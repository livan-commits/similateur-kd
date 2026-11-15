const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("kodeDotSD", Object.freeze({
  list: () => ipcRenderer.invoke("sd:list"),
  write: (name, bytes) => ipcRenderer.invoke("sd:write", name, bytes),
  open: () => ipcRenderer.invoke("sd:open")
}));
