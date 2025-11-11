const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    onEcgData: (callback) => ipcRenderer.on("ecg-data-realtime", (event, data) => callback(data)),
});
