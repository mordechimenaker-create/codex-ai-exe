const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  sendPrompt: (id, prompt, history) => ipcRenderer.send("ai:prompt", { id, prompt, history }),
  onAiChunk: (callback) => ipcRenderer.on("ai:chunk", (_event, payload) => callback(payload)),
  onAiDone: (callback) => ipcRenderer.on("ai:done", (_event, payload) => callback(payload)),
  onAppWarning: (callback) => ipcRenderer.on("app:warning", (_event, msg) => callback(msg)),
  onAppStatus: (callback) => ipcRenderer.on("app:status", (_event, msg) => callback(msg)),
  startImprove: (iterations) => ipcRenderer.send("improve:start", { iterations }),
  onImproveLog: (callback) => ipcRenderer.on("improve:log", (_event, msg) => callback(msg)),
  onImproveDone: (callback) => ipcRenderer.on("improve:done", (_event, msg) => callback(msg)),
  terminalWrite: (data) => ipcRenderer.send("terminal:write", data),
  terminalResize: (cols, rows) => ipcRenderer.send("terminal:resize", { cols, rows }),
  onTerminalData: (callback) => ipcRenderer.on("terminal:data", (_event, data) => callback(data))
});
