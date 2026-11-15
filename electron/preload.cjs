const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("kodeDotSD", Object.freeze({
  list: () => ipcRenderer.invoke("sd:list"),
  write: (name, bytes) => ipcRenderer.invoke("sd:write", name, bytes),
  read: (name) => ipcRenderer.invoke("sd:read", name),
  delete: (name) => ipcRenderer.invoke("sd:delete", name),
  open: () => ipcRenderer.invoke("sd:open"),
  loadFlash: () => ipcRenderer.invoke("flash:load"),
  saveFlash: (bytes, firmwareHash) => ipcRenderer.invoke("flash:save", bytes, firmwareHash),
  onSaveFlash: (callback) => ipcRenderer.on("app:save-flash", () => callback()),
  flashSaved: () => ipcRenderer.send("app:flash-saved")
}));
