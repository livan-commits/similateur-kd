#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "kode.h"

#define SPOTIFY_ART_WIDTH 112U
#define SPOTIFY_ART_HEIGHT 112U
#define SPOTIFY_ART_BYTES (SPOTIFY_ART_WIDTH * SPOTIFY_ART_HEIGHT * 2U)

typedef enum {
    SPOTIFY_CMD_PLAY_PAUSE = 0x01,
    SPOTIFY_CMD_PREVIOUS = 0x02,
    SPOTIFY_CMD_NEXT = 0x03,
    SPOTIFY_CMD_VOLUME_UP = 0x04,
    SPOTIFY_CMD_VOLUME_DOWN = 0x05
} spotify_command_t;

bool spotify_ble_send(spotify_command_t command);
bool spotify_ble_get_phone_state(char *out, size_t out_size);
bool spotify_ble_take_artwork(const uint8_t **pixels);
void spotify_ble_on_phone_state(const kode_event_t *event);
void spotify_ble_on_artwork(const struct kode_event *event);
