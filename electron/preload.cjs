const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("kodeDotSD", Object.freeze({
  list: () => ipcRenderer.invoke("sd:list"),
  write: (name, bytes) => ipcRenderer.invoke("sd:write", name, bytes),
  read: (name) => ipcRenderer.invoke("sd:read", name),
  delete: (name) => ipcRenderer.invoke("sd:delete", name),
  open: () => ipcRenderer.invoke("sd:open")
}));
