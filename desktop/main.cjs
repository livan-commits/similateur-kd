const { app, BrowserWindow, net, protocol, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const siteRoot = path.join(__dirname, "site");

function localResponse(status, message) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

async function serveLocalAsset(request) {
  const url = new URL(request.url);
  if (url.hostname !== "bundle") return localResponse(404, "Not found");

  let relative;
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  } catch {
    return localResponse(400, "Bad path");
  }

  const target = path.resolve(siteRoot, relative);
  const rootPrefix = siteRoot.endsWith(path.sep) ? siteRoot : siteRoot + path.sep;
  if (target !== siteRoot && !target.startsWith(rootPrefix)) {
    return localResponse(403, "Forbidden");
  }

  let filePath = target;
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
    if (!fs.statSync(filePath).isFile()) return localResponse(404, "Not found");
  } catch {
    return localResponse(404, "Not found");
  }

  try {
    return await net.fetch(pathToFileURL(filePath).toString());
  } catch (error) {
    return localResponse(500, "Local asset error: " + error.message);
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 920,
    minWidth: 900,
    minHeight: 700,
    show: false,
    backgroundColor: "#111318",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, destination) => {
    if (!destination.startsWith("app://bundle/")) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  window.loadURL("app://bundle/index.html");
}

app.whenReady().then(async () => {
  await protocol.handle("app", serveLocalAsset);

  // The desktop build is deliberately self-contained: block accidental
  // HTTP(S) calls so a missing bundled asset cannot silently use the network.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const scheme = new URL(details.url).protocol;
    callback({ cancel: scheme === "http:" || scheme === "https:" });
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
