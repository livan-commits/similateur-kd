/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdbool.h>
#include <stdint.h>
#include "kode.h"
#include "kode_log.h"
#include "spotify_ble.h"

#define TAG "spotify_ble"
#define SPOTIFY_CHR_COMMAND "command"
#define SPOTIFY_CHR_PHONE_STATE "phone_state"

bool spotify_ble_send(spotify_command_t command)
{
    const uint8_t value = (uint8_t)command;
    const bool ok = kode_ble_notify(SPOTIFY_CHR_COMMAND, &value, sizeof(value));
    if (!ok) {
        KLOG_W(TAG, "BLE command not sent: %s", kode_error());
    }
    return ok;
}

/* Called by the Kode BLE event dispatcher. Keep the callback short: it only
 * validates and logs the latest phone metadata. LVGL is owned by its AO and
 * must not be touched from this callback thread. */
void spotify_ble_on_phone_state(const kode_event_t *event)
{
    if ((event != NULL) &&
        (event->source != NULL) &&
        (strcmp(event->source, SPOTIFY_CHR_PHONE_STATE) == 0) &&
        (event->value > 0)) {
        KLOG_I(TAG, "phone state received (%ld bytes)", (long)event->value);
    }
}
