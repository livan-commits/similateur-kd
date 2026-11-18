/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Host profile: official KGUI screen builders, without firmware-only screens. */
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "kui_sim.h"
#include "kgui_screens.h"

#define SUBJECT_TEXT_LEN 256U

lv_obj_t *kgui_screen_loading = NULL;
lv_obj_t *kgui_screen_settings = NULL;

lv_subject_t *kgui_subject_app_count = NULL;
lv_subject_t *kgui_subject_empty_text = NULL;
lv_subject_t *kgui_subject_loading_text = NULL;
lv_subject_t *kgui_subject_tp_text = NULL;

static char empty_text[SUBJECT_TEXT_LEN], empty_prev[SUBJECT_TEXT_LEN];
static char loading_text[SUBJECT_TEXT_LEN], loading_prev[SUBJECT_TEXT_LEN];
static char tp_text[SUBJECT_TEXT_LEN], tp_prev[SUBJECT_TEXT_LEN];
static int s_clock_minute = -1;
static int s_clock_day = -1;

/* Windows has localtime_s, POSIX has localtime_r; wrap both. */
static struct tm *host_localtime(const time_t *now, struct tm *out)
{
#if defined(_WIN32)
    return localtime_s(out, now) == 0 ? out : NULL;
#else
    return localtime_r(now, out);
#endif
}

static void browser_clock_tick(lv_timer_t *timer)
{
    LV_UNUSED(timer);
    time_t now = time(NULL);
    struct tm local;
    if (host_localtime(&now, &local) == NULL) return;

    if (s_clock_minute != local.tm_min) {
        kgui_screen_face_time(local.tm_hour, local.tm_min, false, false);
        s_clock_minute = local.tm_min;
    }
    if (s_clock_day != local.tm_yday) {
        char date[32];
#if defined(_WIN32)
        /* MSVCRT's strftime has no %e (blank-padded day of month). */
        const char *date_fmt = "%a %d %b";
#else
        const char *date_fmt = "%a %e %b";
#endif
        if (strftime(date, sizeof(date), date_fmt, &local) > 0U) {
            lv_obj_t *label = lv_obj_find_by_name(kgui_screen_face, "face_date");
            if (label != NULL) lv_label_set_text(label, date);
        }
        s_clock_day = local.tm_yday;
    }
}

static lv_obj_t *get_face(void) { return kgui_screen_face; }
static lv_obj_t *get_launcher(void) { return kgui_screen_launcher; }
static lv_obj_t *get_touch_test(void) { return kgui_screen_touch_test; }
static lv_obj_t *get_loading(void) { return kgui_screen_loading; }
static lv_obj_t *get_settings(void) { return kgui_screen_settings; }

const kui_sim_screen_t kui_sim_screens[] = {
    { "face", get_face },
    { "launcher", get_launcher },
    { "touch_test", get_touch_test },
    { "loading", get_loading },
    { "settings", get_settings },
};
const uint32_t kui_sim_screen_count =
    (uint32_t)(sizeof(kui_sim_screens) / sizeof(kui_sim_screens[0]));

static lv_subject_t *int_subject(int32_t value)
{
    lv_subject_t *subject = lv_subject_create(LV_SUBJECT_TYPE_INT);
    if (subject != NULL) lv_subject_set_int(subject, value);
    return subject;
}

static lv_subject_t *string_subject(char *buf, char *prev, const char *value)
{
    lv_subject_t *subject = lv_subject_create(LV_SUBJECT_TYPE_STRING);
    if (subject != NULL) {
        lv_subject_set_string_buffer_static(subject, buf, prev, SUBJECT_TEXT_LEN);
        lv_subject_set_string(subject, value);
    }
    return subject;
}

bool kgui_clock_known(int32_t hour, int32_t minute)
{
    return hour >= 0 && hour < KGUI_CLOCK_HOURS &&
           minute >= 0 && minute < KGUI_CLOCK_MINUTES;
}

int32_t kgui_clock_hour(int32_t hour, bool h12)
{
    if (!h12) return hour;
    int32_t value = hour % KGUI_CLOCK_HOURS_12;
    return value == 0 ? KGUI_CLOCK_HOURS_12 : value;
}

void kgui_screens_init(void)
{
    if (kgui_subject_app_count != NULL) return;
    kgui_subject_app_count = int_subject(0);
    kgui_subject_empty_text = string_subject(
        empty_text, empty_prev, "No apps yet.        ");
    kgui_subject_loading_text = string_subject(
        loading_text, loading_prev, "Installing...                             ");
    kgui_subject_tp_text = string_subject(
        tp_text, tp_prev, "Tap the target  (1/5)                     ");

    /* These are the unchanged KodeOS screen builders. */
    kgui_screen_face_build();
    kgui_screen_launcher_build();
    kgui_screen_loading_build();
    kgui_screen_settings_build();
    kgui_screen_touch_test_build();

    /* This graphical host has no firmware clock or battery service. */
    time_t now = time(NULL);
    struct tm local;
    if (host_localtime(&now, &local) != NULL) {
        kgui_screen_face_time(local.tm_hour, local.tm_min, false, false);
    }
    kgui_screen_face_date(true);
    /* LVGL timers are serviced by the Emscripten browser main loop. */
    browser_clock_tick(NULL);
    (void)lv_timer_create(browser_clock_tick, 1000U, NULL);
    kgui_screen_face_pile(true, 85U, KGUI_PILE_MEDIUM, false);
    kgui_screen_settings_battery(85U, lv_color_hex(0x4f9b73U));
    kgui_screen_settings_level(100U);
    kgui_screen_settings_volume(70U);
}

void kui_sim_setup(void)
{
    kgui_screens_init();
}

static bool parse_int(const char *value, int32_t *out)
{
    char *end = NULL;
    long parsed = strtol(value, &end, 10);
    if (end == value || *end != '\0') return false;
    *out = (int32_t)parsed;
    return true;
}

bool kui_sim_set(const char *subject, const char *value)
{
    int32_t number = 0;
    if (strcmp(subject, "app_count") == 0) {
        if (!parse_int(value, &number)) return false;
        lv_subject_set_int(kgui_subject_app_count, number);
        return true;
    }
    if (strcmp(subject, "empty_text") == 0) {
        lv_subject_set_string(kgui_subject_empty_text, value);
        return true;
    }
    if (strcmp(subject, "tp_text") == 0) {
        lv_subject_set_string(kgui_subject_tp_text, value);
        return true;
    }
    return false;
}
