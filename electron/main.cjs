const { app, BrowserWindow, protocol, session, ipcMain, shell } = require("electron");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");

const smokeTest = process.env.KD_SMOKE_TEST === "1";
let externalRequestCount = 0;
if (smokeTest) app.commandLine.appendSwitch("headless");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "kode-dot",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const MIME_TYPES = {
  ".bin": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm"
};

const sdRoot = () => path.join(app.getPath("userData"), "Carte_SD");
function safeSdPath(name) {
  if (typeof name !== "string" || !name || name.startsWith("/") || name.includes("\\") ||
      name.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Chemin SD invalide");
  const root = sdRoot();
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep)) throw new Error("Chemin SD interdit");
  return target;
}
async function assertSafeSdParents(target) {
  const root = path.resolve(sdRoot());
  const relative = path.relative(root, target);
  const parts = relative.split(path.sep);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error("Les liens symboliques sont interdits sur la carte SD");
      if (current !== target && !stat.isDirectory()) throw new Error("Un élément du chemin SD n'est pas un dossier");
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
  }
}
function registerSdBridge() {
  ipcMain.handle("sd:list", async () => {
    await fs.mkdir(sdRoot(), { recursive: true });
    const entries = [];
    async function walk(directory, prefix = "") {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const relative = prefix ? prefix + "/" + entry.name : entry.name;
        if (entry.isDirectory()) {
          entries.push({ name: relative, directory: true });
          if (entries.length < 2000) await walk(path.join(directory, entry.name), relative);
        } else if (entry.isFile()) {
          const stat = await fs.stat(path.join(directory, entry.name));
          entries.push({ name: relative, directory: false, size: stat.size });
        }
        if (entries.length >= 2000) return;
      }
    }
    await walk(sdRoot());
    return entries;
  });
  ipcMain.handle("sd:write", async (_event, name, bytes) => {
    const target = safeSdPath(name);
    await assertSafeSdParents(target);
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength > 67108864) throw new Error("Fichier invalide (limite 64 Mio)");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(bytes));
    return { name, size: bytes.byteLength };
  });
  ipcMain.handle("sd:read", async (_event, name) => {
    const target = safeSdPath(name);
    await assertSafeSdParents(target);
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > 67108864) throw new Error("Fichier absent ou supérieur à 64 Mio");
    return await fs.readFile(target);
  });
  ipcMain.handle("sd:delete", async (_event, name) => {
    const target = safeSdPath(name);
    await assertSafeSdParents(target);
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Seuls les fichiers peuvent être supprimés");
    await fs.unlink(target);
    return { name, deleted: true };
  });
  ipcMain.handle("sd:open", async () => {
    await fs.mkdir(sdRoot(), { recursive: true });
    await shell.openPath(sdRoot());
    return sdRoot();
  });
}
function getSiteDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "site")
    : path.resolve(__dirname, "..", "windows", "site");
}

function responseHeaders(filePath) {
  return {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff"
  };
}

async function serveLocalFile(requestUrl, siteDirectory) {
  const url = new URL(requestUrl);
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Invalid path", { status: 400 });
  }

  const relativePath = requestedPath.replace(/^\/+/, "") || "index.html";
  const filePath = path.resolve(siteDirectory, relativePath);
  const relative = path.relative(siteDirectory, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const body = await fs.readFile(filePath);
    return new Response(body, { headers: responseHeaders(filePath) });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function createWindow() {
  const siteDirectory = getSiteDirectory();
  const indexPath = path.join(siteDirectory, "index.html");
  await fs.access(indexPath);

  registerSdBridge();
  const appSession = session.defaultSession;
  appSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (_details, callback) => {
      externalRequestCount++;
      callback({ cancel: true });
    }
  );
  await protocol.handle("kode-dot", (request) => serveLocalFile(request.url, siteDirectory));

  const window = new BrowserWindow({
    width: 1180,
    height: 900,
    minWidth: 760,
    minHeight: 640,
    show: !smokeTest,
    backgroundColor: "#111318",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await window.loadURL("kode-dot://app/index.html");
  if (smokeTest) await verifyOfflineBoot(window);
}

function verifyOfflineBoot(window) {
  return new Promise((resolve) => {
    let checking = false;
    let finished = false;
    const finish = (code, detail) => {
      if (finished) return;
      finished = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      const result = {
        result: code === 0 ? "passed" : "failed",
        externalRequestCount,
        ...detail
      };
      console.log("WINDOWS_OFFLINE_SMOKE " + JSON.stringify(result));
      if (process.env.KD_SMOKE_RESULT_FILE) {
        try {
          fsSync.writeFileSync(process.env.KD_SMOKE_RESULT_FILE, JSON.stringify(result, null, 2));
        } catch (error) {
          console.error("Impossible d'écrire le résultat du contrôle :", error);
        }
      }
      app.exit(code);
      resolve();
    };
    const pollTimer = setInterval(async () => {
      if (checking || finished) return;
      checking = true;
      try {
        const state = await window.webContents.executeJavaScript(`(() => {
          const canvas = document.querySelector("#screen");
          const context = canvas?.getContext("2d");
          let nonBlackPixels = 0;
          if (canvas && context) {
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonBlackPixels++;
            }
          }
          const consoleText = document.querySelector("#console")?.textContent || "";
          return {
            status: document.querySelector("#status")?.textContent || "",
            frame: document.querySelector("#frame-status")?.textContent || "",
            width: canvas?.width || 0,
            height: canvas?.height || 0,
            consoleReady: consoleText.includes("console up ('help' for commands)"),
            clockReady: consoleText.includes("time state=known"),
            nonBlackPixels
          };
        })()`);
        if (state.status.includes("Erreur")) {
          finish(1, { reason: "Le simulateur affiche une erreur.", state });
        } else if (state.status.includes("ESP32-P4 démarré") &&
                   state.consoleReady && state.clockReady &&
                   state.frame.includes("PSRAM KGUI") &&
                   state.width === 410 && state.height === 502 &&
                   state.nonBlackPixels >= 20) {
          if (externalRequestCount !== 0) {
            finish(1, { reason: "Une requête externe a été tentée.", state });
          } else {
            finish(0, { reason: "Démarrage local et framebuffer KGUI vérifiés.", state });
          }
        }
      } catch (error) {
        finish(1, { reason: error?.message || String(error) });
      } finally {
        checking = false;
      }
    }, 1000);
    const timeoutTimer = setTimeout(() => {
      finish(1, { reason: "Délai dépassé pendant le démarrage hors ligne." });
    }, 240000);
  });
}

app.whenReady().then(createWindow).catch((error) => {
  console.error("Impossible de démarrer le simulateur Kode Dot :", error);
  if (smokeTest && process.env.KD_SMOKE_RESULT_FILE) {
    try {
      fsSync.writeFileSync(process.env.KD_SMOKE_RESULT_FILE, JSON.stringify({
        result: "failed",
        reason: error?.stack || String(error),
        externalRequestCount
      }, null, 2));
    } catch {}
    app.exit(1);
    return;
  }
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
