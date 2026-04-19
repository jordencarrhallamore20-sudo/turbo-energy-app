"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Machine = {
  fleet: string;
  type: string;
  machineType: string;
  status: string;
  location: string;
  availability: number;
  updated: string;
};

const sampleData: Machine[] = [
  { fleet: "FEL10", type: "FEL", machineType: "SL60", status: "Available", location: "Hwange", availability: 88, updated: "19 Apr 2026" },
  { fleet: "TEX01", type: "TEX", machineType: "TK371", status: "Repair", location: "Kariba", availability: 75, updated: "18 Apr 2026" },
  { fleet: "TRT07", type: "TRT", machineType: "TR100", status: "Available", location: "Hwange", availability: 100, updated: "18 Apr 2026" },
  { fleet: "HT03", type: "HT", machineType: "773E", status: "Maintenance", location: "Binga", availability: 82, updated: "17 Apr 2026" },
  { fleet: "GEN02", type: "GEN", machineType: "WTS000", status: "Available", location: "Hwange", availability: 67, updated: "18 Apr 2026" },
  { fleet: "FEL11", type: "FEL", machineType: "966H", status: "Available", location: "Hwange", availability: 90, updated: "18 Apr 2026" },
  { fleet: "TEX02", type: "TEX", machineType: "EX360", status: "Repair", location: "Kariba", availability: 74, updated: "18 Apr 2026" },
  { fleet: "TRT08", type: "TRT", machineType: "777D", status: "Available", location: "Hwange", availability: 100, updated: "18 Apr 2026" },
  { fleet: "HT04", type: "HT", machineType: "ADT40", status: "Available", location: "Binga", availability: 84, updated: "17 Apr 2026" },
  { fleet: "GEN03", type: "GEN", machineType: "Atlas Copco", status: "Available", location: "Harare", availability: 66, updated: "18 Apr 2026" },
  { fleet: "LV01", type: "LV", machineType: "Light Vehicle", status: "Available", location: "Hwange", availability: 92, updated: "19 Apr 2026" },
  { fleet: "WB01", type: "WB", machineType: "Water Bowser", status: "Repair", location: "Kariba", availability: 71, updated: "18 Apr 2026" }
];

export default function Page() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedType, setSelectedType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [fileName, setFileName] = useState("No file chosen");

  useEffect(() => {
    const stored = localStorage.getItem("turboMachineData");
    if (stored) {
      try {
        setMachines(JSON.parse(stored));
      } catch {
        setMachines(sampleData);
        localStorage.setItem("turboMachineData", JSON.stringify(sampleData));
      }
    } else {
      setMachines(sampleData);
      localStorage.setItem("turboMachineData", JSON.stringify(sampleData));
    }
  }, []);

  const saveMachines = (data: Machine[]) => {
    setMachines(data);
    localStorage.setItem("turboMachineData", JSON.stringify(data));
  };

  const totalMachines = machines.length;
  const availableMachines = machines.filter((m) =>
    m.status.toLowerCase().includes("avail")
  ).length;
  const repairsMachines = machines.filter(
    (m) => !m.status.toLowerCase().includes("avail")
  ).length;
  const locationCount = new Set(machines.map((m) => m.location)).size;

  const groupedData = useMemo(() => {
    const groups: Record<string, number[]> = {};
    machines.forEach((machine) => {
      if (!groups[machine.type]) groups[machine.type] = [];
      groups[machine.type].push(Number(machine.availability) || 0);
    });

    return Object.entries(groups).map(([type, values]) => ({
      type,
      availability: Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length
      )
    }));
  }, [machines]);

  const typeOptions = useMemo(() => {
    return ["ALL", ...Array.from(new Set(machines.map((m) => m.type))).sort()];
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      const matchesType = selectedType === "ALL" || machine.type === selectedType;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        term === "" ||
        machine.fleet.toLowerCase().includes(term) ||
        machine.type.toLowerCase().includes(term) ||
        machine.machineType.toLowerCase().includes(term) ||
        machine.status.toLowerCase().includes(term) ||
        machine.location.toLowerCase().includes(term);

      return matchesType && matchesSearch;
    });
  }, [machines, search, selectedType]);

  const topSummary = machines.slice(0, 5);

  const under85 = machines.filter((m) => Number(m.availability) < 85).length;

  const handleExport = () => {
    const headers = [
      "fleet",
      "type",
      "machineType",
      "status",
      "location",
      "availability",
      "updated"
    ];

    const rows = machines.map((machine) =>
      [
        machine.fleet,
        machine.type,
        machine.machineType,
        machine.status,
        machine.location,
        machine.availability,
        machine.updated
      ].join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "turbo-machine-register.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRefresh = () => {
    const stored = localStorage.getItem("turboMachineData");
    if (stored) {
      try {
        setMachines(JSON.parse(stored));
      } catch {
        saveMachines(sampleData);
      }
    }
  };

  const handleCSVUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        saveMachines(parsed);
      } else {
        alert("CSV uploaded but no valid rows were found.");
      }
    };
    reader.readAsText(file);
  };

  const scrollToBottomRegister = () => {
    const el = document.getElementById("bottom-register");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const showBelow85Only = () => {
    setSelectedType("ALL");
    setSearch("");
    const el = document.getElementById("bottom-register");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="page">
      <div className="shell">
        <header className="topbar">
          <div className="logoBox">
            <div className="logoText">TURBO ENERGY</div>
          </div>

          <div className="titleWrap">
            <h1>Turbo-Energy Machine Availability</h1>
            <p>Live fleet dashboard connected to saved browser data</p>
          </div>

          <div className="topActions">
            <label htmlFor="csvUploadTop" className="pillButton primaryPill">
              Upload File
            </label>
            <button className="pillButton" onClick={showBelow85Only}>
              Units Below 85%
            </button>
            <button className="pillButton" onClick={scrollToBottomRegister}>
              Bottom Register
            </button>
          </div>
        </header>

        <main className="dashboardGrid">
          <section className="leftColumn">
            <div className="kpiGrid">
              <KpiCard
                icon="🏗"
                title="TOTAL MACHINES"
                value={totalMachines}
                note="All units currently in the register"
              />
              <KpiCard
                icon="✅"
                title="AVAILABLE"
                value={availableMachines}
                note="Units marked available"
              />
              <KpiCard
                icon="🔧"
                title="REPAIRS / DOWN"
                value={repairsMachines}
                note="Units needing attention"
              />
              <KpiCard
                icon="📍"
                title="LOCATIONS"
                value={locationCount}
                note="Distinct operating locations"
              />
            </div>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <h2>Admin Upload and Save</h2>
                  <p>Upload spreadsheet CSV from Excel</p>
                </div>

                <div className="panelButtons">
                  <button className="actionButton orangeButton" onClick={handleExport}>
                    Export CSV
                  </button>
                  <button className="actionButton whiteButton" onClick={handlePrint}>
                    Print report
                  </button>
                </div>
              </div>

              <div className="uploadArea">
                <input
                  id="csvUploadTop"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hiddenInput"
                />
                <label htmlFor="csvUploadTop" className="filePicker">
                  Choose File
                </label>
                <span className="fileName">{fileName}</span>
              </div>

              <div className="infoBox">
                Save your Excel sheet as CSV, then upload it here. The loaded spreadsheet data will show in the bottom section as a full register table.
              </div>
            </section>

            <section className="panel">
              <div className="sectionTitleRow">
                <h2>Availability by Machine Type</h2>
                <span>% Available</span>
              </div>

              <div className="chartPanel">
                <div className="chartGridLines">
                  <div><span>100%</span></div>
                  <div><span>80%</span></div>
                  <div><span>60%</span></div>
                  <div><span>40%</span></div>
                  <div><span>20%</span></div>
                </div>

                <div className="barsArea">
                  {groupedData.map((item, index) => (
                    <div key={item.type} className="barGroup">
                      <div className="barValue">{item.availability}%</div>
                      <div
                        className={`bar ${index === 3 ? "highlightBar" : ""}`}
                        style={{ height: `${Math.max(item.availability * 1.7, 18)}px` }}
                      />
                      <div className="barLabel">{item.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="footNote">
                Breakdown shows availability percentage for each machine type.
              </p>
            </section>

            <section className="panel">
              <div className="sectionHeading">
                <h2>Top Machine Summary</h2>
                <p>Quick summary of the latest machines.</p>
              </div>

              <div className="tableWrap">
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
                  <tbody>
                    {topSummary.map((machine) => (
                      <tr key={machine.fleet}>
                        <td>{machine.fleet}</td>
                        <td>{machine.machineType}</td>
                        <td>
                          <span className={`statusPill ${getStatusClass(machine.status)}`}>
                            {machine.status}
                          </span>
                        </td>
                        <td>{machine.location}</td>
                        <td>{machine.availability}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <aside className="rightColumn">
            <section className="panel">
              <div className="sectionHeading">
                <h2>Notes / Summary Panel</h2>
              </div>

              <div className="notesStack">
                <div className="noteCard">
                  <div className="noteIcon">🗂</div>
                  <div>
                    <h3>Live data connected</h3>
                    <p>Dashboard reading machines from saved browser data.</p>
                  </div>
                </div>

                <div className="noteCard">
                  <div className="noteIcon">💡</div>
                  <div>
                    <h3>Next step</h3>
                    <p>Add filters, admin actions, and style refinements.</p>
                  </div>
                </div>

                <div className="mutedCard">
                  Shell pass complete: header, KPI row, chart, notes panel, summary table, and bottom register.
                </div>
              </div>
            </section>

            <section className="panel" id="bottom-register">
              <div className="sectionHeading">
                <h2>Bottom Machine by-Machine Register</h2>
                <p>Full register with search and filters.</p>
              </div>

              <div className="controlsRow">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="selectInput"
                >
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL" ? "All Machines" : option}
                    </option>
                  ))}
                </select>

                <div className="searchWrap">
                  <span>⌕</span>
                  <input
                    type="text"
                    placeholder="Type fleet number or type..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <button className="pillButton solidButton" onClick={handleRefresh}>
                  Refresh data
                </button>
              </div>

              <div className="tableWrap">
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
                  <tbody>
                    {filteredMachines.map((machine) => (
                      <tr key={`${machine.fleet}-${machine.updated}`}>
                        <td>{machine.fleet}</td>
                        <td>{machine.machineType}</td>
                        <td>
                          <span className={`statusPill ${getStatusClass(machine.status)}`}>
                            {machine.status}
                          </span>
                        </td>
                        <td>{machine.location}</td>
                        <td>{machine.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bottomLine">
                <span>Turbo Energy - Machine Availability Dashboard</span>
                <span>
                  Last updated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                </span>
              </div>
            </section>
          </aside>
        </main>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          color: #f3f7ff;
          background:
            radial-gradient(circle at top left, rgba(90, 130, 255, 0.18), transparent 24%),
            radial-gradient(circle at top right, rgba(242, 154, 31, 0.14), transparent 22%),
            linear-gradient(180deg, #091c43 0%, #081733 100%);
          font-family: Arial, Helvetica, sans-serif;
        }

        .shell {
          width: min(1280px, calc(100% - 24px));
          margin: 0 auto;
          padding: 0 0 24px;
        }

        .topbar {
          display: grid;
          grid-template-columns: 370px 1fr auto;
          gap: 18px;
          align-items: center;
          padding: 14px 18px;
          background: linear-gradient(180deg, rgba(23, 50, 95, 0.96), rgba(13, 34, 74, 0.96));
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 0 0 18px 18px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.24);
        }

        .logoBox {
          background: rgba(255,255,255,0.92);
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
        }

        .logoText {
          color: #8a9abb;
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .titleWrap {
          text-align: center;
        }

        .titleWrap h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }

        .titleWrap p {
          margin: 6px 0 0;
          font-size: 14px;
          color: #c8d4ea;
        }

        .topActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .pillButton {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(10, 23, 52, 0.5);
          color: white;
          border-radius: 999px;
          padding: 12px 18px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }

        .primaryPill {
          background: linear-gradient(180deg, #ffb24c, #f29a1f);
          box-shadow: 0 10px 22px rgba(242,154,31,0.26);
        }

        .solidButton {
          background: rgba(14, 35, 74, 0.95);
        }

        .dashboardGrid {
          display: grid;
          grid-template-columns: 1.65fr 1fr;
          gap: 16px;
          margin-top: 14px;
        }

        .leftColumn,
        .rightColumn {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .kpiCard {
          background: rgba(255,255,255,0.97);
          color: #17325f;
          border-radius: 22px;
          padding: 18px;
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 14px;
          align-items: center;
          box-shadow: 0 18px 40px rgba(0,0,0,0.22);
        }

        .kpiIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(79, 140, 255, 0.15);
          font-size: 24px;
        }

        .kpiText h4 {
          margin: 0 0 6px;
          font-size: 13px;
          font-weight: 800;
        }

        .kpiValue {
          margin: 0 0 8px;
          font-size: 22px;
          line-height: 1;
          font-weight: 900;
        }

        .kpiText p {
          margin: 0;
          font-size: 13px;
          color: #5f7196;
        }

        .panel {
          background: linear-gradient(180deg, rgba(17, 42, 87, 0.92), rgba(10, 29, 63, 0.94));
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.22);
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .panelHeader h2,
        .sectionHeading h2,
        .sectionTitleRow h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
        }

        .panelHeader p,
        .sectionHeading p {
          margin: 6px 0 0;
          color: #c8d4ea;
          font-size: 14px;
        }

        .panelButtons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .actionButton {
          border: none;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .orangeButton {
          background: linear-gradient(180deg, #ffb24c, #f29a1f);
          color: white;
        }

        .whiteButton {
          background: rgba(255,255,255,0.97);
          color: #17325f;
        }

        .uploadArea {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .hiddenInput {
          display: none;
        }

        .filePicker {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          padding: 10px 16px;
          background: rgba(255,255,255,0.95);
          color: #17325f;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .fileName {
          color: #d9e4f7;
          font-size: 14px;
          font-weight: 700;
        }

        .infoBox {
          margin-top: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 14px;
          background: rgba(255,255,255,0.03);
          color: #c8d4ea;
          font-size: 14px;
          line-height: 1.45;
        }

        .sectionTitleRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .sectionTitleRow span {
          font-size: 14px;
          font-weight: 800;
        }

        .chartPanel {
          position: relative;
          min-height: 310px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 20px 20px 16px 56px;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          overflow: hidden;
        }

        .chartGridLines {
          position: absolute;
          left: 56px;
          right: 18px;
          top: 18px;
          bottom: 54px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        }

        .chartGridLines div {
          position: relative;
          border-top: 1px dashed rgba(255,255,255,0.12);
        }

        .chartGridLines span {
          position: absolute;
          left: -54px;
          top: -8px;
          font-size: 12px;
          font-weight: 700;
          color: #c8d4ea;
        }

        .barsArea {
          position: relative;
          height: 270px;
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          gap: 18px;
          z-index: 1;
        }

        .barGroup {
          width: 100%;
          max-width: 82px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }

        .barValue {
          font-size: 15px;
          font-weight: 900;
        }

        .bar {
          width: 62px;
          border-radius: 14px 14px 4px 4px;
          background: linear-gradient(180deg, rgba(225,235,255,0.98), rgba(169,189,235,0.92));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 18px rgba(0,0,0,0.16);
        }

        .highlightBar {
          background: linear-gradient(180deg, #bed6ff, #6f9fff);
        }

        .barLabel {
          font-size: 15px;
          font-weight: 900;
          color: #eaf0ff;
        }

        .footNote {
          margin: 12px 0 0;
          font-size: 14px;
          color: #c8d4ea;
        }

        .sectionHeading {
          margin-bottom: 12px;
        }

        .tableWrap {
          overflow-x: auto;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 660px;
        }

        th {
          background: rgba(255,255,255,0.96);
          color: #17325f;
          text-align: left;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 900;
        }

        td {
          padding: 12px 14px;
          font-size: 14px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .statusPill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 92px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
        }

        .statusAvailable {
          background: rgba(65,184,108,0.18);
          color: #52dd84;
        }

        .statusRepair {
          background: rgba(239,193,77,0.18);
          color: #ffd75d;
        }

        .statusDown {
          background: rgba(201,72,96,0.18);
          color: #ff7b93;
        }

        .notesStack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .noteCard {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 12px;
          align-items: start;
          background: rgba(255,255,255,0.97);
          color: #17325f;
          border-radius: 16px;
          padding: 14px 16px;
        }

        .noteIcon {
          font-size: 22px;
          line-height: 1;
          margin-top: 2px;
        }

        .noteCard h3 {
          margin: 0 0 4px;
          font-size: 15px;
          font-weight: 900;
        }

        .noteCard p {
          margin: 0;
          font-size: 14px;
          color: #4f648b;
        }

        .mutedCard {
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.05);
          color: #e7eeff;
          font-size: 14px;
          line-height: 1.45;
        }

        .controlsRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .selectInput {
          min-width: 190px;
          border: none;
          outline: none;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 800;
          color: #17325f;
          background: white;
        }

        .searchWrap {
          flex: 1;
          min-width: 220px;
          display: flex;
          align-items: center;
          background: white;
          border-radius: 12px;
          overflow: hidden;
        }

        .searchWrap span {
          padding: 0 12px;
          color: #637ba5;
          font-weight: 900;
        }

        .searchWrap input {
          border: none;
          outline: none;
          width: 100%;
          padding: 12px 14px 12px 0;
          font-size: 14px;
          font-weight: 700;
          color: #17325f;
        }

        .bottomLine {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
          font-size: 13px;
          color: #d8e1f6;
        }

        @media (max-width: 1180px) {
          .topbar {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .topActions {
            justify-content: center;
          }

          .dashboardGrid {
            grid-template-columns: 1fr;
          }

          .kpiGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .panelHeader {
            flex-direction: column;
          }
        }

        @media (max-width: 760px) {
          .shell {
            width: min(100%, calc(100% - 14px));
          }

          .kpiGrid {
            grid-template-columns: 1fr;
          }

          .logoText {
            font-size: 26px;
          }

          .titleWrap h1 {
            font-size: 17px;
          }

          .chartPanel {
            padding-left: 44px;
          }

          .chartGridLines {
            left: 44px;
          }

          .bar {
            width: 42px;
          }

          .barLabel {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}

function KpiCard({
  icon,
  title,
  value,
  note
}: {
  icon: string;
  title: string;
  value: number;
  note: string;
}) {
  return (
    <div className="kpiCard">
      <div className="kpiIcon">{icon}</div>
      <div className="kpiText">
        <h4>{title}</h4>
        <div className="kpiValue">{value}</div>
        <p>{note}</p>
      </div>
    </div>
  );
}

function getStatusClass(status: string) {
  const value = status.toLowerCase();
  if (value.includes("avail")) return "statusAvailable";
  if (value.includes("repair") || value.includes("maint")) return "statusRepair";
  return "statusDown";
}

function parseCSV(text: string): Machine[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());

  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split(",").map((col) => col.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = cols[index] || "";
      });

      return {
        fleet: row.fleet || row["fleet number"] || "UNIT",
        type: row.type || "GEN",
        machineType: row["machine type"] || row.model || row.type || "Machine",
        status: row.status || "Available",
        location: row.location || "Unknown",
        availability: Number(row.availability || row["availability %"] || 0),
        updated: row.updated || new Date().toLocaleDateString()
      };
    })
    .filter((row) => row.fleet && row.machineType);
}
