# Spotify Remote for Kode Dot

Independent native Kode Dot app plus Android companion. The Dot talks to the phone over a custom BLE GATT service; the Android companion controls the active Spotify Android MediaSession. No Spotify Premium or Spotify Web API credentials are used.

## Architecture

- `kode/`: native Kode SDK v0.1.1 application for the ESP32-P4 / Kode Dot.
- `android/`: Android companion. It needs Notification access to enumerate active media sessions and Bluetooth permissions to connect to the Dot.
- BLE service UUID: `8f3c0001-5b7e-4a52-9d2e-6b1f0c7a4e21`
- Command characteristic UUID: `8f3c0002-5b7e-4a52-9d2e-6b1f0c7a4e21`
- Phone-state characteristic UUID: `8f3c0003-5b7e-4a52-9d2e-6b1f0c7a4e21`

## BLE protocol

Dot to phone (notification, one byte):
- `0x01`: play/pause
- `0x02`: previous
- `0x03`: next
- `0x04`: volume up
- `0x05`: volume down

Phone to Dot (write, UTF-8 text):
- `title|artist|state` (state is `playing`, `paused`, or `idle`).
- Payload is best-effort and truncated to the negotiated ATT payload size. The current firmware logs it; rendering live metadata is the next UI integration task.

## Build the Kode app

Use the KodeOS / ESP-IDF 6.1 environment and the official Kode SDK v0.1.1:

```sh
cd spotify-remote/kode
idf.py set-target esp32p4
idf.py build
```

The resulting firmware image is `build/spotify_remote.bin`. Install using the official KodeOS `tools/kcli.py` command for your connected Dot.

## Download the Android APK\n\nThe debug APK is published as a GitHub Actions artifact after each successful Android build: [Android companion build runs](https://github.com/livan-commits/similateur-kd/actions/workflows/spotify-remote-android.yml). Open the latest successful run and download the `kode-spotify-remote-debug` artifact.\n\n## Build the Android companion

Open `spotify-remote/android` in Android Studio and build the `app` debug variant. On the phone:
1. Install and open Kode Spotify Remote.
2. Grant Bluetooth permissions.
3. Enable its Notification access in Android Settings.
4. Keep Spotify running on the phone. The companion scans for the Kode Dot BLE service and connects when it is advertising.

## Current limitations

- This is a first implementation scaffold; it has not been compiled or tested on physical hardware in this environment.
- The native Dot UI currently exposes the transport controls and sends BLE commands; live title/artist rendering is not yet wired into the LVGL screen.
- Android MediaSession access depends on Android granting Notification access and Spotify exposing an active session.
- Volume keys adjust the phone's music stream volume.
