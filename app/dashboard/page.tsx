"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type MachineStatus = "AVAILABLE" | "DOWN";

type Machine = {
  id: string;
  type: string;
  department: string;
  status: MachineStatus;
  location: string;
  availability: string;
  hours_worked?: number;
  hours_down?: number;
  downtime_reason?: string;
  repair_reason?: string;
  spares_eta?: string;
  online_status?: string;
  major_repair?: boolean;
  updated_at?: string;
  updated_by?: string;
};

const TABLE_NAME = "machine_availability_live";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const starterMachines: Machine[] = [
  {
    id: "FEL10",
    type: "SL60",
    department: "Mining",
    status: "AVAILABLE",
    location: "Hwange",
    availability: "96.4%",
  },
  {
    id: "HT12",
    type: "Haul Truck",
    department: "Operations",
    status: "AVAILABLE",
    location: "North Pit",
    availability: "94.8%",
  },
  {
    id: "LV33",
    type: "Light Vehicle",
    department: "Admin",
    status: "DOWN",
    location: "Main Yard",
    availability: "78.2%",
  },
  {
    id: "WB05",
    type: "Water Bowser",
    department: "Support",
    status: "AVAILABLE",
    location: "Plant Area",
    availability: "95.0%",
  },
  {
    id: "TG02",
    type: "Generator",
    department: "Utilities",
    status: "AVAILABLE",
    location: "South Section",
    availability: "100.0%",
  },
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function numberValue(value: any) {
  const n = Number(String(value ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

function round1(value: any) {
  return Number(numberValue(value).toFixed(1));
}

function normalizeStatus(value: any): MachineStatus {
  const s = clean(value).toLowerCase();
  if (s.includes("down") || s.includes("offline") || s.includes("repair") || s.includes("maint")) {
    return "DOWN";
  }
  return "AVAILABLE";
}

function normalizeMachine(row: any): Machine | null {
  const id = clean(row.fleet || row.id || row.unit || row.unit_no || row.machine_number).toUpperCase();
  if (!id || id === "FLEET" || id === "UNIT" || id === "ID") return null;

  const status = normalizeStatus(row.status || row.online_status);
  const availability = row.availability ?? row.availability_percent ?? row.availability_percentage ?? (status === "AVAILABLE" ? 100 : 0);

  return {
    id,
    type: clean(row.type || row.machine_type || row.machineType || row.machine || "Unknown"),
    department: clean(row.department || row.dept || "Workshop"),
    status,
    location: clean(row.location || row.site || "Hwange"),
    availability: `${round1(availability)}%`,
    hours_worked: numberValue(row.hours_worked || row.hoursWorked || row.worked_hours),
    hours_down: numberValue(row.hours_down || row.hoursDown || row.downtime_hours),
    downtime_reason: clean(row.downtime_reason || row.downtimeReason || row.reason || row.breakdown_reason),
    repair_reason: clean(row.repair_reason || row.repairReason || row.work_required),
    spares_eta: clean(row.spares_eta || row.sparesEta || row.eta),
    online_status: clean(row.online_status || row.onlineStatus || (status === "AVAILABLE" ? "Online" : "Offline")),
    major_repair: Boolean(row.major_repair || row.majorRepair || clean(row.status).toLowerCase().includes("major")),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

function toDbRow(machine: Machine, updatedBy = "Dashboard") {
  return {
    fleet: machine.id.trim().toUpperCase(),
    type: machine.type.trim(),
    department: machine.department.trim(),
    status: machine.status,
    location: machine.location.trim(),
    availability: round1(machine.availability),
    hours_worked: numberValue(machine.hours_worked),
    hours_down: numberValue(machine.hours_down),
    downtime_reason: machine.downtime_reason || "",
    repair_reason: machine.repair_reason || "",
    spares_eta: machine.spares_eta || "",
    online_status: machine.status === "AVAILABLE" ? "Online" : "Offline",
    major_repair: Boolean(machine.major_repair),
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((item) => item.replace(/^"|"$/g, ""));
}

export default function MachineAvailabilityPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState("");

  const [form, setForm] = useState({
    id: "",
    type: "",
    department: "",
    status: "AVAILABLE" as MachineStatus,
    location: "",
    availability: "",
  });

  async function loadMachines(showLoading = true) {
    if (showLoading) setLoading(true);

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage("Supabase environment variables are missing in Vercel.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("fleet", { ascending: true });

    if (error) {
      setMessage(`Supabase load failed: ${error.message}`);
      setLoading(false);
      return;
    }

    const loaded = (data || [])
      .map(normalizeMachine)
      .filter((machine): machine is Machine => Boolean(machine));

    setMachines(loaded);
    setLastRefresh(new Date().toLocaleTimeString());
    setLoading(false);

    if (loaded.length === 0) {
      setMessage("Live register is empty. Upload CSV or add machines. Use sample data only for testing.");
    } else {
      setMessage(`Loaded ${loaded.length} machines from live Supabase register.`);
    }
  }

  useEffect(() => {
    loadMachines();

    const channel = supabase
      .channel("machine-availability-live-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME },
        () => loadMachines(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearForm = () => {
    setForm({
      id: "",
      type: "",
      department: "",
      status: "AVAILABLE",
      location: "",
      availability: "",
    });
    setEditingId(null);
  };

  async function saveMachine() {
    if (
      !form.id.trim() ||
      !form.type.trim() ||
      !form.department.trim() ||
      !form.location.trim() ||
      !form.availability.trim()
    ) {
      setMessage("Fill all fields");
      return;
    }

    const cleanId = form.id.trim().toUpperCase();
    const availabilityNumber = numberValue(form.availability);

    if (!Number.isFinite(availabilityNumber)) {
      setMessage("Availability must be a number");
      return;
    }

    const cleanMachine: Machine = {
      id: cleanId,
      type: form.type.trim(),
      department: form.department.trim(),
      status: form.status,
      location: form.location.trim(),
      availability: `${round1(availabilityNumber)}%`,
    };

    const duplicate = machines.some(
      (m) => m.id !== editingId && m.id.toLowerCase() === cleanId.toLowerCase()
    );

    if (!editingId && duplicate) {
      setMessage("Unit already exists");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(toDbRow(cleanMachine, "Dashboard"), { onConflict: "fleet" });

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setMachines((current) => {
      const exists = current.some((m) => m.id === cleanId);
      if (exists) return current.map((m) => (m.id === cleanId ? cleanMachine : m));
      return [cleanMachine, ...current];
    });

    setMessage(editingId ? "Machine updated live" : "Machine added live");
    clearForm();
    await loadMachines(false);
    setSaving(false);
  }

  const editMachine = (machine: Machine) => {
    setForm({
      id: machine.id,
      type: machine.type,
      department: machine.department,
      status: machine.status,
      location: machine.location,
      availability: machine.availability.replace("%", ""),
    });
    setEditingId(machine.id);
    setMessage("Editing machine");
  };

  async function deleteMachine(id: string) {
    setSaving(true);
    const { error } = await supabase.from(TABLE_NAME).delete().eq("fleet", id);

    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setMachines((current) => current.filter((m) => m.id !== id));
    if (editingId === id) clearForm();
    setMessage("Machine deleted live");
    setSaving(false);
  }

  async function toggleStatus(id: string) {
    const machine = machines.find((m) => m.id === id);
    if (!machine) return;

    const nextStatus: MachineStatus = machine.status === "AVAILABLE" ? "DOWN" : "AVAILABLE";
    const nextMachine: Machine = {
      ...machine,
      status: nextStatus,
      availability: nextStatus === "AVAILABLE" ? "100%" : "0%",
      online_status: nextStatus === "AVAILABLE" ? "Online" : "Offline",
    };

    setMachines((current) => current.map((m) => (m.id === id ? nextMachine : m)));

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(toDbRow(nextMachine, "Dashboard"))
      .eq("fleet", id);

    if (error) {
      setMessage(`Status update failed: ${error.message}`);
      await loadMachines(false);
      return;
    }

    setMessage("Status updated live");
  }

  async function resetSampleData() {
    setSaving(true);

    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(starterMachines.map((machine) => toDbRow(machine, "Dashboard Sample")), {
        onConflict: "fleet",
      });

    if (error) {
      setMessage(`Sample data failed: ${error.message}`);
      setSaving(false);
      return;
    }

    clearForm();
    setSearchTerm("");
    await loadMachines(false);
    setMessage("Sample data added to live register");
    setSaving(false);
  }

  const exportCsv = () => {
    const headers = ["id,type,department,status,location,availability"];
    const rows = machines.map(
      (m) =>
        `"${m.id}","${m.type}","${m.department}","${m.status}","${m.location}","${m.availability}"`
    );

    const csv = [...headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "machine-availability.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage("CSV exported");
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean);

      if (rows.length < 2) {
        setMessage("CSV file is empty");
        return;
      }

      const headers = parseCsvLine(rows[0]).map((h) => h.toLowerCase().trim());
      const findIndex = (names: string[]) =>
        headers.findIndex((header) => names.includes(header));

      const idIndex = findIndex(["id", "fleet", "fleet no", "fleet number", "unit", "unit no", "unitno"]);
      const typeIndex = findIndex(["type", "machine type", "machine_type", "machine"]);
      const departmentIndex = findIndex(["department", "dept"]);
      const statusIndex = findIndex(["status", "machine status", "condition", "online status", "online/offline"]);
      const locationIndex = findIndex(["location", "site"]);
      const availabilityIndex = findIndex(["availability", "availability %", "availability percent", "availability_percentage"]);

      if (idIndex === -1 || typeIndex === -1 || departmentIndex === -1 || locationIndex === -1) {
        setMessage("CSV headers not recognised. Need fleet/id, type, department and location.");
        return;
      }

      const unique = new Map<string, Machine>();

      rows.slice(1).forEach((row) => {
        const cols = parseCsvLine(row);
        const id = clean(cols[idIndex]).toUpperCase();
        if (!id || id === "FLEET" || id === "UNIT" || id === "ID") return;

        const status = normalizeStatus(statusIndex >= 0 ? cols[statusIndex] : "AVAILABLE");
        const rawAvailability = availabilityIndex >= 0 ? cols[availabilityIndex] : status === "AVAILABLE" ? "100" : "0";

        const machine: Machine = {
          id,
          type: clean(cols[typeIndex]) || "Unknown",
          department: clean(cols[departmentIndex]) || "Workshop",
          status,
          location: clean(cols[locationIndex]) || "Hwange",
          availability: `${round1(rawAvailability)}%`,
        };

        unique.set(id, machine);
      });

      const parsedMachines = Array.from(unique.values());

      if (parsedMachines.length === 0) {
        setMessage("No valid rows found");
        return;
      }

      setSaving(true);

      const clearResult = await supabase.from(TABLE_NAME).delete().neq("fleet", "___never_match___");
      if (clearResult.error) {
        setMessage(`Could not clear old register: ${clearResult.error.message}`);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from(TABLE_NAME)
        .upsert(parsedMachines.map((machine) => toDbRow(machine, "CSV Upload")), {
          onConflict: "fleet",
        });

      if (error) {
        setMessage(`Upload failed: ${error.message}`);
        setSaving(false);
        return;
      }

      setMachines(parsedMachines);
      clearForm();
      setMessage(`Replaced live register with ${parsedMachines.length} machines from CSV`);
      await loadMachines(false);
      setSaving(false);
    } catch (error: any) {
      setMessage(`CSV upload failed: ${error?.message || "Unknown error"}`);
      setSaving(false);
    } finally {
      event.target.value = "";
    }
  };

  const printReport = () => {
    window.print();
  };

  const filteredMachines = useMemo(() => {
    const t = searchTerm.toLowerCase().trim();
    if (!t) return machines;

    return machines.filter(
      (m) =>
        m.id.toLowerCase().includes(t) ||
        m.type.toLowerCase().includes(t) ||
        m.department.toLowerCase().includes(t) ||
        m.location.toLowerCase().includes(t) ||
        m.status.toLowerCase().includes(t)
    );
  }, [machines, searchTerm]);

  const activeMachines = machines.filter((m) => !m.major_repair);
  const totalMachines = activeMachines.length;
  const availableCount = activeMachines.filter((m) => m.status === "AVAILABLE").length;
  const downCount = activeMachines.filter((m) => m.status === "DOWN").length;

  const averageAvailability =
    activeMachines.length > 0
      ? (
          activeMachines.reduce((sum, machine) => sum + numberValue(machine.availability), 0) /
          activeMachines.length
        ).toFixed(1)
      : "0.0";

  const totalRunTime = activeMachines
    .reduce((sum, machine) => sum + numberValue(machine.hours_worked || numberValue(machine.availability) * 10), 0)
    .toFixed(1);

  const totalDowntime = activeMachines
    .reduce((sum, machine) => sum + numberValue(machine.hours_down || 100 - numberValue(machine.availability)), 0)
    .toFixed(1);

  const unitsBelow85 = activeMachines.filter((m) => numberValue(m.availability) < 85).length;

  const summaryCards = [
    { title: "TOTAL MACHINES", value: String(totalMachines), note: "Active fleet units only" },
    { title: "AVAILABLE", value: String(availableCount), note: "Active units marked available" },
    { title: "REPAIRS / DOWN", value: String(downCount), note: "Active units needing attention" },
    { title: "AVERAGE FLEET AVAILABILITY", value: `${averageAvailability}%`, note: "Major repair units excluded" },
    { title: "UNITS BELOW 85%", value: String(unitsBelow85), note: "Current units below target availability" },
  ];

  const groupedAverages = Object.values(
    activeMachines.reduce((acc, machine) => {
      const key = machine.type.toUpperCase();
      const availabilityValue = numberValue(machine.availability);
      const runTimeValue = numberValue(machine.hours_worked || availabilityValue * 10);
      const downtimeValue = numberValue(machine.hours_down || 100 - availabilityValue);

      if (!acc[key]) {
        acc[key] = { type: key, units: 0, availabilityTotal: 0, runTime: 0, downtime: 0 };
      }

      acc[key].units += 1;
      acc[key].availabilityTotal += availabilityValue;
      acc[key].runTime += runTimeValue;
      acc[key].downtime += downtimeValue;
      return acc;
    }, {} as Record<string, { type: string; units: number; availabilityTotal: number; runTime: number; downtime: number }>)
  ).map((item) => {
    const avg = item.units > 0 ? item.availabilityTotal / item.units : 0;
    return {
      type: item.type,
      units: item.units,
      availability: `${avg.toFixed(1)}%`,
      runTime: item.runTime.toFixed(1),
      downtime: item.downtime.toFixed(1),
      status: avg >= 90 ? "GREEN" : avg >= 80 ? "AMBER" : "RED",
    };
  });

  const chartBars = groupedAverages.map((row) => {
    const value = numberValue(row.availability);
    return { label: row.type, value: `${value.toFixed(1)}%`, height: `${Math.max(value, 8)}%` };
  });

  return (
    <div className="availability-page">
      <style>{`
        @media print {
          input, select, button { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <section className="upload-panel">
        <div className="section-heading">
          <h2>Admin Upload and Save</h2>
          <p style={{ margin: "6px 0 0", color: "#dbeafe" }}>
            Live source: Supabase table {TABLE_NAME}. Last refresh: {lastRefresh || "-"}
          </p>
        </div>

        <div className="upload-grid">
          <div className="upload-main">
            <label className="upload-label">Upload CSV workbook</label>
            <input className="upload-input" type="file" accept=".csv" onChange={handleCsvUpload} />
          </div>

          <div className="upload-actions">
            <button className="primary-btn" onClick={exportCsv} disabled={saving}>Export CSV</button>
            <button className="secondary-btn" onClick={resetSampleData} disabled={saving}>Add sample data</button>
            <button className="secondary-btn" onClick={() => loadMachines()} disabled={loading || saving}>Refresh live</button>
            <button className="secondary-btn" onClick={printReport}>Print report</button>
          </div>
        </div>

        <div className="info-strip">
          This dashboard no longer saves to browser localStorage. Upload, edit and status changes are saved live to Supabase for all phones and computers.
        </div>

        {message ? (
          <div style={{ marginTop: "12px", color: "#ffffff", fontWeight: 800 }}>
            {loading || saving ? "Working... " : ""}{message}
          </div>
        ) : null}
      </section>

      <section className="availability-summary-grid">
        {summaryCards.map((card) => (
          <div className="availability-summary-card" key={card.title}>
            <span className="availability-card-title">{card.title}</span>
            <strong className="availability-card-value">{card.value}</strong>
            <p className="availability-card-note">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="availability-main-grid">
        <div className="availability-panel large-panel">
          <div className="panel-title-wrap">
            <h2>Grouped Machine Type Averages</h2>
            <p>Same machine types grouped together. Major repair units are excluded.</p>
          </div>

          <div className="availability-table-wrap">
            <table className="availability-table">
              <thead>
                <tr>
                  <th>Machine Type</th>
                  <th>Units</th>
                  <th>Average Availability</th>
                  <th>Total Run Time</th>
                  <th>Total Downtime</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedAverages.map((row) => (
                  <tr key={row.type}>
                    <td>{row.type}</td>
                    <td>{row.units}</td>
                    <td>{row.availability}</td>
                    <td>{row.runTime}</td>
                    <td>{row.downtime}</td>
                    <td>
                      <span className={row.status === "GREEN" ? "status-badge green" : row.status === "AMBER" ? "status-badge amber" : "status-badge red"}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {groupedAverages.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>No machine type data</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="availability-side-column">
          <div className="availability-panel">
            <div className="panel-title-wrap">
              <h2>Monthly Trends</h2>
              <p>Type averages from current live dataset</p>
            </div>

            <div className="bar-chart">
              {chartBars.map((bar) => (
                <div className="bar-item" key={bar.label}>
                  <span className="bar-value">{bar.value}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ height: bar.height }} /></div>
                  <span className="bar-label">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="availability-panel">
            <div className="panel-title-wrap"><h2>Report Tools</h2></div>
            <div className="report-grid">
              <div className="report-field"><label>Report type</label><select defaultValue="Monthly"><option>Monthly</option><option>Weekly</option><option>Daily</option></select></div>
              <div className="report-field"><label>Report title / period</label><input type="text" placeholder="e.g. April 2026" /></div>
            </div>
            <div className="report-actions">
              <button className="primary-btn" onClick={printReport}>Generate report</button>
              <button className="secondary-btn" onClick={exportCsv}>Download CSV</button>
            </div>
          </div>
        </div>
      </section>

      <section className="availability-panel bottom-register-panel">
        <div className="panel-title-wrap">
          <h2>{editingId ? "Edit Machine" : "Add Machine"}</h2>
          <p>Live machine data. Changes here update the foreman page and all user phones.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <input type="text" placeholder="Unit No" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} style={fieldStyle} disabled={Boolean(editingId)} />
          <input type="text" placeholder="Machine Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={fieldStyle} />
          <input type="text" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} style={fieldStyle} />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MachineStatus })} style={fieldStyle}>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="DOWN">DOWN</option>
          </select>
          <input type="text" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={fieldStyle} />
          <input type="text" placeholder="Availability %" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} style={fieldStyle} />
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
          <button className="primary-btn" onClick={saveMachine} disabled={saving}>{editingId ? "Update Machine" : "Add Machine"}</button>
          <button className="secondary-btn" onClick={clearForm}>Clear</button>
        </div>

        <div className="panel-title-wrap">
          <h2>Bottom Machine Register</h2>
          <p>Full live machine list with department, status, location, availability, edit, delete, and search.</p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <input type="text" placeholder="Search by unit, type, department, location or status" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...fieldStyle, width: "100%", maxWidth: "480px" }} />
        </div>

        <div className="availability-table-wrap">
          <table className="availability-table">
            <thead>
              <tr>
                <th>Unit No</th><th>Machine Type</th><th>Department</th><th>Status</th><th>Location</th><th>Availability</th><th>Edit</th><th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filteredMachines.length > 0 ? filteredMachines.map((machine) => (
                <tr key={machine.id}>
                  <td>{machine.id}</td>
                  <td>{machine.type}</td>
                  <td>{machine.department}</td>
                  <td>
                    <button onClick={() => toggleStatus(machine.id)} className={machine.status === "AVAILABLE" ? "status-badge green" : "status-badge red"} style={statusButtonStyle}>
                      {machine.status}
                    </button>
                  </td>
                  <td>{machine.location}</td>
                  <td>{machine.availability}</td>
                  <td><button className="secondary-btn" onClick={() => editMachine(machine)} style={smallButtonStyle}>Edit</button></td>
                  <td><button className="secondary-btn" onClick={() => deleteMachine(machine.id)} style={smallButtonStyle}>Delete</button></td>
                </tr>
              )) : (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "20px" }}>{loading ? "Loading live register..." : "No machines found"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #c7d3e4",
  background: "#ffffff",
  color: "#173f78",
  fontSize: "14px",
};

const statusButtonStyle: React.CSSProperties = { border: "none", cursor: "pointer" };
const smallButtonStyle: React.CSSProperties = { padding: "8px 12px" };

