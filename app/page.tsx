<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Turbo-Energy Machine Availability</title>

  <style>
    :root{
      --bg:#071a3a;
      --bg2:#0d2e63;
      --panel:rgba(14,35,74,0.90);
      --panelLine:rgba(255,255,255,0.10);
      --white:#f8f9fc;
      --text:#f2f6ff;
      --muted:#c5d2ee;
      --dark:#17325f;
      --orange:#f29a1f;
      --orange2:#ffb14b;
      --green:#41b86c;
      --red:#c94860;
      --blue:#4f8cff;
      --yellow:#efc14d;
      --shadow:0 18px 40px rgba(0,0,0,0.28);
      --radius:20px;
      --radiusSm:14px;
    }

    *{
      box-sizing:border-box;
      margin:0;
      padding:0;
    }

    body{
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(80,120,255,0.20), transparent 24%),
        radial-gradient(circle at top right, rgba(255,177,75,0.10), transparent 20%),
        linear-gradient(180deg, #0b1e45 0%, #081733 100%);
      color:var(--text);
      min-height:100vh;
    }

    .shell{
      width:min(1280px, calc(100% - 24px));
      margin:0 auto;
      padding:14px 0 24px;
    }

    .topbar{
      display:grid;
      grid-template-columns:370px 1fr auto;
      align-items:center;
      gap:18px;
      background:linear-gradient(180deg, rgba(21,48,96,0.96), rgba(12,31,68,0.96));
      border:1px solid var(--panelLine);
      border-radius:0 0 18px 18px;
      padding:14px 18px;
      box-shadow:var(--shadow);
      position:sticky;
      top:0;
      z-index:50;
      backdrop-filter:blur(8px);
    }

    .logo-box{
      background:rgba(255,255,255,0.92);
      min-height:62px;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:8px 16px;
      overflow:hidden;
    }

    .logo-box img{
      max-width:100%;
      max-height:46px;
      object-fit:contain;
      display:block;
    }

    .logo-fallback{
      color:#8090af;
      font-size:22px;
      font-weight:900;
      letter-spacing:1px;
    }

    .title-wrap{
      text-align:center;
    }

    .title-wrap h1{
      font-size:20px;
      line-height:1.15;
      font-weight:800;
      margin-bottom:4px;
    }

    .title-wrap p{
      font-size:14px;
      color:var(--muted);
    }

    .top-actions{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }

    button,
    .file-label{
      border:none;
      outline:none;
      cursor:pointer;
      border-radius:999px;
      padding:12px 18px;
      font-size:15px;
      font-weight:800;
      transition:0.2s ease;
    }

    .btn{
      background:rgba(7,18,45,0.45);
      color:#fff;
      border:1px solid rgba(255,255,255,0.12);
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);
    }

    .btn:hover,
    .file-label:hover{
      transform:translateY(-1px);
      filter:brightness(1.04);
    }

    .btn-primary{
      background:linear-gradient(180deg, var(--orange2), var(--orange));
      color:#fff;
      box-shadow:0 10px 24px rgba(242,154,31,0.30);
    }

    .dashboard{
      margin-top:14px;
      display:grid;
      grid-template-columns:1.65fr 1fr;
      gap:16px;
    }

    .left-col,
    .right-col{
      display:flex;
      flex-direction:column;
      gap:16px;
    }

    .kpi-grid{
      display:grid;
      grid-template-columns:repeat(4, 1fr);
      gap:12px;
    }

    .kpi{
      background:rgba(255,255,255,0.97);
      color:var(--dark);
      border-radius:22px;
      padding:18px 18px;
      min-height:108px;
      display:grid;
      grid-template-columns:56px 1fr;
      gap:14px;
      align-items:center;
      box-shadow:var(--shadow);
    }

    .kpi-icon{
      width:52px;
      height:52px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:22px;
      font-weight:900;
    }

    .icon-blue{ background:rgba(79,140,255,0.16); color:var(--blue); }
    .icon-green{ background:rgba(65,184,108,0.16); color:var(--green); }
    .icon-red{ background:rgba(201,72,96,0.16); color:var(--red); }
    .icon-pin{ background:rgba(79,140,255,0.16); color:var(--blue); }

    .kpi h4{
      font-size:13px;
      font-weight:800;
      letter-spacing:0.4px;
      text-transform:uppercase;
      margin-bottom:6px;
    }

    .kpi .value{
      font-size:22px;
      font-weight:900;
      line-height:1;
      margin-bottom:8px;
    }

    .kpi p{
      font-size:13px;
      color:#5a6d92;
    }

    .panel{
      background:linear-gradient(180deg, rgba(17,42,87,0.90), rgba(10,29,63,0.94));
      border:1px solid var(--panelLine);
      border-radius:22px;
      box-shadow:var(--shadow);
      padding:18px;
    }

    .panel-title{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      margin-bottom:14px;
    }

    .panel-title h2{
      font-size:18px;
      font-weight:900;
    }

    .panel-sub{
      color:var(--muted);
      font-size:14px;
      margin-bottom:14px;
    }

    .toolbar{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .toolbar .small{
      padding:10px 16px;
      font-size:14px;
    }

    .upload-box{
      border:1px solid rgba(255,255,255,0.14);
      border-radius:14px;
      padding:14px;
      background:rgba(255,255,255,0.03);
      margin-bottom:12px;
    }

    .upload-row{
      display:flex;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    }

    .file-label{
      background:rgba(255,255,255,0.10);
      color:#fff;
      border:1px solid rgba(255,255,255,0.10);
      padding:10px 18px;
    }

    input[type="file"]{
      display:none;
    }

    .file-name{
      font-size:14px;
      color:var(--muted);
      font-weight:700;
    }

    .help-box{
      border:1px solid rgba(255,255,255,0.10);
      border-radius:14px;
      padding:14px;
      background:rgba(255,255,255,0.03);
      color:var(--muted);
      font-size:14px;
      line-height:1.45;
    }

    .chart-card{
      padding-bottom:12px;
    }

    .chart-top{
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:12px;
    }

    .chart-top h2{
      font-size:18px;
      font-weight:900;
    }

    .chart-top .chart-tag{
      font-size:14px;
      color:#fff;
      font-weight:800;
    }

    .chart-wrap{
      height:290px;
      border:1px solid rgba(255,255,255,0.10);
      border-radius:16px;
      padding:14px 18px 12px;
      background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
      position:relative;
      overflow:hidden;
    }

    .chart-grid{
      position:absolute;
      inset:14px 18px 46px 18px;
      display:flex;
      flex-direction:column;
      justify-content:space-between;
      pointer-events:none;
    }

    .chart-grid span{
      border-top:1px dashed rgba(255,255,255,0.12);
      position:relative;
    }

    .chart-grid span small{
      position:absolute;
      top:-9px;
      left:-4px;
      transform:translateX(-100%);
      color:#c0cee9;
      font-size:12px;
      font-weight:700;
    }

    .bars{
      position:absolute;
      left:56px;
      right:28px;
      bottom:34px;
      top:28px;
      display:flex;
      justify-content:space-around;
      align-items:flex-end;
      gap:18px;
    }

    .bar-col{
      width:100%;
      max-width:82px;
      text-align:center;
      display:flex;
      flex-direction:column;
      justify-content:flex-end;
      align-items:center;
      gap:8px;
    }

    .bar-value{
      font-size:15px;
      font-weight:900;
      color:#fff;
      text-shadow:0 2px 6px rgba(0,0,0,0.25);
    }

    .bar{
      width:62px;
      border-radius:14px 14px 4px 4px;
      background:linear-gradient(180deg, rgba(220,230,255,0.98), rgba(167,188,235,0.92));
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.50), 0 10px 18px rgba(0,0,0,0.15);
      position:relative;
    }

    .bar.highlight{
      background:linear-gradient(180deg, #b8d3ff, #6ea0ff);
    }

    .bar-label{
      font-size:15px;
      font-weight:900;
      color:#e9f0ff;
      margin-top:4px;
    }

    .summary-table-wrap{
      overflow:auto;
      border:1px solid rgba(255,255,255,0.10);
      border-radius:14px;
      background:rgba(255,255,255,0.04);
    }

    table{
      width:100%;
      border-collapse:collapse;
      min-width:680px;
    }

    thead th{
      background:rgba(255,255,255,0.95);
      color:#18335f;
      text-align:left;
      font-size:13px;
      font-weight:900;
      padding:12px 14px;
      border-bottom:1px solid rgba(0,0,0,0.06);
    }

    tbody td{
      padding:12px 14px;
      font-size:14px;
      border-bottom:1px solid rgba(255,255,255,0.08);
      color:#edf4ff;
    }

    tbody tr:hover{
      background:rgba(255,255,255,0.04);
    }

    .note-box{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .mini-card{
      background:rgba(255,255,255,0.96);
      color:#18335f;
      border-radius:16px;
      padding:14px 16px;
      box-shadow:var(--shadow);
      display:grid;
      grid-template-columns:30px 1fr;
      gap:12px;
      align-items:start;
    }

    .mini-icon{
      font-size:22px;
      line-height:1;
      margin-top:2px;
    }

    .mini-card h3{
      font-size:15px;
      font-weight:900;
      margin-bottom:4px;
    }

    .mini-card p{
      font-size:14px;
      color:#445b83;
      line-height:1.4;
    }

    .muted-panel{
      border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;
      padding:14px 16px;
      background:rgba(255,255,255,0.05);
      color:#e8efff;
      font-size:14px;
      line-height:1.45;
    }

    .register-controls{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-bottom:12px;
    }

    select,
    .search-box input{
      border:none;
      outline:none;
      border-radius:12px;
      padding:12px 14px;
      font-size:14px;
      font-weight:700;
    }

    select{
      min-width:190px;
      color:#17325f;
      background:#fff;
    }

    .search-box{
      flex:1;
      display:flex;
      align-items:center;
      background:#fff;
      border-radius:12px;
      overflow:hidden;
      min-width:220px;
    }

    .search-box span{
      padding:0 12px;
      color:#5772a1;
      font-weight:900;
    }

    .search-box input{
      width:100%;
      color:#17325f;
    }

    .status-pill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:92px;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:900;
      text-transform:capitalize;
    }

    .available{ background:rgba(65,184,108,0.18); color:#46d279; }
    .repair{ background:rgba(239,193,77,0.20); color:#ffd35e; }
    .down{ background:rgba(201,72,96,0.18); color:#ff6d87; }

    .footer-line{
      display:flex;
      justify-content:space-between;
      gap:10px;
      margin-top:10px;
      color:#d4def6;
      font-size:13px;
    }

    @media (max-width: 1180px){
      .dashboard{
        grid-template-columns:1fr;
      }

      .kpi-grid{
        grid-template-columns:repeat(2, 1fr);
      }

      .topbar{
        grid-template-columns:1fr;
        text-align:center;
      }

      .top-actions{
        justify-content:center;
      }
    }

    @media (max-width: 760px){
      .shell{
        width:min(100%, calc(100% - 14px));
      }

      .kpi-grid{
        grid-template-columns:1fr;
      }

      .bars{
        gap:10px;
        left:44px;
        right:10px;
      }

      .bar{
        width:40px;
      }

      .bar-label{
        font-size:12px;
      }

      .title-wrap h1{
        font-size:17px;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="logo-box">
        <img
          id="companyLogo"
          src="logo.png"
          alt="Turbo Energy Logo"
          onerror="this.style.display='none';document.getElementById('logoFallback').style.display='block';"
        />
        <div id="logoFallback" class="logo-fallback" style="display:none;">TURBO ENERGY</div>
      </div>

      <div class="title-wrap">
        <h1>Turbo-Energy Machine Availability</h1>
        <p>Live fleet dashboard connected to saved browser data</p>
      </div>

      <div class="top-actions">
        <label class="btn btn-primary file-label" for="csvFileTop">Upload File</label>
        <button class="btn" id="below85Btn">Units Below 85%</button>
        <button class="btn" id="bottomRegisterBtn">Bottom Register</button>
      </div>
    </header>

    <main class="dashboard">
      <section class="left-col">
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-icon icon-blue">🏗</div>
            <div>
              <h4>Total Machines</h4>
              <div class="value" id="totalMachines">24</div>
              <p>All units currently in the register</p>
            </div>
          </div>

          <div class="kpi">
            <div class="kpi-icon icon-green">☑</div>
            <div>
              <h4>Available</h4>
              <div class="value" id="availableMachines">18</div>
              <p>Units marked available</p>
            </div>
          </div>

          <div class="kpi">
            <div class="kpi-icon icon-red">🔧</div>
            <div>
              <h4>Repairs / Down</h4>
              <div class="value" id="repairMachines">6</div>
              <p>Units needing attention</p>
            </div>
          </div>

          <div class="kpi">
            <div class="kpi-icon icon-pin">📍</div>
            <div>
              <h4>Locations</h4>
              <div class="value" id="locationCount">4</div>
              <p>Distinct operating locations</p>
            </div>
          </div>
        </div>

        <section class="panel">
          <div class="panel-title">
            <h2>Admin Upload and Save</h2>
            <div class="toolbar">
              <button class="btn btn-primary small" id="exportBtn">Export CSV</button>
              <button class="btn small" id="printBtn">Print report</button>
            </div>
          </div>

          <p class="panel-sub">Upload spreadsheet CSV from Excel</p>

          <div class="upload-box">
            <div class="upload-row">
              <input type="file" id="csvFileTop" accept=".csv" />
              <label class="file-label" for="csvFileTop">Choose File</label>
              <span class="file-name" id="fileName">No file chosen</span>
            </div>
          </div>

          <div class="help-box">
            Save your Excel sheet as CSV, then upload it here. The loaded spreadsheet data will show in the bottom section as a full register table.
          </div>
        </section>

        <section class="panel chart-card">
          <div class="chart-top">
            <h2>Availability by Machine Type</h2>
            <div class="chart-tag">% Available</div>
          </div>

          <div class="chart-wrap">
            <div class="chart-grid">
              <span><small>100%</small></span>
              <span><small>80%</small></span>
              <span><small>60%</small></span>
              <span><small>40%</small></span>
              <span><small>20%</small></span>
              <span><small>0%</small></span>
            </div>

            <div class="bars" id="barsContainer"></div>
          </div>

          <div style="margin-top:12px;color:var(--muted);font-size:14px;">
            Breakdown shows availability percentage for each machine type.
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">
            <div>
              <h2>Top Machine Summary</h2>
              <div class="panel-sub" style="margin:6px 0 0;">Quick summary of the latest machines.</div>
            </div>
          </div>

          <div class="summary-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fleet Number</th>
                  <th>Machine Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Availability %</th>
                </tr>
              </thead>
              <tbody id="summaryTableBody"></tbody>
            </table>
          </div>
        </section>
      </section>

      <aside class="right-col">
        <section class="panel">
          <div class="panel-title">
            <h2>Notes / Summary Panel</h2>
          </div>

          <div class="note-box">
            <div class="mini-card">
              <div class="mini-icon">🗂</div>
              <div>
                <h3>Live data connected</h3>
                <p>Dashboard reading machines from saved browser register data.</p>
              </div>
            </div>

            <div class="mini-card">
              <div class="mini-icon">💡</div>
              <div>
                <h3>Next step</h3>
                <p>Add filters, admin actions, and style refinements.</p>
              </div>
            </div>

            <div class="muted-panel">
              Shell pass complete: header, KPI row, chart, notes panel, summary table, and bottom register.
            </div>
          </div>
        </section>

        <section class="panel" id="bottomRegisterSection">
          <div class="panel-title">
            <div>
              <h2>Bottom Machine by-Machine Register</h2>
              <div class="panel-sub" style="margin:6px 0 0;">Full register with search and filters.</div>
            </div>
          </div>

          <div class="register-controls">
            <select id="typeFilter">
              <option value="ALL">All Machines</option>
            </select>

            <div class="search-box">
              <span>⌕</span>
              <input type="text" id="searchInput" placeholder="Type fleet number or type..." />
            </div>

            <button class="btn" id="refreshBtn">Refresh data</button>
          </div>

          <div class="summary-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fleet Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody id="registerTableBody"></tbody>
            </table>
          </div>

          <div class="footer-line">
            <span>Turbo Energy - Machine Availability Dashboard</span>
            <span id="lastUpdatedText">Last updated: --</span>
          </div>
        </section>
      </aside>
    </main>
  </div>

  <script>
    const defaultData = [
      { fleet: "FEL10", type: "FEL", machineType: "SL60", status: "Available", location: "Hwange", availability: 88, updated: "19 Apr 2026" },
      { fleet: "TEX01", type: "TEX", machineType: "TK371", status: "Repair", location: "Kariba", availability: 75, updated: "18 Apr 2026" },
      { fleet: "TRT07", type: "TRT", machineType: "TR100", status: "Available", location: "Hwange", availability: 100, updated: "18 Apr 2026" },
      { fleet: "HT03", type: "HT", machineType: "773E", status: "Repair", location: "Binga", availability: 82, updated: "17 Apr 2026" },
      { fleet: "GEN02", type: "GEN", machineType: "WTS000", status: "Available", location: "Hwange", availability: 67, updated: "18 Apr 2026" },
      { fleet: "FEL11", type: "FEL", machineType: "966H", status: "Available", location: "Hwange", availability: 90, updated: "18 Apr 2026" },
      { fleet: "FEL12", type: "FEL", machineType: "WA470", status: "Available", location: "Harare", availability: 86, updated: "18 Apr 2026" },
      { fleet: "TEX02", type: "TEX", machineType: "Hitachi EX", status: "Repair", location: "Kariba", availability: 71, updated: "18 Apr 2026" },
      { fleet: "TRT08", type: "TRT", machineType: "777D", status: "Available", location: "Binga", availability: 100, updated: "18 Apr 2026" },
      { fleet: "HT04", type: "HT", machineType: "ADT40", status: "Available", location: "Hwange", availability: 84, updated: "18 Apr 2026" },
      { fleet: "GEN03", type: "GEN", machineType: "GENSET", status: "Down", location: "Harare", availability: 66, updated: "17 Apr 2026" },
      { fleet: "FEL13", type: "FEL", machineType: "SL50", status: "Available", location: "Hwange", availability: 89, updated: "18 Apr 2026" },
      { fleet: "TEX03", type: "TEX", machineType: "Dozer D8", status: "Available", location: "Kariba", availability: 79, updated: "18 Apr 2026" },
      { fleet: "TRT09", type: "TRT", machineType: "FMX", status: "Available", location: "Hwange", availability: 99, updated: "19 Apr 2026" },
      { fleet: "HT05", type: "HT", machineType: "Telehandler", status: "Available", location: "Binga", availability: 80, updated: "18 Apr 2026" },
      { fleet: "GEN04", type: "GEN", machineType: "Atlas Copco", status: "Available", location: "Harare", availability: 68, updated: "18 Apr 2026" },
      { fleet: "FEL14", type: "FEL", machineType: "L90H", status: "Repair", location: "Hwange", availability: 85, updated: "17 Apr 2026" },
      { fleet: "TEX04", type: "TEX", machineType: "Cat D6", status: "Available", location: "Kariba", availability: 76, updated: "18 Apr 2026" },
      { fleet: "TRT10", type: "TRT", machineType: "Howo", status: "Available", location: "Hwange", availability: 100, updated: "19 Apr 2026" },
      { fleet: "HT06", type: "HT", machineType: "Water Bowser", status: "Down", location: "Binga", availability: 81, updated: "17 Apr 2026" },
      { fleet: "GEN05", type: "GEN", machineType: "Compressor", status: "Available", location: "Harare", availability: 67, updated: "18 Apr 2026" },
      { fleet: "FEL15", type: "FEL", machineType: "Backhoe", status: "Available", location: "Hwange", availability: 90, updated: "18 Apr 2026" },
      { fleet: "TEX05", type: "TEX", machineType: "Excavator 20T", status: "Repair", location: "Kariba", availability: 74, updated: "17 Apr 2026" },
      { fleet: "HT07", type: "HT", machineType: "Service Truck", status: "Available", location: "Binga", availability: 82, updated: "18 Apr 2026" }
    ];

    let machineData = JSON.parse(localStorage.getItem("turboMachineData")) || defaultData;

    const barsContainer = document.getElementById("barsContainer");
    const summaryTableBody = document.getElementById("summaryTableBody");
    const registerTableBody = document.getElementById("registerTableBody");
    const typeFilter = document.getElementById("typeFilter");
    const searchInput = document.getElementById("searchInput");
    const fileInput = document.getElementById("csvFileTop");
    const fileName = document.getElementById("fileName");

    function saveData() {
      localStorage.setItem("turboMachineData", JSON.stringify(machineData));
    }

    function getStatusClass(status) {
      const value = String(status).toLowerCase();
      if (value.includes("avail")) return "available";
      if (value.includes("repair") || value.includes("maint")) return "repair";
      return "down";
    }

    function renderKPIs() {
      const total = machineData.length;
      const available = machineData.filter(x => String(x.status).toLowerCase().includes("avail")).length;
      const repairs = total - available;
      const locations = new Set(machineData.map(x => x.location)).size;

      document.getElementById("totalMachines").textContent = total;
      document.getElementById("availableMachines").textContent = available;
      document.getElementById("repairMachines").textContent = repairs;
      document.getElementById("locationCount").textContent = locations;

      document.getElementById("lastUpdatedText").textContent =
        "Last updated: " + new Date().toLocaleString();
    }

    function getTypeAverages(data) {
      const grouped = {};
      data.forEach(item => {
        if (!grouped[item.type]) grouped[item.type] = [];
        grouped[item.type].push(Number(item.availability) || 0);
      });

      return Object.entries(grouped).map(([type, values]) => {
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        return { type, avg };
      });
    }

    function renderChart() {
      const grouped = getTypeAverages(machineData);
      barsContainer.innerHTML = "";

      grouped.forEach((item, index) => {
        const col = document.createElement("div");
        col.className = "bar-col";

        const value = document.createElement("div");
        value.className = "bar-value";
        value.textContent = item.avg + "%";

        const bar = document.createElement("div");
        bar.className = "bar" + (index === 3 ? " highlight" : "");
        bar.style.height = Math.max(item.avg * 1.9, 20) + "px";

        const label = document.createElement("div");
        label.className = "bar-label";
        label.textContent = item.type;

        col.appendChild(value);
        col.appendChild(bar);
        col.appendChild(label);
        barsContainer.appendChild(col);
      });
    }

    function renderSummaryTable() {
      summaryTableBody.innerHTML = "";
      machineData.slice(0, 6).forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.fleet}</td>
          <td>${item.machineType}</td>
          <td><span class="status-pill ${getStatusClass(item.status)}">${item.status}</span></td>
          <td>${item.location}</td>
          <td>${item.availability}%</td>
        `;
        summaryTableBody.appendChild(row);
      });
    }

    function populateFilterOptions() {
      const types = [...new Set(machineData.map(item => item.type))].sort();
      typeFilter.innerHTML = `<option value="ALL">All Machines</option>`;
      types.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
      });
    }

    function renderRegisterTable() {
      const filterType = typeFilter.value;
      const search = searchInput.value.trim().toLowerCase();

      const filtered = machineData.filter(item => {
        const typeMatch = filterType === "ALL" || item.type === filterType;
        const searchMatch =
          item.fleet.toLowerCase().includes(search) ||
          item.type.toLowerCase().includes(search) ||
          item.machineType.toLowerCase().includes(search) ||
          item.location.toLowerCase().includes(search) ||
          item.status.toLowerCase().includes(search);
        return typeMatch && searchMatch;
      });

      registerTableBody.innerHTML = "";
      filtered.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.fleet}</td>
          <td>${item.machineType}</td>
          <td><span class="status-pill ${getStatusClass(item.status)}">${item.status}</span></td>
          <td>${item.location}</td>
          <td>${item.updated}</td>
        `;
        registerTableBody.appendChild(row);
      });
    }

    function renderAll() {
      renderKPIs();
      renderChart();
      renderSummaryTable();
      populateFilterOptions();
      renderRegisterTable();
      saveData();
    }

    function parseCSV(text) {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return [];

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

      return lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());

        const row = {};
        headers.forEach((header, i) => {
          row[header] = cols[i] || "";
        });

        return {
          fleet: row.fleet || row["fleet number"] || row.unit || "UNIT",
          type: row.type || "GEN",
          machineType: row["machine type"] || row.model || row.type || "Machine",
          status: row.status || "Available",
          location: row.location || "Unknown",
          availability: Number(row.availability || row["availability %"] || row.percent || 0),
          updated: row.updated || new Date().toLocaleDateString()
        };
      }).filter(x => x.fleet && x.machineType);
    }

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      fileName.textContent = file.name;

      const reader = new FileReader();
      reader.onload = function(event) {
        const text = event.target.result;
        const parsed = parseCSV(text);
        if (parsed.length) {
          machineData = parsed;
          renderAll();
        } else {
          alert("CSV loaded, but no valid rows were found.");
        }
      };
      reader.readAsText(file);
    });

    typeFilter.addEventListener("change", renderRegisterTable);
    searchInput.addEventListener("input", renderRegisterTable);

    document.getElementById("exportBtn").addEventListener("click", () => {
      const headers = ["fleet","type","machineType","status","location","availability","updated"];
      const rows = machineData.map(item =>
        [item.fleet, item.type, item.machineType, item.status, item.location, item.availability, item.updated].join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "turbo_machine_register.csv";
      link.click();
    });

    document.getElementById("printBtn").addEventListener("click", () => {
      window.print();
    });

    document.getElementById("refreshBtn").addEventListener("click", () => {
      renderAll();
    });

    document.getElementById("below85Btn").addEventListener("click", () => {
      searchInput.value = "";
      typeFilter.value = "ALL";
      registerTableBody.innerHTML = "";

      machineData
        .filter(item => Number(item.availability) < 85)
        .forEach(item => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${item.fleet}</td>
            <td>${item.machineType}</td>
            <td><span class="status-pill ${getStatusClass(item.status)}">${item.status}</span></td>
            <td>${item.location}</td>
            <td>${item.updated}</td>
          `;
          registerTableBody.appendChild(row);
        });

      document.getElementById("bottomRegisterSection").scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("bottomRegisterBtn").addEventListener("click", () => {
      document.getElementById("bottomRegisterSection").scrollIntoView({ behavior: "smooth" });
    });

    renderAll();
  </script>
</body>
</html>
