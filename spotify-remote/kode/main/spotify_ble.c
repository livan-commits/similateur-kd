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
#define SPOTIFY_CHR_ARTWORK "artwork"
#define ART_PACKET_MAGIC 0xA1U
#define ART_PACKET_HEADER 5U
#define ART_CHUNK_BYTES (KODE_SYS_BLE_VALUE_MAX - ART_PACKET_HEADER)
#define ART_CHUNKS ((SPOTIFY_ART_BYTES + ART_CHUNK_BYTES - 1U) / ART_CHUNK_BYTES)

static portMUX_TYPE s_state_mux = portMUX_INITIALIZER_UNLOCKED;
static char s_phone_state[180] = "Waiting for Android companion";
static uint8_t s_artwork[SPOTIFY_ART_BYTES];
static uint16_t s_next_art_chunk;
static bool s_artwork_ready;

bool spotify_ble_send(spotify_command_t command)
{
    const uint8_t value = (uint8_t)command;
    const bool ok = kode_ble_notify(SPOTIFY_CHR_COMMAND, &value, sizeof(value));
    if (!ok) KLOG_W(TAG, "BLE command not sent: %s", kode_error());
    return ok;
}

bool spotify_ble_get_phone_state(char *out, size_t out_size)
{
    if ((out == NULL) || (out_size == 0U)) return false;
    portENTER_CRITICAL(&s_state_mux);
    size_t length = strlen(s_phone_state);
    if (length >= out_size) length = out_size - 1U;
    memcpy(out, s_phone_state, length);
    out[length] = '\0';
    portEXIT_CRITICAL(&s_state_mux);
    return true;
}

bool spotify_ble_take_artwork(const uint8_t **pixels)
{
    if (pixels == NULL) return false;
    bool ready;
    portENTER_CRITICAL(&s_state_mux);
    ready = s_artwork_ready;
    if (ready) s_artwork_ready = false;
    portEXIT_CRITICAL(&s_state_mux);
    if (ready) *pixels = s_artwork;
    return ready;
}

void spotify_ble_on_phone_state(const kode_event_t *event)
{
    if ((event == NULL) || (event->source == NULL) ||
        (strcmp(event->source, SPOTIFY_CHR_PHONE_STATE) != 0) ||
        (event->value <= 0) || (event->text == NULL)) return;

    size_t length = (size_t)event->value;
    if (length >= sizeof(s_phone_state)) length = sizeof(s_phone_state) - 1U;
    portENTER_CRITICAL(&s_state_mux);
    memcpy(s_phone_state, event->text, length);
    s_phone_state[length] = '\0';
    for (size_t i = 0U; i < length; i++) {
        if (s_phone_state[i] == '|') s_phone_state[i] = '\n';
    }
    portEXIT_CRITICAL(&s_state_mux);
    KLOG_I(TAG, "phone media state updated");
}

/* Each write is one bounded binary packet: magic, big-endian chunk index,
 * big-endian chunk count, then RGB565 little-endian pixels. The Android side
 * sends writes serially and the listener assembles them in order. */
void spotify_ble_on_artwork(const kode_event_t *event)
{
    if ((event == NULL) || (event->source == NULL) ||
        (strcmp(event->source, SPOTIFY_CHR_ARTWORK) != 0) ||
        (event->value < (int32_t)ART_PACKET_HEADER) || (event->text == NULL)) return;

    const uint8_t *packet = (const uint8_t *)event->text;
    const uint16_t index = (uint16_t)(((uint16_t)packet[1] << 8) | packet[2]);
    const uint16_t total = (uint16_t)(((uint16_t)packet[3] << 8) | packet[4]);
    if ((packet[0] != ART_PACKET_MAGIC) || (total != ART_CHUNKS) ||
        (index >= total)) return;

    const uint32_t offset = (uint32_t)index * ART_CHUNK_BYTES;
    uint32_t count = (uint32_t)event->value - ART_PACKET_HEADER;
    if (count > (SPOTIFY_ART_BYTES - offset)) count = SPOTIFY_ART_BYTES - offset;
    if ((index == 0U) && (count != 0U)) {
        s_next_art_chunk = 0U;
        s_artwork_ready = false;
    }
    if (index != s_next_art_chunk) {
        KLOG_W(TAG, "artwork chunk out of order: %u, expected %u",
               (unsigned)index, (unsigned)s_next_art_chunk);
        return;
    }
    memcpy(&s_artwork[offset], &packet[ART_PACKET_HEADER], count);
    s_next_art_chunk++;
    if (s_next_art_chunk == ART_CHUNKS) {
        portENTER_CRITICAL(&s_state_mux);
        s_artwork_ready = true;
        portEXIT_CRITICAL(&s_state_mux);
        KLOG_I(TAG, "album artwork received (%u bytes)", (unsigned)SPOTIFY_ART_BYTES);
    }
}
