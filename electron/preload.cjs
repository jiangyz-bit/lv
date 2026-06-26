const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  hide: () => ipcRenderer.invoke("window:hide"),
  show: () => ipcRenderer.invoke("window:show"),
  close: () => ipcRenderer.invoke("window:close"),
  isAlwaysOnTop: () => ipcRenderer.invoke("window:isAlwaysOnTop"),
  toggleAlwaysOnTop: () => ipcRenderer.invoke("window:toggleAlwaysOnTop"),
  setViewMode: (mode) => ipcRenderer.invoke("window:setViewMode", mode),
  beginDrag: (point) => ipcRenderer.invoke("window:beginDrag", point),
  dragTo: (point) => ipcRenderer.invoke("window:dragTo", point),
  endDrag: () => ipcRenderer.invoke("window:endDrag"),
  getLaunchAtLogin: () => ipcRenderer.invoke("app:getLaunchAtLogin"),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke("app:setLaunchAtLogin", enabled),
  onNavigate: (callback) => {
    const listener = (_event, view) => callback(view);
    ipcRenderer.on("app:navigate", listener);
    return () => ipcRenderer.removeListener("app:navigate", listener);
  }
});

contextBridge.exposeInMainWorld("marketData", {
  fetchQuotes: (codes) => ipcRenderer.invoke("market:fetchQuotes", codes)
});

contextBridge.exposeInMainWorld("petAi", {
  getStatus: () => ipcRenderer.invoke("ai:getStatus"),
  setApiKey: (apiKey) => ipcRenderer.invoke("ai:setApiKey", apiKey),
  analyzeHolding: (payload) => ipcRenderer.invoke("ai:analyzeHolding", payload)
});
