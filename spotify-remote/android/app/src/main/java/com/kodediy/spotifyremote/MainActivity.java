package com.kodediy.spotifyremote;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private TextView status;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 36, 28, 28);
        root.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView title = new TextView(this);
        title.setText("KODE SPOTIFY REMOTE");
        title.setTextSize(24);
        root.addView(title);

        status = new TextView(this);
        status.setText("1. Autorise Bluetooth\n2. Active l'accès aux notifications\n3. Lance Spotify et connecte le Kode Dot");
        status.setTextSize(16);
        status.setPadding(0, 24, 0, 24);
        root.addView(status);

        Button bluetooth = new Button(this);
        bluetooth.setText("Autoriser Bluetooth");
        bluetooth.setOnClickListener(v -> requestBluetooth());
        root.addView(bluetooth);

        Button notifications = new Button(this);
        notifications.setText("Activer l'accès aux notifications");
        notifications.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        root.addView(notifications);

        Button refresh = new Button(this);
        refresh.setText("Vérifier les autorisations");
        refresh.setOnClickListener(v -> updateStatus());
        root.addView(refresh);
        setContentView(root);
        updateStatus();
    }

    private void requestBluetooth() {
        if (Build.VERSION.SDK_INT >= 31) {
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}, 42);
        } else {
            updateStatus();
        }
    }

    private void updateStatus() {
        boolean bt = Build.VERSION.SDK_INT < 31 ||
            (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
             checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED);
        boolean listener = false;
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (enabled != null) listener = enabled.contains(getPackageName());
        status.setText("Bluetooth : " + (bt ? "autorisé" : "à autoriser") +
            "\nAccès notifications : " + (listener ? "activé" : "à activer") +
            "\n\nL'application cherche le service BLE du Kode Dot dès que l'accès aux notifications est accordé.");
    }

    @Override protected void onResume() { super.onResume(); updateStatus(); }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        updateStatus();
    }
}
