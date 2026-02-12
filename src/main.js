const { app, BrowserWindow, ipcMain } = require("electron");
const { exec, spawn } = require("child_process");
const { dirname } = require("path");
const { dir } = require("console");

/* ================= WINDOW ================= */
let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            preload: __dirname + "/preload.js",
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile("./src/interfaces/index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ================= CONFIG ================= */

// NDB MGM
const NDB_MGM_RUTA = "C:/mysql-cluster/bin";
const NDB_MGM_CMD = "ndb_mgm.exe";

// MYSQL
const MYSQL_RUTA = "C:/mysql-cluster/bin";
const MYSQL_CMD = "mysqld.exe";
const MYSQL_ARGS = ["--defaults-file=C:/mysql-cluster/my-cluster.ini"];

/* ================= STATE ================= */

let monitorInterval = null;
let lastState = null;
let mysqlLevantado = false;
let mysqlEstado = false;

/* ================= IPC ================= */

ipcMain.handle("levantar-cluster", async (event, comando, cwd) => {
    return new Promise((resolve, reject) => {
        exec(comando, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                iniciarMonitor();   // solo si levanta bien
                resolve(stdout);
            }
        });
    });
});

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
            statusObj.mysqlStatus = mysqlEstado;
            resolve(statusObj);
        });
    });
});

/* ================= MONITOR ================= */

function iniciarMonitor() {
    if (monitorInterval) return;

    console.log("🟢 Monitor del cluster iniciado ...");

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

            /* ===== IPC PUSH ===== */
            if (win && win.webContents) {
                win.webContents.send("cluster-status", statusObj);
            }

            /* ===== LOG SOLO SI CAMBIA ===== */
            if (JSON.stringify(statusObj) !== JSON.stringify(lastState)) {
                lastState = statusObj;

                console.log("===== ESTADO CLUSTER =====");
                console.log(statusObj);
                console.log("==========================");
            }

            /* ===== ORQUESTACIÓN MYSQL ===== */
            if (statusObj.clusterStatus && !mysqlLevantado) {
                console.log("🔥 Cluster completo → levantando MySQL Server...");
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

    // Nodo 1
    if (text.includes("node 2") && (text.includes("started") || text.includes("connected"))) {
        status.ndb1Status = true;
    }

    // Nodo 2
    if (text.includes("node 3") && (text.includes("started") || text.includes("connected"))) {
        status.ndb2Status = true;
    }

    return status;
}

/* ================= MYSQL ================= */

function levantarMySQL() {
    console.log("🚀 Iniciando MySQL Server...");

    const mysqlProc = spawn(MYSQL_CMD, MYSQL_ARGS, {
        cwd: MYSQL_RUTA,
        detached: true,
        stdio: "ignore"
    });

    mysqlProc.unref();

    mysqlEstado = true;

    console.log("✅ MySQL Server levantado");
}