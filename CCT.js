/* ============ CCT.js ============ */

// Tarifas globales
let t_sillon = Number(document.getElementById('t_sillon').value) || 20;
let t_sofa = Number(document.getElementById('t_sofa').value) || 27;
let t_chais = Number(document.getElementById('t_chais').value) || 35;
let t_canape = Number(document.getElementById('t_canape').value) || 30;
let t_descanso = Number(document.getElementById('t_descanso').value) || 12;
let t_electro = Number(document.getElementById('t_electro').value) || 19;
let t_americano = Number(document.getElementById('t_americano').value) || 22;
let t_premium = Number(document.getElementById('t_premium').value) || 0.105;
let t_optima = Number(document.getElementById('t_optima').value) || 0.05;

const fileInput = document.getElementById('fileInput');
const fileInput2 = document.getElementById('fileInput2');
const exportBtn = document.getElementById('exportBtn');
const tableHead = document.querySelector('#resultTable thead');
const tableBody = document.querySelector('#resultTable tbody');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const countInfo = document.getElementById('countInfo');

let processedData = [];
let secondData = []; // Excel 2 cargado

// Normalizar texto
function normalizeText(txt){
    return String(txt ?? "").replace(/\s+/g, ' ').trim().toUpperCase();
}

function ceil2(n){
    return Math.ceil(n * 100) / 100;
}

// Detectar categoría por catálogo
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
    for(const [cat,list] of Object.entries(CAT))
        if(list.some(x=>n.startsWith(normalizeText(x)))) return cat;
    return "none";
}
function tarifaPorCategoria(cat){
    return {
        chais:t_chais, sofa:t_sofa, sillon:t_sillon,
        descanso:t_descanso, canape:t_canape, electro:t_electro, americano:t_americano
    }[cat] ?? "";
}

/* ===========================
      Cargar segundo Excel
=========================== */
fileInput2.addEventListener('change',e=>{
    const file = e.target.files[0];
    const r = new FileReader();
    r.onload = e=>{
        const wb = XLSX.read(e.target.result,{type:'binary'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        secondData = XLSX.utils.sheet_to_json(sheet,{defval:""});
        alert("✅ Segundo archivo cargado correctamente.\nAhora carga el primero.");
    };
    r.readAsBinaryString(file);
});

/* ===========================
      Cargar primer Excel (solo si ya está el segundo)
=========================== */
fileInput.addEventListener('change',()=>{
    if(!secondData.length){
        alert("⚠️ Primero debes cargar el segundo archivo (BKO).");
        fileInput.value="";
        return;
    }
    loadFirst();
});

function loadFirst(){
    const file = fileInput.files[0];
    const r = new FileReader();
    r.onload = e=>{
        const wb = XLSX.read(e.target.result,{type:'binary'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet,{defval:""});

        processedData = rows.map(processRow);
        applyBusinessRules();
        renderTable();
        exportBtn.disabled = false;
    };
    r.readAsBinaryString(file);
}


/* ===========================
      PROCESAR UNA FILA
=========================== */
function processRow(row){
    const fecha = row["Fecha "] ?? row["Fecha"] ?? "";
    const expedidor = row["Expedidor"] ?? "";
    const transportista = row["Transportista"] ?? "";

    const identificador = row["Identificador de la tarea"] ?? row["Identificador"] ?? "";
    const pedido = identificador.includes("|") ? identificador.split("|")[0].trim() : identificador;

    const articuloNombre =
        row["Artículo – Nombre"] ??
        row["Artículo - Nombre"] ??
        row["Artículo Nombre"] ??
        row["Artículo"] ?? "";

    let cantidad =
        row["Artículo – Cantidad"] ??
        row["Artículo - Cantidad"] ??
        row["Artículo Cantidad"] ??
        row["Cantidad"];
    cantidad = Number(cantidad || 1);

    const referencia =
        row["Artículo – Referencia"] ??
        row["Artículo - Referencia"] ??
        row["Referencia"] ?? "";

    const retirada = row["Retirada"] ?? "";
    const estado = row["Estado"] ?? "";

    // Cruce con articulos.js
    const refKey = String(referencia).trim();
    const cruce = articulos[refKey] ?? articulos[Number(refKey)] ?? "";

    // Categoría
    let categoria = detectCategory(cruce);
    if(categoria==="none"||categoria==="") categoria = row["Modo de Entrega"] ?? row["Modo de entrega"] ?? "";

    // Cruce con Excel 2
    const match = secondData.find(r =>
        normalizeText(r["Pedido de ventas"]) === normalizeText(pedido) &&
        normalizeText(r["Código de artículo"]) === normalizeText(referencia)
    );
    const importeNeto = match ? Number(match["Importe neto"])||0 : "";

    // Tarifa especial
    let tarifaUnit="";
    if(String(categoria).includes("PREM") && importeNeto!=="") tarifaUnit=(importeNeto/cantidad)*t_premium;
    else if(String(categoria).includes("TIMA") && importeNeto!=="") tarifaUnit=(importeNeto/cantidad)*t_optima;
    else tarifaUnit = tarifaPorCategoria(categoria);

    const total = tarifaUnit==="" ? "" : tarifaUnit*cantidad;

    return {
        "Fecha":fecha,
        "Expedidor":expedidor,
        "Transportista":transportista,
        "Identificador de la tarea":identificador,
        "Cuenta del cliente":row["Cuenta del cliente"]??"",
        "Pedido de ventas":pedido,
        "Artículo – Nombre":articuloNombre,
        "Artículo – Referencia":referencia,
        "Retirada":retirada,
        "Cruce":cruce,
        "Categoría":categoria,
        "Importe neto": importeNeto === "" ? "" : ceil2(importeNeto),
        "Artículo – Cantidad":cantidad,
        "Tarifa unit.": tarifaUnit === "" ? "" : ceil2(tarifaUnit),
        "Total": total === "" ? "" : ceil2(total),
        "Estado":estado
    };
}

/* ===========================
      REGLAS POR PEDIDO
=========================== */
function applyBusinessRules(){
    const grouped={};
    processedData.forEach(r=>{
        if(!grouped[r["Pedido de ventas"]]) grouped[r["Pedido de ventas"]]=[];
        grouped[r["Pedido de ventas"]].push(r);
    });

    for(const pedido in grouped){
        const rows = grouped[pedido];
        const hasPREM = rows.some(r=>String(r["Categoría"]).includes("PREM"));
        const hasTIMA = rows.some(r=>String(r["Categoría"]).includes("TIMA"));

        if(hasPREM && hasTIMA){
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("TIMA"))
                    r["Categoría"]="autocorregido PREM";
            });
        }

        if(hasPREM && !hasTIMA){
            let sum=rows.filter(r=>String(r["Categoría"]).includes("PREM"))
                        .reduce((a,r)=>a+(Number(r["Total"])||0),0);
            sum = Math.max(sum,95);
            let first=true;
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("PREM")){
                    r["Total"]=first?sum:"";
                    first=false;
                }
            });
        }

        if(hasTIMA && !hasPREM){
            let sum=rows.filter(r=>String(r["Categoría"]).includes("TIMA"))
                        .reduce((a,r)=>a+(Number(r["Total"])||0),0);
            sum = Math.max(sum,40);
            let first=true;
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("TIMA")){
                    r["Total"]=first?sum:"";
                    first=false;
                }
            });
        }
    }
}

/* ===========================
      TABLA
=========================== */
function renderTable(){
    tableHead.innerHTML=`
    <tr>
        <th>Fecha</th><th>Expedidor</th><th>Transportista</th><th>Identificador de la tarea</th><th>Cuenta del cliente</th>
        <th>Pedido de ventas</th><th>Artículo – Nombre</th><th>Artículo – Referencia</th>
        <th>Retirada</th><th>Cruce</th><th>Categoría</th><th>Importe neto</th><th>Artículo – Cantidad</th><th>Tarifa unit.</th><th>Total</th><th>Estado</th>
    </tr>`;
    applyFiltersAndShow();
}

function applyFiltersAndShow(){
    const q=normalizeText(searchInput.value);
    const c=categoryFilter.value;

    const filtered=processedData.filter(r=>{
        if(c!=="all" && c!=="none" && r["Categoría"]!==c) return false;
        if(c==="none" && r["Categoría"]!=="") return false;
        if(q && !Object.values(r).some(v=>normalizeText(v).includes(q))) return false;
        return true;
    });

    tableBody.innerHTML = filtered.map(r=>`
<tr>
<td>${r["Fecha"]}</td><td>${r["Expedidor"]}</td><td>${r["Transportista"]}</td><td>${r["Identificador de la tarea"]}</td>
<td>${r["Cuenta del cliente"]}</td><td>${r["Pedido de ventas"]}</td><td>${r["Artículo – Nombre"]}</td>
<td>${r["Artículo – Referencia"]}</td>
<td>${r["Retirada"]}</td><td>${r["Cruce"]}</td><td>${r["Categoría"]}</td>
<td>${r["Importe neto"]}</td><td>${r["Artículo – Cantidad"]}</td><td>${r["Tarifa unit."]}</td><td>${r["Total"]}</td><td>${r["Estado"]}</td>
</tr>`).join('');

    countInfo.textContent=`Mostrando ${filtered.length} de ${processedData.length} filas`;
}

/* ===========================
      EXPORTAR
=========================== */
exportBtn.addEventListener('click',()=>{
    const ws = XLSX.utils.json_to_sheet(processedData,{
        header:["Fecha","Expedidor","Transportista","Identificador de la tarea","Cuenta del cliente",
        "Pedido de ventas","Artículo – Nombre","Artículo – Referencia","Retirada",
        "Cruce","Categoría","Importe neto","Artículo – Cantidad","Tarifa unit.","Total","Estado"]
    });
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Resultado");
    XLSX.writeFile(wb,"resultado_cruzado.xlsx");
});
