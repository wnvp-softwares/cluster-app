const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    levantarCluster: () => ipcRenderer.invoke("levantar-cluster"),
    levantarMysqld: () => ipcRenderer.invoke("levantar-mysqld"),
    refrescarStatus: () => ipcRenderer.invoke("refrescar-status"),
    stopNdb1: () => ipcRenderer.invoke("stop-ndb1"),
    stopNdb2: () => ipcRenderer.invoke("stop-ndb2"),
    obtenerDatos: () => ipcRenderer.invoke("obtener-datos"),
    borrarRow: (id) => ipcRenderer.invoke("borrar-row", id),
    insertarRow: (data) => ipcRenderer.invoke("insertar-row", data),
    actualizarRow: (data) => ipcRenderer.invoke("actualizar-row", data)
});