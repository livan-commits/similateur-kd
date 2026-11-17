cmake_minimum_required(VERSION 3.22)
set(IDF_TARGET esp32p4)
set(KBSP_BOARD "${CMAKE_CURRENT_LIST_DIR}/managed_components/kodediy__kbsp/sdkconfig.board")
if(NOT EXISTS "${KBSP_BOARD}" AND NOT KBSP_FETCH_PASS)
    message(STATUS "Fetching Kode SDK board settings (first configure)")
    execute_process(
        COMMAND "${CMAKE_COMMAND}" -G "${CMAKE_GENERATOR}"
                -S "${CMAKE_CURRENT_LIST_DIR}"
                -B "${CMAKE_BINARY_DIR}/kbsp_fetch"
                -DKBSP_FETCH_PASS=ON
                "-DSDKCONFIG=${CMAKE_BINARY_DIR}/kbsp_fetch/sdkconfig"
        RESULT_VARIABLE KBSP_FETCH_RC)
    file(REMOVE_RECURSE "${CMAKE_BINARY_DIR}/kbsp_fetch")
    if(NOT EXISTS "${KBSP_BOARD}")
        message(FATAL_ERROR "Kode SDK board settings were not fetched; inspect the component-manager error above.")
    endif()
endif()
if(EXISTS "${KBSP_BOARD}")
    set(SDKCONFIG_DEFAULTS "${KBSP_BOARD};${CMAKE_CURRENT_LIST_DIR}/sdkconfig.defaults")
else()
    set(SDKCONFIG_DEFAULTS "${CMAKE_CURRENT_LIST_DIR}/sdkconfig.defaults")
endif()
if(NOT DEFINED PROJECT_VER)
    set(PROJECT_VER "00.00.01")
endif()
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(spotify_remote)
