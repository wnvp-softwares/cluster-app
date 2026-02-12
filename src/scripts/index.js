const RUTA_ADMIN = "C:/mysql-cluster/bin";
const COMANDO_ADMIN = "ndb_mgmd.exe -f C:/mysql-cluster/config/config.ini --configdir=C:/mysql-cluster/config";

const refrescarBtn = document.getElementById("refrescar");

const clusterH2 = document.getElementById("cluster-status");
const ndb1H2 = document.getElementById("ndb1-status");
const ndb2H2 = document.getElementById("ndb2-status");
const mysqldH2 = document.getElementById("mysqld-status");


/* ================= MANUAL ================= */
refrescarBtn.addEventListener("click", async () => {
    const status = await window.api.refreshStatus();

    clusterH2.innerText = "Estado de clúster: " + (status.clusterStatus ? "ACTIVO" : "INACTIVO");
    ndb1H2.innerText = "Estado de Nodo 1: " + (status.ndb1Status ? "ACTIVO" : "INACTIVO");
    ndb2H2.innerText = "Estado de Nodo 2: " + (status.ndb2Status ? "ACTIVO" : "INACTIVO");
    mysqldH2.innerText = "Estado MySQL: " + (status.mysqlStatus ? "ACTIVO" : "INACTIVO");
});

/* ================= AUTOMÁTICO ================= */
window.api.onClusterStatus((status) => {

    clusterH2.innerText = "Estado de clúster: " + (status.clusterStatus ? "ACTIVO" : "INACTIVO");
    ndb1H2.innerText    = "Estado de Nodo 1: " + (status.ndb1Status ? "ACTIVO" : "INACTIVO");
    ndb2H2.innerText    = "Estado de Nodo 2: " + (status.ndb2Status ? "ACTIVO" : "INACTIVO");
    mysqldH2.innerText  = "Estado MySQL: " + (status.mysqlStatus ? "ACTIVO" : "INACTIVO");

});