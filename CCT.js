/* CCT.js
   Variables globales de tarifa (valores iniciales).
   El usuario puede modificarlas desde la interfaz.
*/
let t_sillon = Number(document.getElementById?.('t_sillon')?.value) || 20;
let t_sofa = Number(document.getElementById?.('t_sofa')?.value) || 27;
let t_chais = Number(document.getElementById?.('t_chais')?.value) || 35;
let t_canape = Number(document.getElementById?.('t_canape')?.value) || 30;
let t_descanso = Number(document.getElementById?.('t_descanso')?.value) || 12;
let t_electro = Number(document.getElementById?.('t_electro')?.value) || 19;
let t_americano = Number(document.getElementById?.('t_americano')?.value) || 22;
let t_premium = Number(document.getElementById?.('t_premium')?.value) || 0.105;
let t_optima = Number(document.getElementById?.('t_optima')?.value) || 0.05;

const fileInput = document.getElementById('fileInput');
const exportBtn = document.getElementById('exportBtn');
const resultTable = document.getElementById('resultTable');
const tableHead = resultTable.querySelector('thead');
const tableBody = resultTable.querySelector('tbody');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const countInfo = document.getElementById('countInfo');
let secondData = []; // Guardará el Excel 2


let processedData = []; // array de filas procesadas (incluye cruce, categoría, tarifa y total)

// ---- Definiciones de nombres por categoría (normalizados) ----
// Lista de "prefijos" exactos (sin número) que se usarán para asignar categorías.
// Usamos startsWith en la cadena normalizada.
const CAT = {
    chais: [
        "RINCONERA PIEL", "RINCONERA", "CHAISE LONGUE PIEL", "CHAISE LONGUE"
    ],
    sofa: [
        "SOFA PIEL", "SOFA", "SOFA CAMA"
    ],
    sillon: [
        "SILLON", "SILLON PIEL", "SILLON DECORATIVO", "COMPLEMENTO SOFAS"
    ],
    descanso: [
        "COLCHONES", "SOMIERS Y BASES"
    ],
    canape: [
        "CANAPÉ ABATIBLE", "CANAPE ABATIBLE", "CANAPÉ", "CANAPE"
    ],
    electro: [
        "EVACUACION","CONDENSACION","BOMBA DE CALOR","LIBRE INSTALACIÓN","LIBRE INSTALACION",
        "ENCASTRE","GAS","ELECTRICA","FRONTAL","SUPERIOR",
        "LAVADORA /SECADORA","LAVA /SECA SUPERIOR","INTEGRADAS","ACCESORIOS LAVADO",
        "INTEGRABLE","TABLE TOP","1 PUERTA","2 PUERTAS","COMBI","VINOTECAS",
        "INTEGRACIÓN","INTEGRACION","ACCESORIOS","HORIZONTAL","VERTICAL",
        "VERTICAL INTEGRABLE","VERTICAL INTEGRABLE,","PLACAS","HORNOS","CAMPANAS",
        "CONJUNTOS","ACCESORIOS ENCASTRE","CALEFACCIÓN","CALEFACCION",
        "LED", "IPS","DIRECT LED", "OLED", "HD", "FHD", "UHD 4K"

    ],
    americano: [
        "SIDE BY SIDE","AMERICANOS 4X4","AMERICANOS","AMERICANOS 4X4" // redundancias por si hay variantes
    ]
};

document.getElementById('fileInput2').addEventListener('change', handleSecondFile);

function handleSecondFile(ev){
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        secondData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        alert("Segundo archivo cargado correctamente ✅");
    };
    reader.readAsBinaryString(file);
}


// Normaliza texto: elimina múltiples espacios, trim y mayúsculas.
function normalizeText(txt){
    if (txt === undefined || txt === null) return "";
    // toString in case value is numeric
    let s = String(txt);
    // Reemplaza múltiples espacios por uno, elimina tabs, y trim.
    s = s.replace(/\s+/g, ' ').trim().toUpperCase();
    return s;
}

// Devuelve la categoría (clave de CAT) o "none" o "" si no se encuentra.
// Comprueba startsWith con cada prefijo de cada categoría.
function detectCategory(cruceTexto){
    const n = normalizeText(cruceTexto);
    if (!n) return "none";
    for (const [catKey, prefixes] of Object.entries(CAT)){
        for (const p of prefixes){
            const pp = normalizeText(p);
            if (pp === "") continue;
            if (n.startsWith(pp)) return catKey;
        }
    }
    return "none";
}

// Obtiene la tarifa numérica según la categoría actual (usa variables globales actualizadas)
function tarifaPorCategoria(cat){
    switch(cat){
        case 'chais': return Number(t_chais) || 0;
        case 'sofa': return Number(t_sofa) || 0;
        case 'sillon': return Number(t_sillon) || 0;
        case 'descanso': return Number(t_descanso) || 0;
        case 'canape': return Number(t_canape) || 0;
        case 'electro': return Number(t_electro) || 0;
        case 'americano': return Number(t_americano) || 0;
        default: return "";
    }
}

// ---- Event: actualización de tarifas por inputs ----
document.getElementById('tarifas').addEventListener('input', (e) => {
    // Actualiza variables globales en tiempo real
    t_sillon = Number(document.getElementById('t_sillon').value) || 0;
    t_sofa = Number(document.getElementById('t_sofa').value) || 0;
    t_chais = Number(document.getElementById('t_chais').value) || 0;
    t_canape = Number(document.getElementById('t_canape').value) || 0;
    t_descanso = Number(document.getElementById('t_descanso').value) || 0;
    t_electro = Number(document.getElementById('t_electro').value) || 0;
    t_americano = Number(document.getElementById('t_americano').value) || 0;
    t_premium = Number(document.getElementById('t_premium').value) || 0;
    t_optima = Number(document.getElementById('t_optima').value) || 0;
    // Recalcula totales basados en nueva tarifa y refresca tabla (si ya hay datos)
    if (processedData.length) recalcTotalsAndRender();

});

// ---- Lectura de fichero XLSX ----
fileInput.addEventListener('change', handleFile);

function handleFile(ev){
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target.result;
        // Leer workbook
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        // Convertir a JSON
        // defval: para que si falta una celda, nos ponga "" en lugar de omitirla
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

         processedData = rows.map(row => processRow(row));
         applyBusinessRules();
         renderTable(processedData);

        exportBtn.disabled = false;
    };
    reader.readAsBinaryString(file);
}

function processRow(row){
    const fecha = row["Fecha "] ?? row["Fecha"] ?? "";
    const expedidor = row["Expedidor"] ?? "";
    const transportista = row["Transportista"] ?? "";
    const identificador = row["Identificador de la tarea"] ?? row["Identificador"] ?? "";
    const cuenta = row["Cuenta del cliente"] ?? "";

    let pedido_de_ventas = "";
    if (typeof identificador === "string" && identificador.includes("|")) {
        pedido_de_ventas = identificador.split("|")[0].trim();
    } else {
        pedido_de_ventas = identificador; 
    }

    const articuloNombre = row["Artículo – Nombre"] ?? row["Artículo - Nombre"] ?? row["Artículo Nombre"] ?? row["Artículo"] ?? "";
    let cantidad = row["Artículo – Cantidad"] ?? row["Artículo - Cantidad"] ?? row["Artículo Cantidad"] ?? row["Cantidad"];
    cantidad = (cantidad === "" || cantidad === null || cantidad === undefined) ? 1 : Number(cantidad) || 1;

    const referencia = row["Artículo – Referencia"] ?? row["Artículo - Referencia"] ?? row["Referencia"] ?? "";
    const retirada = row["Retirada"] ?? "";

    // Cruce con articulos.js
    const refKey = (referencia === "" || referencia === null) ? "" : String(referencia).trim();
    const cruceRaw = (typeof articulos !== 'undefined' && articulos.hasOwnProperty(refKey)) 
                     ? articulos[refKey] 
                     : (typeof articulos !== 'undefined' && articulos.hasOwnProperty(Number(refKey)) 
                        ? articulos[Number(refKey)] 
                        : "");
    const cruce = cruceRaw ?? "";
    const categoriaInicial = detectCategory(cruce);
    const estado = row["Estado"] ?? "";
    const modoEntrega = row["Modo de Entrega"] ?? row["Modo de entrega"] ?? row["Modo Entrega"] ?? "";

    const categoriaFinal = (categoriaInicial === 'none' || categoriaInicial === "") ? modoEntrega : categoriaInicial;

    // -------------------------------------
    // 🟡 CRUCE CON SEGUNDO EXCEL
    // -------------------------------------
    let importeNeto = "";
    if (secondData.length){
        let match = secondData.find(r =>
            String(r["Pedido de ventas"]).trim() === String(pedido_de_ventas).trim() &&
            String(r["Código de artículo"]).trim() === String(referencia).trim()
        );
        if (match) importeNeto = Number(match["Importe neto"]) || 0;
    }

    // -------------------------------------
    // 🟡 CÁLCULO TARIFAS ESPECIALES
    // -------------------------------------
    let tarifaUnitCalc = "";
    let totalCalc = "";

    if (String(categoriaFinal).toUpperCase().includes("PREM") && importeNeto !== ""){
        tarifaUnitCalc = (importeNeto / cantidad) * t_premium;
        totalCalc = tarifaUnitCalc * cantidad;
    }
    else if (String(categoriaFinal).toUpperCase().includes("TIMA") && importeNeto !== ""){
        tarifaUnitCalc = (importeNeto / cantidad) * t_optima;
        totalCalc = tarifaUnitCalc * cantidad;
    }
    else {
        tarifaUnitCalc = tarifaPorCategoria(categoriaFinal) || "";
        totalCalc = tarifaUnitCalc === "" ? "" : tarifaUnitCalc * cantidad;
    }

    return {
        "Fecha" : fecha,
        "Expedidor": expedidor,
        "Transportista": transportista,
        "Identificador de la tarea": identificador,
        "Cuenta del cliente": cuenta,
        "Pedido de ventas": pedido_de_ventas,
        "Artículo – Nombre": articuloNombre,
        "Artículo – Cantidad": cantidad,
        "Artículo – Referencia": referencia,
        "Retirada": retirada,
        "Cruce": cruce,
        "Categoría": categoriaFinal,
        "Importe neto": importeNeto,
        "Tarifa unit.": tarifaUnitCalc === "" ? "" : Number(tarifaUnitCalc),
        "Total": totalCalc === "" ? "" : Number(totalCalc),
        "Estado": estado
    };
}


// Recalcula totales (cuando cambian tarifas)
function recalcTotalsAndRender(){
    processedData = processedData.map(r => {
        const cat = r["Categoría"] || "none";
        const tarifaUnit = tarifaPorCategoria(cat);
        const total = (tarifaUnit === "" || tarifaUnit === undefined) ? "" : (Number(tarifaUnit) * Number(r["Artículo – Cantidad"] || 1));
        return {
            ...r,
            "Tarifa unit.": tarifaUnit === "" ? "" : Number(tarifaUnit),
            "Total": total === "" ? "" : Number(total)
        };
    });
    renderTable(processedData);
}

function applyBusinessRules(){
    const grouped = {};

    processedData.forEach(r => {
        const p = r["Pedido de ventas"];
        if (!grouped[p]) grouped[p] = [];
        grouped[p].push(r);
    });

    for (const pedido in grouped){
        const rows = grouped[pedido];
        const hasPREM = rows.some(r => String(r["Categoría"]).includes("PREM"));
        const hasTIMA = rows.some(r => String(r["Categoría"]).includes("TIMA"));

        // 1) Si hay PREM y TIMA → corregir TIMA → autocorregido PREM
        if (hasPREM && hasTIMA){
            rows.forEach(r=>{
                if (String(r["Categoría"]).includes("TIMA")){
                    r["Categoría"] = "autocorregido PREM";
                }
            });
        }

        // 2) Si solo hay PREM → sumar total y mínimo 95
        if (hasPREM && !hasTIMA){
            let sum = rows.filter(r=>String(r["Categoría"]).includes("PREM"))
                          .reduce((acc,r)=>acc+(Number(r["Total"])||0),0);
            if (sum < 95) sum = 95;
            let first = true;
            rows.forEach(r=>{
                if (String(r["Categoría"]).includes("PREM")){
                    if (first){ r["Total"] = sum; first=false; }
                    else{ r["Total"] = ""; }
                }
            });
        }

        // 3) Si solo hay TIMA → sumar total y mínimo 40
        if (hasTIMA && !hasPREM){
            let sum = rows.filter(r=>String(r["Categoría"]).includes("TIMA"))
                          .reduce((acc,r)=>acc+(Number(r["Total"])||0),0);
            if (sum < 40) sum = 40;
            let first = true;
            rows.forEach(r=>{
                if (String(r["Categoría"]).includes("TIMA")){
                    if (first){ r["Total"] = sum; first=false; }
                    else{ r["Total"] = ""; }
                }
            });
        }
    }
}

// ---- Render de tabla con filtros y búsqueda ----
function renderTable(data){
    // Cabecera fija
    tableHead.innerHTML = `
        <tr>
            <th>Fecha</th>
            <th>Expedidor</th>
            <th>Transportista</th>
            <th>Identificador de la tarea</th>
            <th>Cuenta del cliente</th>
            <th>Pedido de ventas</th> 
            <th>Artículo – Nombre</th>
            <th>Artículo – Cantidad</th>
            <th>Artículo – Referencia</th>
            <th>Retirada</th>
            <th>Cruce</th>
            <th>Categoría</th>
            <th>Tarifa unit.</th>
            <th>Total</th>
            <th>Estado</th>
        </tr>
    `;

    applyFiltersAndShow();
}

// Aplica búsqueda y filtro por categoría y escribe tbody
function applyFiltersAndShow(){
    const q = normalizeText(searchInput.value || "");
    const filterCat = categoryFilter.value || "all";

    const filtered = processedData.filter(row => {
        // Filtro por categoría
        if (filterCat !== 'all') {
            if (filterCat === 'none') {
                if ((row["Categoría"] || "") !== "") return false;
            } else {
                if (row["Categoría"] !== filterCat) return false;
            }
        }

        // Búsqueda en varias columnas
        if (!q) return true;
        const hay = [
            String(row["Fecha"] || ""),
            String(row["Expedidor"] || ""),
            String(row["Identificador de la tarea"] || ""),
            String(row["Cuenta del cliente"] || ""),
            String(row["Artículo – Nombre"] || ""),
            String(row["Artículo – Referencia"] || ""),
            String(row["Cruce"] || "")
        ].some(val => normalizeText(val).includes(q));
        return hay;
    });

    // Construir filas
    tableBody.innerHTML = filtered.map(row => {
        const cat = row["Categoría"] || "none";
        const rowClass = `row-${cat === "" ? 'none' : cat}`;
        return `<tr class="${rowClass}">
            <td>${escapeHtml(row["Fecha"] ?? "")}</td>
            <td>${escapeHtml(row["Expedidor"] ?? "")}</td>
            <td>${escapeHtml(row["Transportista"] ?? "")}</td>
            <td>${escapeHtml(row["Identificador de la tarea"] ?? "")}</td>
            <td>${escapeHtml(row["Cuenta del cliente"] ?? "")}</td>
            <td>${escapeHtml(row["Pedido de ventas"] ?? "")}</td>
            <td>${escapeHtml(row["Artículo – Nombre"] ?? "")}</td>
            <td>${escapeHtml(row["Artículo – Cantidad"] ?? "")}</td>
            <td>${escapeHtml(row["Artículo – Referencia"] ?? "")}</td>
            <td>${escapeHtml(row["Retirada"] ?? "")}</td>
            <td>${escapeHtml(row["Cruce"] ?? "")}</td>
            <td>${escapeHtml(row["Categoría"] ?? "")}</td>
            <td>${row["Tarifa unit."] === "" ? "" : Number(row["Tarifa unit."]).toFixed(2)}</td>
            <td>${row["Total"] === "" ? "" : Number(row["Total"]).toFixed(2)}</td>
            <td>${escapeHtml(row["Estado"] ?? "")}</td>
        </tr>`;
    }).join('');

    countInfo.textContent = `Mostrando ${filtered.length} de ${processedData.length} filas`;
}

// util escapar html sencillo
function escapeHtml(s){
    return String(s)
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'",'&#39;');
}

// Eventos UI: búsqueda y filtro
searchInput.addEventListener('input', () => applyFiltersAndShow());
categoryFilter.addEventListener('change', () => applyFiltersAndShow());

// ---- Exportar XLSX con resultados cruzados ----
exportBtn.addEventListener('click', () => {
    if (!processedData.length) return;
    // Queremos exportar las filas actualmente filtradas (respeto el filtro)
    const q = normalizeText(searchInput.value || "");
    const filterCat = categoryFilter.value || "all";

    const exportRows = processedData.filter(row => {
        if (filterCat !== 'all') {
            if (filterCat === 'none') {
                if ((row["Categoría"] || "") !== "") return false;
            } else {
                if (row["Categoría"] !== filterCat) return false;
            }
        }
        if (!q) return true;
        const hay = [
            String(row["Fecha"] || ""),
            String(row["Expedidor"] || ""),
            String(row["Identificador de la tarea"] || ""),
            String(row["Cuenta del cliente"] || ""),
            String(row["Artículo – Nombre"] || ""),
            String(row["Artículo – Referencia"] || ""),
            String(row["Cruce"] || "")
        ].some(val => normalizeText(val).includes(q));
        return hay;
    });

    // Construir hoja: mantener columnas legibles y ordenadas
    const out = exportRows.map(r => ({
        "Fecha": r["Fecha"],
        "Expedidor": r["Expedidor"],
        "Transportista": r["Transportista"],
        "Identificador de la tarea": r["Identificador de la tarea"],
        "Cuenta del cliente": r["Cuenta del cliente"],
        "Pedido de ventas": r["Pedido de ventas"],
        "Artículo – Nombre": r["Artículo – Nombre"],
        "Artículo – Cantidad": r["Artículo – Cantidad"],
        "Artículo – Referencia": r["Artículo – Referencia"],
        "Retirada": r["Retirada"],
        "Cruce": r["Cruce"],
        "Categoría": r["Categoría"],
        "Tarifa unit.": r["Tarifa unit."],
        "Total": r["Total"],
        "Estado": r["Estado"]
    }));

    const ws = XLSX.utils.json_to_sheet(out, { header: [
        "Fecha", "Expedidor","Transportista","Identificador de la tarea","Cuenta del cliente","Pedido de ventas","Artículo – Nombre","Artículo – Cantidad",
        "Artículo – Referencia","Retirada","Cruce","Categoría","Tarifa unit.","Total", "Estado"
    ]});
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, "resultado_cruzado.xlsx");
});

// ---- Comportamiento inicial: muestra cabecera vacía ----
tableHead.innerHTML = `
    <tr>
        <th>Fecha</th>
        <th>Expedidor</th>
        <th>Transportista</th>
        <th>Identificador de la tarea</th>
        <th>Cuenta del cliente</th>
        <th>Pedido de ventas</th>
        <th>Artículo – Nombre</th>
        <th>Artículo – Cantidad</th>
        <th>Artículo – Referencia</th>
        <th>Retirada</th>
        <th>Cruce</th>
        <th>Categoría</th>
        <th>Tarifa unit.</th>
        <th>Total</th>
        <th>Estado</th>
    </tr>
`;

// ---- Nota: si articulos.js tiene referencias con o sin espacios, el lookup se hace por la clave exacta
// Para mayor robustez, se puede intentar varias claves (trim, parseInt, etc.) — ya está manejado en processRow.

// Fin del fichero CCT.js
