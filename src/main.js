const { app, BrowserWindow, ipcMain } = require("electron");
const { exec, spawn } = require("child_process");

/* ================= WINDOW ================= */

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile("./interfaces/index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ================= CONFIG ================= */

const NDB_MGM_RUTA = "C:/mysql-cluster/bin";
const NDB_MGM_CMD = "ndb_mgm.exe";
const MYSQL_RUTA = "C:/mysql-cluster/bin";
const MYSQL_CMD = "mysqld.exe --defaults-file=C:/mysql-cluster/my-cluster.ini";

/* ================= IPC ================= */

ipcMain.handle("levantar-cluster", async (event, comando, cwd) => {
    return new Promise((resolve, reject) => {
        exec(comando, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                iniciarMonitor();   // 🔥 se activa solo si levanta bien
                resolve(stdout);
            }
        });
    });
});

/* ================= MONITOR ================= */

let monitorInterval = null;
let lastState = null;
let mysqlLevantado = false;
let mysqlEstado = false;

function iniciarMonitor() {
    if (monitorInterval) return;

    console.log("Monitor del cluster iniciado ...");

    monitorInterval = setInterval(() => {
        const proc = spawn(NDB_MGM_CMD, [], { cwd: NDB_MGM_RUTA });

        proc.stdin.write("SHOW\n");
        proc.stdin.end();

        let output = "";

        proc.stdout.on("data", (data) => {
            output += data.toString();
        });

        proc.stderr.on("data", (data) => {
            console.error("NDB_MGM_ERROR:", data.toString());
        });

        proc.on("close", () => {

            const statusObj = parseClusterStatus(output);
            statusObj.mysqlStatus = mysqlEstado;

            // Solo mostrar si cambia el estado
            if (JSON.stringify(statusObj) !== JSON.stringify(lastState)) {
                lastState = statusObj;

                console.log("===== ESTADO CLUSTER (OBJETO) =====");
                console.log(statusObj);
                console.log("==================================");
            }

            // 🔥 ORQUESTACIÓN MYSQL
            if (statusObj.clusterStatus && !mysqlLevantado) {
                console.log("Cluster completo → levantando MySQL Server...");
                levantarMySQL();
                mysqlLevantado = true;
            }

        });
    }, 2000); // cada 2s
}

/* ================= PARSER ================= */

function parseClusterStatus(output) {
    const status = {
        clusterStatus: false,
        ndb1Status: false,
        ndb2Status: false
    };

    const text = output.toLowerCase();

    // Cluster general
    if (text.includes("cluster") && text.includes("running")) {
        status.clusterStatus = true;
    }

    // Nodo 1 (ej: Node 2)
    if (text.includes("node 2") && (text.includes("started") || text.includes("connected"))) {
        status.ndb1Status = true;
    }

    // Nodo 2 (ej: Node 3)
    if (text.includes("node 3") && (text.includes("started") || text.includes("connected"))) {
        status.ndb2Status = true;
    }

    return status;
}

ipcMain.handle("refresh-status", async () => {
    return new Promise((resolve, reject) => {

        const proc = spawn(NDB_MGM_CMD, [], { cwd: NDB_MGM_RUTA });

        proc.stdin.write("SHOW\n");
        proc.stdin.end();

        let output = "";

        proc.stdout.on("data", (data) => {
            output += data.toString();
        });

        proc.stderr.on("data", (data) => {
            reject(data.toString());
        });

        proc.on("close", () => {
            const statusObj = parseClusterStatus(output);
            resolve(statusObj);   // 🔥 devuelve objeto al renderer
        });
    });
});

function levantarMySQL() {
    exec(MYSQL_CMD, { cwd: MYSQL_RUTA }, (error, stdout, stderr) => {
        if (error) {
            console.error("Error al levantar MySQL:", stderr || error.message);
            mysqlEstado = false;
        } else {
            console.log("MySQL Server levantado correctamente");
            mysqlEstado = true;
        }
    });
}

win.webContents.send("cluster-status", statusObj);