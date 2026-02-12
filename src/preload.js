const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    refreshStatus: () => ipcRenderer.invoke("refresh-status"),
    onClusterStatus: (callback) => ipcRenderer.on("cluster-status", (e, data) => callback(data))
});