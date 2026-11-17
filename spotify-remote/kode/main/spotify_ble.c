/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <freertos/FreeRTOS.h>
#include "kode.h"
#include "kode_log.h"
#include "spotify_ble.h"

#define TAG "spotify_ble"
#define SPOTIFY_CHR_COMMAND "command"
#define SPOTIFY_CHR_PHONE_STATE "phone_state"

static portMUX_TYPE s_state_mux = portMUX_INITIALIZER_UNLOCKED;
static char s_phone_state[180] = "Waiting for Android companion";

bool spotify_ble_send(spotify_command_t command)
{
    const uint8_t value = (uint8_t)command;
    const bool ok = kode_ble_notify(SPOTIFY_CHR_COMMAND, &value, sizeof(value));
    if (!ok) {
        KLOG_W(TAG, "BLE command not sent: %s", kode_error());
    }
    return ok;
}

bool spotify_ble_get_phone_state(char *out, size_t out_size)
{
    if ((out == NULL) || (out_size == 0U)) {
        return false;
    }
    portENTER_CRITICAL(&s_state_mux);
    size_t length = strlen(s_phone_state);
    if (length >= out_size) length = out_size - 1U;
    memcpy(out, s_phone_state, length);
    out[length] = '\0';
    portEXIT_CRITICAL(&s_state_mux);
    return true;
}

/* Called by the Kode BLE event dispatcher. Keep the callback short: it only
 * validates and logs the latest phone metadata. LVGL is owned by its AO and
 * must not be touched from this callback thread. */
void spotify_ble_on_phone_state(const kode_event_t *event)
{
    if ((event != NULL) &&
        (event->source != NULL) &&
        (strcmp(event->source, SPOTIFY_CHR_PHONE_STATE) == 0) &&
        (event->value > 0) &&
        (event->text != NULL)) {
        size_t length = (size_t)event->value;
        if (length >= sizeof(s_phone_state)) {
            length = sizeof(s_phone_state) - 1U;
        }
        portENTER_CRITICAL(&s_state_mux);
        memcpy(s_phone_state, event->text, length);
        s_phone_state[length] = '\0';
        for (size_t i = 0U; i < length; i++) {
            if (s_phone_state[i] == '|') {
                s_phone_state[i] = '\n';
            }
        }
        portEXIT_CRITICAL(&s_state_mux);
        KLOG_I(TAG, "phone media state updated");
    }
}
