/* CCT.js */

// Tarifas globales
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
const fileInput2 = document.getElementById('fileInput2');
const exportBtn = document.getElementById('exportBtn');
const resultTable = document.getElementById('resultTable');
const tableHead = resultTable.querySelector('thead');
const tableBody = resultTable.querySelector('tbody');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const countInfo = document.getElementById('countInfo');

let processedData = [];
let secondData = []; // Excel 2 cargado

// Categorías
const CAT = {
    chais: ["RINCONERA PIEL","RINCONERA","CHAISE LONGUE PIEL","CHAISE LONGUE"],
    sofa: ["SOFA PIEL","SOFA","SOFA CAMA"],
    sillon: ["SILLON","SILLON PIEL","SILLON DECORATIVO","COMPLEMENTO SOFAS"],
    descanso: ["COLCHONES","SOMIERS Y BASES"],
    canape: ["CANAPÉ ABATIBLE","CANAPE ABATIBLE","CANAPÉ","CANAPE"],
    electro: ["EVACUACION","CONDENSACION","BOMBA DE CALOR","LIBRE INSTALACIÓN","LIBRE INSTALACION",
        "ENCASTRE","GAS","ELECTRICA","FRONTAL","SUPERIOR","LAVADORA /SECADORA","LAVA /SECA SUPERIOR",
        "INTEGRADAS","ACCESORIOS LAVADO","INTEGRABLE","TABLE TOP","1 PUERTA","2 PUERTAS","COMBI",
        "VINOTECAS","INTEGRACIÓN","INTEGRACION","ACCESORIOS","HORIZONTAL","VERTICAL","VERTICAL INTEGRABLE",
        "PLACAS","HORNOS","CAMPANAS","CONJUNTOS","CALEFACCIÓN","CALEFACCION","LED","IPS","DIRECT LED",
        "OLED","HD","FHD","UHD 4K"],
    americano: ["SIDE BY SIDE","AMERICANOS 4X4","AMERICANOS"]
};

// Normaliza cadenas
function normalizeText(txt){
    return String(txt ?? "").replace(/\s+/g, ' ').trim().toUpperCase();
}

function detectCategory(txt){
    const n = normalizeText(txt);
    for (const [cat,prefixes] of Object.entries(CAT)){
        if (prefixes.some(p => n.startsWith(normalizeText(p)))) return cat;
    }
    return "none";
}

function tarifaPorCategoria(cat){
    return ({
        chais:t_chais, sofa:t_sofa, sillon:t_sillon, descanso:t_descanso,
        canape:t_canape, electro:t_electro, americano:t_americano
    }[cat]) ?? "";
}

// Actualizar tarifas
document.getElementById('tarifas').addEventListener('input', () => {
    t_sillon = Number(t_sillon.value) || Number(document.getElementById('t_sillon').value) || 0;
    t_sofa = Number(document.getElementById('t_sofa').value) || 0;
    t_chais = Number(document.getElementById('t_chais').value) || 0;
    t_canape = Number(document.getElementById('t_canape').value) || 0;
    t_descanso = Number(document.getElementById('t_descanso').value) || 0;
    t_electro = Number(document.getElementById('t_electro').value) || 0;
    t_americano = Number(document.getElementById('t_americano').value) || 0;
    t_premium = Number(document.getElementById('t_premium').value) || 0;
    t_optima = Number(document.getElementById('t_optima').value) || 0;

    if(processedData.length) recalcTotalsAndRender();
});

// Cargar Excel 2 (BKO)
fileInput2.addEventListener('change', e=>{
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = e=>{
        secondData = XLSX.utils.sheet_to_json(XLSX.read(e.target.result,{type:"binary"}).Sheets["Hoja1"] || 
                                              XLSX.read(e.target.result,{type:"binary"}).Sheets[XLSX.read(e.target.result,{type:"binary"}).SheetNames[0]],
                                              {defval:""});
        alert("✅ Segundo archivo cargado. Ahora puedes cargar el primero.");
    };
    reader.readAsBinaryString(file);
});

// Esperar a segundo archivo antes de procesar
fileInput.addEventListener('change',()=>{
    if(!secondData.length){
        alert("⚠️ Primero debes cargar el segundo archivo.");
        fileInput.value="";
        return;
    }
    processFirstFile();
});

function processFirstFile(){
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = e=>{
        const rows = XLSX.utils.sheet_to_json(XLSX.read(e.target.result,{type:"binary"}).Sheets[
            XLSX.read(e.target.result,{type:"binary"}).SheetNames[0]
        ],{defval:""});

        processedData = rows.map(processRow);
        applyBusinessRules();
        renderTable(processedData);
        exportBtn.disabled = false;
    };
    reader.readAsBinaryString(file);
}

function processRow(row){
    const referencia = row["Artículo – Referencia"] || row["Referencia"] || "";
    const cantidad = Number(row["Artículo – Cantidad"] || 1);
    const identificador = row["Identificador de la tarea"] || "";
    const pedido = identificador.includes("|") ? identificador.split("|")[0].trim() : identificador;

    const cruce = articulos[String(referencia).trim()] ?? "";
    let categoria = detectCategory(cruce);
    if(categoria==="none") categoria = row["Modo de Entrega"] || "";

    // CRUCE CON EXCEL 2
    const match = secondData.find(r =>
        normalizeText(r["Pedido de ventas"])===normalizeText(pedido) &&
        normalizeText(r["Código de artículo"])===normalizeText(referencia)
    );
    const importeNeto = match ? Number(match["Importe neto"])||0 : "";

    // CÁLCULO TARIFAS ESPECIALES
    let tarifa = "";
    if(String(categoria).includes("PREM") && importeNeto!=="") tarifa = (importeNeto/cantidad)*t_premium;
    else if(String(categoria).includes("TIMA") && importeNeto!=="") tarifa = (importeNeto/cantidad)*t_optima;
    else tarifa = tarifaPorCategoria(categoria);

    const total = tarifa === "" ? "" : tarifa * cantidad;

    return {
        "Fecha": row["Fecha"]||"",
        "Expedidor": row["Expedidor"]||"",
        "Transportista": row["Transportista"]||"",
        "Identificador de la tarea": identificador,
        "Cuenta del cliente": row["Cuenta del cliente"]||"",
        "Pedido de ventas": pedido,
        "Artículo – Nombre": row["Artículo – Nombre"]||"",
        "Artículo – Cantidad": cantidad,
        "Artículo – Referencia": referencia,
        "Retirada": row["Retirada"]||"",
        "Cruce": cruce,
        "Categoría": categoria,
        "Importe neto": importeNeto,
        "Tarifa unit.": tarifa===""?"":Number(tarifa),
        "Total": total===""?"":Number(total),
        "Estado": row["Estado"]||""
    };
}

// Reglas finales agrupadas por pedido
function applyBusinessRules(){
    const grouped = {};
    processedData.forEach(r=>{
        if(!grouped[r["Pedido de ventas"]]) grouped[r["Pedido de ventas"]] = [];
        grouped[r["Pedido de ventas"]].push(r);
    });

    for(const pedido in grouped){
        const rows = grouped[pedido];
        const hasPREM = rows.some(r=>String(r["Categoría"]).includes("PREM"));
        const hasTIMA = rows.some(r=>String(r["Categoría"]).includes("TIMA"));

        if(hasPREM && hasTIMA){
            rows.forEach(r=>{
                if(String(r["Categoría"]).includes("TIMA")){
                    r["Categoría"]="autocorregido PREM";
                }
            });
        }

        if(hasPREM && !hasTIMA){
            let sum = rows.filter(r=>String(r["Categoría"]).includes("PREM"))
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
            let sum = rows.filter(r=>String(r["Categoría"]).includes("TIMA"))
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

// Dibujar tabla
function renderTable(){
    tableHead.innerHTML = `
    <tr>
        <th>Fecha</th><th>Expedidor</th><th>Transportista</th><th>Identificador de la tarea</th><th>Cuenta del cliente</th>
        <th>Pedido de ventas</th><th>Artículo – Nombre</th><th>Artículo – Cantidad</th><th>Artículo – Referencia</th>
        <th>Retirada</th><th>Cruce</th><th>Categoría</th><th>Importe neto</th><th>Tarifa unit.</th><th>Total</th><th>Estado</th>
    </tr>`;
    applyFiltersAndShow();
}

// Filtro + visualización
function applyFiltersAndShow(){
    const q = normalizeText(searchInput.value);
    const c = categoryFilter.value;

    const filtered = processedData.filter(r=>{
        if(c!=="all" && c!=="none" && r["Categoría"]!==c) return false;
        if(c==="none" && r["Categoría"]!=="") return false;
        if(q && !Object.values(r).some(v=>normalizeText(v).includes(q))) return false;
        return true;
    });

    tableBody.innerHTML = filtered.map(r=>`
<tr>
<td>${r["Fecha"]}</td><td>${r["Expedidor"]}</td><td>${r["Transportista"]}</td><td>${r["Identificador de la tarea"]}</td>
<td>${r["Cuenta del cliente"]}</td><td>${r["Pedido de ventas"]}</td><td>${r["Artículo – Nombre"]}</td>
<td>${r["Artículo – Cantidad"]}</td><td>${r["Artículo – Referencia"]}</td><td>${r["Retirada"]}</td>
<td>${r["Cruce"]}</td><td>${r["Categoría"]}</td><td>${r["Importe neto"]}</td>
<td>${r["Tarifa unit."]}</td><td>${r["Total"]}</td><td>${r["Estado"]}</td>
</tr>`).join('');

    countInfo.textContent = `Mostrando ${filtered.length} de ${processedData.length} filas`;
}

// Exportar
exportBtn.addEventListener('click',()=>{
    const ws = XLSX.utils.json_to_sheet(processedData,{
        header:["Fecha","Expedidor","Transportista","Identificador de la tarea",
        "Cuenta del cliente","Pedido de ventas","Artículo – Nombre","Artículo – Cantidad",
        "Artículo – Referencia","Retirada","Cruce","Categoría","Importe neto","Tarifa unit.","Total","Estado"]
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Resultado");
    XLSX.writeFile(wb,"resultado_cruzado.xlsx");
});
