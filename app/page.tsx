<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fleet Availability Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root{
      --primary:#ff6a00;
      --primary-dark:#cc5500;
      --bg:#0a192f;
      --panel:#112240;
      --panel-2:#1a2f52;
      --soft:#243b64;
      --text:#ffffff;
      --muted:#b7c2d0;
      --success:#20bf6b;
      --warning:#f7b731;
      --danger:#eb3b5a;
      --border:rgba(255,255,255,0.08);
      --shadow:0 10px 30px rgba(0,0,0,0.28);
      --radius:18px;
      --max-width:1400px;
    }

    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at top, rgba(255,106,0,0.12), transparent 24%),
        radial-gradient(circle at right top, rgba(255,255,255,0.06), transparent 18%),
        var(--bg);
      color:var(--text);
    }

    .app-shell{
      width:100%;
      max-width:var(--max-width);
      margin:0 auto;
      padding:20px;
    }

    .topbar{
      display:flex;
      flex-wrap:wrap;
      gap:14px;
      justify-content:space-between;
      align-items:center;
      margin-bottom:18px;
    }

    .brand{
      display:flex;
      align-items:center;
      gap:12px;
    }

    .brand-badge{
      width:48px;
      height:48px;
      border-radius:14px;
      background:linear-gradient(135deg,var(--primary),#ff9f43);
      display:grid;
      place-items:center;
      font-weight:700;
      color:#111;
      box-shadow:var(--shadow);
    }

    .brand h1{
      margin:0;
      font-size:1.35rem;
      line-height:1.1;
    }

    .brand p{
      margin:3px 0 0;
      color:var(--muted);
      font-size:0.9rem;
    }

    .controls{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      align-items:center;
    }

    .panel{
      background:linear-gradient(180deg,var(--panel),var(--panel-2));
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:16px;
    }

    .controls .panel{
      padding:12px;
    }

    input[type="file"],
    input[type="text"],
    select{
      background:#0e1d35;
      color:var(--text);
      border:1px solid var(--border);
      padding:11px 12px;
      border-radius:12px;
      outline:none;
      min-height:42px;
    }

    input[type="text"]{
      min-width:220px;
    }

    button{
      border:none;
      background:var(--primary);
      color:#111;
      padding:11px 14px;
      border-radius:12px;
      cursor:pointer;
      font-weight:700;
      min-height:42px;
    }

    button:hover{
      background:#ff7f24;
    }

    button.secondary{
      background:#213757;
      color:var(--text);
      border:1px solid var(--border);
    }

    button.danger{
      background:var(--danger);
      color:#fff;
    }

    .admin-toggle{
      display:flex;
      align-items:center;
      gap:8px;
      color:var(--muted);
      font-size:0.95rem;
    }

    .summary-grid{
      display:grid;
      grid-template-columns:repeat(4, minmax(0,1fr));
      gap:14px;
      margin-bottom:18px;
    }

    .card{
      background:linear-gradient(180deg,#132747,#0e1e36);
      border:1px solid var(--border);
      border-radius:18px;
      padding:18px;
      min-height:120px;
    }

    .card h3{
      margin:0 0 10px;
      color:var(--muted);
      font-size:0.95rem;
      font-weight:600;
    }

    .metric{
      font-size:2rem;
      font-weight:800;
      margin:0;
    }

    .submetric{
      margin-top:8px;
      color:var(--muted);
      font-size:0.92rem;
    }

    .status-good{color:var(--success)}
    .status-warn{color:var(--warning)}
    .status-bad{color:var(--danger)}

    .charts-grid{
      display:grid;
      grid-template-columns:1.2fr 1fr;
      gap:18px;
      margin-bottom:18px;
      align-items:start;
    }

    .chart-panel{
      min-width:0;
      overflow:hidden;
    }

    .chart-wrap{
      position:relative;
      width:100%;
      height:320px;
      max-width:100%;
    }

    .section-title{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }

    .section-title h2{
      margin:0;
      font-size:1.1rem;
    }

    .muted{
      color:var(--muted);
      font-size:0.9rem;
    }

    .table-wrap{
      width:100%;
      overflow-x:auto;
      border-radius:14px;
      border:1px solid var(--border);
    }

    table{
      width:100%;
      border-collapse:collapse;
      min-width:900px;
      background:#0e1d35;
    }

    th, td{
      padding:10px 12px;
      border-bottom:1px solid rgba(255,255,255,0.06);
      text-align:left;
      font-size:0.92rem;
      vertical-align:middle;
    }

    th{
      background:#142846;
      color:#dbe7f5;
      position:sticky;
      top:0;
      z-index:1;
    }

    tr:hover td{
      background:rgba(255,255,255,0.03);
    }

    .badge{
      display:inline-block;
      padding:5px 10px;
      border-radius:999px;
      font-size:0.8rem;
      font-weight:700;
      white-space:nowrap;
    }

    .badge-available{background:rgba(32,191,107,0.16); color:#7bed9f;}
    .badge-breakdown{background:rgba(235,59,90,0.16); color:#ff7b98;}
    .badge-maintenance{background:rgba(247,183,49,0.16); color:#ffd166;}
    .badge-repair{background:rgba(255,106,0,0.16); color:#ffb26b;}
    .badge-other{background:rgba(116,125,140,0.2); color:#dfe4ea;}

    .split-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:18px;
      margin-bottom:18px;
    }

    .machine-panels{
      display:grid;
      grid-template-columns:1fr;
      gap:18px;
      margin-bottom:18px;
    }

    .pill-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:10px;
    }

    .tiny-pill{
      padding:6px 10px;
      border-radius:999px;
      background:#1f3557;
      color:#dbe7f5;
      font-size:0.8rem;
      border:1px solid var(--border);
    }

    .hidden{
      display:none !important;
    }

    .search-result{
      margin-top:10px;
      padding:12px;
      border-radius:12px;
      background:#10223d;
      border:1px solid var(--border);
    }

    .footer-note{
      margin-top:16px;
      color:var(--muted);
      font-size:0.85rem;
    }

    .small-btn{
      padding:8px 10px;
      min-height:auto;
      font-size:0.82rem;
      border-radius:10px;
    }

    .action-group{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
    }

    @media (max-width:1100px){
      .summary-grid{
        grid-template-columns:repeat(2, minmax(0,1fr));
      }
      .charts-grid,
      .split-grid{
        grid-template-columns:1fr;
      }
    }

    @media (max-width:640px){
      .summary-grid{
        grid-template-columns:1fr;
      }
      input[type="text"]{
        min-width:100%;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <div class="topbar">
      <div class="brand">
        <div class="brand-badge">FA</div>
        <div>
          <h1>Fleet Availability Dashboard</h1>
          <p>Upload Excel, manage fleet sections, and track availability properly</p>
        </div>
      </div>

      <div class="controls">
        <div class="panel">
          <input type="file" id="excelFile" accept=".xlsx,.xls,.csv" />
        </div>

        <div class="panel">
          <input type="text" id="searchFleet" placeholder="Search fleet / registration number" />
          <button id="searchBtn">Search</button>
        </div>

        <div class="panel admin-toggle">
          <label>
            <input type="checkbox" id="adminMode" />
            Admin mode
          </label>
        </div>

        <div class="panel">
          <button class="secondary" id="loadSampleBtn">Load sample data</button>
          <button class="secondary" id="resetBtn">Reset</button>
        </div>
      </div>
    </div>

    <div id="searchOutput" class="search-result hidden"></div>

    <div class="summary-grid">
      <div class="card">
        <h3>Total Active Fleet</h3>
        <p class="metric" id="totalFleet">0</p>
        <div class="submetric">Excludes major repairs / long term rebuild</div>
      </div>

      <div class="card">
        <h3>Available Units</h3>
        <p class="metric status-good" id="availableFleet">0</p>
        <div class="submetric" id="availablePct">0%</div>
      </div>

      <div class="card">
        <h3>Unavailable Units</h3>
        <p class="metric status-bad" id="unavailableFleet">0</p>
        <div class="submetric" id="unavailablePct">0%</div>
      </div>

      <div class="card">
        <h3>Excluded from Totals</h3>
        <p class="metric status-warn" id="excludedFleet">0</p>
        <div class="submetric">Major Repairs + Long Term Rebuild</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="panel chart-panel">
        <div class="section-title">
          <h2>Overall Availability</h2>
          <span class="muted">Chart size fixed so page does not stretch</span>
        </div>
        <div class="chart-wrap">
          <canvas id="availabilityChart"></canvas>
        </div>
      </div>

      <div class="panel chart-panel">
        <div class="section-title">
          <h2>Department Availability</h2>
          <span class="muted">Auto-calculated from machine assignments</span>
        </div>
        <div class="chart-wrap">
          <canvas id="departmentChart"></canvas>
        </div>
      </div>
    </div>

    <div class="split-grid">
      <div class="panel">
        <div class="section-title">
          <h2>Light Vehicles</h2>
          <span class="muted">Grouped separately</span>
        </div>
        <div class="pill-row" id="lightVehiclePills"></div>
        <div class="table-wrap" style="margin-top:12px;">
          <table>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Department</th>
                <th>Status</th>
                <th>Section</th>
                <th>Notes</th>
                <th class="admin-only hidden">Actions</th>
              </tr>
            </thead>
            <tbody id="lightVehiclesTable"></tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="section-title">
          <h2>Excluded Units</h2>
          <span class="muted">Do not affect overall fleet totals</span>
        </div>

        <div class="pill-row">
          <span class="tiny-pill">Major Repairs: <strong id="majorRepairsCount">0</strong></span>
          <span class="tiny-pill">Long Term Rebuild: <strong id="longTermCount">0</strong></span>
        </div>

        <div class="table-wrap" style="margin-top:12px;">
          <table>
            <thead>
              <tr>
                <th>Fleet / Registration</th>
                <th>Department</th>
                <th>Status</th>
                <th>Section</th>
                <th>Notes</th>
                <th class="admin-only hidden">Actions</th>
              </tr>
            </thead>
            <tbody id="excludedTable"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="machine-panels">
      <div class="panel">
        <div class="section-title">
          <h2>Main Fleet Machines</h2>
          <span class="muted">Bottom section added back</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fleet / Registration</th>
                <th>Machine Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Section</th>
                <th>Notes</th>
                <th class="admin-only hidden">Actions</th>
              </tr>
            </thead>
            <tbody id="mainFleetTable"></tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="section-title">
          <h2>All Machines Summary</h2>
          <span class="muted">Everything from the Excel shown below</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fleet / Registration</th>
                <th>Machine Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Section</th>
                <th>Included In Totals</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody id="allFleetTable"></tbody>
          </table>
        </div>
        <div class="footer-note">
          Expected Excel columns the app can read automatically:
          <strong>Fleet No</strong>, <strong>Registration</strong>, <strong>Machine</strong>, <strong>Type</strong>, <strong>Department</strong>, <strong>Status</strong>, <strong>Section</strong>, <strong>Notes</strong>.
          If your headings differ slightly, this code tries to match them.
        </div>
      </div>
    </div>
  </div>

  <script>
    let rawFleetData = [];
    let availabilityChart = null;
    let departmentChart = null;

    const knownLightVehicles = new Set([
      "AFE 5504","AFN 0307","AFR 5684","AFX 1489","AFC 9890","AEX 0451",
      "AFK 8279","AFX 0359","AFX 3400","ABH 4195","AEK 9938","AGA 5529",
      "AGA 5514","AGA 5421","AGE 7705","AGP 9562","AGE 5580","AGP 4457",
      "AGP 4458","AGQ 7369","AGQ 7370","AFX 7681","AEX 0450","AHH 2977"
    ]);

    const sampleData = [
      { fleetNo:"EX001", registration:"", machineType:"Excavator", department:"Mining", status:"Available", section:"Main Fleet", notes:"" },
      { fleetNo:"DT012", registration:"", machineType:"Dump Truck", department:"Mining", status:"Breakdown", section:"Main Fleet", notes:"Engine issue" },
      { fleetNo:"LD004", registration:"", machineType:"Loader", department:"Plant", status:"Maintenance", section:"Main Fleet", notes:"Service due" },
      { fleetNo:"DG003", registration:"", machineType:"Dozer", department:"Plant", status:"Available", section:"Main Fleet", notes:"" },
      { fleetNo:"LV001", registration:"AFE 5504", machineType:"Light Vehicle", department:"Admin", status:"Available", section:"Light Vehicles", notes:"" },
      { fleetNo:"LV002", registration:"AFN 0307", machineType:"Light Vehicle", department:"Operations", status:"Maintenance", section:"Light Vehicles", notes:"Tyres" },
      { fleetNo:"LV003", registration:"AFX 1489", machineType:"Light Vehicle", department:"Workshop", status:"Available", section:"Light Vehicles", notes:"" },
      { fleetNo:"EX009", registration:"", machineType:"Excavator", department:"Mining", status:"Repair", section:"Major Repairs", notes:"Hydraulic rebuild" },
      { fleetNo:"DT022", registration:"", machineType:"Dump Truck", department:"Mining", status:"Repair", section:"Long Term Rebuild", notes:"Transmission rebuild" }
    ];

    function normalizeText(value){
      return String(value ?? "").trim();
    }

    function cleanUpper(value){
      return normalizeText(value).toUpperCase();
    }

    function findColumn(row, names){
      const keys = Object.keys(row || {});
      for(const key of keys){
        const lower = key.toLowerCase().trim();
        if(names.some(name => lower === name)) return key;
      }
      for(const key of keys){
        const lower = key.toLowerCase().trim();
        if(names.some(name => lower.includes(name))) return key;
      }
      return null;
    }

    function isAvailableStatus(status){
      const s = cleanUpper(status);
      return s === "AVAILABLE" || s === "RUNNING" || s === "WORKING" || s === "ACTIVE";
    }

    function getStatusBadge(status){
      const s = cleanUpper(status);
      if(["AVAILABLE","RUNNING","WORKING","ACTIVE"].includes(s)){
        return `<span class="badge badge-available">${status || "Available"}</span>`;
      }
      if(["BREAKDOWN","BROKEN DOWN","DOWN"].includes(s)){
        return `<span class="badge badge-breakdown">${status || "Breakdown"}</span>`;
      }
      if(["MAINTENANCE","SERVICE","PM SERVICE"].includes(s)){
        return `<span class="badge badge-maintenance">${status || "Maintenance"}</span>`;
      }
      if(["REPAIR","MAJOR REPAIR","REBUILD"].includes(s)){
        return `<span class="badge badge-repair">${status || "Repair"}</span>`;
      }
      return `<span class="badge badge-other">${status || "Other"}</span>`;
    }

    function classifySection(item){
      const reg = cleanUpper(item.registration);
      const type = cleanUpper(item.machineType);
      const section = cleanUpper(item.section);

      if(section === "MAJOR REPAIRS") return "Major Repairs";
      if(section === "LONG TERM REBUILD") return "Long Term Rebuild";

      if(
        type.includes("LIGHT") ||
        knownLightVehicles.has(reg)
      ){
        return "Light Vehicles";
      }

      return item.section && item.section.trim() ? item.section.trim() : "Main Fleet";
    }

    function prepareRow(row){
      const fleetNoKey = findColumn(row, ["fleet no", "fleet number", "fleet", "unit no", "unit"]);
      const regKey = findColumn(row, ["registration", "reg no", "reg", "registration no"]);
      const machineKey = findColumn(row, ["machine", "machine type", "type", "equipment"]);
      const deptKey = findColumn(row, ["department", "dept"]);
      const statusKey = findColumn(row, ["status", "condition"]);
      const sectionKey = findColumn(row, ["section", "category", "group"]);
      const notesKey = findColumn(row, ["notes", "remarks", "comment", "comments"]);

      const item = {
        fleetNo: normalizeText(fleetNoKey ? row[fleetNoKey] : ""),
        registration: normalizeText(regKey ? row[regKey] : ""),
        machineType: normalizeText(machineKey ? row[machineKey] : ""),
        department: normalizeText(deptKey ? row[deptKey] : "Unassigned"),
        status: normalizeText(statusKey ? row[statusKey] : "Available"),
        section: normalizeText(sectionKey ? row[sectionKey] : ""),
        notes: normalizeText(notesKey ? row[notesKey] : "")
      };

      if(!item.fleetNo && item.registration) item.fleetNo = item.registration;
      if(!item.registration && knownLightVehicles.has(cleanUpper(item.fleetNo))) item.registration = item.fleetNo;
      if(!item.machineType && item.registration) item.machineType = "Light Vehicle";

      item.section = classifySection(item);
      return item;
    }

    function setData(data){
      rawFleetData = data.map(item => ({
        fleetNo: item.fleetNo || "",
        registration: item.registration || "",
        machineType: item.machineType || "",
        department: item.department || "Unassigned",
        status: item.status || "Available",
        section: classifySection(item),
        notes: item.notes || ""
      }));
      renderAll();
    }

    function getIncludedFleet(){
      return rawFleetData.filter(item =>
        item.section !== "Major Repairs" && item.section !== "Long Term Rebuild"
      );
    }

    function getExcludedFleet(){
      return rawFleetData.filter(item =>
        item.section === "Major Repairs" || item.section === "Long Term Rebuild"
      );
    }

    function getLightVehicles(){
      return rawFleetData.filter(item => item.section === "Light Vehicles");
    }

    function getMainFleet(){
      return rawFleetData.filter(item =>
        item.section !== "Light Vehicles" &&
        item.section !== "Major Repairs" &&
        item.section !== "Long Term Rebuild"
      );
    }

    function calculateSummary(){
      const included = getIncludedFleet();
      const excluded = getExcludedFleet();
      const available = included.filter(item => isAvailableStatus(item.status)).length;
      const unavailable = included.length - available;

      return {
        total: included.length,
        available,
        unavailable,
        excluded: excluded.length
      };
    }

    function calculateDepartmentData(){
      const included = getIncludedFleet();
      const map = {};

      included.forEach(item => {
        const dept = item.department || "Unassigned";
        if(!map[dept]){
          map[dept] = { total:0, available:0 };
        }
        map[dept].total += 1;
        if(isAvailableStatus(item.status)) map[dept].available += 1;
      });

      const labels = Object.keys(map);
      const values = labels.map(label => {
        const row = map[label];
        return row.total ? Number(((row.available / row.total) * 100).toFixed(1)) : 0;
      });

      return { labels, values };
    }

    function updateSummaryCards(){
      const s = calculateSummary();
      document.getElementById("totalFleet").textContent = s.total;
      document.getElementById("availableFleet").textContent = s.available;
      document.getElementById("unavailableFleet").textContent = s.unavailable;
      document.getElementById("excludedFleet").textContent = s.excluded;
      document.getElementById("availablePct").textContent = s.total ? `${((s.available / s.total) * 100).toFixed(1)}% available` : "0%";
      document.getElementById("unavailablePct").textContent = s.total ? `${((s.unavailable / s.total) * 100).toFixed(1)}% unavailable` : "0%";

      document.getElementById("majorRepairsCount").textContent =
        rawFleetData.filter(x => x.section === "Major Repairs").length;

      document.getElementById("longTermCount").textContent =
        rawFleetData.filter(x => x.section === "Long Term Rebuild").length;
    }

    function renderCharts(){
      const summary = calculateSummary();
      const ctx1 = document.getElementById("availabilityChart").getContext("2d");

      if(availabilityChart) availabilityChart.destroy();
      availabilityChart = new Chart(ctx1, {
        type: "doughnut",
        data: {
          labels: ["Available", "Unavailable", "Excluded"],
          datasets: [{
            data: [summary.available, summary.unavailable, summary.excluded],
            backgroundColor: ["#20bf6b", "#eb3b5a", "#f7b731"],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: "#ffffff"
              }
            }
          }
        }
      });

      const dept = calculateDepartmentData();
      const ctx2 = document.getElementById("departmentChart").getContext("2d");

      if(departmentChart) departmentChart.destroy();
      departmentChart = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: dept.labels,
          datasets: [{
            label: "Availability %",
            data: dept.values,
            backgroundColor: "#ff6a00",
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { color:"#ffffff" },
              grid: { color:"rgba(255,255,255,0.08)" }
            },
            x: {
              ticks: { color:"#ffffff" },
              grid: { color:"rgba(255,255,255,0.04)" }
            }
          },
          plugins: {
            legend: {
              labels: { color:"#ffffff" }
            }
          }
        }
      });
    }

    function renderLightVehiclePills(){
      const lv = getLightVehicles();
      const departments = [...new Set(lv.map(x => x.department || "Unassigned"))];
      const wrap = document.getElementById("lightVehiclePills");
      wrap.innerHTML = "";

      departments.forEach(dept => {
        const total = lv.filter(x => x.department === dept).length;
        const available = lv.filter(x => x.department === dept && isAvailableStatus(x.status)).length;
        const pill = document.createElement("span");
        pill.className = "tiny-pill";
        pill.textContent = `${dept}: ${available}/${total} available`;
        wrap.appendChild(pill);
      });

      if(!departments.length){
        wrap.innerHTML = `<span class="tiny-pill">No light vehicles loaded</span>`;
      }
    }

    function actionButtons(index){
      const admin = document.getElementById("adminMode").checked;
      if(!admin) return "";

      return `
        <div class="action-group">
          <button class="small-btn secondary" onclick="moveSection(${index}, 'Main Fleet')">Main</button>
          <button class="small-btn secondary" onclick="moveSection(${index}, 'Light Vehicles')">Light</button>
          <button class="small-btn secondary" onclick="moveSection(${index}, 'Major Repairs')">Major</button>
          <button class="small-btn danger" onclick="moveSection(${index}, 'Long Term Rebuild')">Rebuild</button>
        </div>
      `;
    }

    function renderTables(){
      const admin = document.getElementById("adminMode").checked;
      document.querySelectorAll(".admin-only").forEach(el => {
        el.classList.toggle("hidden", !admin);
      });

      const lightBody = document.getElementById("lightVehiclesTable");
      const excludedBody = document.getElementById("excludedTable");
      const mainBody = document.getElementById("mainFleetTable");
      const allBody = document.getElementById("allFleetTable");

      lightBody.innerHTML = "";
      excludedBody.innerHTML = "";
      mainBody.innerHTML = "";
      allBody.innerHTML = "";

      getLightVehicles().forEach(item => {
        const idx = rawFleetData.indexOf(item);
        lightBody.innerHTML += `
          <tr>
            <td>${item.registration || item.fleetNo}</td>
            <td>${item.department}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td>${item.section}</td>
            <td>${item.notes}</td>
            <td class="${admin ? "" : "hidden"}">${actionButtons(idx)}</td>
          </tr>
        `;
      });

      getExcludedFleet().forEach(item => {
        const idx = rawFleetData.indexOf(item);
        excludedBody.innerHTML += `
          <tr>
            <td>${item.fleetNo || item.registration}</td>
            <td>${item.department}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td>${item.section}</td>
            <td>${item.notes}</td>
            <td class="${admin ? "" : "hidden"}">${actionButtons(idx)}</td>
          </tr>
        `;
      });

      getMainFleet().forEach(item => {
        const idx = rawFleetData.indexOf(item);
        mainBody.innerHTML += `
          <tr>
            <td>${item.fleetNo || item.registration}</td>
            <td>${item.machineType}</td>
            <td>${item.department}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td>${item.section}</td>
            <td>${item.notes}</td>
            <td class="${admin ? "" : "hidden"}">${actionButtons(idx)}</td>
          </tr>
        `;
      });

      rawFleetData.forEach(item => {
        const included = item.section !== "Major Repairs" && item.section !== "Long Term Rebuild";
        allBody.innerHTML += `
          <tr>
            <td>${item.fleetNo || item.registration}</td>
            <td>${item.machineType}</td>
            <td>${item.department}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td>${item.section}</td>
            <td>${included ? "Yes" : "No"}</td>
            <td>${item.notes}</td>
          </tr>
        `;
      });
    }

    function renderAll(){
      updateSummaryCards();
      renderCharts();
      renderLightVehiclePills();
      renderTables();
    }

    function searchFleet(){
      const value = cleanUpper(document.getElementById("searchFleet").value);
      const output = document.getElementById("searchOutput");

      if(!value){
        output.classList.add("hidden");
        output.innerHTML = "";
        return;
      }

      const found = rawFleetData.find(item =>
        cleanUpper(item.fleetNo).includes(value) ||
        cleanUpper(item.registration).includes(value)
      );

      if(!found){
        output.classList.remove("hidden");
        output.innerHTML = `<strong>No result found</strong>`;
        return;
      }

      output.classList.remove("hidden");
      output.innerHTML = `
        <strong>${found.fleetNo || found.registration}</strong><br>
        Machine Type: ${found.machineType || "-"}<br>
        Registration: ${found.registration || "-"}<br>
        Department: ${found.department || "-"}<br>
        Status: ${found.status || "-"}<br>
        Section: ${found.section || "-"}<br>
        Notes: ${found.notes || "-"}
      `;
    }

    function handleFileUpload(event){
      const file = event.target.files[0];
      if(!file) return;

      const reader = new FileReader();
      reader.onload = function(e){
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type:"array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval:"" });

        const mapped = json
          .map(row => prepareRow(row))
          .filter(row => row.fleetNo || row.registration || row.machineType);

        setData(mapped);
      };
      reader.readAsArrayBuffer(file);
    }

    function resetAll(){
      rawFleetData = [];
      document.getElementById("excelFile").value = "";
      document.getElementById("searchFleet").value = "";
      document.getElementById("searchOutput").classList.add("hidden");
      document.getElementById("searchOutput").innerHTML = "";
      renderAll();
    }

    window.moveSection = function(index, section){
      if(typeof rawFleetData[index] === "undefined") return;
      rawFleetData[index].section = section;

      if(section === "Light Vehicles" && !rawFleetData[index].machineType){
        rawFleetData[index].machineType = "Light Vehicle";
      }
      renderAll();
    };

    document.getElementById("excelFile").addEventListener("change", handleFileUpload);
    document.getElementById("searchBtn").addEventListener("click", searchFleet);
    document.getElementById("searchFleet").addEventListener("keydown", (e) => {
      if(e.key === "Enter") searchFleet();
    });
    document.getElementById("adminMode").addEventListener("change", renderTables);
    document.getElementById("loadSampleBtn").addEventListener("click", () => setData(sampleData));
    document.getElementById("resetBtn").addEventListener("click", resetAll);

    setData(sampleData);
  </script>
</body>
</html>
