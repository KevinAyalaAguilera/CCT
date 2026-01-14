/* ============ CCT.js ============ */

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
const fileInput3 = document.getElementById('fileInput3');
const exportBtn = document.getElementById('exportBtn');
const tableHead = document.querySelector('#resultTable thead');
const tableBody = document.querySelector('#resultTable tbody');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const countInfo = document.getElementById('countInfo');

/* --- Datos en memoria --- */
let originalRows = [];   // rows raw del primer excel (para re-procesar)
let processedData = [];  // filas procesadas mostradas / exportadas
let secondData = [];     // JSON del segundo excel (Importe neto)
let thirdData = [];      // JSON del tercer excel (Gastos totales, Factura)

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
    electro:["EVACUAC","BOMBA DE CALOR","COMBI","FRONTAL 200","2 PUERTAS 211","CONDENSACION 194","HORIZONTAL","CALEFACCIÓN","INTEGRABLE","SECADORA","LED","OLED","UHD","LAVADORA","FRIGORÍFICO","HORNOS","PLACA","CAMPANA","VINOTECAS", "LIBRE INSTALACIÓN"],
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
        processedData = originalRows.map(processRow);
        applyBusinessRules();
        applyPedidoSummaries();
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
        alert("✅ Segundo archivo (Importe neto) cargado correctamente.");
    };
    r.readAsBinaryString(file);
});

/* ===========================
    CARGA DEL TERCER EXCEL (Gastos / Facturas)
   =========================== */
fileInput3.addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const r = new FileReader();
    r.onload = e=>{
        const wb = XLSX.read(e.target.result,{type:'binary'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        thirdData = XLSX.utils.sheet_to_json(sheet,{defval:""});
        alert("✅ Tercer archivo (Gastos/Facturas) cargado correctamente.");
    };
    r.readAsBinaryString(file);
});

/* ===========================
    CARGA DEL PRIMER EXCEL (solo si hay secondData y thirdData)
   =========================== */
fileInput.addEventListener('change', ()=>{
    if(!secondData.length){
        alert("⚠️ Debes cargar primero el segundo archivo (Importe neto).");
        fileInput.value = "";
        return;
    }
    if(!thirdData.length){
        alert("⚠️ Debes cargar también el tercer archivo (Gastos/Facturas).");
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
        originalRows = rows.slice(); // guardamos los raws
        processedData = originalRows.map(processRow);
        applyBusinessRules();
        applyPedidoSummaries();
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

    const nombre = row["Representante del cliente"] ?? "";
    const town = row["Ciudad"] ?? "";
    const postalcode = row["Código postal"] ?? "";

    const repartidor = row["Repartidor"] ?? "";
    const ruta = row["Ruta"] ?? "";

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
    // *** NUEVA REGLA: productos tipo "patas" o "servicio" = categoría "vacío" ***
    const prodNorm = normalizeText(producto);
    if (prodNorm.includes("PATAS") || prodNorm.includes("SERVICIO")) {
        categoria = "vacío";
    }


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
    if(categoria === "vacío") {
        tarifaUnitRaw = 0;
    } else if(String(categoria).toUpperCase().includes("ENTREGA PREMIUM") && importeNetoRaw !== "") {
        tarifaUnitRaw = (importeNetoRaw / cantidad) * t_premium;
    } else if(String(categoria).toUpperCase().includes("WEB - ENT PREMIUM") && importeNetoRaw !== "") {
        tarifaUnitRaw = (importeNetoRaw / cantidad) * t_premium;
    } else if(String(categoria).toUpperCase().includes("ENTREGA ÓPTIMA") && importeNetoRaw !== "") {
        tarifaUnitRaw = (importeNetoRaw / cantidad) * t_optima;
    } else if(String(categoria).toUpperCase().includes("WEB - ENT OPTIMA") && importeNetoRaw !== "") {
        tarifaUnitRaw = (importeNetoRaw / cantidad) * t_optima;
    } else {
        tarifaUnitRaw = tarifaPorCategoria(categoria);
    }


    // Tarifa x ud (cantidad * tarifa unit.) y total (tarifaUnit * cantidad)
    const tarifaXudRaw = (tarifaUnitRaw === "" || tarifaUnitRaw === null) ? "" : (Number(cantidad) * Number(tarifaUnitRaw));
    const totalRaw = (tarifaUnitRaw === "" || tarifaUnitRaw === null) ? "" : (Number(tarifaUnitRaw) * Number(cantidad));

    // Aplicar redondeo AL ALZA a centésimas para las columnas solicitadas
    const importeNeto = importeNetoRaw === "" ? "" : ceil2(importeNetoRaw);
    const netoPorUd = (netoPorUdRaw === "" ? "" : ceil2(netoPorUdRaw));
    const tarifaUnit = (tarifaUnitRaw === "" ? "" : ceil2(tarifaUnitRaw));
    const tarifaXud = (tarifaXudRaw === "" ? "" : ceil2(tarifaXudRaw));
    const total = (totalRaw === "" ? "" : ceil2(totalRaw));

    // Comentarios
    const comentarioOK = row["Comentario de la entrega "] ?? ""; // fix
    const comentarioKO = row["comentario_entrega_fallida"] ?? "";

    return {
        "Fecha": fecha,
        "Expedidor": expedidor,
        "Transportista": transportista,
        "Ruta": ruta,
        "Repartidor": repartidor,
        "Identificador de la tarea": identificador,
        "Cuenta": row["Cuenta del cliente"] ?? row["Cuenta"] ?? "",
        "Pedido de ventas": pedido,
        "Nombre": nombre,
        "Ciudad": town,
        "CP": postalcode,
        "Producto": producto,
        "Categoría": categoria,
        "Cantidad": cantidad,
        "Neto / ud": netoPorUd,
        "Importe neto": importeNeto,
        "Código": codigo,
        "Familia": cruce,
        "Tarifa unit.": tarifaUnit,
        "Tarifa x ud": tarifaXud,
        "Total": total,
        "Retirada": retirada,
        "Estado": estado,
        // columnas nuevas (se rellenarán por pedido en applyPedidoSummaries)
        "Total coste pedido": "",
        "Gastos facturados SIN IVA": "",
        "Diferencia": "",
        "Comentario OK": comentarioOK,
        "Comentario KO": comentarioKO
    };
}

/* ===========================
    REGLAS POR PEDIDO (ya usan los campos procesados)
   =========================== */
function applyBusinessRules(){
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

        if(hasPREM && hasTIMA){
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("TIMA")){
                    r["Categoría"] = "autocorregido PREM";
                }
            });
        }

        if(hasPREM && !hasTIMA){
            let sum = rows.filter(r=>String(r["Categoría"]).includes("PREM"))
                          .reduce((a,r)=>a+(Number(r["Total"])||0),0);
            sum = Math.max(sum,55);
            let first=true;
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("PREM")){
                    r["Total"] = first ? ceil2(sum) : "";
                    first=false;
                }
            });
        }

        if(hasTIMA && !hasPREM){
            let sum = rows.filter(r=>String(r["Categoría"]).includes("TIMA"))
                          .reduce((a,r)=>a+(Number(r["Total"])||0),0);
            sum = Math.max(sum,20);
            let first=true;
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("TIMA")){
                    r["Total"] = first ? ceil2(sum) : "";
                    first=false;
                }
            });
        }
    }
}

/* ===========================
    RESÚMENES POR PEDIDO (Total coste pedido y Gastos facturados SIN IVA)
   =========================== */
function applyPedidoSummaries(){
    // Pre-calcular gastos por pedido desde thirdData
    const gastosByPedido = {};
    thirdData.forEach(r=>{
        const p = String(r["Pedido de ventas"] ?? "").trim();
        if(!p) return;
        const gasto = Number(r["Gastos totales"] || r["Gasto total"] || 0) || 0;
        gastosByPedido[p] = (gastosByPedido[p] || 0) + gasto;
    });

    // Agrupamos
    const groups = {};
    processedData.forEach(r=>{
        const p = r["Pedido de ventas"] ?? "";
        if(!groups[p]) groups[p] = [];
        groups[p].push(r);
        r["Total coste pedido"] = "";
        r["Gastos facturados SIN IVA"] = "";
        r["Diferencia"] = "";
    });

    for(const p in groups){
        const rows = groups[p];

        /* -----------------------------
           (1) AJUSTE ELECTRO + Tarifa
        ------------------------------*/
        const electroRows = rows.filter(r => String(r["Categoría"]).toLowerCase().includes("electro"));
        if(electroRows.length > 2){
            // Dejar primeras 2 tal cual, y a partir de la 3ª aplicar tarifa 12€
            for(let i = 2; i < electroRows.length; i++){
                const r = electroRows[i];
                const cantidad = Number(r["Cantidad"]) || 1;
                const nuevoTotal = ceil2(cantidad * 12);
                r["Tarifa unit."] = ceil2(12);
                r["Tarifa x ud"] = ceil2(cantidad * 12);
                r["Total"] = nuevoTotal;
            }
        }

        /* -----------------------------
           (2) SUMATORIO BASE
        ------------------------------*/
        let sumaTotal = rows.reduce((a,r)=> a + (Number(r["Total"])||0), 0);

        /* -----------------------------
           (3) SUMAS POR RETIRADA
        ------------------------------*/
        for(const r of rows){
            const ret = normalizeText(r["Retirada"]);
            if(ret.includes("RETIRADA CHAIS") || ret.includes("RINCONERA")) sumaTotal += 15;
            else if(ret.includes("RETIRADA SOFAS")) sumaTotal += 15;
            else if(ret.includes("RETIRADA DE SILLON")) sumaTotal += 15;
            else if(ret.includes("RETIRADA DESCANSO")) sumaTotal += 12;
        }

        sumaTotal = ceil2(sumaTotal);

        /* -----------------------------
           (4) GASTOS FACTURADOS
        ------------------------------*/
        const gastosRaw = gastosByPedido[p] || 0;
        const gastosRounded = gastosRaw === 0 ? 0 : ceil2(gastosRaw);

        /* -----------------------------
           (5) Ponemos valores en la primera fila del pedido
        ------------------------------*/
        let first = true;
        for(const r of rows){
            if(first){
                r["Total coste pedido"] = sumaTotal;
                r["Gastos facturados SIN IVA"] = gastosRounded;
                r["Diferencia"] = ceil2(sumaTotal - gastosRounded);
                first = false;
            } else {
                r["Total coste pedido"] = "";
                r["Gastos facturados SIN IVA"] = "";
                r["Diferencia"] = "";
            }
        }
    }
}


/* ===========================
    RENDER / FILTRADO / EXPORT
   =========================== */

function renderTable(){
    tableHead.innerHTML = `
    <tr>
        <th>Fecha</th>
        <th>Expedidor</th>
        <th>Transportista</th>
        <th>Repartidor</th>
        <th>Ruta</th>
        <th>Identificador de la tarea</th>
        <th>Cuenta</th>
        <th>Pedido de ventas</th>
        <th>Nombre</th>
        <th>Ciudad</th>
        <th>CP</th>
        <th>Producto</th>
        <th>Categoría</th>
        <th>Cantidad</th>
        <th class="numeric">Neto / ud</th>
        <th class="numeric">Importe neto</th>
        <th>Código</th>
        <th>Familia</th>
        <th class="numeric">Tarifa unit.</th>
        <th class="numeric">Tarifa x ud</th>
        <th class="numeric">Total</th>
        <th>Retirada</th>
        <th>Estado</th>
        <th class="numeric">Total coste pedido</th>
        <th class="numeric">Gastos facturados SIN IVA</th>
        <th class="numeric">Diferencia</th>
        <th>Comentario OK</th>
        <th>Comentario KO</th>
    </tr>`;
    applyFiltersAndShow();
}

function applyFiltersAndShow(){
    const q = normalizeText(searchInput.value || "");
    const filterCat = categoryFilter.value || "all";

    const filtered = processedData.filter(row => {
        if(filterCat !== 'all'){
            if(filterCat === 'none'){
                if((row["Categoría"] || "") !== "") return false;
            } else {
                if(row["Categoría"] !== filterCat) return false;
            }
        }
        if(!q) return true;
        const hay = [
            String(row["Fecha"] || ""),
            String(row["Expedidor"] || ""),
            String(row["Identificador de la tarea"] || ""),
            String(row["Nombre"] || ""),
            String(row["Cuenta"] || ""),
            String(row["Producto"] || ""),
            String(row["Código"] || ""),
            String(row["Familia"] || "")
        ].some(val => normalizeText(val).includes(q));
        return hay;
    });

    const fmt = v => (v === "" || v === null || v === undefined) ? "" : Number(v).toFixed(2);

    tableBody.innerHTML = filtered.map(row => {
        const cat = String(row["Categoría"] || "").toUpperCase();
        let rowClass = "row-none";
        if(cat.includes("PREM")) rowClass = "row-prem";
        else if(cat.includes("TIMA")) rowClass = "row-tima";
        else{
            const base = String(row["Categoría"]||"").toLowerCase();
            rowClass = `row-${base || 'none'}`;
        }

        const retiradaVal = row["Retirada"] ?? "";
        const retiradaClass = retiradaVal === "" ? "retirada" : "retirada not-empty";

        // diferencia cell highlight if Total coste pedido > Gastos facturados SIN IVA
        const diferenciaVal = row["Diferencia"];
        const diferenciaClass = (Number(row["Total coste pedido"]||0) > Number(row["Gastos facturados SIN IVA"]||0) && diferenciaVal !== "" ) ? "cell-exceso" : "";

        return `<tr class="${rowClass}">
            <td>${escapeHtml(row["Fecha"] ?? "")}</td>
            <td>${escapeHtml(row["Expedidor"] ?? "")}</td>
            <td>${escapeHtml(row["Transportista"] ?? "")}</td>
            <td>${escapeHtml(row["Repartidor"] ?? "")}</td>
            <td>${escapeHtml(row["Ruta"] ?? "")}</td>
            <td>${escapeHtml(row["Identificador de la tarea"] ?? "")}</td>
            <td>${escapeHtml(row["Cuenta"] ?? "")}</td>
            <td>${escapeHtml(row["Pedido de ventas"] ?? "")}</td>
            <td>${escapeHtml(row["Nombre"] ?? "")}</td>
            <td>${escapeHtml(row["Ciudad"] ?? "")}</td>
            <td>${escapeHtml(row["CP"] ?? "")}</td>
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
            <td class="numeric">${fmt(row["Total coste pedido"])}</td>
            <td class="numeric">${fmt(row["Gastos facturados SIN IVA"])}</td>
            <td class="numeric ${diferenciaClass}">${fmt(row["Diferencia"])}</td>
            <td>${escapeHtml(row["Comentario OK"] ?? "")}</td>
            <td>${escapeHtml(row["Comentario KO"] ?? "")}</td>
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
    EXPORTAR (incluye nuevas columnas)
   =========================== */
exportBtn.addEventListener('click', ()=>{
    if(!processedData.length) return;

    const out = processedData.map(r => ({
        "Fecha": r["Fecha"],
        "Expedidor": r["Expedidor"],
        "Transportista": r["Transportista"],
        "Repartidor": r["Repartidor"],
        "Ruta": r["Ruta"],
        "Identificador de la tarea": r["Identificador de la tarea"],
        "Cuenta": r["Cuenta"],
        "Pedido de ventas": r["Pedido de ventas"],
        "Nombre": r["Nombre"],
        "Ciudad": r["Ciudad"],
        "CP": r["CP"],
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
        "Estado": r["Estado"],
        "Total coste pedido": r["Total coste pedido"],
        "Gastos facturados SIN IVA": r["Gastos facturados SIN IVA"],
        "Diferencia": r["Diferencia"],
        "Comentario OK": r["Comentario OK"],
        "Comentario KO": r["Comentario KO"]
    }));

    const header = ["Fecha","Expedidor","Transportista","Repartidor","Ruta","Identificador de la tarea","Cuenta",
        "Pedido de ventas","Nombre","Ciudad","CP","Producto","Categoría","Cantidad","Neto / ud","Importe neto","Código","Familia",
        "Tarifa unit.","Tarifa x ud","Total","Retirada","Estado","Total coste pedido","Gastos facturados SIN IVA","Diferencia","Comentario OK","Comentario KO"];

    const ws = XLSX.utils.json_to_sheet(out, { header });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, "resultado_cruzado.xlsx");
});
