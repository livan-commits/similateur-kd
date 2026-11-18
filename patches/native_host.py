#!/usr/bin/env python3
"""Prepare an isolated native build of selected official KodeOS KGUI screens."""
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: native_host.py <kode-sdk-dir> <project-root>")

sdk = Path(sys.argv[1]).resolve()
root = Path(sys.argv[2]).resolve()
consumer_cmake = sdk.parent / "components/kgui/sim/CMakeLists.txt"
cmake = consumer_cmake.read_text()

# The SDK's upstream simulator is a generic KUI host. This consumer profile
# supplies three unchanged KodeOS screen translation units and a small host
# initializer. Firmware-only Loading/Settings screens are deliberately not
# registered until their pack/Lottie and tilt services have host backends.
anchor = "file(GLOB KGUI_SCREENS ${CMAKE_CURRENT_LIST_DIR}/../screens/*.c)\n"
replacement = (
    "set(KGUI_HOST_SOURCES\n"
    f"    {root}/ports/native/kgui_sim_host.c\n"
    "    ${CMAKE_CURRENT_LIST_DIR}/../screens/kgui_screen_face.c\n"
    "    ${CMAKE_CURRENT_LIST_DIR}/../screens/kgui_screen_launcher.c\n"
    "    ${CMAKE_CURRENT_LIST_DIR}/../screens/kgui_screen_touch_test.c\n"
    "    ${CMAKE_CURRENT_LIST_DIR}/../screens/kgui_tp_target.c\n"
    "    ${CMAKE_CURRENT_LIST_DIR}/../screens/kgui_off.c\n"
    "    ${CMAKE_CURRENT_LIST_DIR}/../screens/kgui_lvgl.c\n"
    "    ${CMAKE_CURRENT_LIST_DIR}/../kgui_rest.c\n"
    ")\n"
)
if cmake.count(anchor) != 1:
    raise SystemExit("Expected exactly one upstream KGUI screen glob")
cmake = cmake.replace(anchor, replacement, 1)

old_sources = "SOURCES ${CMAKE_CURRENT_LIST_DIR}/kgui_sim.c ${KGUI_SCREENS}"
new_sources = "SOURCES ${KGUI_HOST_SOURCES}"
if cmake.count(old_sources) != 1:
    raise SystemExit("Expected exactly one upstream simulator source list")
cmake = cmake.replace(old_sources, new_sources, 1)

old_includes = "INCLUDES ${CMAKE_CURRENT_LIST_DIR}/../screens)"
new_includes = (
    "INCLUDES ${CMAKE_CURRENT_LIST_DIR}/../screens "
    "${CMAKE_CURRENT_LIST_DIR}/../include "
    "${CMAKE_CURRENT_LIST_DIR}/.. "
    f"{root}/ports/native)"
)
if cmake.count(old_includes) != 1:
    raise SystemExit("Expected exactly one upstream include list")
consumer_cmake.write_text(cmake.replace(old_includes, new_includes, 1))

# The upstream snapshot mode switches SDL to its dummy driver with setenv(),
# which the Windows CRT does not provide. Keep the upstream behaviour on POSIX
# and use the CRT's _putenv_s on Windows.
sim_main = sdk.parent / "components/kui/sim/main.c"
main_src = sim_main.read_text()
old_setenv = '(void)setenv("SDL_VIDEODRIVER", "dummy", 1);'
new_setenv = (
    "#if defined(_WIN32)\n"
    "        (void)_putenv_s(\"SDL_VIDEODRIVER\", \"dummy\");\n"
    "#else\n"
    "        (void)setenv(\"SDL_VIDEODRIVER\", \"dummy\", 1);\n"
    "#endif"
)
if main_src.count(old_setenv) != 1:
    raise SystemExit("Expected exactly one SDL_VIDEODRIVER setenv in the upstream simulator main")
sim_main.write_text(main_src.replace(old_setenv, new_setenv, 1))
print("Prepared native host profile: official Face, Launcher and Touch Test screens.")
