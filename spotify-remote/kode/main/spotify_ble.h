#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

typedef enum {
    SPOTIFY_CMD_PLAY_PAUSE = 0x01,
    SPOTIFY_CMD_PREVIOUS = 0x02,
    SPOTIFY_CMD_NEXT = 0x03,
    SPOTIFY_CMD_VOLUME_UP = 0x04,
    SPOTIFY_CMD_VOLUME_DOWN = 0x05
} spotify_command_t;

bool spotify_ble_send(spotify_command_t command);
bool spotify_ble_get_phone_state(char *out, size_t out_size);
