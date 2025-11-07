/* ============ CCT.js (completo) ============ */

/* --- Tarifas iniciales (se leen del DOM) --- */
let t_sillon = Number(document.getElementById('t_sillon').value) || 20;
let t_sofa = Number(document.getElementById('t_sofa').value) || 27;
let t_chais = Number(document.getElementById('t_chais').value) || 35;
let t_canape = Number(document.getElementById('t_canape').value) || 30;
let t_descanso = Number(document.getElementById('t_descanso').value) || 12;
let t_electro = Number(document.getElementById('t_electro').value) || 19;
let t_americano = Number(document.getElementById('t_americano').value) || 22;
let t_premium = Number(document.getElementById('t_premium').value) || 0.105;
let t_optima = Number(document.getElementById('t_optima').value) || 0.05;

/* --- Elementos DOM --- */
const fileInput = document.getElementById('fileInput');
const fileInput2 = document.getElementById('fileInput2');
const exportBtn = document.getElementById('exportBtn');
const tableHead = document.querySelector('#resultTable thead');
const tableBody = document.querySelector('#resultTable tbody');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const countInfo = document.getElementById('countInfo');

/* --- Datos en memoria --- */
let originalRows = [];   // JSON raw del primer excel (para re-procesar si cambian tarifas)
let processedData = [];  // filas procesadas mostradas / exportadas
let secondData = [];     // JSON del segundo excel

/* ===== utilidades ===== */
function normalizeText(txt){ return String(txt ?? "").replace(/\s+/g,' ').trim().toUpperCase(); }
function ceil2(n){ return Math.ceil(Number(n) * 100) / 100; } // redondeo AL ALZA a 2 decimales

/* categorias (detección por prefijos) */
const CAT = {
    chais:["RINCONERA","CHAISE LONGUE"],
    sofa:["SOFA","SOFA CAMA"],
    sillon:["SILLON","COMPLEMENTO SOFAS"],
    descanso:["COLCHONES","SOMIERS","BASES"],
    canape:["CANAPE","CANAPÉ"],
    electro:["LED","OLED","UHD","LAVADORA","FRIGORÍFICO","HORNOS","PLACA","CAMPANA","VINOTECAS"],
    americano:["AMERICANOS","SIDE BY SIDE"]
};
function detectCategory(txt){
    const n = normalizeText(txt);
    for(const [k,list] of Object.entries(CAT)) if(list.some(p => n.startsWith(normalizeText(p)))) return k;
    return "none";
}
function tarifaPorCategoria(cat){
    return {
        chais:t_chais, sofa:t_sofa, sillon:t_sillon,
        descanso:t_descanso, canape:t_canape, electro:t_electro, americano:t_americano
    }[cat] ?? "";
}

/* --- Actualizar tarifas desde inputs y re-procesar si ya hay datos --- */
document.getElementById('tarifas').addEventListener('input', () => {
    t_sillon = Number(document.getElementById('t_sillon').value) || 0;
    t_sofa = Number(document.getElementById('t_sofa').value) || 0;
    t_chais = Number(document.getElementById('t_chais').value) || 0;
    t_canape = Number(document.getElementById('t_canape').value) || 0;
    t_descanso = Number(document.getElementById('t_descanso').value) || 0;
    t_electro = Number(document.getElementById('t_electro').value) || 0;
    t_americano = Number(document.getElementById('t_americano').value) || 0;
    t_premium = Number(document.getElementById('t_premium').value) || 0;
    t_optima = Number(document.getElementById('t_optima').value) || 0;

    if(originalRows.length) {
        // re-procesar desde los originales para aplicar nuevas tarifas
        processedData = originalRows.map(processRow);
        applyBusinessRules();
        renderTable();
    }
});

/* ===========================
    CARGA DEL SEGUNDO EXCEL
   =========================== */
fileInput2.addEventListener('change',e=>{
    const file = e.target.files[0];
    if(!file) return;
    const r = new FileReader();
    r.onload = e =>{
        const wb = XLSX.read(e.target.result,{type:'binary'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        secondData = XLSX.utils.sheet_to_json(sheet,{defval:""});
        alert("✅ Segundo archivo cargado correctamente.");
    };
    r.readAsBinaryString(file);
});

/* ===========================
    CARGA DEL PRIMER EXCEL (solo si hay secondData)
   =========================== */
fileInput.addEventListener('change', ()=>{
    if(!secondData.length){
        alert("⚠️ Debes cargar primero el segundo archivo (BKO) para poder procesar.");
        fileInput.value = "";
        return;
    }
    const file = fileInput.files[0];
    if(!file) return;
    const r = new FileReader();
    r.onload = e=>{
        const wb = XLSX.read(e.target.result,{type:'binary'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet,{defval:""});
        originalRows = rows.slice(); // guardamos los raws para re-procesar después
        processedData = originalRows.map(processRow);
        applyBusinessRules();
        renderTable();
        exportBtn.disabled = false;
    };
    r.readAsBinaryString(file);
});

/* ===========================
    PROCESS ONE ROW -> objeto final
   =========================== */
function processRow(row){
    // múltiples nombres posibles en Excel original
    const fecha = row["Fecha "] ?? row["Fecha"] ?? "";
    const expedidor = row["Expedidor"] ?? "";
    const transportista = row["Transportista"] ?? "";

    const identificador = row["Identificador de la tarea"] ?? row["Identificador"] ?? "";
    const pedido = (typeof identificador === "string" && identificador.includes("|")) ? identificador.split("|")[0].trim() : identificador;

    const producto = row["Artículo – Nombre"] ?? row["Artículo - Nombre"] ?? row["Artículo Nombre"] ?? row["Artículo"] ?? "";

    let cantidad = row["Artículo – Cantidad"] ?? row["Artículo - Cantidad"] ?? row["Artículo Cantidad"] ?? row["Cantidad"];
    cantidad = Number(cantidad || 1);

    const codigo = row["Artículo – Referencia"] ?? row["Artículo - Referencia"] ?? row["Referencia"] ?? "";

    const retirada = row["Retirada"] ?? "";
    const estado = row["Estado"] ?? "";

    // Cruce con articulos.js (si existe)
    const refKey = String(codigo).trim();
    const cruce = (typeof articulos !== 'undefined' && (articulos[refKey] ?? articulos[Number(refKey)])) ?? "";

    // categoría detectada o modo de entrega
    let categoria = detectCategory(cruce);
    if(categoria === "none" || categoria === "") categoria = row["Modo de Entrega"] ?? row["Modo de entrega"] ?? "";

    // Cruce con segundo excel (Importe neto)
    const match = secondData.find(r =>
        normalizeText(r["Pedido de ventas"]) === normalizeText(pedido) &&
        normalizeText(r["Código de artículo"]) === normalizeText(codigo)
    );
    const importeNetoRaw = match ? (Number(match["Importe neto"]) || 0) : "";

    // Neto / ud (antes de Importe neto)
    const netoPorUdRaw = (importeNetoRaw === "" || cantidad === 0) ? "" : (importeNetoRaw / cantidad);

    // Tarifa unit. => lógica especial si PREM / TIMA y hay importeNeto, sino por categoría
    let tarifaUnitRaw = "";
    if(String(categoria).toUpperCase().includes("PREM") && importeNetoRaw !== "") {
        tarifaUnitRaw = (importeNetoRaw / cantidad) * t_premium;
    } else if(String(categoria).toUpperCase().includes("TIMA") && importeNetoRaw !== "") {
        tarifaUnitRaw = (importeNetoRaw / cantidad) * t_optima;
    } else {
        tarifaUnitRaw = tarifaPorCategoria(categoria);
    }

    // Totales y "Tarifa x ud" (cantidad * tarifaUnit)
    const tarifaXudRaw = (tarifaUnitRaw === "" || tarifaUnitRaw === null) ? "" : (Number(cantidad) * Number(tarifaUnitRaw));
    const totalRaw = (tarifaUnitRaw === "" || tarifaUnitRaw === null) ? "" : (Number(tarifaUnitRaw) * Number(cantidad));

    // Aplicar redondeo AL ALZA a centésimas para las columnas solicitadas
    const importeNeto = importeNetoRaw === "" ? "" : ceil2(importeNetoRaw);
    const netoPorUd = (netoPorUdRaw === "" ? "" : ceil2(netoPorUdRaw));
    const tarifaUnit = (tarifaUnitRaw === "" ? "" : ceil2(tarifaUnitRaw));
    const tarifaXud = (tarifaXudRaw === "" ? "" : ceil2(tarifaXudRaw));
    const total = (totalRaw === "" ? "" : ceil2(totalRaw));

    return {
        "Fecha": fecha,
        "Expedidor": expedidor,
        "Transportista": transportista,
        "Identificador de la tarea": identificador,
        "Cuenta": row["Cuenta del cliente"] ?? row["Cuenta"] ?? "",
        "Pedido de ventas": pedido,
        "Producto": producto,
        "Cantidad": cantidad,
        "Código": codigo,
        "Retirada": retirada,
        "Familia": cruce,
        "Categoría": categoria,
        "Neto / ud": netoPorUd,
        "Importe neto": importeNeto,
        "Tarifa unit.": tarifaUnit,
        "Tarifa x ud": tarifaXud,
        "Total": total,
        "Estado": estado
    };
}

/* ===========================
    REGLAS POR PEDIDO (ya usan los campos procesados)
   =========================== */
function applyBusinessRules(){
    // agrupar por pedido
    const groups = {};
    processedData.forEach(r => {
        const p = r["Pedido de ventas"] ?? "";
        if(!groups[p]) groups[p] = [];
        groups[p].push(r);
    });

    for(const p in groups){
        const rows = groups[p];
        const hasPREM = rows.some(r => String(r["Categoría"]).includes("PREM"));
        const hasTIMA = rows.some(r => String(r["Categoría"]).includes("TIMA"));

        // 1) Si hay PREM y TIMA -> convertir TIMA a "autocorregido PREM"
        if(hasPREM && hasTIMA){
            rows.forEach(r => {
                if(String(r["Categoría"]).includes("TIMA")){
                    r["Categoría"] = "autocorregido PREM";
                }
            });
        }

        // 2) Si hay PREM y no TIMA -> sumar Totales de PREM y aplicar mínimo 95
        if(hasPREM && !hasTIMA){
            let sum = rows.filter(r=>String(r["Categoría"]).includes("PREM"))
                          .reduce((a,r)=>(a + (Number(r["Total"])||0)),0);
            sum = Math.max(sum,95);
            let first = true;
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("PREM")){
                    if(first){ r["Total"] = ceil2(sum); first = false; }
                    else { r["Total"] = ""; }
                }
            });
        }

        // 3) Si hay TIMA y no PREM -> sumar Totales de TIMA y aplicar mínimo 40
        if(hasTIMA && !hasPREM){
            let sum = rows.filter(r=>String(r["Categoría"]).includes("TIMA"))
                          .reduce((a,r)=>(a + (Number(r["Total"])||0)),0);
            sum = Math.max(sum,40);
            let first = true;
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("TIMA")){
                    if(first){ r["Total"] = ceil2(sum); first = false; }
                    else { r["Total"] = ""; }
                }
            });
        }
    }
}

/* ===========================
    RENDER / FILTRADO / EXPORT
   =========================== */

function renderTable(){
    // encabezado con los nombres nuevos y orden solicitados
    tableHead.innerHTML = `
    <tr>
        <th>Fecha</th>
        <th>Expedidor</th>
        <th>Transportista</th>
        <th>Identificador de la tarea</th>
        <th>Cuenta</th>
        <th>Pedido de ventas</th>
        <th>Producto</th>
        <th>Categoría</th>
        <th>Cantidad</th>
        <th>Neto / ud</th>
        <th>Importe neto</th>
        <th>Código</th>
        <th>Familia</th>
        <th class="numeric">Tarifa unit.</th>
        <th class="numeric">Tarifa x ud</th>
        <th class="numeric">Total</th>
        <th>Retirada</th>
        <th>Estado</th>
    </tr>`;
    applyFiltersAndShow();
}

function applyFiltersAndShow(){
    const q = normalizeText(searchInput.value || "");
    const filterCat = categoryFilter.value || "all";

    const filtered = processedData.filter(row => {
        // Filtrar por categoría si aplica
        if(filterCat !== 'all'){
            if(filterCat === 'none'){
                if((row["Categoría"] || "") !== "") return false;
            } else {
                if(row["Categoría"] !== filterCat) return false;
            }
        }
        // Búsqueda global en valores
        if(!q) return true;
        const hay = [
            String(row["Fecha"] || ""),
            String(row["Expedidor"] || ""),
            String(row["Identificador de la tarea"] || ""),
            String(row["Cuenta"] || ""),
            String(row["Producto"] || ""),
            String(row["Código"] || ""),
            String(row["Familia"] || "")
        ].some(val => normalizeText(val).includes(q));
        return hay;
    });

    // construir filas con clases para colores por categoría y por PREM/TIMA
    tableBody.innerHTML = filtered.map(row => {
        const cat = String(row["Categoría"] || "").toUpperCase();
        // elegir clase por prioridad: PREM/TIMA sobre otras
        let rowClass = "row-none";
        if(cat.includes("PREM")) rowClass = "row-prem";
        else if(cat.includes("TIMA")) rowClass = "row-tima";
        else{
            const base = String(row["Categoría"]||"").toLowerCase();
            rowClass = `row-${base || 'none'}`;
        }

        // Retirada celda especial si no vacía
        const retiradaVal = row["Retirada"] ?? "";
        const retiradaClass = retiradaVal === "" ? "retirada" : "retirada not-empty";

        // numeric formatting: mostrar siempre 2 decimales en importes si no vacíos
        const fmt = v => (v === "" || v === null || v === undefined) ? "" : Number(v).toFixed(2);

        return `<tr class="${rowClass}">
            <td>${escapeHtml(row["Fecha"] ?? "")}</td>
            <td>${escapeHtml(row["Expedidor"] ?? "")}</td>
            <td>${escapeHtml(row["Transportista"] ?? "")}</td>
            <td>${escapeHtml(row["Identificador de la tarea"] ?? "")}</td>
            <td>${escapeHtml(row["Cuenta"] ?? "")}</td>
            <td>${escapeHtml(row["Pedido de ventas"] ?? "")}</td>
            <td>${escapeHtml(row["Producto"] ?? "")}</td>
            <td>${escapeHtml(row["Categoría"] ?? "")}</td>
            <td class="numeric">${escapeHtml(String(row["Cantidad"] ?? ""))}</td>
            <td class="numeric">${fmt(row["Neto / ud"])}</td>
            <td class="numeric">${fmt(row["Importe neto"])}</td>
            <td>${escapeHtml(row["Código"] ?? "")}</td>
            <td>${escapeHtml(row["Familia"] ?? "")}</td>
            <td class="numeric">${fmt(row["Tarifa unit."])}</td>
            <td class="numeric">${fmt(row["Tarifa x ud"])}</td>
            <td class="numeric">${fmt(row["Total"])}</td>
            <td class="${retiradaClass}">${escapeHtml(row["Retirada"] ?? "")}</td>
            <td>${escapeHtml(row["Estado"] ?? "")}</td>
        </tr>`;
    }).join('');

    countInfo.textContent = `Mostrando ${filtered.length} de ${processedData.length} filas`;
}

function escapeHtml(s){
    return String(s ?? "")
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'","&#39;");
}

/* --- eventos UI --- */
searchInput.addEventListener('input', () => applyFiltersAndShow());
categoryFilter.addEventListener('change', () => applyFiltersAndShow());

/* ===========================
    EXPORTAR (incluye nuevas columnas, nombres ya renombrados)
   =========================== */
exportBtn.addEventListener('click', ()=>{
    if(!processedData.length) return;

    // Construimos hoja con los encabezados exactos que quieres
    const out = processedData.map(r => ({
        "Fecha": r["Fecha"],
        "Expedidor": r["Expedidor"],
        "Transportista": r["Transportista"],
        "Identificador de la tarea": r["Identificador de la tarea"],
        "Cuenta": r["Cuenta"],
        "Pedido de ventas": r["Pedido de ventas"],
        "Producto": r["Producto"],
        "Categoría": r["Categoría"],
        "Cantidad": r["Cantidad"],
        "Neto / ud": r["Neto / ud"],
        "Importe neto": r["Importe neto"],
        "Código": r["Código"],
        "Familia": r["Familia"],
        "Tarifa unit.": r["Tarifa unit."],
        "Tarifa x ud": r["Tarifa x ud"],
        "Total": r["Total"],
        "Retirada": r["Retirada"],
        "Estado": r["Estado"]
    }));

    const header = ["Fecha","Expedidor","Transportista","Identificador de la tarea","Cuenta",
        "Pedido de ventas","Producto","Categoría","Cantidad","Neto / ud","Importe neto","Código",
        "Familia","Tarifa unit.","Tarifa x ud","Total","Retirada","Estado"];

    const ws = XLSX.utils.json_to_sheet(out, { header });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, "resultado_cruzado.xlsx");
});
