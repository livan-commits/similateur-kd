idf_component_register(
    SRCS "spotify_main.c" "spotify_ble.c" "spotify_ui.c"
    INCLUDE_DIRS "."
    REQUIRES kode
    PRIV_REQUIRES kscreen
)
