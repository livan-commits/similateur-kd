const { app, BrowserWindow, protocol, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

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

  const appSession = session.defaultSession;
  appSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (_details, callback) => callback({ cancel: true })
  );
  await protocol.handle("kode-dot", (request) => serveLocalFile(request.url, siteDirectory));

  const window = new BrowserWindow({
    width: 1180,
    height: 900,
    minWidth: 760,
    minHeight: 640,
    backgroundColor: "#111318",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await window.loadURL("kode-dot://app/index.html");
}

app.whenReady().then(createWindow).catch((error) => {
  console.error("Impossible de démarrer le simulateur Kode Dot :", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
