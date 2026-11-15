import init, { WasmEmulator } from "./esp-emu/pkg/esp_emu.js";
import { CosimPump } from "./esp-emu/cosim.js";

const WIDTH = 410;
const HEIGHT = 502;
const BYTES_PER_PIXEL = 2;
const MAX_READ_BYTES = 4096;
const POLL_MS = 33;

const encoder = new TextEncoder();
const framebufferBytes = new Uint8Array(WIDTH * HEIGHT * BYTES_PER_PIXEL);
const rgb565ToRgba = new Uint32Array(65536);
for (let value = 0; value < 65536; value++) {
  const r = (value >>> 11) & 0x1f;
  const g = (value >>> 5) & 0x3f;
  const b = value & 0x1f;
  const red = Math.round((r * 255) / 31);
  const green = Math.round((g * 255) / 63);
  const blue = Math.round((b * 255) / 31);
  rgb565ToRgba[value] = (0xff000000 | (blue << 16) | (green << 8) | red) >>> 0;
}

const offscreen = typeof OffscreenCanvas === "function"
  ? new OffscreenCanvas(WIDTH, HEIGHT)
  : null;
const offscreenContext = offscreen?.getContext("2d", { alpha: false }) ?? null;
const frameImage = offscreenContext?.createImageData(WIDTH, HEIGHT) ?? null;
const framePixels32 = frameImage
  ? new Uint32Array(frameImage.data.buffer)
  : null;

let emulator = null;
let pump = null;
let boardWorker = null;
let framebufferSymbols = null;
let framebufferAddresses = null;
let framebufferTimer = null;
let booting = false;
let running = false;
let hasFramebufferFrame = false;
let lastFramebufferSeq = -1;
let framebufferErrorShown = false;
let pollInProgress = false;
let firmwareLoaded = false;
let flashSaveTimer = null;
let flashImageLength = 0;
let firmwareHash = "";
let lastSavedFlashHash = null;
let pendingFlashHash = null;

function report(type, data = {}, transfer = []) {
  postMessage({ type, ...data }, transfer);
}

function readMemoryWord(address) {
  const bytes = emulator.read_memory(address, 4);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 4) {
    throw new Error("Lecture mémoire ESP-EMU incomplète à 0x" + address.toString(16));
  }
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
}

async function fetchFirmware(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Firmware HTTP " + response.status);
  const total = Number(response.headers.get("Content-Length") || 0);
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    report("progress", { loaded: bytes.length, total: total || bytes.length });
    return bytes;
  }

  const reader = response.body.getReader();
  // Preallocate when the server provides Content-Length: this avoids keeping
  // every network chunk plus a second full firmware copy in memory on mobile.
  let bytes = total > 0 ? new Uint8Array(total) : null;
  const chunks = bytes ? null : [];
  let loaded = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (bytes) {
      if (loaded + value.length > bytes.length) {
        const expanded = new Uint8Array(Math.max(loaded + value.length, bytes.length * 2));
        expanded.set(bytes.subarray(0, loaded));
        bytes = expanded;
      }
      bytes.set(value, loaded);
    } else {
      chunks.push(value);
    }
    loaded += value.length;
    report("progress", { loaded, total });
  }

  if (bytes) return bytes.subarray(0, loaded);
  bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function publishFrame(seq, y1, y2, byteLength) {
  if (offscreen && offscreenContext && frameImage) {
    const firstPixel = y1 * WIDTH;
    const pixelCount = (y2 - y1) * WIDTH;
    for (let i = 0, p = firstPixel; i < byteLength; i += 2, p++) {
      const rgb565 = framebufferBytes[i] | (framebufferBytes[i + 1] << 8);
      framePixels32[p] = rgb565ToRgba[rgb565];
    }
    offscreenContext.putImageData(frameImage, 0, 0, 0, y1, WIDTH, y2 - y1);
    if (typeof createImageBitmap === "function") {
      // Send only the changed rows instead of copying the whole 410x502 screen.
      // Keeping the OffscreenCanvas intact also avoids a full-canvas restore.
      const bitmap = await createImageBitmap(offscreen, 0, y1, WIDTH, y2 - y1);
      report("frame", { image: bitmap, seq, y1, y2 }, [bitmap]);
    } else {
      const bitmap = offscreen.transferToImageBitmap();
      offscreenContext.drawImage(bitmap, 0, 0);
      report("frame", { image: bitmap, seq, y1, y2, fullFrame: true }, [bitmap]);
    }
    return;
  }

  // Compatibility path for browsers without OffscreenCanvas.
  const copy = framebufferBytes.slice(0, byteLength);
  report("frame-rgb565", { data: copy.buffer, seq, y1, y2 }, [copy.buffer]);
}

async function pollFramebuffer() {
  if (!running || !emulator || !framebufferAddresses || pollInProgress) return;
  pollInProgress = true;
  try {
    const { sequence, frontPointer, dirtyY1, dirtyY2 } = framebufferAddresses;
    const seqBefore = readMemoryWord(sequence);
    if ((seqBefore & 1) !== 0 || seqBefore === lastFramebufferSeq) return;

    const framebuffer = readMemoryWord(frontPointer);
    const dirtyTop = readMemoryWord(dirtyY1);
    const dirtyBottom = readMemoryWord(dirtyY2);
    const seqCheck = readMemoryWord(sequence);
    if (seqBefore !== seqCheck || (seqCheck & 1) !== 0 || !framebuffer) return;

    const y1 = hasFramebufferFrame ? Math.max(0, Math.min(HEIGHT - 1, dirtyTop)) : 0;
    const y2 = hasFramebufferFrame ? Math.max(y1, Math.min(HEIGHT, dirtyBottom)) : HEIGHT;
    if (y2 <= y1) {
      lastFramebufferSeq = seqCheck;
      return;
    }

    const byteLength = (y2 - y1) * WIDTH * BYTES_PER_PIXEL;
    const maxChunk = Math.min(MAX_READ_BYTES, Number(framebufferSymbols.max_read_bytes || MAX_READ_BYTES));
    for (let offset = 0; offset < byteLength; offset += maxChunk) {
      const count = Math.min(maxChunk, byteLength - offset);
      const chunk = emulator.read_memory(framebuffer + y1 * WIDTH * BYTES_PER_PIXEL + offset, count);
      if (!(chunk instanceof Uint8Array) || chunk.length !== count) {
        throw new Error("Lecture PSRAM incomplète (" + offset + "/" + byteLength + " octets)");
      }
      framebufferBytes.set(chunk, offset);
    }

    const seqAfterCopy = readMemoryWord(sequence);
    if (seqAfterCopy !== seqCheck || (seqAfterCopy & 1) !== 0) return;

    await publishFrame(seqAfterCopy, y1, y2, byteLength);
    lastFramebufferSeq = seqAfterCopy;
    hasFramebufferFrame = true;
    framebufferErrorShown = false;
  } catch (error) {
    if (!framebufferErrorShown) {
      report("error", { message: "[framebuffer mémoire] " + (error?.message || error) });
      framebufferErrorShown = true;
    }
  } finally {
    pollInProgress = false;
  }
}

function hashFlash(bytes) {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    const value = bytes[i];
    a = Math.imul(a ^ value, 0x01000193);
    b = Math.imul(b ^ value, 0x85ebca6b);
  }
  return (a >>> 0).toString(16) + "-" + (b >>> 0).toString(16) + "-" + bytes.length;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

function exportFlash() {
  if (!emulator || !firmwareLoaded) {
    report("flash-unchanged");
    return;
  }
  if (pendingFlashHash) {
    report("flash-pending");
    return;
  }
  try {
    const state = emulator.flash_state();
    if (!(state instanceof Uint8Array) || state.length !== flashImageLength) {
      throw new Error("Taille de la mémoire flash émulée inattendue");
    }
    const hash = hashFlash(state);
    if (hash === lastSavedFlashHash) {
      report("flash-unchanged");
      return;
    }
    pendingFlashHash = hash;
    report("flash-state", { data: state.buffer, hash, firmwareHash }, [state.buffer]);
  } catch (error) {
    report("error", { message: "[flash] " + (error?.message || error) });
  }
}

function sendUart(text) {
  if (!emulator) return;
  emulator.uart_input(encoder.encode(text));
}

async function boot(savedFlash = null, persistFlash = false) {
  if (booting || running) return;
  booting = true;
  try {
    report("status", { message: "Chargement du runtime ESP-EMU…" });
    await init();
    emulator = new WasmEmulator("esp32p4");

    const defaultFirmware = await fetchFirmware("./firmware/kodeos-flash.bin");
    firmwareHash = await sha256Hex(defaultFirmware);
    let firmware = defaultFirmware;
    if (savedFlash?.data && savedFlash.firmwareHash === firmwareHash) {
      const savedImage = new Uint8Array(savedFlash.data);
      if (savedImage.length === defaultFirmware.length) {
        firmware = savedImage;
        report("log", { message: "[flash] Mémoire interne restaurée depuis ce PC" });
      } else {
        report("log", { message: "[flash] Sauvegarde ignorée : taille incompatible ; fichier conservé" });
      }
    } else if (savedFlash?.data) {
      report("log", { message: "[flash] Sauvegarde d'un autre firmware détectée ; démarrage propre, ancienne image conservée" });
    }
    report("log", { message: "[emu] Firmware KodeOS fusionné chargé (" + firmware.length.toLocaleString("fr-FR") + " octets)" });
    emulator.load_default_rom();
    await emulator.load_firmware(firmware);
    flashImageLength = firmware.length;
    lastSavedFlashHash = savedFlash?.data && savedFlash.firmwareHash === firmwareHash
      ? hashFlash(firmware)
      : null;
    firmwareLoaded = true;
    if (persistFlash) flashSaveTimer = setInterval(exportFlash, 300000);

    const symbolsResponse = await fetch("./framebuffer-symbols.json");
    if (!symbolsResponse.ok) throw new Error("Table des symboles framebuffer HTTP " + symbolsResponse.status);
    framebufferSymbols = await symbolsResponse.json();
    if (framebufferSymbols.width !== WIDTH || framebufferSymbols.height !== HEIGHT ||
        framebufferSymbols.bytes_per_pixel !== BYTES_PER_PIXEL || !framebufferSymbols.front_pointer_address) {
      throw new Error("Table des symboles framebuffer invalide");
    }
    framebufferAddresses = {
      sequence: Number.parseInt(framebufferSymbols.sequence_address, 16),
      frontPointer: Number.parseInt(framebufferSymbols.front_pointer_address, 16),
      dirtyY1: Number.parseInt(framebufferSymbols.dirty_y1_address, 16),
      dirtyY2: Number.parseInt(framebufferSymbols.dirty_y2_address, 16)
    };
    report("log", { message: "[framebuffer] Symboles ELF KGUI chargés · lecture PSRAM dans le Worker" });

    boardWorker = new Worker("./esp-emu/part-worker.js", { type: "module" });
    boardWorker.onerror = (event) => report("error", { message: "[carte virtuelle] " + (event.message || "erreur du Worker I2C") });
    boardWorker.onmessage = (event) => {
      if (event.data?.type === "error") report("error", { message: "[carte virtuelle] " + event.data.text });
    };
    const channel = new MessageChannel();
    pump = new CosimPump(emulator, {
      kodeboard: { port: channel.port1, worker: boardWorker }
    });
    boardWorker.postMessage({
      type: "start",
      port: channel.port2,
      module: "./parts/kode_board.wasm",
      config: { pins: { SCL: 5, SDA: 4 } }
    }, [channel.port2]);

    if (!(await pump.waitForDevice(5000))) {
      throw new Error("La carte virtuelle Kode Dot ne s'est pas attachée au bus I2C en 5 secondes.");
    }
    report("log", { message: "[I2C] Carte Kode Dot virtuelle attachée · TCA6408A + CST820" });

    running = true;
    framebufferTimer = setInterval(pollFramebuffer, POLL_MS);
    report("ready");
    pump.start(
      (output) => report("uart", { data: output }),
      (error) => {
        running = false;
        if (framebufferTimer) clearInterval(framebufferTimer);
        if (flashSaveTimer) clearInterval(flashSaveTimer);
        firmwareLoaded = false;
        report("error", { message: "[emu error] " + (error?.message || error) });
      }
    );
  } catch (error) {
    running = false;
    if (framebufferTimer) clearInterval(framebufferTimer);
    if (flashSaveTimer) clearInterval(flashSaveTimer);
    firmwareLoaded = false;
    report("error", { message: error?.stack || String(error) });
  } finally {
    booting = false;
  }
}

onmessage = (event) => {
  const message = event.data || {};
  try {
    if (message.type === "start") {
      boot(message.savedFlash || null, message.persistFlash === true);
    } else if (message.type === "export-flash") {
      exportFlash();
    } else if (message.type === "flash-saved") {
      if (pendingFlashHash && message.hash === pendingFlashHash) {
        lastSavedFlashHash = pendingFlashHash;
        pendingFlashHash = null;
      }
    } else if (message.type === "flash-save-failed") {
      if (pendingFlashHash && message.hash === pendingFlashHash) pendingFlashHash = null;
    } else if (message.type === "uart" && emulator) {
      sendUart(message.data || "");
    } else if (message.type === "sync-time" && emulator) {
      const isoUtc = String(message.iso || new Date().toISOString()).slice(0, 19) + "Z";
      sendUart('time set="' + isoUtc + '"\n');
      sendUart("time\n");
    } else if (message.type === "board-input" && boardWorker) {
      boardWorker.postMessage({ type: "input", kind: message.kind });
    }
  } catch (error) {
    report("error", { message: error?.stack || String(error) });
  }
};
