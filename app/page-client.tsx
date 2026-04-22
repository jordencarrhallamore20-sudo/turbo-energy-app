"use client";

import { signOut } from "next-auth/react";
import * as XLSX from "xlsx";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Machine = {
  fleet: string;
  type: string;
  machineType: string;
  status: string;
  location: string;
  department: string;
  availability: number;
  updated: string;
  majorRepair: boolean;
  repairReason: string;
  sparesEta: string;
};

type WorkbookSheetData = {
  name: string;
  rows: Record<string, unknown>[];
};

type DashboardClientProps = {
  role: string;
  username: string;
};

const sampleData: Machine[] = [
  { fleet: "FEL09", type: "FEL", machineType: "SL60", status: "Available", location: "Hwange", department: "Plant", availability: 88, updated: "19 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" },
  { fleet: "FEL10", type: "FEL", machineType: "966H", status: "Available", location: "Hwange", department: "Plant", availability: 91, updated: "19 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" },
  { fleet: "TEX01", type: "TEX", machineType: "TK371", status: "Repair", location: "Kariba", department: "Mining", availability: 75, updated: "18 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" },
  { fleet: "TRT07", type: "TRT", machineType: "TR100", status: "Available", location: "Hwange", department: "Logistics", availability: 100, updated: "18 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" },
  { fleet: "HT03", type: "HT", machineType: "773E", status: "Major Repair", location: "Binga", department: "Mining", availability: 82, updated: "17 Apr 2026", majorRepair: true, repairReason: "Engine rebuild", sparesEta: "25 Apr 2026" },
  { fleet: "TRL01", type: "TRL", machineType: "Lowbed", status: "Available", location: "Harare", department: "Logistics", availability: 93, updated: "18 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" },
  { fleet: "TDC01", type: "TDC", machineType: "Service Truck", status: "Available", location: "Hwange", department: "Plant", availability: 86, updated: "18 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" },
  { fleet: "GEN02", type: "GEN", machineType: "WTS000", status: "Available", location: "Hwange", department: "Plant", availability: 67, updated: "18 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" },
  { fleet: "WB01", type: "WB", machineType: "Water Bowser", status: "Major Repair", location: "Kariba", department: "Mining", availability: 71, updated: "18 Apr 2026", majorRepair: true, repairReason: "Transmission parts", sparesEta: "30 Apr 2026" },
  { fleet: "AFE 5504", type: "LDV", machineType: "Light Vehicle", status: "Available", location: "Hwange", department: "Logistics", availability: 92, updated: "19 Apr 2026", majorRepair: false, repairReason: "", sparesEta: "" }
];

const departments = ["Plant", "Mining", "Logistics", "Admin", "Workshop"];

export default function DashboardClient({ role, username }: DashboardClientProps) {
  const isAdmin = role === "admin";

  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedType, setSelectedType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [fileName, setFileName] = useState("No file chosen");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [workbookSheets, setWorkbookSheets] = useState<WorkbookSheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("turboMachineData");

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Machine[];
        const normalized = parsed.map(normalizeLoadedMachine);
        setMachines(normalized);
        localStorage.setItem("turboMachineData", JSON.stringify(normalized));
      } catch {
        const normalizedSample = sampleData.map(normalizeLoadedMachine);
        setMachines(normalizedSample);
        localStorage.setItem("turboMachineData", JSON.stringify(normalizedSample));
      }
    } else {
      const normalizedSample = sampleData.map(normalizeLoadedMachine);
      setMachines(normalizedSample);
      localStorage.setItem("turboMachineData", JSON.stringify(normalizedSample));
    }
  }, []);

  const saveMachines = (data: Machine[]) => {
    const normalized = data.map(normalizeLoadedMachine);
    setMachines(normalized);
    localStorage.setItem("turboMachineData", JSON.stringify(normalized));
  };

  const mainMachines = useMemo(() => machines.filter((m) => !m.majorRepair), [machines]);

  const totalMachines = machines.length;
  const availableMachines = mainMachines.filter((m) => m.status.toLowerCase().includes("avail")).length;
  const repairsMachines = mainMachines.filter((m) => !m.status.toLowerCase().includes("avail")).length;
  const majorRepairsMachines = machines.filter((m) => m.majorRepair).length;
  const locationCount = new Set(machines.map((m) => m.location)).size;

  const typeOptions = useMemo(() => {
    return ["ALL", ...Array.from(new Set(machines.map((m) => normalizeTypeLabel(m.type)))).sort()];
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      const matchesType = selectedType === "ALL" || normalizeTypeLabel(machine.type) === selectedType;
      const term = search.trim().toLowerCase();

      const matchesSearch =
        term === "" ||
        machine.fleet.toLowerCase().includes(term) ||
        machine.type.toLowerCase().includes(term) ||
        machine.machineType.toLowerCase().includes(term) ||
        machine.status.toLowerCase().includes(term) ||
        machine.location.toLowerCase().includes(term) ||
        machine.department.toLowerCase().includes(term) ||
        machine.repairReason.toLowerCase().includes(term);

      return matchesType && matchesSearch;
    });
  }, [machines, search, selectedType]);

  const topSummary = mainMachines.slice(0, 8);
  const majorRepairsList = useMemo(() => machines.filter((m) => m.majorRepair), [machines]);

  const groupedMachineTypeData = useMemo(() => {
    const groups: Record<string, number[]> = {};

    mainMachines.forEach((machine) => {
      const groupType = normalizeTypeLabel(machine.type);
      if (!groups[groupType]) groups[groupType] = [];
      groups[groupType].push(Number(machine.availability) || 0);
    });

    return Object.entries(groups)
      .map(([type, values]) => ({
        type,
        availability: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [mainMachines]);

  const departmentAvailability = useMemo(() => {
    const groups: Record<string, Machine[]> = {};

    machines.forEach((machine) => {
      if (!groups[machine.department]) groups[machine.department] = [];
      groups[machine.department].push(machine);
    });

    return Object.entries(groups).map(([department, items]) => {
      const active = items.filter((m) => !m.majorRepair);
      const available = active.filter((m) => m.status.toLowerCase().includes("avail")).length;
      const percent = active.length === 0 ? 0 : Math.round((available / active.length) * 100);

      return {
        department,
        total: items.length,
        active: active.length,
        available,
        percent
      };
    });
  }, [machines]);

  const updateMachineField = (
    fleet: string,
    field: keyof Machine,
    value: string | number | boolean
  ) => {
    if (!isAdmin) return;

    const updated = machines.map((machine) =>
      machine.fleet === fleet
        ? normalizeLoadedMachine({ ...machine, [field]: value, updated: new Date().toLocaleDateString() })
        : machine
    );
    saveMachines(updated);
  };

  const setMajorRepair = (fleet: string, enabled: boolean) => {
    if (!isAdmin) return;

    const updated = machines.map((machine) => {
      if (machine.fleet !== fleet) return machine;

      return normalizeLoadedMachine({
        ...machine,
        majorRepair: enabled,
        status: enabled ? "Major Repair" : "Available",
        repairReason: enabled ? machine.repairReason : "",
        sparesEta: enabled ? machine.sparesEta : "",
        updated: new Date().toLocaleDateString()
      });
    });

    saveMachines(updated);
  };

  const handleExport = () => {
    if (!isAdmin) return;

    const headers = [
      "fleet",
      "type",
      "machineType",
      "status",
      "location",
      "department",
      "availability",
      "majorRepair",
      "repairReason",
      "sparesEta",
      "updated"
    ];

    const rows = machines.map((machine) =>
      [
        machine.fleet,
        machine.type,
        machine.machineType,
        machine.status,
        machine.location,
        machine.department,
        machine.availability,
        machine.majorRepair,
        machine.repairReason,
        machine.sparesEta,
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
    if (!isAdmin) return;
    window.print();
  };

  const handleRefresh = () => {
    const stored = localStorage.getItem("turboMachineData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Machine[];
        const normalized = parsed.map(normalizeLoadedMachine);
        setMachines(normalized);
        localStorage.setItem("turboMachineData", JSON.stringify(normalized));
      } catch {
        saveMachines(sampleData);
      }
    }
  };

  const handleSpreadsheetUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".csv")) {
        const text = await file.text();
        const parsed = parseCSV(text);

        if (parsed.length > 0) {
          saveMachines(parsed);
          setSheetNames(["CSV"]);
          setWorkbookSheets([{ name: "CSV", rows: [] }]);
          setActiveSheet("CSV");
        } else {
          alert("CSV uploaded but no valid rows were found.");
        }
        return;
      }

      if (
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".xlsm")
      ) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        const sheets: WorkbookSheetData[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: ""
          });
          return { name, rows };
        });

        setWorkbookSheets(sheets);
        setSheetNames(workbook.SheetNames);

        const preferredSheet =
          sheets.find((s) => s.name === "Summary") ||
          sheets.find((s) => s.name === "Summary (Excl Tyre)") ||
          sheets.find((s) => isSummaryLikeSheet(s.rows)) ||
          sheets[0];

        if (!preferredSheet) {
          alert("No usable sheets found.");
          return;
        }

        const parsed = parseSelectedSheet(preferredSheet.name, preferredSheet.rows);

        if (parsed.length > 0) {
          saveMachines(parsed);
          setActiveSheet(preferredSheet.name);
        } else {
          alert("Spreadsheet loaded, but the selected sheet did not contain machine summary rows.");
        }

        return;
      }

      alert("Please upload .xlsx, .xls, .xlsm, or .csv");
    } catch (error) {
      console.error(error);
      alert("Could not read spreadsheet file.");
    }
  };

  const loadSheetByName = (sheetName: string) => {
    if (!isAdmin) return;

    const selected = workbookSheets.find((s) => s.name === sheetName);
    if (!selected) return;

    const parsed = parseSelectedSheet(selected.name, selected.rows);

    if (parsed.length > 0) {
      saveMachines(parsed);
      setActiveSheet(sheetName);
    } else {
      alert(`Sheet "${sheetName}" does not contain machine summary rows for the dashboard.`);
    }
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

  const showMajorRepairsOnly = () => {
    setSelectedType("ALL");
    setSearch("major repair");
    const el = document.getElementById("major-repairs");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="page">
      <div className="shell">
        <div className="topMetaRow">
          <div className="userBadge">
            Logged in as: <strong>{username}</strong> ({isAdmin ? "admin" : "user"})
          </div>
          <button
            className="logoutButton"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Logout
          </button>
        </div>

        <header className="topbar">
          <div className="logoBox">
            <div className="logoText">TURBO ENERGY</div>
          </div>

          <div className="titleWrap">
            <h1>Turbo-Energy Machine Availability</h1>
            <p>Live fleet dashboard with admin movements, departments, and major repairs</p>
          </div>

          <div className="topActions">
            {isAdmin && (
              <label htmlFor="csvUploadTop" className="pillButton primaryPill">
                Upload File
              </label>
            )}
            <button className="pillButton" onClick={showBelow85Only}>
              Units Below 85%
            </button>
            <button className="pillButton" onClick={showMajorRepairsOnly}>
              Major Repairs
            </button>
            <button className="pillButton" onClick={scrollToBottomRegister}>
              Bottom Register
            </button>
          </div>
        </header>

        <main className="dashboardGrid">
          <section className="leftColumn">
            <div className="kpiGrid">
              <KpiCard icon="🏗" title="TOTAL MACHINES" value={totalMachines} note="All units in the register" />
              <KpiCard icon="✅" title="AVAILABLE" value={availableMachines} note="Active units marked available" />
              <KpiCard icon="🔧" title="REPAIRS / DOWN" value={repairsMachines} note="Active units needing attention" />
              <KpiCard icon="📍" title="LOCATIONS" value={locationCount} note="Distinct operating locations" />
            </div>

            {isAdmin && (
              <section className="panel">
                <div className="panelHeader">
                  <div>
                    <h2>Admin Upload and Save</h2>
                    <p>Upload spreadsheet XLSX, XLS, XLSM, or CSV</p>
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
                    accept=".xlsx,.xls,.xlsm,.csv"
                    onChange={handleSpreadsheetUpload}
                    className="hiddenInput"
                  />
                  <label htmlFor="csvUploadTop" className="filePicker">
                    Choose File
                  </label>
                  <span className="fileName">{fileName}</span>
                </div>

                <div className="infoBox">
                  Excel upload now uses <strong>Summary</strong> first, then <strong>Summary (Excl Tyre)</strong>. Registration-style light vehicles are grouped into <strong>LDV</strong>.
                </div>
              </section>
            )}

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
                  {groupedMachineTypeData.map((item, index) => (
                    <div key={item.type} className="barGroup">
                      <div className="barValue">{item.availability}%</div>
                      <div
                        className={`bar ${index % 4 === 3 ? "highlightBar" : ""}`}
                        style={{ height: `${Math.max(item.availability * 1.7, 18)}px` }}
                      />
                      <div className="barLabel">{item.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="footNote">
                Major repair units are excluded from the machine type availability graph.
              </p>
            </section>

            <section className="panel">
              <div className="sectionHeading">
                <h2>Department Availability</h2>
                <p>Availability percentage by department with major repairs excluded.</p>
              </div>

              <div className="departmentGrid">
                {departmentAvailability.map((item) => (
                  <div key={item.department} className="departmentCard">
                    <div className="departmentHead">
                      <h3>{item.department}</h3>
                      <span>{item.percent}%</span>
                    </div>
                    <div className="departmentBarTrack">
                      <div className="departmentBarFill" style={{ width: `${item.percent}%` }} />
                    </div>
                    <div className="departmentMeta">
                      <span>Total: {item.total}</span>
                      <span>Active: {item.active}</span>
                      <span>Available: {item.available}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel" id="major-repairs">
              <div className="sectionHeading">
                <h2>Machines on Major Repairs</h2>
                <p>These units are removed from the main availability percentage.</p>
              </div>

              <div className="majorRepairSummary">
                <div className="majorBadge">{majorRepairsMachines}</div>
                <div>
                  <strong>{majorRepairsMachines}</strong> unit(s) on major repair
                </div>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fleet</th>
                      <th>Machine</th>
                      <th>Department</th>
                      <th>Reason</th>
                      <th>Spares ETA</th>
                      <th>Status</th>
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {majorRepairsList.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6}>No machines on major repair.</td>
                      </tr>
                    ) : (
                      majorRepairsList.map((machine) => (
                        <tr key={machine.fleet}>
                          <td>{machine.fleet}</td>
                          <td>{machine.machineType}</td>
                          <td>{machine.department}</td>
                          <td>{machine.repairReason || "-"}</td>
                          <td>{machine.sparesEta || "-"}</td>
                          <td>
                            <span className="statusPill statusMajor">Major Repair</span>
                          </td>
                          {isAdmin && (
                            <td>
                              <button
                                className="miniAction"
                                onClick={() => setMajorRepair(machine.fleet, false)}
                              >
                                Return to main list
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="sectionHeading">
                <h2>Top Machine Summary</h2>
                <p>Quick summary of active machines only.</p>
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
                          <span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>
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
                    <h3>Main availability</h3>
                    <p>Major repair units are automatically excluded from top KPI percentages and type graphs.</p>
                  </div>
                </div>

                <div className="noteCard">
                  <div className="noteIcon">📄</div>
                  <div>
                    <h3>Excel upload fixed</h3>
                    <p>Workbook now uses Summary sheets first instead of the event log sheet.</p>
                  </div>
                </div>

                <div className="mutedCard">
                  {isAdmin
                    ? "You are logged in as admin. Editing controls are enabled."
                    : "You are logged in as user. This is view-only mode."}
                </div>
              </div>
            </section>

            {isAdmin && (
              <section className="panel">
                <div className="sectionHeading">
                  <h2>Admin Machine Controls</h2>
                  <p>Move machines to major repair, assign departments, and add notes.</p>
                </div>

                <div className="adminList">
                  {machines.map((machine) => (
                    <div key={machine.fleet} className="adminCard">
                      <div className="adminTop">
                        <div>
                          <strong>{machine.fleet}</strong> - {machine.machineType}
                        </div>
                        <span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>
                          {machine.majorRepair ? "Major Repair" : machine.status}
                        </span>
                      </div>

                      <div className="adminGrid">
                        <div>
                          <label>Department</label>
                          <select
                            value={machine.department}
                            onChange={(e) => updateMachineField(machine.fleet, "department", e.target.value)}
                            className="selectInput"
                          >
                            {departments.map((dep) => (
                              <option key={dep} value={dep}>{dep}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label>Status</label>
                          <select
                            value={machine.majorRepair ? "Major Repair" : machine.status}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "Major Repair") {
                                setMajorRepair(machine.fleet, true);
                              } else {
                                updateMachineField(machine.fleet, "status", value);
                                if (machine.majorRepair) setMajorRepair(machine.fleet, false);
                              }
                            }}
                            className="selectInput"
                          >
                            <option value="Available">Available</option>
                            <option value="Repair">Repair</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Down">Down</option>
                            <option value="Major Repair">Major Repair</option>
                          </select>
                        </div>

                        <div>
                          <label>Availability %</label>
                          <input
                            className="textInput"
                            type="number"
                            value={machine.availability}
                            onChange={(e) =>
                              updateMachineField(machine.fleet, "availability", Number(e.target.value || 0))
                            }
                          />
                        </div>

                        <div>
                          <label>Reason</label>
                          <input
                            className="textInput"
                            type="text"
                            value={machine.repairReason}
                            placeholder="Reason for major repair"
                            onChange={(e) => updateMachineField(machine.fleet, "repairReason", e.target.value)}
                          />
                        </div>

                        <div>
                          <label>Spares ETA</label>
                          <input
                            className="textInput"
                            type="text"
                            value={machine.sparesEta}
                            placeholder="e.g. 30 Apr 2026"
                            onChange={(e) => updateMachineField(machine.fleet, "sparesEta", e.target.value)}
                          />
                        </div>

                        <div>
                          <label>Location</label>
                          <input
                            className="textInput"
                            type="text"
                            value={machine.location}
                            onChange={(e) => updateMachineField(machine.fleet, "location", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="adminActions">
                        {!machine.majorRepair ? (
                          <button
                            className="miniAction orangeMini"
                            onClick={() => setMajorRepair(machine.fleet, true)}
                          >
                            Move to major repair
                          </button>
                        ) : (
                          <button
                            className="miniAction"
                            onClick={() => setMajorRepair(machine.fleet, false)}
                          >
                            Remove from major repair
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
                      <th>Department</th>
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
                          <span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>
                            {machine.majorRepair ? "Major Repair" : machine.status}
                          </span>
                        </td>
                        <td>{machine.department}</td>
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

        {isAdmin && sheetNames.length > 0 && (
          <section className="sheetTabsPanel">
            <div className="sheetTabsHeader">
              <h3>Workbook Sheets</h3>
              <p>Click a sheet tab to load it into the dashboard.</p>
            </div>

            <div className="sheetTabs">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  className={`sheetTab ${activeSheet === name ? "activeSheetTab" : ""}`}
                  onClick={() => loadSheetByName(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>
        )}
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
          width: min(1380px, calc(100% - 24px));
          margin: 0 auto;
          padding: 0 0 24px;
          overflow-x: hidden;
        }

        .topMetaRow {
          width: min(1380px, calc(100% - 24px));
          margin: 14px auto 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .userBadge {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(10, 23, 52, 0.5);
          color: white;
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
        }

        .logoutButton {
          padding: 10px 16px;
          background: #d94141;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        }

        .topbar {
          display: grid;
          grid-template-columns: 370px 1fr auto;
          gap: 18px;
          align-items: center;
          padding: 14px 18px;
          background: linear-gradient(180deg, rgba(23, 50, 95, 0.96), rgba(13, 34, 74, 0.96));
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 18px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.24);
          margin-top: 12px;
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
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
          gap: 16px;
          margin-top: 14px;
          min-width: 0;
        }

        .leftColumn,
        .rightColumn {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        .panel,
        .tableWrap,
        .chartPanel {
          min-width: 0;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
          min-width: 0;
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
          word-break: break-word;
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
          overflow-x: auto;
          overflow-y: hidden;
          max-width: 100%;
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
          width: max-content;
          min-width: 100%;
          height: 270px;
          display: flex;
          justify-content: flex-start;
          align-items: flex-end;
          gap: 14px;
          z-index: 1;
          padding-right: 12px;
        }

        .barGroup {
          width: 58px;
          min-width: 58px;
          max-width: 58px;
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
          width: 42px;
          border-radius: 14px 14px 4px 4px;
          background: linear-gradient(180deg, rgba(225,235,255,0.98), rgba(169,189,235,0.92));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 18px rgba(0,0,0,0.16);
        }

        .highlightBar {
          background: linear-gradient(180deg, #bed6ff, #6f9fff);
        }

        .barLabel {
          font-size: 12px;
          font-weight: 900;
          color: #eaf0ff;
          text-align: center;
          white-space: nowrap;
        }

        .footNote {
          margin: 12px 0 0;
          font-size: 14px;
          color: #c8d4ea;
        }

        .sectionHeading {
          margin-bottom: 12px;
        }

        .departmentGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .departmentCard {
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 14px;
          background: rgba(255,255,255,0.04);
          min-width: 0;
        }

        .departmentHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 10px;
        }

        .departmentHead h3 {
          margin: 0;
          font-size: 15px;
        }

        .departmentHead span {
          font-size: 16px;
          font-weight: 900;
          color: #ffcf67;
        }

        .departmentBarTrack {
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          overflow: hidden;
          margin-bottom: 10px;
        }

        .departmentBarFill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #7db2ff, #4f8cff);
        }

        .departmentMeta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #cfdbf4;
        }

        .majorRepairSummary {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .majorBadge {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 177, 75, 0.18);
          color: #ffcf67;
          font-weight: 900;
          font-size: 18px;
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
          min-width: 760px;
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

        .statusMajor {
          background: rgba(255,177,75,0.18);
          color: #ffcf67;
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

        .adminList {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .adminCard {
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 14px;
          background: rgba(255,255,255,0.04);
        }

        .adminTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }

        .adminGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .adminGrid label {
          display: block;
          font-size: 12px;
          color: #cfdbf4;
          margin-bottom: 6px;
          font-weight: 700;
        }

        .selectInput,
        .textInput {
          width: 100%;
          border: none;
          outline: none;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 700;
          color: #17325f;
          background: white;
          min-width: 0;
        }

        .adminActions {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
        }

        .miniAction {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(10, 23, 52, 0.5);
          color: white;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .orangeMini {
          background: linear-gradient(180deg, #ffb24c, #f29a1f);
          border: none;
        }

        .controlsRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
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
          min-width: 0;
        }

        .bottomLine {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
          font-size: 13px;
          color: #d8e1f6;
          flex-wrap: wrap;
        }

        .sheetTabsPanel {
          margin-top: 16px;
          background: linear-gradient(180deg, rgba(17, 42, 87, 0.92), rgba(10, 29, 63, 0.94));
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 18px 40px rgba(0,0,0,0.22);
        }

        .sheetTabsHeader h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
        }

        .sheetTabsHeader p {
          margin: 6px 0 0;
          color: #c8d4ea;
          font-size: 14px;
        }

        .sheetTabs {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 14px;
        }

        .sheetTab {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(10, 23, 52, 0.5);
          color: white;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .activeSheetTab {
          background: linear-gradient(180deg, #ffb24c, #f29a1f);
          border: none;
        }

        @media (max-width: 1280px) {
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

          .panelHeader {
            flex-direction: column;
          }
        }

        @media (max-width: 860px) {
          .kpiGrid,
          .departmentGrid,
          .adminGrid {
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
            width: 36px;
          }

          .barGroup {
            width: 50px;
            min-width: 50px;
            max-width: 50px;
          }

          .barLabel {
            font-size: 11px;
          }

          .bottomLine,
          .adminTop,
          .topMetaRow {
            flex-direction: column;
            align-items: flex-start;
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

function getStatusClass(status: string, majorRepair?: boolean) {
  if (majorRepair) return "statusMajor";
  const value = status.toLowerCase();
  if (value.includes("avail")) return "statusAvailable";
  if (value.includes("repair") || value.includes("maint")) return "statusRepair";
  return "statusDown";
}

function normalizeTypeLabel(type: string) {
  const cleaned = String(type || "").toUpperCase().trim();
  if (cleaned === "LV") return "LDV";
  return cleaned;
}

function isRegistrationStyleFleet(fleet: string) {
  const cleaned = String(fleet || "").toUpperCase().trim();
  return /^[A-Z]{3}\s?\d{3,4}$/.test(cleaned);
}

function normalizeLoadedMachine(machine: Machine): Machine {
  const isRegistration = isRegistrationStyleFleet(machine.fleet);
  const normalizedType = isRegistration
    ? "LDV"
    : normalizeTypeLabel(machine.type || inferTypeFromFleet(machine.fleet));

  return {
    ...machine,
    type: normalizedType,
    machineType:
      normalizedType === "LDV" ? "Light Vehicle" : machine.machineType || machine.fleet,
    department: machine.department || inferDepartmentFromType(normalizedType),
  };
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

      return normalizeMachine(row);
    })
    .filter((row) => row.fleet && row.machineType);
}

function isSummaryLikeSheet(rows: Record<string, unknown>[]) {
  if (!rows.length) return false;
  const first = normalizeKeys(rows[0]);
  return (
    ("machine" in first || "fleet" in first || "fleet number" in first) &&
    ("availability" in first || "availability %" in first)
  );
}

function parseSelectedSheet(
  sheetName: string,
  rows: Record<string, unknown>[]
): Machine[] {
  const lower = sheetName.toLowerCase();

  if (lower.includes("summary")) {
    return mapSummaryRows(rows);
  }

  const normalizedFirst = rows[0] ? normalizeKeys(rows[0]) : {};
  if ("machine" in normalizedFirst && "availability" in normalizedFirst) {
    return mapSummaryRows(rows);
  }

  return [];
}

function mapSummaryRows(rows: Record<string, unknown>[]): Machine[] {
  return rows
    .map((row) => {
      const n = normalizeKeys(row);

      const fleet = String(n["machine"] || n["fleet"] || n["fleet number"] || "").trim();
      if (!fleet) return null;

      const inferredType = normalizeTypeLabel(inferTypeFromFleet(fleet));

      const availabilityRaw = n["availability"] ?? n["availability %"] ?? "";
      let availability = Number(availabilityRaw);
      if (!Number.isFinite(availability)) availability = 0;

      if (availability <= 1) {
        availability = Math.round(availability * 10000) / 100;
      }

      const downtime = Number(n["downtime"] || 0);
      const status =
        availability >= 85
          ? "Available"
          : availability > 0
          ? "Repair"
          : downtime >= 359
          ? "Down"
          : "Repair";

      return normalizeLoadedMachine({
        fleet,
        type: inferredType,
        machineType: inferredType === "LDV" ? "Light Vehicle" : fleet,
        status,
        location: "Hwange",
        department: inferDepartmentFromType(inferredType),
        availability,
        updated: new Date().toLocaleDateString(),
        majorRepair: false,
        repairReason: "",
        sparesEta: "",
      });
    })
    .filter((row): row is Machine => Boolean(row));
}

function normalizeKeys(row: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[String(key).trim().toLowerCase()] = String(value ?? "").trim();
  });
  return normalized;
}

function normalizeMachine(row: Record<string, string>): Machine {
  const majorRepair =
    String(row.majorrepair || row["major repair"] || "").toLowerCase() === "true" ||
    String(row.status || "").toLowerCase().includes("major");

  const fleet = row.fleet || row["fleet number"] || row.unit || "UNIT";
  const type = normalizeTypeLabel(row.type || inferTypeFromFleet(fleet));

  return normalizeLoadedMachine({
    fleet,
    type,
    machineType: row["machine type"] || row.model || (type === "LDV" ? "Light Vehicle" : fleet),
    status: majorRepair ? "Major Repair" : row.status || "Available",
    location: row.location || "Hwange",
    department: row.department || inferDepartmentFromType(type),
    availability: Number(row.availability || row["availability %"] || row.percent || 0),
    updated: row.updated || new Date().toLocaleDateString(),
    majorRepair,
    repairReason: row.repairreason || row["repair reason"] || "",
    sparesEta: row.spareseta || row["spares eta"] || "",
  });
}

function inferTypeFromFleet(fleet: string) {
  const cleaned = fleet.toUpperCase().trim();

  if (isRegistrationStyleFleet(cleaned)) {
    return "LDV";
  }

  const knownHeavyPrefixes = [
    "FEL",
    "TEX",
    "TRT",
    "HT",
    "TRL",
    "TDC",
    "GEN",
    "WB",
    "LV",
    "LDV",
    "WT",
    "EX",
    "DT",
    "TLB",
    "CARGO",
  ];

  for (const prefix of knownHeavyPrefixes) {
    if (cleaned.startsWith(prefix)) {
      return prefix === "LV" ? "LDV" : prefix;
    }
  }

  const lettersOnly = cleaned.match(/^[A-Z]+/);
  if (!lettersOnly) return "GEN";

  return lettersOnly[0];
}

function inferDepartmentFromType(type: string) {
  const t = normalizeTypeLabel(type);

  if (t === "LDV") return "Logistics";
  if (["FEL", "HT", "TEX", "WB", "EX", "DT"].includes(t)) return "Mining";
  if (["TRT", "TRL", "TDC", "TLB", "CARGO"].includes(t)) return "Logistics";

  return "Plant";
}
