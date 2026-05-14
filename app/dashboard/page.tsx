"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const TABLE = "machine_availability_live";
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 10 } } })
    : null;

type Machine = {
  id?: string;
  fleet: string;
  type: string;
  machine?: string;
  machine_type?: string;
  status: string;
  department: string;
  location?: string;
  availability?: number | string;
  hours_worked?: number | string;
  hours_down?: number | string;
  downtime_reason?: string;
  repair_reason?: string;
  spares_eta?: string;
  online_status?: string;
  major_repair?: boolean;
  updated_at?: string;
  updated_by?: string;
  raw?: any;
  [key: string]: any;
};

const departments = [
  "Mining",
  "Logistics",
  "Plant",
  "Workshop",
  "Admin",
  "Engineering & Civils",
  "Charging Station",
  "Stores & Procurement",
];

const statuses = ["Available", "Down", "Repair", "Maintenance", "Major Repair", "Standby"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function toNumber(value: any, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(/,/g, ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function oneDecimal(value: any) {
  return toNumber(value, 0).toFixed(1);
}

function getValue(row: any, names: string[]) {
  if (!row || typeof row !== "object") return "";

  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && clean(row[name]) !== "") return row[name];
  }

  const wanted = names.map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const key of Object.keys(row)) {
    const normalKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (wanted.includes(normalKey) && clean(row[key]) !== "") return row[key];
  }

  return "";
}

function inferType(fleet: string, explicitType: string) {
  const explicit = clean(explicitType).toUpperCase();
  if (explicit && !["TYPE", "MACHINE TYPE", "MACHINETYPE"].includes(explicit)) return explicit;
  const f = clean(fleet).toUpperCase();
  if (/^[A-Z]{3}\s?\d{3,4}$/.test(f)) return "LDV";
  const match = f.match(/^[A-Z]+/);
  return match?.[0] || "MACHINE";
}

function normalizeStatus(value: any, onlineValue?: any) {
  const s = lower(value);
  const online = lower(onlineValue);
  if (s.includes("major")) return "Major Repair";
  if (s.includes("maint")) return "Maintenance";
  if (s.includes("repair")) return "Repair";
  if (s.includes("down") || s.includes("break")) return "Down";
  if (s.includes("stand")) return "Standby";
  if (s.includes("avail") || s.includes("online")) return "Available";
  if (online === "offline") return "Down";
  return clean(value) || "Available";
}

function normalizeMachine(row: any): Machine | null {
  const fleet = clean(
    getValue(row, [
      "fleet",
      "fleet_no",
      "fleet number",
      "fleet_number",
      "fleet no",
      "unit",
      "unit no",
      "machine number",
      "machine_number",
      "reg",
      "registration",
    ])
  );

  if (!fleet) return null;
  const bad = lower(fleet);
  if (["fleet", "fleet no", "fleet number", "unit", "machine", "total"].includes(bad)) return null;

  const rawType = clean(getValue(row, ["type", "machine_type", "machine type", "machineType", "category"]));
  const type = inferType(fleet, rawType);
  const onlineRaw = clean(getValue(row, ["online_status", "online status", "online/offline", "online_offline", "online"]));
  const status = normalizeStatus(getValue(row, ["status", "machine_status", "machine status", "condition"]), onlineRaw);
  const online_status = onlineRaw || (status === "Available" ? "Online" : "Offline");
  const major_repair = Boolean(getValue(row, ["major_repair", "major repair", "majorRepair"])) || lower(status).includes("major");

  return {
    id: row.id ? clean(row.id) : undefined,
    fleet,
    type,
    machine: clean(getValue(row, ["machine", "name", "description"])) || type,
    machine_type: type,
    status,
    department: clean(getValue(row, ["department", "dept", "section"])) || "Workshop",
    location: clean(getValue(row, ["location", "site", "area"])) || "Hwange",
    availability:
      getValue(row, ["availability", "availability_percent", "availability percentage", "availability_%", "availability %"]) ||
      (status === "Available" ? 100 : 0),
    hours_worked: getValue(row, ["hours_worked", "hours worked", "hoursWorked", "worked_hours", "worked hours"]) || 0,
    hours_down: getValue(row, ["hours_down", "hours down", "hoursDown", "downtime_hours", "downtime hours"]) || 0,
    downtime_reason:
      clean(getValue(row, ["downtime_reason", "downtime reason", "downtimeReason", "reason", "breakdown_reason", "breakdown reason"])) || "",
    repair_reason: clean(getValue(row, ["repair_reason", "repair reason", "repairReason", "work_required", "work required"])) || "",
    spares_eta: clean(getValue(row, ["spares_eta", "spares eta", "sparesEta", "eta", "spares", "parts eta"])) || "",
    online_status,
    major_repair,
    updated_at: row.updated_at,
    updated_by: row.updated_by || "Dashboard",
    raw: row.raw || row,
  };
}

function uniqueByFleet(rows: Machine[]) {
  const map = new Map<string, Machine>();
  for (const row of rows) {
    const key = clean(row.fleet).toUpperCase();
    if (!key) continue;
    map.set(key, { ...row, fleet: clean(row.fleet) });
  }
  return Array.from(map.values()).sort((a, b) => a.fleet.localeCompare(b.fleet, undefined, { numeric: true }));
}

function isOffline(machine: Machine) {
  const status = lower(machine.status);
  const online = lower(machine.online_status);
  return online === "offline" || status.includes("down") || status.includes("repair") || status.includes("maint") || status.includes("major");
}

function isAvailable(machine: Machine) {
  return !machine.major_repair && lower(machine.status).includes("available") && lower(machine.online_status || "online") !== "offline";
}

function statusClass(status: string) {
  const s = lower(status);
  if (s.includes("available")) return "good";
  if (s.includes("major")) return "major";
  if (s.includes("maint")) return "maintenance";
  if (s.includes("repair")) return "repair";
  if (s.includes("down")) return "down";
  return "neutral";
}

function toDbPayload(machine: Partial<Machine>) {
  const status = normalizeStatus(machine.status || "Available", machine.online_status);
  const online_status = machine.online_status || (status === "Available" ? "Online" : "Offline");
  const type = inferType(clean(machine.fleet), clean(machine.type || machine.machine_type));
  return {
    fleet: clean(machine.fleet),
    type,
    machine: clean(machine.machine) || type,
    machine_type: type,
    status,
    department: clean(machine.department) || "Workshop",
    location: clean(machine.location) || "Hwange",
    availability: toNumber(machine.availability, status === "Available" ? 100 : 0),
    hours_worked: toNumber(machine.hours_worked, 0),
    hours_down: toNumber(machine.hours_down, 0),
    downtime_reason: clean(machine.downtime_reason),
    repair_reason: clean(machine.repair_reason),
    spares_eta: clean(machine.spares_eta),
    online_status,
    major_repair: Boolean(machine.major_repair) || lower(status).includes("major"),
    updated_by: machine.updated_by || "Dashboard",
    raw: machine.raw || {},
  };
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: any) {
  const s = clean(value);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loggedIn, setLoggedIn] = useState(true);
  const [role, setRole] = useState("Admin");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [lastRefresh, setLastRefresh] = useState("");
  const [connectionState, setConnectionState] = useState("Checking live Supabase table...");
  const [activity, setActivity] = useState<string[]>([]);

  function addActivity(text: string) {
    const stamp = new Date().toLocaleString();
    setActivity((prev) => [`${stamp} - ${text}`, ...prev].slice(0, 40));
  }

  const loadMachines = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setMessage("");

    if (!supabase) {
      setConnectionState("Supabase env variables missing in Vercel.");
      setMessage("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in Vercel for shared live data.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from(TABLE).select("*").order("fleet", { ascending: true });
    if (error) {
      setConnectionState(`Supabase error: ${error.message}`);
      setMessage(`Live table error: ${error.message}. Run the SQL file first.`);
      setLoading(false);
      return;
    }

    const loaded = uniqueByFleet((data || []).map(normalizeMachine).filter(Boolean) as Machine[]);
    setMachines(loaded);
    setLastRefresh(new Date().toLocaleTimeString());
    setConnectionState(`Live Supabase connected • ${TABLE} • ${loaded.length} machine(s)`);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMachines();
    const timer = window.setInterval(() => loadMachines(false), 10000);
    return () => window.clearInterval(timer);
  }, [loadMachines]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("dashboard-machine-availability-live")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => loadMachines(false))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionState((prev) => `${prev} • realtime on`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMachines]);

  const stats = useMemo(() => {
    const total = machines.length;
    const major = machines.filter((m) => m.major_repair || lower(m.status).includes("major")).length;
    const active = machines.filter((m) => !m.major_repair && !lower(m.status).includes("major"));
    const available = active.filter(isAvailable).length;
    const down = active.filter((m) => !isAvailable(m)).length;
    const locations = new Set(machines.map((m) => clean(m.location)).filter(Boolean)).size;
    const percent = active.length ? (available / active.length) * 100 : 0;
    return { total, active: active.length, available, down, locations, major, percent };
  }, [machines]);

  const types = useMemo(() => ["All", ...Array.from(new Set(machines.map((m) => m.type).filter(Boolean))).sort()], [machines]);
  const deptOptions = useMemo(() => ["All", ...Array.from(new Set([...departments, ...machines.map((m) => m.department).filter(Boolean)])).sort()], [machines]);

  const filteredMachines = useMemo(() => {
    const q = lower(search);
    return machines.filter((m) => {
      if (selectedDept !== "All" && m.department !== selectedDept) return false;
      if (selectedType !== "All" && m.type !== selectedType) return false;
      if (!q) return true;
      return [m.fleet, m.type, m.machine, m.status, m.department, m.location, m.online_status, m.downtime_reason, m.repair_reason, m.spares_eta]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [machines, search, selectedDept, selectedType]);

  const below85 = useMemo(() => machines.filter((m) => !m.major_repair && toNumber(m.availability, 100) < 85), [machines]);
  const majorRepairs = useMemo(() => machines.filter((m) => m.major_repair || lower(m.status).includes("major")), [machines]);
  const offline = useMemo(() => machines.filter(isOffline), [machines]);

  const typeSummary = useMemo(() => {
    const groups = new Map<string, Machine[]>();
    machines.forEach((m) => groups.set(m.type, [...(groups.get(m.type) || []), m]));
    return Array.from(groups.entries())
      .map(([type, rows]) => {
        const active = rows.filter((m) => !m.major_repair && !lower(m.status).includes("major"));
        const available = active.filter(isAvailable).length;
        const percent = active.length ? (available / active.length) * 100 : 0;
        return { type, total: rows.length, active: active.length, available, percent };
      })
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [machines]);

  const deptSummary = useMemo(() => {
    const groups = new Map<string, Machine[]>();
    machines.forEach((m) => groups.set(m.department, [...(groups.get(m.department) || []), m]));
    return Array.from(groups.entries())
      .map(([department, rows]) => {
        const active = rows.filter((m) => !m.major_repair && !lower(m.status).includes("major"));
        const available = active.filter(isAvailable).length;
        const percent = active.length ? (available / active.length) * 100 : 0;
        return { department, total: rows.length, active: active.length, available, percent };
      })
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [machines]);

  async function updateMachine(machine: Machine, patch: Partial<Machine>) {
    if (!supabase) {
      setMessage("Supabase env variables missing. Update not saved.");
      return;
    }

    const next = normalizeMachine({ ...machine, ...patch, updated_by: role || "Dashboard" });
    if (!next) return;

    setMachines((prev) => uniqueByFleet(prev.map((m) => (m.fleet === machine.fleet ? next : m))));
    const { error } = await supabase.from(TABLE).upsert(toDbPayload(next), { onConflict: "fleet" });
    if (error) {
      setMessage(`Save failed on ${machine.fleet}: ${error.message}`);
      await loadMachines(false);
      return;
    }
    addActivity(`Updated ${machine.fleet}: ${Object.keys(patch).join(", ")}`);
    await loadMachines(false);
  }

  async function handleFileUpload(file: File) {
    if (!supabase) {
      setMessage("Supabase env variables missing. Upload cannot save live.");
      return;
    }

    setLoading(true);
    setMessage("Reading file and replacing live register...");

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const parsed = uniqueByFleet(rows.map(normalizeMachine).filter(Boolean) as Machine[]);

      if (parsed.length === 0) {
        setMessage("No valid fleet rows found. Check the file headings include fleet/fleet number.");
        setLoading(false);
        return;
      }

      const payloads = parsed.map((m) => toDbPayload({ ...m, updated_by: "Excel Upload" }));
      const { error } = await supabase.from(TABLE).upsert(payloads, { onConflict: "fleet" });
      if (error) {
        setMessage(`Upload failed: ${error.message}`);
        setLoading(false);
        return;
      }

      const { data: existing } = await supabase.from(TABLE).select("fleet");
      const wanted = new Set(payloads.map((p) => p.fleet));
      const toDelete = (existing || []).map((r: any) => clean(r.fleet)).filter((fleet: string) => fleet && !wanted.has(fleet));
      for (let i = 0; i < toDelete.length; i += 100) {
        await supabase.from(TABLE).delete().in("fleet", toDelete.slice(i, i + 100));
      }

      try {
        localStorage.setItem("turboMachineData", JSON.stringify(parsed));
      } catch {
        // ignore local storage limits
      }

      setMessage(`Live register replaced with ${payloads.length} machine(s). Old rows not in this upload were removed. Phones now read this same Supabase data.`);
      addActivity(`Uploaded and replaced live register: ${payloads.length} machines`);
      await loadMachines(false);
    } catch (error: any) {
      setMessage(`File upload failed: ${error?.message || "Unknown error"}. Make sure the xlsx package is installed.`);
    }

    setLoading(false);
  }

  function exportCsv() {
    const headers = [
      "fleet",
      "type",
      "machine",
      "status",
      "department",
      "location",
      "availability",
      "hours_worked",
      "hours_down",
      "online_status",
      "downtime_reason",
      "repair_reason",
      "spares_eta",
      "major_repair",
      "updated_at",
      "updated_by",
    ];

    const lines = [headers.join(",")];
    machines.forEach((m) => {
      lines.push(headers.map((h) => csvEscape((m as any)[h])).join(","));
    });
    downloadText(`turbo-machine-availability-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"));
  }

  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!loggedIn) {
    return (
      <main className="page loginPage">
        <section className="loginBox">
          <h1>Turbo-Energy Machine Availability</h1>
          <button className="btn whiteBtn" onClick={() => { setLoggedIn(true); setRole("Admin"); }}>Login as Admin</button>
        </section>
        <style jsx>{pageStyles}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="topLine">
        <span>Logged in as: <b>{role} (admin)</b></span>
        <button className="btn redBtn" onClick={() => setLoggedIn(false)}>Logout</button>
      </section>

      <section className="hero">
        <div className="logoBox">TURBO ENERGY</div>
        <div className="titleBox">
          <h1>Turbo-Energy<br />Machine<br />Availability</h1>
          <p>Live fleet dashboard with admin movements, departments, repairs, history, and machine details.</p>
        </div>
        <div className="heroActions">
          <button className="btn orangeBtn" onClick={() => fileInputRef.current?.click()}>Upload File</button>
          <button className="btn blueBtn" onClick={() => scrollToId("report")}>Report Generator</button>
          <button className="btn darkBtn" onClick={() => scrollToId("below85")}>Units Below 85%</button>
          <button className="btn darkBtn" onClick={() => scrollToId("majorRepairs")}>Major Repairs</button>
          <button className="btn darkBtn" onClick={() => scrollToId("bottomRegister")}>Bottom Register</button>
          <button className="btn whiteBtn" onClick={() => loadMachines()}>Refresh</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </section>

      <section className="sourceBar">{connectionState} • Last refresh: {lastRefresh || "-"}</section>
      {message && <section className="notice">{message}</section>}

      <section className="dashboardGrid">
        <section>
          <section className="stats">
            <div className="stat"><div>🧾</div><h3>Total Machines</h3><strong>{stats.total}</strong><p>All units in the live register</p></div>
            <div className="stat"><div>✅</div><h3>Available</h3><strong>{stats.available}</strong><p>Active units marked available</p></div>
            <div className="stat"><div>🔧</div><h3>Repairs / Down</h3><strong>{stats.down}</strong><p>Active units needing attention</p></div>
            <div className="stat"><div>📍</div><h3>Locations</h3><strong>{stats.locations}</strong><p>Distinct operating locations</p></div>
          </section>

          <section className="card uploadCard">
            <div>
              <h2>Admin Upload and Save</h2>
              <p>Upload spreadsheet XLSX, XLS, XLSM, or CSV. The live register is replaced by fleet number so old duplicates stop.</p>
            </div>
            <div className="buttonRow">
              <button className="btn orangeBtn" onClick={() => fileInputRef.current?.click()}>Choose File</button>
              <button className="btn orangeBtn" onClick={exportCsv}>Export CSV</button>
              <button className="btn whiteBtn" onClick={() => window.print()}>Print page</button>
            </div>
            <div className="helperBox">Shared Supabase mode is active. Foreman phones and this dashboard read/write the same table: {TABLE}.</div>
          </section>

          <section className="card">
            <h2>Admin Machine Controls</h2>
            <p>Edit hours, online status, downtime reason, department, and repairs.</p>
            <div className="filters">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by fleet, type, department, status, reason, or online status..." />
              <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>{deptOptions.map((d) => <option key={d}>{d}</option>)}</select>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select>
              <button className="btn darkBtn" onClick={() => { setSearch(""); setSelectedDept("All"); setSelectedType("All"); }}>Clear Search</button>
            </div>
            <p className="foundText">Showing {filteredMachines.length} of {machines.length} machine(s). Major repair machines stay visible but are excluded from availability percentages.</p>

            <div className="machineCards">
              {loading ? <div className="empty">Loading live Supabase register...</div> : null}
              {!loading && filteredMachines.length === 0 ? <div className="empty">No machines found.</div> : null}
              {filteredMachines.slice(0, 160).map((m) => (
                <MachineEditCard key={m.fleet} machine={m} onUpdate={updateMachine} />
              ))}
            </div>
          </section>
        </section>

        <aside className="card sideCard">
          <h2>Recent Activity</h2>
          <p>Latest shared changes across the dashboard.</p>
          <div className="activityList">
            {activity.length === 0 ? <p>No local activity yet. Live updates still load from Supabase.</p> : null}
            {activity.map((item) => <div key={item}>{item}</div>)}
          </div>
        </aside>
      </section>

      <section id="report" className="card wideCard">
        <h2>Report Generator</h2>
        <div className="reportGrid">
          <div><span>Total Fleet</span><strong>{stats.total}</strong></div>
          <div><span>Active Fleet</span><strong>{stats.active}</strong></div>
          <div><span>Available</span><strong>{stats.available}</strong></div>
          <div><span>Availability %</span><strong>{oneDecimal(stats.percent)}%</strong></div>
          <div><span>Major Repairs Excluded</span><strong>{stats.major}</strong></div>
        </div>
      </section>

      <section className="summaryGrid">
        <section className="card">
          <h2>Machine Type Availability</h2>
          {typeSummary.map((row) => <SummaryBar key={row.type} label={row.type} total={row.total} available={row.available} active={row.active} percent={row.percent} />)}
        </section>

        <section className="card">
          <h2>Department Availability</h2>
          {deptSummary.map((row) => <SummaryBar key={row.department} label={row.department} total={row.total} available={row.available} active={row.active} percent={row.percent} />)}
        </section>
      </section>

      <section id="below85" className="card wideCard">
        <h2>Units Below 85%</h2>
        <MachineTable rows={below85} />
      </section>

      <section id="majorRepairs" className="card wideCard">
        <h2>Major Repairs</h2>
        <MachineTable rows={majorRepairs} />
      </section>

      <section className="card wideCard">
        <h2>Machines on Breakdown / Offline</h2>
        <MachineTable rows={offline} />
      </section>

      <section id="bottomRegister" className="card wideCard">
        <h2>Bottom Register</h2>
        <MachineTable rows={machines} />
      </section>

      <style jsx>{pageStyles}</style>
    </main>
  );
}

function MachineEditCard({ machine, onUpdate }: { machine: Machine; onUpdate: (machine: Machine, patch: Partial<Machine>) => Promise<void> }) {
  const [draft, setDraft] = useState(machine);

  useEffect(() => setDraft(machine), [machine]);

  return (
    <div className="machineCard">
      <div className="machineHeader">
        <div>
          <h3>{machine.fleet} - {machine.machine || machine.type}</h3>
          <p>{machine.department} · {machine.location || "Hwange"}</p>
        </div>
        <span className={`pill ${statusClass(machine.status)}`}>{machine.status}</span>
      </div>

      <div className="formGridSmall">
        <label>Status<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value, online_status: e.target.value === "Available" ? "Online" : "Offline", availability: e.target.value === "Available" ? 100 : 0, major_repair: e.target.value === "Major Repair" })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Online<select value={draft.online_status || "Online"} onChange={(e) => setDraft({ ...draft, online_status: e.target.value })}><option>Online</option><option>Offline</option></select></label>
        <label>Dept<select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })}>{departments.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>Availability<input value={draft.availability ?? ""} onChange={(e) => setDraft({ ...draft, availability: e.target.value })} /></label>
        <label>Hours Worked<input value={draft.hours_worked ?? ""} onChange={(e) => setDraft({ ...draft, hours_worked: e.target.value })} /></label>
        <label>Hours Down<input value={draft.hours_down ?? ""} onChange={(e) => setDraft({ ...draft, hours_down: e.target.value })} /></label>
        <label>Downtime Reason<input value={draft.downtime_reason ?? ""} onChange={(e) => setDraft({ ...draft, downtime_reason: e.target.value })} /></label>
        <label>Repair Reason<input value={draft.repair_reason ?? ""} onChange={(e) => setDraft({ ...draft, repair_reason: e.target.value })} /></label>
        <label>ETA / Spares<input value={draft.spares_eta ?? ""} onChange={(e) => setDraft({ ...draft, spares_eta: e.target.value })} /></label>
      </div>
      <button className="btn whiteBtn saveButton" onClick={() => onUpdate(machine, draft)}>Save Live Update</button>
    </div>
  );
}

function SummaryBar({ label, total, active, available, percent }: { label: string; total: number; active: number; available: number; percent: number }) {
  return (
    <div className="summaryRow">
      <div className="summaryTop"><strong>{label}</strong><span>{available}/{active} active available · total {total} · {oneDecimal(percent)}%</span></div>
      <div className="bar"><div style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
    </div>
  );
}

function MachineTable({ rows }: { rows: Machine[] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr><th>Fleet</th><th>Type</th><th>Dept</th><th>Status</th><th>Online</th><th>Avail %</th><th>Hrs Down</th><th>Downtime</th><th>Repair</th><th>ETA</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={10} className="empty">No machines to show.</td></tr> : null}
          {rows.map((m) => (
            <tr key={m.fleet}>
              <td>{m.fleet}</td><td>{m.type}</td><td>{m.department}</td>
              <td><span className={`pill ${statusClass(m.status)}`}>{m.status}</span></td>
              <td>{m.online_status || "-"}</td><td>{oneDecimal(m.availability)}</td><td>{oneDecimal(m.hours_down)}</td>
              <td>{m.downtime_reason || "-"}</td><td>{m.repair_reason || "-"}</td><td>{m.spares_eta || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pageStyles = `
  * { box-sizing: border-box; }
  .page { min-height:100vh; background:linear-gradient(135deg,#1e294d 0%,#0b234b 45%,#06172f 100%); color:#fff; padding:22px; font-family:Arial,Helvetica,sans-serif; }
  .topLine,.hero,.sourceBar,.notice,.dashboardGrid,.summaryGrid,.wideCard { max-width:1420px; margin:0 auto 16px; }
  .topLine { display:flex; justify-content:space-between; align-items:center; background:rgba(2,8,23,.45); padding:10px 14px; border-radius:18px; width:fit-content; gap:30px; }
  .hero { background:#12325f; border:1px solid rgba(147,197,253,.18); border-radius:18px; padding:24px 18px; display:grid; grid-template-columns:360px 160px 1fr; gap:18px; align-items:center; box-shadow:0 18px 44px rgba(0,0,0,.25); }
  .logoBox { background:#e5e7eb; color:#8aa0c7; font-size:32px; letter-spacing:3px; font-weight:900; padding:18px 24px; text-align:center; }
  .titleBox h1 { font-size:22px; line-height:1.2; margin:0 0 8px; text-align:center; }
  .titleBox p { font-size:12px; color:#dbeafe; margin:0; text-align:center; }
  .heroActions { display:flex; gap:12px; flex-wrap:wrap; justify-content:flex-end; }
  .btn { border:0; border-radius:16px; padding:12px 18px; font-weight:900; cursor:pointer; white-space:nowrap; }
  .orangeBtn { background:#f59e0b; color:#fff; } .blueBtn { background:#3b82f6; color:#fff; } .darkBtn { background:#0b1a35; color:#fff; border:1px solid rgba(255,255,255,.18); } .whiteBtn { background:#fff; color:#0b1a35; } .redBtn { background:#dc3545; color:#fff; }
  .sourceBar,.notice { background:rgba(2,8,23,.72); border-left:6px solid #f59e0b; border-radius:12px; padding:12px 16px; font-weight:900; }
  .notice { border-color:#38bdf8; }
  .dashboardGrid { display:grid; grid-template-columns:minmax(0,1fr) 430px; gap:18px; align-items:start; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:18px; }
  .stat { padding:16px 0; color:#fff; } .stat h3 { text-transform:uppercase; font-size:14px; margin:12px 0; } .stat strong { display:block; font-size:18px; margin-bottom:8px; } .stat p { margin:0; color:#e0e7ff; }
  .card { background:#12325f; border:1px solid rgba(147,197,253,.22); border-radius:18px; padding:18px; box-shadow:0 14px 30px rgba(0,0,0,.22); }
  .card h2 { margin:0 0 8px; font-size:20px; } .card p { color:#dbeafe; margin:0 0 14px; }
  .uploadCard { margin-bottom:18px; }
  .buttonRow { display:flex; gap:12px; flex-wrap:wrap; margin:12px 0; }
  .helperBox { background:#10244a; border:1px solid rgba(147,197,253,.2); padding:14px; border-radius:14px; color:#dbeafe; }
  .filters { display:grid; grid-template-columns:1fr 170px 150px auto; gap:10px; align-items:center; background:#10244a; border:1px solid rgba(147,197,253,.2); padding:12px; border-radius:14px; }
  input,select { width:100%; border:0; border-radius:12px; padding:12px; font-size:14px; color:#0f172a; background:#fff; }
  .foundText { font-weight:900; color:#fff !important; margin:12px 0 !important; }
  .machineCards { display:grid; gap:12px; max-height:760px; overflow:auto; padding-right:4px; }
  .machineCard { background:#1e477c; border:1px solid rgba(191,219,254,.18); border-radius:16px; padding:14px; }
  .machineHeader { display:flex; justify-content:space-between; gap:12px; align-items:start; margin-bottom:10px; } .machineHeader h3 { margin:0 0 4px; font-size:16px; } .machineHeader p { margin:0; font-size:12px; }
  .formGridSmall { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; } label { display:flex; flex-direction:column; gap:6px; font-size:12px; font-weight:900; }
  .saveButton { margin-top:12px; width:100%; }
  .sideCard { position:sticky; top:14px; } .activityList { display:grid; gap:10px; font-size:13px; color:#fff; max-height:700px; overflow:auto; }
  .reportGrid { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; } .reportGrid div { background:#0b1a35; border-radius:14px; padding:14px; } .reportGrid span { color:#bfdbfe; font-weight:900; text-transform:uppercase; font-size:12px; } .reportGrid strong { display:block; font-size:26px; margin-top:6px; }
  .summaryGrid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .summaryRow { margin:13px 0; } .summaryTop { display:flex; justify-content:space-between; gap:10px; font-size:13px; margin-bottom:6px; } .bar { height:13px; border-radius:99px; background:#0b1a35; overflow:hidden; } .bar div { height:100%; border-radius:99px; background:linear-gradient(90deg,#22c55e,#3b82f6); }
  .tableWrap { overflow:auto; border-radius:14px; } table { width:100%; min-width:1000px; border-collapse:collapse; background:#1e477c; } th { background:#fff; color:#0f172a; text-align:left; padding:12px; font-size:12px; position:sticky; top:0; } td { border-top:1px solid rgba(255,255,255,.08); padding:12px; font-size:13px; }
  .pill { display:inline-flex; justify-content:center; align-items:center; border-radius:999px; padding:7px 12px; font-size:12px; font-weight:900; min-width:88px; }
  .good { background:#0f766e; color:#d1fae5; } .down { background:#2563eb; color:#dbeafe; } .repair { background:#1d4ed8; color:#dbeafe; } .maintenance { background:#0ea5e9; color:#ecfeff; } .major { background:#d97706; color:#fff7ed; } .neutral { background:#334155; color:#e2e8f0; }
  .empty { text-align:center; padding:22px; color:#dbeafe; font-weight:900; }
  .loginPage { display:grid; place-items:center; } .loginBox { background:#12325f; border-radius:20px; padding:26px; }
  @media(max-width:1100px){ .hero{grid-template-columns:1fr;} .dashboardGrid,.summaryGrid{grid-template-columns:1fr;} .sideCard{position:static;} .stats{grid-template-columns:1fr 1fr;} .filters{grid-template-columns:1fr;} .formGridSmall{grid-template-columns:1fr;} .reportGrid{grid-template-columns:1fr 1fr;} }
  @media(max-width:520px){ .page{padding:12px;} .stats,.reportGrid{grid-template-columns:1fr;} .logoBox{font-size:22px;} .heroActions{display:grid; grid-template-columns:1fr;} .btn{width:100%;} }
`;

