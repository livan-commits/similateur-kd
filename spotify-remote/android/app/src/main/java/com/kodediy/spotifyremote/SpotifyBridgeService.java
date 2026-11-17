package com.kodediy.spotifyremote;

import android.Manifest;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothStatusCodes;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public final class SpotifyBridgeService extends NotificationListenerService {
    private static final String TAG = "KodeSpotifyBridge";
    private static final UUID SERVICE_UUID = UUID.fromString("8f3c0001-5b7e-4a52-9d2e-6b1f0c7a4e21");
    private static final UUID COMMAND_UUID = UUID.fromString("8f3c0002-5b7e-4a52-9d2e-6b1f0c7a4e21");
    private static final UUID PHONE_STATE_UUID = UUID.fromString("8f3c0003-5b7e-4a52-9d2e-6b1f0c7a4e21");
    private static final UUID ARTWORK_UUID = UUID.fromString("8f3c0004-5b7e-4a52-9d2e-6b1f0c7a4e21");
    private static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final int ART_W = 112, ART_H = 112, ART_BYTES = ART_W * ART_H * 2;
    private static final int ART_PACKET_DATA = 507;
    private static final int ART_CHUNKS = (ART_BYTES + ART_PACKET_DATA - 1) / ART_PACKET_DATA;

    private static final class PendingWrite {
        final BluetoothGattCharacteristic characteristic;
        final byte[] value;
        PendingWrite(BluetoothGattCharacteristic c, byte[] v) { characteristic = c; value = v; }
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayDeque<PendingWrite> writes = new ArrayDeque<>();
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic phoneState;
    private BluetoothGattCharacteristic artwork;
    private MediaController spotify;
    private MediaController.Callback mediaCallback;
    private boolean scanning, writeInFlight;
    private String lastArtworkTrack = "";

    @Override public void onListenerConnected() {
        super.onListenerConnected();
        Log.i(TAG, "Notification listener connected");
        connectMediaSession();
        startBleScan();
    }

    @Override public void onListenerDisconnected() {
        stopBleScan();
        if (gatt != null) gatt.close();
        gatt = null;
        phoneState = null;
        artwork = null;
        writes.clear();
        writeInFlight = false;
        super.onListenerDisconnected();
    }

    @Override public void onNotificationPosted(android.service.notification.StatusBarNotification sbn) {
        connectMediaSession();
    }

    private void connectMediaSession() {
        try {
            MediaSessionManager manager = (MediaSessionManager) getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> sessions = manager.getActiveSessions(new ComponentName(this, SpotifyBridgeService.class));
            MediaController found = null;
            for (MediaController c : sessions) {
                if ("com.spotify.music".equals(c.getPackageName())) { found = c; break; }
            }
            if (spotify != found) {
                if (spotify != null && mediaCallback != null) spotify.unregisterCallback(mediaCallback);
                spotify = found;
                if (spotify != null) {
                    mediaCallback = new MediaController.Callback() {
                        @Override public void onMetadataChanged(MediaMetadata metadata) {
                            lastArtworkTrack = "";
                            sendPhoneState();
                        }
                        @Override public void onPlaybackStateChanged(PlaybackState state) { sendPhoneState(); }
                    };
                    spotify.registerCallback(mediaCallback);
                }
            }
            sendPhoneState();
        } catch (SecurityException e) {
            Log.w(TAG, "Notification access is not enabled yet", e);
        }
    }

    private void handleDotCommand(byte command) {
        connectMediaSession();
        if (command == 0x04 || command == 0x05) {
            AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
            audio.adjustStreamVolume(AudioManager.STREAM_MUSIC,
                command == 0x04 ? AudioManager.ADJUST_RAISE : AudioManager.ADJUST_LOWER, 0);
            return;
        }
        if (spotify == null) return;
        MediaController.TransportControls controls = spotify.getTransportControls();
        PlaybackState state = spotify.getPlaybackState();
        boolean playing = state != null && state.getState() == PlaybackState.STATE_PLAYING;
        switch (command) {
            case 0x01: if (playing) controls.pause(); else controls.play(); break;
            case 0x02: controls.skipToPrevious(); break;
            case 0x03: controls.skipToNext(); break;
            default: Log.w(TAG, "Unknown Dot command: " + command);
        }
        handler.postDelayed(this::sendPhoneState, 350);
    }

    private void sendPhoneState() {
        if (phoneState == null || gatt == null) return;
        String title = "Spotify", artist = "", state = "idle";
        MediaMetadata metadata = null;
        if (spotify != null) {
            metadata = spotify.getMetadata();
            if (metadata != null) {
                String t = metadata.getString(MediaMetadata.METADATA_KEY_TITLE);
                String a = metadata.getString(MediaMetadata.METADATA_KEY_ARTIST);
                if (t != null) title = t;
                if (a != null) artist = a;
            }
            PlaybackState playback = spotify.getPlaybackState();
            if (playback != null) state = playback.getState() == PlaybackState.STATE_PLAYING ? "playing" : "paused";
        }
        String payload = (title + "|" + artist + "|" + state).replace("\n", " ");
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 180) {
            byte[] shortened = new byte[180];
            System.arraycopy(bytes, 0, shortened, 0, shortened.length);
            bytes = shortened;
        }
        enqueueWrite(phoneState, bytes);
        if (metadata != null) enqueueArtworkIfChanged(metadata, title, artist);
    }

    private void enqueueArtworkIfChanged(MediaMetadata metadata, String title, String artist) {
        if (artwork == null || gatt == null) return;
        String track = title + "\u0000" + artist;
        if (track.equals(lastArtworkTrack)) return;
        Bitmap source = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (source == null) source = metadata.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (source == null) source = metadata.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        if (source == null) return;
        lastArtworkTrack = track;
        Bitmap scaled = Bitmap.createScaledBitmap(source, ART_W, ART_H, true);
        int[] colors = new int[ART_W * ART_H];
        scaled.getPixels(colors, 0, ART_W, 0, 0, ART_W, ART_H);
        byte[] rgb565 = new byte[ART_BYTES];
        for (int i = 0; i < colors.length; i++) {
            int c = colors[i];
            int r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
            int v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
            rgb565[i * 2] = (byte) (v & 0xff);
            rgb565[i * 2 + 1] = (byte) ((v >> 8) & 0xff);
        }
        if (scaled != source) scaled.recycle();
        for (int index = 0; index < ART_CHUNKS; index++) {
            int offset = index * ART_PACKET_DATA;
            int count = Math.min(ART_PACKET_DATA, ART_BYTES - offset);
            byte[] packet = new byte[5 + count];
            packet[0] = (byte) 0xA1;
            packet[1] = (byte) ((index >> 8) & 0xff);
            packet[2] = (byte) (index & 0xff);
            packet[3] = (byte) ((ART_CHUNKS >> 8) & 0xff);
            packet[4] = (byte) (ART_CHUNKS & 0xff);
            System.arraycopy(rgb565, offset, packet, 5, count);
            enqueueWrite(artwork, packet);
        }
        Log.i(TAG, "Queued album artwork transfer for " + title);
    }

    private void enqueueWrite(BluetoothGattCharacteristic characteristic, byte[] value) {
        writes.add(new PendingWrite(characteristic, value));
        writeNext();
    }

    private void writeNext() {
        if (writeInFlight || gatt == null || writes.isEmpty()) return;
        PendingWrite next = writes.peek();
        if (next == null) return;
        writeInFlight = true;
        boolean accepted;
        if (Build.VERSION.SDK_INT >= 33) {
            accepted = gatt.writeCharacteristic(next.characteristic, next.value,
                BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS;
        } else {
            next.characteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
            next.characteristic.setValue(next.value);
            accepted = gatt.writeCharacteristic(next.characteristic);
        }
        if (!accepted) {
            writeInFlight = false;
            writes.poll();
            handler.postDelayed(this::writeNext, 100);
        }
    }

    private void startBleScan() {
        if (Build.VERSION.SDK_INT >= 31 &&
            checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) return;
        BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        BluetoothLeScanner scanner = manager.getAdapter().getBluetoothLeScanner();
        if (scanner == null || scanning) return;
        ScanFilter filter = new ScanFilter.Builder().setServiceUuid(new android.os.ParcelUuid(SERVICE_UUID)).build();
        ScanSettings settings = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        scanner.startScan(Collections.singletonList(filter), settings, scanCallback);
        scanning = true;
    }

    private void stopBleScan() {
        if (!scanning) return;
        try {
            BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
            manager.getAdapter().getBluetoothLeScanner().stopScan(scanCallback);
        } catch (SecurityException ignored) { }
        scanning = false;
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            stopBleScan();
            if (Build.VERSION.SDK_INT >= 31 &&
                checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return;
            gatt = device.connectGatt(SpotifyBridgeService.this, false, gattCallback);
        }
        @Override public void onScanFailed(int errorCode) {
            Log.e(TAG, "BLE scan failed: " + errorCode);
            scanning = false;
        }
    };

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt bluetoothGatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                bluetoothGatt.discoverServices();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                phoneState = null;
                artwork = null;
                writes.clear();
                writeInFlight = false;
                bluetoothGatt.close();
                gatt = null;
                handler.postDelayed(SpotifyBridgeService.this::startBleScan, 2000);
            }
        }

        @Override public void onServicesDiscovered(BluetoothGatt bluetoothGatt, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) return;
            BluetoothGattService service = bluetoothGatt.getService(SERVICE_UUID);
            if (service == null) return;
            BluetoothGattCharacteristic command = service.getCharacteristic(COMMAND_UUID);
            phoneState = service.getCharacteristic(PHONE_STATE_UUID);
            artwork = service.getCharacteristic(ARTWORK_UUID);
            if (command != null) {
                bluetoothGatt.setCharacteristicNotification(command, true);
                BluetoothGattDescriptor descriptor = command.getDescriptor(CCCD_UUID);
                if (descriptor != null) {
                    if (Build.VERSION.SDK_INT >= 33) {
                        bluetoothGatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    } else {
                        descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                        bluetoothGatt.writeDescriptor(descriptor);
                    }
                } else {
                    bluetoothGatt.requestMtu(517);
                }
            }
        }

        @Override public void onDescriptorWrite(BluetoothGatt bluetoothGatt, BluetoothGattDescriptor descriptor, int status) {
            if (CCCD_UUID.equals(descriptor.getUuid())) bluetoothGatt.requestMtu(517);
        }

        @Override public void onCharacteristicWrite(BluetoothGatt bluetoothGatt,
                BluetoothGattCharacteristic characteristic, int status) {
            writes.poll();
            writeInFlight = false;
            if (status != BluetoothGatt.GATT_SUCCESS) Log.w(TAG, "GATT write failed: " + status);
            writeNext();
        }

        @Override public void onCharacteristicChanged(BluetoothGatt bluetoothGatt,
                BluetoothGattCharacteristic characteristic, byte[] value) {
            if (COMMAND_UUID.equals(characteristic.getUuid()) && value.length > 0) handleDotCommand(value[0]);
        }

        @Override public void onMtuChanged(BluetoothGatt bluetoothGatt, int mtu, int status) {
            Log.i(TAG, "BLE MTU " + mtu);
            sendPhoneState();
        }
    };
}
