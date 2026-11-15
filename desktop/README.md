# Kode Dot Local — Windows

This target packages the existing KodeOS Web runtime as a Windows desktop application.
The browser runtime is bundled in `site/`; the app loads it from the local
`app://bundle` origin and blocks HTTP(S) requests at runtime.

## Build

The `Build and publish KodeOS Web Emulator` workflow first builds the pinned
KodeOS ESP32-P4 firmware and ESP-EMU WebAssembly runtime, then downloads that
validated runtime into this directory and packages:

- an NSIS installer;
- a portable Windows executable.

The installer itself requires an Internet connection only to download the
initial package. Runtime use is intended to be offline. The current build
pipeline must still pass packaging and an offline smoke test before this is
considered verified.

This desktop wrapper does not add missing hardware models: the C5 runtime,
full peripheral support, and third-party app installation remain separate
work.
