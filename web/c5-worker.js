import init, { WasmEmulator } from "./esp-emu/pkg/esp_emu.js";
import { CosimPump } from "./esp-emu/cosim.js";

let emulator = null;
let pump = null;
let booting = false;
let running = false;

function report(type, data = {}) {
  postMessage({ type, ...data });
}

async function fetchFirmware() {
  const response = await fetch("./firmware/c5-flash.bin");
  if (!response.ok) throw new Error("Image ESP32-C5 HTTP " + response.status);
  return new Uint8Array(await response.arrayBuffer());
}

async function boot() {
  if (booting || running) return;
  booting = true;
  try {
    report("status", { message: "Chargement du moteur ESP-EMU ESP32-C5…" });
    await init();
    emulator = new WasmEmulator("esp32c5");
    emulator.load_default_rom();

    const firmware = await fetchFirmware();
    report("log", { message: "[C5] Image flash autonome chargée (" + firmware.length.toLocaleString("fr-FR") + " octets)" });
    await emulator.load_firmware(firmware);

    pump = new CosimPump(emulator, {});
    running = true;
    report("ready");
    pump.start(
      (output) => report("uart", { data: typeof output === "string" ? output : String(output) }),
      (error) => {
        running = false;
        report("error", { message: error?.stack || String(error) });
      }
    );
  } catch (error) {
    report("error", { message: error?.stack || String(error) });
  } finally {
    booting = false;
  }
}

onmessage = (event) => {
  if (event.data?.type === "start") boot();
};
