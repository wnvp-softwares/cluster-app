const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    levantarCluster: (comando, cwd) => ipcRenderer.invoke("levantar-cluster", comando, cwd),
    refreshStatus: () => ipcRenderer.invoke("refresh-status"),
    onClusterStatus: (callback) => ipcRenderer.on("cluster-status", (e, data) => callback(data))
});