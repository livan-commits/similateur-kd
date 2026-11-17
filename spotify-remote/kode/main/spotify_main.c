/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "kode.h"
#include "kode_log.h"
#include "spotify_ble.h"
#include "spotify_ui.h"

#define TAG "spotify_remote"
#define BLE_NAME "Kode Spotify Remote"
#define SERVICE_UUID "8f3c0001-5b7e-4a52-9d2e-6b1f0c7a4e21"
#define COMMAND_UUID "8f3c0002-5b7e-4a52-9d2e-6b1f0c7a4e21"
#define PHONE_STATE_UUID "8f3c0003-5b7e-4a52-9d2e-6b1f0c7a4e21"

KODE_APP_MANIFEST("Spotify Remote", "media");

static const kode_ble_characteristic_t s_spotify_chars[] = {
    { "command", COMMAND_UUID, KODE_BLE_READ | KODE_BLE_NOTIFY },
    { "phone_state", PHONE_STATE_UUID, KODE_BLE_WRITE }
};
KODE_BLE_SERVICE(SERVICE_UUID, s_spotify_chars);

extern void spotify_ble_on_phone_state(const kode_event_t *event);

static void on_ble_written(const kode_event_t *event)
{
    spotify_ble_on_phone_state(event);
}

static void on_ble_link(const kode_event_t *event)
{
    if (event != NULL) {
        KLOG_I(TAG, "%s", event->name);
    }
}

void app_main(void)
{
    kode_init();

    if (!kode_ble_set_name(BLE_NAME)) {
        KLOG_W(TAG, "could not set BLE name: %s", kode_error());
    }
    if (!kode_event_add_listener(KODE_EVENT_BLE_WRITTEN, &on_ble_written)) {
        KLOG_E(TAG, "could not subscribe to BLE writes: %s", kode_error());
    }
    (void)kode_event_add_listener(KODE_EVENT_BLE_CONNECTED, &on_ble_link);
    (void)kode_event_add_listener(KODE_EVENT_BLE_DISCONNECTED, &on_ble_link);

    SpotifyUi_ctor();
    SpotifyUi_start();

    KLOG_I(TAG, "Spotify Remote ready; connect the Android companion over BLE");
}
