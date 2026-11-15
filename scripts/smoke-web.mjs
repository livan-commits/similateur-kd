import { chromium } from "playwright";

const target = process.env.KD_SITE_URL || "https://livan-commits.github.io/similateur-kd/";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (!response || !response.ok()) {
    throw new Error("GitHub Pages répond avec HTTP " + (response?.status() ?? "aucune réponse"));
  }

  await page.waitForFunction(
    () => document.querySelector("#status")?.textContent.includes("ESP32-P4 démarré"),
    null,
    { timeout: 240000, polling: 500 }
  );
  await page.waitForFunction(
    () => document.querySelector("#console")?.textContent.includes("console up ('help' for commands)"),
    null,
    { timeout: 120000, polling: 500 }
  );
  await page.waitForFunction(
    () => document.querySelector("#console")?.textContent.includes("time state=known"),
    null,
    { timeout: 90000, polling: 500 }
  );
  await page.waitForFunction(
    () => document.querySelector("#frame-status")?.textContent.includes("PSRAM KGUI"),
    null,
    { timeout: 90000, polling: 500 }
  );

  const result = await page.evaluate(() => {
    const canvas = document.querySelector("#screen");
    if (!canvas) throw new Error("Canvas KGUI absent");
    const data = canvas.getContext("2d").getImageData(0, 0, 410, 502).data;
    let nonBlackPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] || data[i + 1] || data[i + 2]) nonBlackPixels++;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      nonBlackPixels,
      status: document.querySelector("#status")?.textContent || "",
      frame: document.querySelector("#frame-status")?.textContent || "",
      consoleTail: (document.querySelector("#console")?.textContent || "").slice(-1200)
    };
  });

  if (result.width !== 410 || result.height !== 502) {
    throw new Error("Résolution KGUI inattendue: " + result.width + "x" + result.height);
  }
  if (result.nonBlackPixels < 20) {
    throw new Error("Le framebuffer KGUI est noir ou vide (" + result.nonBlackPixels + " pixels non noirs)");
  }
  if (pageErrors.length) {
    throw new Error("Erreurs JavaScript dans la page: " + pageErrors.join(" | "));
  }

  await page.screenshot({ path: "/tmp/kodeos-web-smoke.png", fullPage: true });
  console.log("KODEOS_WEB_SMOKE_OK " + JSON.stringify(result));
} finally {
  await browser.close();
}
