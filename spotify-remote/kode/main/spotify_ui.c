/* SPDX-License-Identifier: GPL-3.0-or-later */
/**
 * @file display_lvgl_ao.c
 * @brief LVGL on the glass, from an Active Object of your own.
 */
#include "spotify_ui.h"
#include "spotify_ble.h"

#include "kscreen.h"

#define TAG "spotify_ui"

/** Where the lines sit, in pixels from the middle of the glass. Well inside
 *  the corners, and far enough apart not to touch at these sizes. */
#define SR_TIME_DY          (-215)
#define SR_DATE_DY          (-190)
#define SR_TITLE_DY         (-165)
#define SR_COUNT_DY         (65)
#define SR_TOUCH_DY         105
#define SR_BRIGHT_DY        140
#define SR_HINT_DY          180
#define SR_HINT2_DY         205

/** How often the time on the glass is read again, ms. */
#define SR_CLOCK_MS         1000U

/** How far one press of up or down moves the brightness, per cent. */

/** Days in a week: kode_sys_time_t's weekday runs 0 (Sunday) to 6. */
#define SR_WEEK_DAYS        7U

/** @brief This AO's private signals. Posted to itself, never published. */
enum SpotifyUiSignals {
    SR_TICK_SIG = MAX_SIG,  /**< The render pass: kscreen's one-shot.  */
    SR_CLOCK_SIG            /**< The time on the glass: a one-shot too. */
};

/** @brief The AO's own state, private to this file. */
typedef struct {
    QActive    super;
    kscreen_t  screen;    /**< LVGL on the glass, driven from this AO.   */
    QTimeEvt   clock;     /**< Reads the local time once a second.        */
    lv_obj_t * count;     /**< The transport status label. */
    lv_obj_t * art;       /**< Album artwork, backed by the BLE RGB565 buffer. */
    lv_obj_t * time;      /**< The local time.                            */
    lv_obj_t * date;      /**< The local date, or why there is none.      */
    lv_obj_t * touch;     /**< The finger's point.                        */
    lv_obj_t * bright;    /**< The brightness this AO set.                */
    uint32_t   presses;   /**< Presses and taps since the panel came up.  */
} SpotifyUi;

/* The queue and the stack, written out as the reference example does. The
 * queue's depth follows kode_sys.h's one queue rule ("Queue depth"): no
 * request, the two one-shot timers, a button's press and release, and
 * TOUCH_EVT_SIG, which AO_Touch publishes at most every KODE_TOUCH_POLL_MS
 * (10 ms) while a finger moves. A render pass holds this AO while it waits
 * for the flush, about one frame (kscreen.h: about 59 a second for a
 * whole-screen change), so a sample or two waits behind it and
 * KQP_AO_QUEUE_LEN has room to spare. The stack is the other interesting
 * number: LVGL renders on it, and 8 KB is what the launcher's renderer runs
 * on, with a far heavier tree than this one. */
static QEvtPtr     l_queue[KQP_AO_QUEUE_LEN];
static StackType_t l_stack[KQP_AO_STACK_BYTES / sizeof(StackType_t)];

static SpotifyUi l_ao;
static lv_image_dsc_t s_art_dsc;
QActive * const AO_SpotifyUi = &l_ao.super;

static QState SpotifyUi_initial(SpotifyUi * const me, void const * const par);
static QState SpotifyUi_running(SpotifyUi * const me, QEvt const * const e);
static QState SpotifyUi_waiting(SpotifyUi * const me, QEvt const * const e);
static QState SpotifyUi_drawing(SpotifyUi * const me, QEvt const * const e);

/* ---- What is on the glass ------------------------------------------------ */
/* Only this AO's thread calls lv_*, which is why LVGL needs no lock. */

/**
 * @brief One centred line of text on the active screen.
 *
 * @param text   What it says.
 * @param font   Which of the fonts sdkconfig.defaults compiled in.
 * @param colour Its colour; the screen behind it is black.
 * @param dy     Pixels from the middle of the glass, positive is down.
 * @return The label, which LVGL owns.
 */
static lv_obj_t * line_new(const char * text, const lv_font_t * font,
                           lv_color_t colour, int32_t dy)
{
    lv_obj_t * const label = lv_label_create(lv_screen_active());

    lv_label_set_text(label, text);
    lv_obj_set_style_text_font(label, font, 0);
    lv_obj_set_style_text_color(label, colour, 0);
    lv_obj_align(label, LV_ALIGN_CENTER, 0, dy);
    return label;
}

/**
 * @brief Add one to the counter and show it.
 *
 * @param me The AO.
 */
static void count_bump(SpotifyUi * const me)
{
    (void)spotify_ble_send(SPOTIFY_CMD_PLAY_PAUSE);
    lv_label_set_text(me->count, "PLAY / PAUSE");
    KLOG_I(TAG, "play/pause command sent");
}

/**
 * @brief Show the local time and date, or that the clock is not set.
 *
 * @param me The AO.
 */
static void clock_show(SpotifyUi const * const me)
{
    const uint8_t *art_pixels = NULL;
    if (spotify_ble_take_artwork(&art_pixels)) {
        memset(&s_art_dsc, 0, sizeof(s_art_dsc));
        s_art_dsc.header.magic = LV_IMAGE_HEADER_MAGIC;
        s_art_dsc.header.cf = LV_COLOR_FORMAT_RGB565;
        s_art_dsc.header.w = SPOTIFY_ART_WIDTH;
        s_art_dsc.header.h = SPOTIFY_ART_HEIGHT;
        s_art_dsc.header.stride = SPOTIFY_ART_WIDTH * 2U;
        s_art_dsc.data_size = SPOTIFY_ART_BYTES;
        s_art_dsc.data = art_pixels;
        lv_image_set_src(me->art, &s_art_dsc);
        KLOG_I(TAG, "album artwork displayed");
    }
    char media_state[180];
    if (spotify_ble_get_phone_state(media_state, sizeof(media_state))) {
        lv_label_set_text(me->touch, media_state);
    }
    /* The weekday's short name, indexed by kode_sys_time_t's weekday. */
    static const char * const SR_DAYS[SR_WEEK_DAYS] = {
        "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
    };
    kode_sys_time_t now;

    if ( (kode_sys_clock_local(&now) == KODE_OK) && (now.weekday < SR_WEEK_DAYS) )
    {
        lv_label_set_text_fmt(me->time, "%02u:%02u:%02u", (unsigned)now.hour,
                              (unsigned)now.minute, (unsigned)now.second);
        lv_label_set_text_fmt(me->date, "%s %04u-%02u-%02u", SR_DAYS[now.weekday],
                              (unsigned)now.year, (unsigned)now.month,
                              (unsigned)now.day);
    }
    else
    {
        lv_label_set_text(me->time, "--:--:--");
        lv_label_set_text(me->date, "time not set");
    }
}

/**
 * @brief Show where the finger is, from AO_Touch's report.
 *
 * @param me The AO.
 * @param te The report: the point in glass pixels, and whether it is down.
 */
static void touch_show(SpotifyUi const * const me, TouchEvt const * const te)
{
    if ( te->pressed )
    {
        lv_label_set_text_fmt(me->touch, "finger at %d, %d", (int)te->x, (int)te->y);
    }
    else
    {
        lv_label_set_text_fmt(me->touch, "finger lifted at %d, %d", (int)te->x,
                              (int)te->y);
    }
}

/**
 * @brief Move the brightness one step up or down, and show it.
 *
 * kode_sys_screen_brightness() posts to AO_Display and returns; a refusal
 * (KODE_NO_RESOURCES: its queue is full) leaves the level where it was.
 *
 * @param me The AO.
 * @param up true for brighter.
 */
static void tap_cb(lv_event_t * e)
{
    count_bump((SpotifyUi *)lv_event_get_user_data(e));
}

/**
 * @brief Build the screen: the time, a title, the counter, the finger, the
 *        brightness and two hints.
 *
 * Nothing here draws. LVGL marks what changed and the next pass renders it, so
 * this can run in an entry action and cost the step almost nothing.
 *
 * @param me The AO.
 */
static void ui_build(SpotifyUi * const me)
{
    lv_obj_t * const scr = lv_screen_active();

    /* Black, opaque: LVGL's theme would otherwise paint the screen itself. */
    lv_obj_set_style_bg_color(scr, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);
    lv_obj_add_event_cb(scr, &tap_cb, LV_EVENT_CLICKED, me);

    me->time = line_new("--:--:--", &lv_font_montserrat_28, lv_color_white(),
                        SR_TIME_DY);
    me->date = line_new("", &lv_font_montserrat_14,
                        lv_palette_main(LV_PALETTE_GREY), SR_DATE_DY);
    (void)line_new("SPOTIFY REMOTE", &lv_font_montserrat_28,
                   lv_color_white(), SR_TITLE_DY);
    me->art = lv_image_create(scr);
    lv_obj_align(me->art, LV_ALIGN_CENTER, 0, -35);
    me->count = line_new("READY", &lv_font_montserrat_48,
                         lv_palette_main(LV_PALETTE_LIGHT_BLUE), SR_COUNT_DY);
    me->touch = line_new("Waiting for Android companion", &lv_font_montserrat_14,
                         lv_color_white(), SR_TOUCH_DY);
    lv_obj_set_width(me->touch, 360);
    lv_label_set_long_mode(me->touch, LV_LABEL_LONG_DOT);
    me->bright = line_new("", &lv_font_montserrat_14, lv_color_white(),
                          SR_BRIGHT_DY);
    lv_label_set_text(me->bright, "Bluetooth LE controls ready");
    (void)line_new("TOP / TAP: PLAY-PAUSE   BOT: EXIT", &lv_font_montserrat_14,
                   lv_palette_main(LV_PALETTE_GREY), SR_HINT_DY);
    (void)line_new("LEFT: PREV   RIGHT: NEXT   UP/DOWN: VOL", &lv_font_montserrat_14,
                   lv_palette_main(LV_PALETTE_GREY), SR_HINT2_DY);
}

/* ---- The AO -------------------------------------------------------------- */

void SpotifyUi_ctor(void)
{
    SpotifyUi * const me = &l_ao;

    QActive_ctor(&me->super, Q_STATE_CAST(&SpotifyUi_initial));
    kscreen_ctor(&me->screen, &me->super, (enum_t)SR_TICK_SIG);
    QTimeEvt_ctorX(&me->clock, &me->super, (enum_t)SR_CLOCK_SIG, 0U);
    me->count      = NULL;
    me->art        = NULL;
    me->time       = NULL;
    me->date       = NULL;
    me->touch      = NULL;
    me->bright     = NULL;
    me->presses    = 0U;
}

void SpotifyUi_start(void)
{
    QActive_setAttr(AO_SpotifyUi, TASK_NAME_ATTR, "spotify_ui");

    /* KODE_PRIO_USER_GUI, not KODE_PRIO_USER_LOW: it is the level the SDK keeps
     * for a renderer, just above AO_Net and below every owner. Rendering is the
     * heaviest work in the system and the least urgent, and here a slow frame
     * can only ever delay itself. */
    QACTIVE_START(AO_SpotifyUi, KODE_PRIO_USER_GUI,
                  l_queue, Q_DIM(l_queue),
                  l_stack, sizeof(l_stack),
                  (void *)0);
}

/**
 * @brief The initial transition: subscribe, then ask.
 *
 * It runs in the thread that calls SpotifyUi_start(), before the AO's own
 * task exists, and that is after kode_init() has returned - the condition
 * kscreen_start()'s question needs. kscreen_start() subscribes before it asks:
 * the answer can come the instant the question is posted, and an AO that asked
 * first would miss it.
 *
 * @param me  The AO.
 * @param par Unused.
 * @return The transition to SpotifyUi_waiting.
 */
static QState SpotifyUi_initial(SpotifyUi * const me, void const * const par)
{
    (void)par;

    QActive_subscribe(&me->super, BUTTON_EVT_SIG);
    kscreen_start(&me->screen);

    KLOG_I(TAG, "up; asked AO_Display whether the panel is there");
    return Q_TRAN(&SpotifyUi_waiting);
}

/**
 * @brief The parent of both states: what is true whether or not there is a
 *        picture. The bottom button resets the board.
 *
 * @param me The AO; unused, nothing here needs it.
 * @param e  The event.
 * @return Q_HANDLED() for what it handles, Q_SUPER() otherwise.
 */
static QState SpotifyUi_running(SpotifyUi * const me, QEvt const * const e)
{
    QState status;

    (void)me;
    switch ( e->sig )
    {
        case BUTTON_EVT_SIG: {
            ButtonEvt const * const be = (ButtonEvt const *)e;

            /* id is a button's number: KODE_SYS_BUTTON_x in kode_sys.h. */
            if ( be->pressed && (KODE_SYS_BUTTON_BOT == (uint32_t)be->id) )
            {
                /* Posts to AO_Boot, which resets the board a moment later:
                 * into kodeOS after a launcher start, into this app again
                 * after a mailbox install. */
                KLOG_I(TAG, "resetting");
                if ( KODE_OK != kode_sys_exit_to_os() )
                {
                    KLOG_W(TAG, "AO_Boot is busy; press again");
                }
            }
            status = Q_HANDLED();
            break;
        }
        default: {
            status = Q_SUPER(&QHsm_top);
            break;
        }
    }

    return status;
}

/**
 * @brief Waiting for AO_Display's answer: LVGL is not started yet.
 *
 * @param me The AO.
 * @param e  The event.
 * @return Q_HANDLED(), a transition to SpotifyUi_drawing, or Q_SUPER().
 */
static QState SpotifyUi_waiting(SpotifyUi * const me, QEvt const * const e)
{
    QState status;

    switch ( e->sig )
    {
        case DISPLAY_STATE_SIG: {
            DisplayStateEvt const * const st = (DisplayStateEvt const *)e;

            if ( kscreen_open(&me->screen, st) == KODE_OK )
            {
                KLOG_I(TAG, "panel up at %u%%, LVGL running",
                       (unsigned)st->bright);
                status = Q_TRAN(&SpotifyUi_drawing);
            }
            else
            {
                /* kscreen has said why. Stay here: nothing will be drawn,
                 * and the bottom button still resets the board. */
                status = Q_HANDLED();
            }
            break;
        }
        default: {
            status = Q_SUPER(&SpotifyUi_running);
            break;
        }
    }

    return status;
}

/**
 * @brief Drawing: the screen is built and the render pass ticks.
 *
 * @param me The AO.
 * @param e  The event.
 * @return Q_HANDLED() for what it handles, Q_SUPER() otherwise.
 */
static QState SpotifyUi_drawing(SpotifyUi * const me, QEvt const * const e)
{
    QState status;

    switch ( e->sig )
    {
        case Q_ENTRY_SIG: {
            ui_build(me);
            clock_show(me);
            QTimeEvt_armX(&me->clock, KQP_TICKS_PER_MS(SR_CLOCK_MS), 0U);
            status = Q_HANDLED();
            break;
        }
        case SR_CLOCK_SIG: {
            clock_show(me);
            QTimeEvt_armX(&me->clock, KQP_TICKS_PER_MS(SR_CLOCK_MS), 0U);
            status = Q_HANDLED();
            break;
        }
        /* Always to kscreen_tick(), which re-arms the one-shot: a periodic tick
         * would fill the queue behind a slow frame, and a full queue asserts. */
        case SR_TICK_SIG: {
            kscreen_tick(&me->screen);
            status = Q_HANDLED();
            break;
        }
        case TOUCH_EVT_SIG: {
            kscreen_touch(&me->screen, (TouchEvt const *)e);
            touch_show(me, (TouchEvt const *)e);
            status = Q_HANDLED();
            break;
        }
        case DISPLAY_REPAINT_SIG: {
            kscreen_repaint(&me->screen);
            status = Q_HANDLED();
            break;
        }
        case BUTTON_EVT_SIG: {
            ButtonEvt const * const be = (ButtonEvt const *)e;

            if ( be->pressed && (KODE_SYS_BUTTON_TOP == (uint32_t)be->id) )
            {
                count_bump(me);
                status = Q_HANDLED();
            }
            else if ( be->pressed && (KODE_SYS_BUTTON_LEFT == (uint32_t)be->id) )
            {
                (void)spotify_ble_send(SPOTIFY_CMD_PREVIOUS);
                lv_label_set_text(me->count, "PREVIOUS");
                status = Q_HANDLED();
            }
            else if ( be->pressed && (KODE_SYS_BUTTON_RIGHT == (uint32_t)be->id) )
            {
                (void)spotify_ble_send(SPOTIFY_CMD_NEXT);
                lv_label_set_text(me->count, "NEXT");
                status = Q_HANDLED();
            }
            else if ( be->pressed && (KODE_SYS_BUTTON_UP == (uint32_t)be->id) )
            {
                (void)spotify_ble_send(SPOTIFY_CMD_VOLUME_UP);
                lv_label_set_text(me->count, "VOLUME +");
                status = Q_HANDLED();
            }
            else if ( be->pressed && (KODE_SYS_BUTTON_DOWN == (uint32_t)be->id) )
            {
                (void)spotify_ble_send(SPOTIFY_CMD_VOLUME_DOWN);
                lv_label_set_text(me->count, "VOLUME -");
                status = Q_HANDLED();
            }
            else
            {
                /* The bottom button is the parent's. */
                status = Q_SUPER(&SpotifyUi_running);
            }
            break;
        }
        default: {
            status = Q_SUPER(&SpotifyUi_running);
            break;
        }
    }

    return status;
}
