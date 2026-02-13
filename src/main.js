const { BrowserWindow, app, ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let ventana;

function crearVentana() {
    ventana = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, "/preload.js"),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    ventana.loadFile(path.join(__dirname, "/interfaces/index.html"));
}

app.whenReady().then(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("Conectado a la base de datos");
        connection.release();
    } catch {
        console.error("Error al conectar con la base de datos");
    }

    crearVentana();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            crearVentana();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// Variables de uso medido

const NDB_MGMD_COMMAND = "ndb_mgmd.exe -f C:/mysql-cluster/config/config.ini --configdir=C:/mysql-cluster/config";
const NDB_MGMD_CWD = "C:/mysql-cluster/bin";

const NDB_MGM_COMMANDO = 'cmd /c "echo show | ndb_mgm.exe"';
const NDB_MGM_CWD = "C:/mysql-cluster/bin";

const MYSQLD_COMMANDO = "mysqld.exe --defaults-file=C:/mysql-cluster/my-cluster.ini";
const MYSQLD_CWD = "C:/mysql-cluster/bin";

const STOP_NDB1 = 'cmd /c "echo 2 stop | ndb_mgm.exe"';
const STOP_NDB2 = 'cmd /c "echo 3 stop | ndb_mgm.exe"';
const STOP_ADMIN = 'cmd /c "echo shutdown | ndb_mgm.exe"';

const status = {
    cluster: false,
    ndb1: false,
    ndb2: false,
    mysql: false
}

const procesos = {
    cluster: null,
    mysql: null
};

let data = "";
let lines = [];

// Metodo para ejecutar el comando de levantamiento del cluster

ipcMain.handle("levantar-cluster", async () => {
    return new Promise((resolve) => {
        procesos.cluster = exec(NDB_MGMD_COMMAND, { cwd: NDB_MGMD_CWD }, async (error, stdout, stderr) => {
            if (error) {
                status.cluster = false;
                status.ndb1 = false;
                status.ndb2 = false;
                status.mysql = false;
                resolve({
                    error: true,
                    output: stderr || error.message,
                    status
                });
            } else {
                const statusActual = await refrescar();
                resolve({
                    output: stdout,
                    status: statusActual
                });
            }
        });
    });
});

// Metodo para levantar el nodo MySQLD

ipcMain.handle("levantar-mysqld", async () => {
    return new Promise((resolve) => {
        procesos.mysql = exec(MYSQLD_COMMANDO, { cwd: MYSQLD_CWD }, async (error, stdout, stderr) => {
            if (error) {
                status.cluster = false;
                status.ndb1 = false;
                status.ndb2 = false;
                status.mysql = false;
                resolve({
                    error: true,
                    output: stderr || error.message,
                    status
                });
            } else {
                const statusActual = await refrescar();
                resolve({
                    output: stdout,
                    status: statusActual
                });
            }
        });
    });
});

// Metodo para chequear el estatus de los nodos

ipcMain.handle("refrescar-status", async () => {
    const statusActual = await refrescar();
    return statusActual;
});

// Funcion de chequeo semi-automatico
function refrescar() {
    return new Promise((resolve) => {
        exec(NDB_MGM_COMMANDO, { cwd: NDB_MGM_CWD }, (error, stdout, stderr) => {
            if (error) {
                status.cluster = false;
                status.ndb1 = false;
                status.ndb2 = false;
                status.mysql = false;
                resolve({
                    output: stderr || error.message,
                    status
                });
            } else {
                data = stdout;
                lines = data.split(/\r?\n/);

                status.cluster = false;
                status.ndb1 = false;
                status.ndb2 = false;
                status.mysql = false;

                for (const line of lines) {
                    if (line.includes("id=1") && line.includes("@")) status.cluster = true;
                    if (line.includes("id=2") && line.includes("@")) status.ndb1 = true;
                    if (line.includes("id=3") && line.includes("@")) status.ndb2 = true;
                    if (line.includes("id=4") && line.includes("@")) status.mysql = true;
                }

                resolve({
                    output: stdout,
                    status
                });
            }
        });
    });
}

// Aplicar STOP a los nodos de datos

ipcMain.handle("stop-ndb1", async () => {
    return new Promise((resolve) => {
        exec(STOP_NDB1, { cwd: NDB_MGM_CWD }, async (error, stdout, stderr) => {
            if (error) {
                exec(STOP_ADMIN, { cwd: NDB_MGM_CWD });
                resolve({
                    error: true,
                    output: stderr || error.message
                });
            } else {
                const statusActual = await refrescar();
                exec(STOP_ADMIN, { cwd: NDB_MGM_CWD });
                resolve({
                    output: stdout,
                    status: statusActual
                });
            }
        });
    });
});

ipcMain.handle("stop-ndb2", async () => {
    return new Promise((resolve) => {
        exec(STOP_NDB2, { cwd: NDB_MGM_CWD }, async (error, stdout, stderr) => {
            if (error) {
                exec(STOP_ADMIN, { cwd: NDB_MGM_CWD });
                resolve({
                    error: true,
                    output: stderr || error.message
                });
            } else {
                const statusActual = await refrescar();
                exec(STOP_ADMIN, { cwd: NDB_MGM_CWD });
                resolve({
                    output: stdout,
                    status: statusActual
                });
            }
        });
    })
});

// Obtener datos de la base de datos

ipcMain.handle("obtener-datos", async () => {
    try {
        const [rows] = await pool.query("SELECT * FROM usuarios");
        return { error: false, data: rows };
    } catch (error) {
        return { error: true, message: error.message };
    }
});

// Borrar ROW de la base de datos

ipcMain.handle("borrar-row", async (event, id) => {
    try {
        await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
        return { error: false };
    } catch (error) {
        return { error: true, message: error.message };
    }
});

// Insertar ROW en la base de datos

ipcMain.handle("insertar-row", async (event, data) => {
    const { nombre, email, edad } = data;
    try {
        await pool.query("INSERT INTO usuarios (nombre, email, edad) VALUES (?, ?, ?)", [nombre, email, edad]);
        return { error: false };
    } catch (error) {
        return { error: true, message: error.message };
    }
});

// Edicion inline de la ROW

ipcMain.handle("actualizar-row", async (event, data) => {
    const { id, nombre, email, edad } = data;
    try {
        await pool.query("UPDATE usuarios SET nombre = ?, email = ?, edad = ? WHERE id = ?", [nombre, email, edad, id]);
        return { error: false };
    } catch (error) {
        return { error: true, message: error.message };
    }
});

// ! FINAL DE CODIGO

// Matar procesos de consola al cerrar programa

app.on("before-quit", () => {
    console.log("Cerrando procesos del cluster...");

    if (procesos.cluster && procesos.cluster.pid) {
        exec(`taskkill /PID ${procesos.cluster.pid} /T /F`);
    }

    if (procesos.mysql && procesos.mysql.pid) {
        exec(`taskkill /PID ${procesos.mysql.pid} /T /F`);
    }
});