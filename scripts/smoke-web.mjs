const playwrightModule = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(playwrightModule);

const target = process.env.KD_SITE_URL || "https://livan-commits.github.io/similateur-kd/";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const workerUrls = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("requestfailed", request => failedRequests.push(request.url() + " :: " + (request.failure()?.errorText || "échec réseau")));
page.on("worker", worker => workerUrls.push(worker.url()));

// Keep a handle to the real firmware worker so the smoke test can ask KodeOS
// itself for AO_Gui's state through the same UART0 bridge as the UI.
await page.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.__kdWorkers = [];
  window.Worker = new Proxy(NativeWorker, {
    construct(target, args) {
      const instance = Reflect.construct(target, args);
      window.__kdWorkers.push({ url: String(args[0]), instance });
      return instance;
    }
  });
});

async function diagnostics(reason) {
  const state = await page.evaluate(() => {
    const canvas = document.querySelector("#screen");
    let pixels = null;
    if (canvas) {
      const data = canvas.getContext("2d").getImageData(0, 0, 410, 502).data;
      let nonBlack = 0, nonOpaque = 0, sum = 0, min = 255, max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.max(data[i], data[i + 1], data[i + 2]);
        if (v) nonBlack++;
        if (data[i + 3] !== 255) nonOpaque++;
        sum += v; min = Math.min(min, v); max = Math.max(max, v);
      }
      pixels = { nonBlack, nonOpaque, meanMaxChannel: +(sum / (data.length / 4)).toFixed(2), min, max,
        samples: [[0,0],[205,251],[100,100],[300,300]].map(([x,y]) => {
          const i = (y * 410 + x) * 4; return [data[i],data[i+1],data[i+2],data[i+3]];
        }) };
    }
    return {
      status: document.querySelector("#status")?.textContent || "(absent)",
      frame: document.querySelector("#frame-status")?.textContent || "(absent)",
      progress: document.querySelector("#progress")?.style.width || "0%",
      consoleTail: (document.querySelector("#console")?.textContent || "").slice(-8000),
      workersCreated: (window.__kdWorkers || []).map(w => w.url),
      pixels,
      workers: performance.getEntriesByType("resource")
        .filter(entry => entry.name.includes("worker") || entry.name.includes("esp_emu"))
        .map(entry => ({ name: entry.name, duration: Math.round(entry.duration), size: entry.transferSize })).slice(-30)
    };
  }).catch(error => ({ evaluateError: error.message }));
  console.error("SMOKE_DIAGNOSTICS " + JSON.stringify({ reason, state, pageErrors, consoleErrors, failedRequests, workerUrls }, null, 2));
  await page.screenshot({ path: "/tmp/kodeos-web-smoke-failure.png", fullPage: true }).catch(() => {});
}

try {
  const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (!response || !response.ok()) throw new Error("GitHub Pages répond avec HTTP " + (response?.status() ?? "aucune réponse"));
  try {
    await page.waitForFunction(() => document.querySelector("#status")?.textContent.includes("ESP32-P4 démarré"), null, { timeout: 240000, polling: 500 });
    await page.waitForFunction(() => document.querySelector("#console")?.textContent.includes("console up ('help' for commands)"), null, { timeout: 120000, polling: 500 });
    await page.waitForFunction(() => document.querySelector("#console")?.textContent.includes("time state=known"), null, { timeout: 90000, polling: 500 });
    await page.waitForFunction(() => window.__kdWorkers?.some(w => w.url.includes("kodeos-worker.js")), null, { timeout: 15000, polling: 100 });
    await page.evaluate(() => {
      const worker = window.__kdWorkers.find(w => w.url.includes("kodeos-worker.js"));
      worker.instance.postMessage({ type: "uart", data: "gui_info\\n" });
    });
    await page.waitForFunction(() => {
      const output = document.querySelector("#console")?.textContent || "";
      return output.includes(">|gui state=") || output.includes(">err");
    }, null, { timeout: 20000, polling: 250 });
    await page.waitForFunction(() => {
      const frame = document.querySelector("#frame-status")?.textContent || "";
      const match = frame.match(/PSRAM KGUI · séquence (\\d+)/);
      return match && Number(match[1]) >= 4;
    }, null, { timeout: 45000, polling: 250 });
  } catch (error) { await diagnostics(error.message); throw error; }

  const result = await page.evaluate(() => {
    const canvas = document.querySelector("#screen");
    if (!canvas) throw new Error("Canvas KGUI absent");
    const data = canvas.getContext("2d").getImageData(0, 0, 410, 502).data;
    let nonBlackPixels = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] || data[i + 1] || data[i + 2]) nonBlackPixels++;
    const output = document.querySelector("#console")?.textContent || "";
    const guiLine = output.split(/\\r?\\n/).find(line => line.includes(">|gui state=")) || "";
    const stateLine = output.split(/\\r?\\n/).find(line => line.includes(">|state=")) || "";
    return { width: canvas.width, height: canvas.height, nonBlackPixels,
      status: document.querySelector("#status")?.textContent || "",
      frame: document.querySelector("#frame-status")?.textContent || "",
      guiLine, stateLine, consoleTail: output.slice(-1800) };
  });
  if (result.width !== 410 || result.height !== 502) throw new Error("Résolution KGUI inattendue: " + result.width + "x" + result.height);
  if (!result.guiLine.includes("lvgl=on")) {
    await diagnostics("AO_Gui ne confirme pas LVGL actif");
    throw new Error("KGUI n'est pas actif: " + (result.guiLine || result.stateLine || "aucune réponse gui_info"));
  }
  if (result.nonBlackPixels < 20) {
    await diagnostics("Framebuffer KGUI noir après une vraie frame (séquence >= 4)");
    throw new Error("Le framebuffer KGUI est noir ou vide (" + result.nonBlackPixels + " pixels non noirs)");
  }
  if (pageErrors.length || consoleErrors.length || failedRequests.length) {
    await diagnostics("Erreurs navigateur");
    throw new Error("Erreurs navigateur: " + JSON.stringify({ pageErrors, consoleErrors, failedRequests }));
  }
  await page.screenshot({ path: "/tmp/kodeos-web-smoke.png", fullPage: true });
  console.log("KODEOS_WEB_SMOKE_OK " + JSON.stringify(result));
} finally { await browser.close(); }
