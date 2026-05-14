"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type MachineStatus =
  | "Available"
  | "Down"
  | "Repair"
  | "Maintenance"
  | "Major Repair"
  | "Standby";

type Machine = {
  fleet: string;
  type: string;
  machine_type: string;
  department: string;
  status: MachineStatus;
  location: string;
  availability: number;
  hours_worked: number;
  hours_down: number;
  downtime_reason: string;
  repair_reason: string;
  spares_eta: string;
  online_status: "Online" | "Offline";
  major_repair: boolean;
  updated_at?: string;
  updated_by?: string;
};

const TABLE = "machine_availability_live";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LEGACY_STORAGE_KEYS = [
  "machine_availability_prototype_final_v1",
  "turboMachineData",
  "turbo_machine_data",
  "machineAvailabilityData",
  "machine_availability_data",
  "machines",
];

const statuses: MachineStatus[] = [
  "Available",
  "Down",
  "Repair",
  "Maintenance",
  "Major Repair",
  "Standby",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function cleanHeader(value: string) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numeric(value: any, fallback = 0) {
  const raw = clean(value).replace("%", "").replace(/,/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function round1(value: any) {
  const n = numeric(value, 0);
  return Number(n.toFixed(1));
}

function normalizeStatus(value: any): MachineStatus {
  const s = clean(value).toLowerCase();
  if (s.includes("major")) return "Major Repair";
  if (s.includes("maint")) return "Maintenance";
  if (s.includes("repair")) return "Repair";
  if (s.includes("down") || s.includes("offline")) return "Down";
  if (s.includes("stand")) return "Standby";
  return "Available";
}

function normalizeOnline(value: any, status: MachineStatus): "Online" | "Offline" {
  const s = clean(value).toLowerCase();
  if (s === "offline" || s.includes("off")) return "Offline";
  if (s === "online" || s.includes("on")) return "Online";
  return status === "Available" ? "Online" : "Offline";
}

function guessTypeFromFleet(fleet: string) {
  const f = clean(fleet).toUpperCase();
  const letters = f.match(/^[A-Z]+/)?.[0] || "";
  if (/^A[A-Z]{2}\s?\d+/.test(f)) return "LDV";
  return letters || "MACHINE";
}

function normalizeMachine(row: any): Machine | null {
  const fleet =
    clean(row.fleet) ||
    clean(row.id) ||
    clean(row.unit) ||
    clean(row.unit_no) ||
    clean(row.unitNo) ||
    clean(row.fleet_no) ||
    clean(row.fleetNo) ||
    clean(row.fleet_number) ||
    clean(row.fleetNumber) ||
    clean(row.machine_number) ||
    clean(row.machineNumber);

  if (!fleet) return null;

  const headerWords = ["fleet", "unit", "machine", "number", "reg", "registration"];
  if (headerWords.includes(fleet.toLowerCase())) return null;

  const status = normalizeStatus(row.status ?? row.machine_status ?? row.condition ?? row.online_status);
  const online = normalizeOnline(row.online_status ?? row.onlineStatus ?? row.online_offline, status);
  const type =
    clean(row.type) ||
    clean(row.machine_type) ||
    clean(row.machineType) ||
    clean(row.category) ||
    clean(row.machine) ||
    guessTypeFromFleet(fleet);

  const major =
    Boolean(row.major_repair) ||
    Boolean(row.majorRepair) ||
    status === "Major Repair" ||
    clean(row.status).toLowerCase().includes("major");

  return {
    fleet: fleet.toUpperCase(),
    type: type.toUpperCase(),
    machine_type: clean(row.machine_type) || clean(row.machineType) || type.toUpperCase(),
    department: clean(row.department) || clean(row.dept) || "Workshop",
    status,
    location: clean(row.location) || clean(row.site) || "Hwange",
    availability: round1(row.availability ?? row.availability_percent ?? row.availability_percentage ?? (status === "Available" ? 100 : 0)),
    hours_worked: round1(row.hours_worked ?? row.hoursWorked ?? row.worked_hours ?? row.runtime ?? 0),
    hours_down: round1(row.hours_down ?? row.hoursDown ?? row.downtime_hours ?? row.downtime ?? (status === "Available" ? 0 : 0)),
    downtime_reason:
      clean(row.downtime_reason) ||
      clean(row.downtimeReason) ||
      clean(row.reason) ||
      clean(row.breakdown_reason),
    repair_reason:
      clean(row.repair_reason) ||
      clean(row.repairReason) ||
      clean(row.work_required) ||
      clean(row.workRequired),
    spares_eta: clean(row.spares_eta) || clean(row.sparesEta) || clean(row.eta),
    online_status: online,
    major_repair: major,
    updated_at: row.updated_at,
    updated_by: clean(row.updated_by) || clean(row.updatedBy) || "Dashboard",
  };
}

function dedupe(rows: Machine[]) {
  const map = new Map<string, Machine>();
  rows.forEach((m) => {
    if (m.fleet) map.set(m.fleet.toUpperCase(), m);
  });
  return Array.from(map.values()).sort((a, b) => a.fleet.localeCompare(b.fleet));
}

function toDb(machine: Machine) {
  return {
    fleet: machine.fleet.toUpperCase(),
    type: machine.type || guessTypeFromFleet(machine.fleet),
    machine_type: machine.machine_type || machine.type || guessTypeFromFleet(machine.fleet),
    department: machine.department || "Workshop",
    status: machine.status || "Available",
    location: machine.location || "Hwange",
    availability: round1(machine.availability),
    hours_worked: round1(machine.hours_worked),
    hours_down: round1(machine.hours_down),
    downtime_reason: machine.downtime_reason || "",
    repair_reason: machine.repair_reason || "",
    spares_eta: machine.spares_eta || "",
    online_status: machine.online_status || (machine.status === "Available" ? "Online" : "Offline"),
    major_repair: Boolean(machine.major_repair) || machine.status === "Major Repair",
    updated_at: new Date().toISOString(),
    updated_by: machine.updated_by || "Dashboard",
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
      i++;
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
  return result.map((item) => item.replace(/^"|"$/g, "").trim());
}

function findColumn(headers: string[], names: string[]) {
  const wanted = names.map(cleanHeader);
  return headers.findIndex((h) => wanted.includes(cleanHeader(h)));
}

function parseCsv(text: string) {
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length < 2) return [];

  const headers = parseCsvLine(rows[0]);
  const indexes = {
    fleet: findColumn(headers, ["fleet", "fleet no", "fleet number", "id", "unit", "unit no", "unitno", "machine number", "registration"]),
    type: findColumn(headers, ["type", "machine type", "machinetype", "category", "machine"]),
    department: findColumn(headers, ["department", "dept"]),
    status: findColumn(headers, ["status", "machine status", "condition"]),
    location: findColumn(headers, ["location", "site"]),
    availability: findColumn(headers, ["availability", "availability %", "availability percent", "availability percentage"]),
    hours_worked: findColumn(headers, ["hours worked", "hours_worked", "worked hours", "runtime", "run time"]),
    hours_down: findColumn(headers, ["hours down", "hours_down", "downtime", "downtime hours"]),
    downtime_reason: findColumn(headers, ["downtime reason", "reason", "breakdown reason"]),
    repair_reason: findColumn(headers, ["repair reason", "work required", "repairs", "repair"]),
    spares_eta: findColumn(headers, ["eta", "spares eta", "spares", "spares_eta"]),
    online_status: findColumn(headers, ["online", "online status", "online/offline", "online offline"]),
    major_repair: findColumn(headers, ["major repair", "major_repair", "major"]),
  };

  return dedupe(
    rows
      .slice(1)
      .map((row) => {
        const cols = parseCsvLine(row);
        const get = (index: number) => (index >= 0 ? cols[index] : "");
        return normalizeMachine({
          fleet: get(indexes.fleet),
          type: get(indexes.type),
          department: get(indexes.department),
          status: get(indexes.status),
          location: get(indexes.location),
          availability: get(indexes.availability),
          hours_worked: get(indexes.hours_worked),
          hours_down: get(indexes.hours_down),
          downtime_reason: get(indexes.downtime_reason),
          repair_reason: get(indexes.repair_reason),
          spares_eta: get(indexes.spares_eta),
          online_status: get(indexes.online_status),
          major_repair: get(indexes.major_repair).toLowerCase().includes("yes") || get(indexes.major_repair).toLowerCase().includes("true"),
        });
      })
      .filter((m): m is Machine => Boolean(m))
  );
}

function readLegacyLocalData() {
  const found: Machine[] = [];

  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const array = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.machines)
        ? parsed.machines
        : Array.isArray(parsed?.data)
        ? parsed.data
        : [];

      array.forEach((item: any) => {
        const machine = normalizeMachine(item);
        if (machine) found.push(machine);
      });
    } catch {
      // Ignore bad old storage keys.
    }
  }

  return dedupe(found);
}

function isOffline(machine: Machine) {
  const status = machine.status.toLowerCase();
  return (
    machine.online_status === "Offline" ||
    status.includes("down") ||
    status.includes("repair") ||
    status.includes("maintenance") ||
    status.includes("major")
  );
}

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("available")) return "green";
  if (s.includes("major")) return "orange";
  if (s.includes("down")) return "red";
  if (s.includes("repair") || s.includes("maint")) return "blue";
  return "grey";
}

export default function MachineAvailabilityPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingFleet, setEditingFleet] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState("");
  const didTryMigration = useRef(false);

  const [form, setForm] = useState<Machine>({
    fleet: "",
    type: "",
    machine_type: "",
    department: "",
    status: "Available",
    location: "Hwange",
    availability: 100,
    hours_worked: 0,
    hours_down: 0,
    downtime_reason: "",
    repair_reason: "",
    spares_eta: "",
    online_status: "Online",
    major_repair: false,
    updated_by: "Dashboard",
  });

  async function replaceLiveRegister(rows: Machine[]) {
    const cleanRows = dedupe(rows).map(toDb);
    if (cleanRows.length === 0) throw new Error("No valid machines to save.");

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .neq("fleet", "__never_match__");

    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from(TABLE).upsert(cleanRows, {
      onConflict: "fleet",
    });

    if (insertError) throw insertError;
  }

  async function upsertMachine(machine: Machine) {
    const { error } = await supabase.from(TABLE).upsert(toDb(machine), {
      onConflict: "fleet",
    });
    if (error) throw error;
  }

  async function importOldBrowserData() {
    const legacy = readLegacyLocalData();
    if (legacy.length === 0) {
      setMessage("No old browser register found. Upload your CSV from this dashboard.");
      return false;
    }

    setSaving(true);
    try {
      await replaceLiveRegister(legacy);
      setMessage(`Synced ${legacy.length} old browser machine(s) into the live Supabase register.`);
      await loadMachines(false, false);
      return true;
    } catch (error: any) {
      setMessage(`Sync failed: ${error.message || String(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function loadMachines(showLoading = true, allowMigration = true) {
    if (showLoading) setLoading(true);

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage("Vercel Supabase variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("fleet", { ascending: true })
      .limit(5000);

    if (error) {
      setMessage(`Supabase load failed: ${error.message}. Run the SQL setup file first.`);
      setMachines([]);
      setLoading(false);
      return;
    }

    const loaded = dedupe((data || []).map(normalizeMachine).filter((m): m is Machine => Boolean(m)));

    if (loaded.length === 0 && allowMigration && !didTryMigration.current) {
      didTryMigration.current = true;
      const migrated = await importOldBrowserData();
      if (migrated) {
        setLoading(false);
        return;
      }
    }

    setMachines(loaded);
    setLastRefresh(new Date().toLocaleTimeString());
    if (loaded.length === 0) {
      setMessage("Live Supabase register is empty. Upload the machine CSV or press Sync Old Browser Data on the computer that had the old dashboard data.");
    } else if (!message.toLowerCase().includes("failed")) {
      setMessage(`Live register loaded: ${loaded.length} machine(s).`);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMachines();

    const poll = setInterval(() => loadMachines(false, false), 15000);

    const channel = supabase
      .channel("machine-availability-live-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE },
        () => loadMachines(false, false)
      )
      .subscribe();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearForm = () => {
    setForm({
      fleet: "",
      type: "",
      machine_type: "",
      department: "",
      status: "Available",
      location: "Hwange",
      availability: 100,
      hours_worked: 0,
      hours_down: 0,
      downtime_reason: "",
      repair_reason: "",
      spares_eta: "",
      online_status: "Online",
      major_repair: false,
      updated_by: "Dashboard",
    });
    setEditingFleet(null);
  };

  const saveMachine = async () => {
    const machine = normalizeMachine({ ...form, fleet: form.fleet || (form as any).id });

    if (!machine || !machine.fleet || !machine.type || !machine.department) {
      setMessage("Fill fleet, type and department.");
      return;
    }

    setSaving(true);
    try {
      await upsertMachine({
        ...machine,
        machine_type: machine.machine_type || machine.type,
        major_repair: machine.status === "Major Repair" || machine.major_repair,
        online_status: normalizeOnline(machine.online_status, machine.status),
        updated_by: "Dashboard",
      });
      setMessage(`${machine.fleet} saved live to Supabase.`);
      clearForm();
      await loadMachines(false, false);
    } catch (error: any) {
      setMessage(`Save failed: ${error.message || String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const editMachine = (machine: Machine) => {
    setForm(machine);
    setEditingFleet(machine.fleet);
    setMessage(`Editing ${machine.fleet}`);
  };

  const deleteMachine = async (fleet: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from(TABLE).delete().eq("fleet", fleet);
      if (error) throw error;
      setMessage(`${fleet} deleted from live register.`);
      if (editingFleet === fleet) clearForm();
      await loadMachines(false, false);
    } catch (error: any) {
      setMessage(`Delete failed: ${error.message || String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (machine: Machine) => {
    const nextStatus: MachineStatus = machine.status === "Available" ? "Down" : "Available";
    const next = {
      ...machine,
      status: nextStatus,
      online_status: nextStatus === "Available" ? ("Online" as const) : ("Offline" as const),
      availability: nextStatus === "Available" ? 100 : 0,
      major_repair: false,
      updated_by: "Dashboard",
    };

    setSaving(true);
    try {
      await upsertMachine(next);
      setMessage(`${machine.fleet} changed to ${nextStatus}.`);
      await loadMachines(false, false);
    } catch (error: any) {
      setMessage(`Status update failed: ${error.message || String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      "fleet,type,machine_type,department,status,online_status,location,availability,hours_worked,hours_down,downtime_reason,repair_reason,spares_eta,major_repair",
    ];

    const rows = machines.map((m) =>
      [
        m.fleet,
        m.type,
        m.machine_type,
        m.department,
        m.status,
        m.online_status,
        m.location,
        m.availability,
        m.hours_worked,
        m.hours_down,
        m.downtime_reason,
        m.repair_reason,
        m.spares_eta,
        m.major_repair ? "YES" : "NO",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [...headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "machine-availability-live.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage("CSV exported from live Supabase register.");
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const text = await file.text();
      const parsedMachines = parseCsv(text);

      if (parsedMachines.length === 0) {
        setMessage("No valid CSV rows found. Check the headers: fleet/id, type, department, status, location, availability.");
        return;
      }

      await replaceLiveRegister(parsedMachines);
      clearForm();
      setMessage(`Uploaded and replaced live register with ${parsedMachines.length} machine(s). Phones will now see the same data.`);
      await loadMachines(false, false);
    } catch (error: any) {
      setMessage(`CSV upload failed: ${error.message || String(error)}`);
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  };

  const printReport = () => window.print();

  const filteredMachines = useMemo(() => {
    const t = searchTerm.toLowerCase().trim();
    if (!t) return machines;
    return machines.filter((m) =>
      [
        m.fleet,
        m.type,
        m.machine_type,
        m.department,
        m.status,
        m.location,
        m.online_status,
        m.downtime_reason,
        m.repair_reason,
        m.spares_eta,
      ]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [machines, searchTerm]);

  const activeMachines = machines.filter((m) => !m.major_repair && m.status !== "Major Repair");
  const totalMachines = machines.length;
  const availableCount = activeMachines.filter((m) => m.status === "Available" && m.online_status === "Online").length;
  const downCount = activeMachines.filter(isOffline).length;
  const majorCount = machines.filter((m) => m.major_repair || m.status === "Major Repair").length;
  const locationsCount = new Set(machines.map((m) => m.location).filter(Boolean)).size;

  const averageAvailability =
    activeMachines.length > 0
      ? (activeMachines.reduce((sum, machine) => sum + numeric(machine.availability), 0) / activeMachines.length).toFixed(1)
      : "0.0";

  const totalRunTime = activeMachines.reduce((sum, machine) => sum + numeric(machine.hours_worked), 0).toFixed(1);
  const totalDowntime = activeMachines.reduce((sum, machine) => sum + numeric(machine.hours_down), 0).toFixed(1);
  const unitsBelow85 = activeMachines.filter((m) => numeric(m.availability) < 85).length;

  const summaryCards = [
    { title: "TOTAL MACHINES", value: String(totalMachines), note: "All units in the live register" },
    { title: "AVAILABLE", value: String(availableCount), note: "Active units marked available" },
    { title: "REPAIRS / DOWN", value: String(downCount), note: "Active units needing attention" },
    { title: "LOCATIONS", value: String(locationsCount), note: "Distinct operating locations" },
    { title: "MAJOR REPAIRS", value: String(majorCount), note: "Visible but excluded from percentages" },
    { title: "AVERAGE AVAILABILITY", value: `${averageAvailability}%`, note: "Excludes major repairs" },
    { title: "TOTAL RUN TIME (HRS)", value: totalRunTime, note: "From current live register" },
    { title: "TOTAL DOWNTIME (HRS)", value: totalDowntime, note: "Rounded to one decimal" },
    { title: "UNITS BELOW 85%", value: String(unitsBelow85), note: "Current units below target" },
  ];

  const groupedAverages = Object.values(
    activeMachines.reduce((acc, machine) => {
      const key = (machine.type || guessTypeFromFleet(machine.fleet)).toUpperCase();
      if (!acc[key]) acc[key] = { type: key, units: 0, availabilityTotal: 0, runTime: 0, downtime: 0, available: 0 };
      acc[key].units += 1;
      acc[key].availabilityTotal += numeric(machine.availability);
      acc[key].runTime += numeric(machine.hours_worked);
      acc[key].downtime += numeric(machine.hours_down);
      if (machine.status === "Available" && machine.online_status === "Online") acc[key].available += 1;
      return acc;
    }, {} as Record<string, { type: string; units: number; availabilityTotal: number; runTime: number; downtime: number; available: number }>)
  ).map((item) => {
    const avg = item.units > 0 ? item.availabilityTotal / item.units : 0;
    const percentAvailable = item.units > 0 ? (item.available / item.units) * 100 : 0;
    return {
      type: item.type,
      units: item.units,
      availability: `${avg.toFixed(1)}%`,
      percentAvailable: `${percentAvailable.toFixed(1)}%`,
      runTime: item.runTime.toFixed(1),
      downtime: item.downtime.toFixed(1),
      status: avg >= 90 ? "GREEN" : avg >= 80 ? "AMBER" : "RED",
    };
  });

  const chartBars = groupedAverages.map((row) => {
    const value = Number(row.availability.replace("%", ""));
    return { label: row.type, value: `${value.toFixed(1)}%`, height: `${Math.max(value, 8)}%` };
  });

  return (
    <div className="availability-page">
      <style>{globalStyles}</style>

      <section className="top-login-strip">
        <span>Live Supabase register: {TABLE}</span>
        <span>Last refresh: {lastRefresh || "-"}</span>
      </section>

      <section className="brand-panel">
        <div className="brand-logo">TURBO ENERGY</div>
        <div className="brand-title">
          <h1>Turbo-Energy<br />Machine Availability</h1>
          <p>Live fleet dashboard with admin movements, departments, repairs, history, and machine details</p>
        </div>
        <div className="brand-actions">
          <button className="primary-btn" onClick={() => loadMachines()} disabled={loading || saving}>Refresh Live</button>
          <button className="secondary-btn" onClick={() => (window.location.href = "/foreman")}>Foreman Page</button>
        </div>
      </section>

      <section className="upload-panel">
        <div className="section-heading"><h2>Admin Upload and Save</h2></div>
        <div className="upload-grid">
          <div className="upload-main">
            <label className="upload-label">Upload CSV workbook</label>
            <input className="upload-input" type="file" accept=".csv,.txt" onChange={handleCsvUpload} />
          </div>
          <div className="upload-actions">
            <button className="primary-btn" onClick={exportCsv} disabled={saving || machines.length === 0}>Export CSV</button>
            <button className="secondary-btn" onClick={importOldBrowserData} disabled={saving}>Sync Old Browser Data</button>
            <button className="secondary-btn" onClick={printReport}>Print page</button>
          </div>
        </div>
        <div className="info-strip">
          Dashboard and Foreman now use the same Supabase table. Upload replaces the live register, removes duplicates by fleet number, and updates all phones after refresh.
        </div>
        {message ? <div className="message-strip">{message}</div> : null}
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
            <p>Same machine types grouped together. Major repair units stay visible in the bottom register but are excluded from percentages.</p>
          </div>
          <div className="availability-table-wrap">
            <table className="availability-table">
              <thead><tr><th>Machine Type</th><th>Units</th><th>Available %</th><th>Average Availability</th><th>Total Run Time</th><th>Total Downtime</th><th>Status</th></tr></thead>
              <tbody>
                {groupedAverages.map((row) => (
                  <tr key={row.type}><td>{row.type}</td><td>{row.units}</td><td>{row.percentAvailable}</td><td>{row.availability}</td><td>{row.runTime}</td><td>{row.downtime}</td><td><span className={`status-badge ${row.status === "GREEN" ? "green" : row.status === "AMBER" ? "amber" : "red"}`}>{row.status}</span></td></tr>
                ))}
                {groupedAverages.length === 0 ? <tr><td colSpan={7} className="empty-cell">No machine type data</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="availability-side-column">
          <div className="availability-panel">
            <div className="panel-title-wrap"><h2>Type Graph</h2><p>Live type averages from Supabase</p></div>
            <div className="bar-chart">
              {chartBars.map((bar) => (
                <div className="bar-item" key={bar.label}><span className="bar-value">{bar.value}</span><div className="bar-track"><div className="bar-fill" style={{ height: bar.height }} /></div><span className="bar-label">{bar.label}</span></div>
              ))}
              {chartBars.length === 0 ? <div className="empty-card">No graph data yet</div> : null}
            </div>
          </div>

          <div className="availability-panel">
            <div className="panel-title-wrap"><h2>Report Tools</h2></div>
            <div className="report-grid"><div className="report-field"><label>Report type</label><select defaultValue="Monthly"><option>Monthly</option><option>Weekly</option><option>Daily</option></select></div><div className="report-field"><label>Report title / period</label><input type="text" placeholder="e.g. May 2026" /></div></div>
            <div className="report-actions"><button className="primary-btn" onClick={printReport}>Generate report</button><button className="secondary-btn" onClick={exportCsv}>Download CSV</button></div>
          </div>
        </div>
      </section>

      <section className="availability-panel bottom-register-panel" id="bottom-register">
        <div className="panel-title-wrap"><h2>{editingFleet ? `Edit Machine ${editingFleet}` : "Add Machine"}</h2><p>These changes save to Supabase and show on the Foreman page.</p></div>
        <div className="edit-grid">
          <input placeholder="Fleet / Unit No" value={form.fleet} onChange={(e) => setForm({ ...form, fleet: e.target.value.toUpperCase() })} />
          <input placeholder="Machine Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value.toUpperCase(), machine_type: e.target.value.toUpperCase() })} />
          <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <select value={form.status} onChange={(e) => {
            const status = e.target.value as MachineStatus;
            setForm({ ...form, status, online_status: status === "Available" ? "Online" : "Offline", availability: status === "Available" ? 100 : 0, major_repair: status === "Major Repair" });
          }}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={form.online_status} onChange={(e) => setForm({ ...form, online_status: e.target.value as "Online" | "Offline" })}><option>Online</option><option>Offline</option></select>
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input placeholder="Availability %" value={String(form.availability)} onChange={(e) => setForm({ ...form, availability: numeric(e.target.value) })} />
          <input placeholder="Hours Worked" value={String(form.hours_worked)} onChange={(e) => setForm({ ...form, hours_worked: numeric(e.target.value) })} />
          <input placeholder="Hours Down" value={String(form.hours_down)} onChange={(e) => setForm({ ...form, hours_down: numeric(e.target.value) })} />
          <input placeholder="Downtime Reason" value={form.downtime_reason} onChange={(e) => setForm({ ...form, downtime_reason: e.target.value })} />
          <input placeholder="Repair Reason / Work Required" value={form.repair_reason} onChange={(e) => setForm({ ...form, repair_reason: e.target.value })} />
          <input placeholder="ETA / Spares" value={form.spares_eta} onChange={(e) => setForm({ ...form, spares_eta: e.target.value })} />
        </div>
        <div className="button-row"><button className="primary-btn" onClick={saveMachine} disabled={saving}>{saving ? "Saving..." : editingFleet ? "Update Machine" : "Add Machine"}</button><button className="secondary-btn" onClick={clearForm}>Clear</button></div>

        <div className="panel-title-wrap"><h2>Bottom Machine Register</h2><p>Full live list with search, edit, delete, status, department, hours, and reasons.</p></div>
        <input className="wide-search" placeholder="Search by fleet, type, department, status, reason, or online status" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <p className="small-note">Showing {filteredMachines.length} of {machines.length} machine(s). Major repairs stay visible but are excluded from availability percentages.</p>
        <div className="availability-table-wrap">
          <table className="availability-table">
            <thead><tr><th>Fleet</th><th>Type</th><th>Department</th><th>Status</th><th>Online</th><th>Location</th><th>Avail %</th><th>Worked</th><th>Down</th><th>Reason</th><th>Repair</th><th>ETA</th><th>Edit</th><th>Delete</th></tr></thead>
            <tbody>
              {filteredMachines.map((machine) => (
                <tr key={machine.fleet}>
                  <td>{machine.fleet}</td><td>{machine.type}</td><td>{machine.department}</td>
                  <td><button onClick={() => toggleStatus(machine)} className={`status-badge ${statusClass(machine.status)}`}>{machine.status}</button></td>
                  <td>{machine.online_status}</td><td>{machine.location}</td><td>{numeric(machine.availability).toFixed(1)}</td><td>{numeric(machine.hours_worked).toFixed(1)}</td><td>{numeric(machine.hours_down).toFixed(1)}</td><td>{machine.downtime_reason || "-"}</td><td>{machine.repair_reason || "-"}</td><td>{machine.spares_eta || "-"}</td>
                  <td><button className="tiny-btn" onClick={() => editMachine(machine)}>Edit</button></td><td><button className="tiny-btn danger" onClick={() => deleteMachine(machine.fleet)}>Delete</button></td>
                </tr>
              ))}
              {filteredMachines.length === 0 ? <tr><td colSpan={14} className="empty-cell">{loading ? "Loading live Supabase register..." : "No machines found"}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const globalStyles = `
  @media print { input, select, button, .top-login-strip, .upload-panel, .brand-actions { display: none !important; } body { background: white !important; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: #101b35; }
  .availability-page { min-height: 100vh; padding: 22px; color: #fff; font-family: Arial, Helvetica, sans-serif; background: radial-gradient(circle at top left, rgba(59,130,246,.22), transparent 30%), linear-gradient(135deg,#111827,#142b55 48%,#0b2344); }
  .top-login-strip, .brand-panel, .upload-panel, .availability-summary-grid, .availability-main-grid, .bottom-register-panel { max-width: 1360px; margin: 0 auto 16px; }
  .top-login-strip { display:flex; justify-content:space-between; gap:12px; background:rgba(2,8,23,.65); border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:10px 16px; font-size:13px; font-weight:800; }
  .brand-panel { background:#14376b; border:1px solid rgba(191,219,254,.18); border-radius:18px; padding:20px; display:grid; grid-template-columns: 330px 1fr auto; gap:18px; align-items:center; box-shadow:0 18px 45px rgba(0,0,0,.28); }
  .brand-logo { background:#f8fafc; color:#8ca0c1; font-size:34px; font-weight:900; letter-spacing:3px; padding:18px 26px; text-align:center; }
  .brand-title h1 { margin:0 0 8px; line-height:1.15; font-size:28px; }
  .brand-title p { margin:0; color:#dbeafe; max-width:260px; font-size:13px; }
  .brand-actions, .upload-actions, .report-actions, .button-row { display:flex; gap:10px; flex-wrap:wrap; }
  .upload-panel, .availability-panel { background:#14376b; border:1px solid rgba(191,219,254,.22); border-radius:18px; padding:18px; box-shadow:0 16px 36px rgba(0,0,0,.22); }
  .section-heading h2, .panel-title-wrap h2 { margin:0 0 7px; font-size:20px; }
  .panel-title-wrap p { margin:0 0 12px; color:#dbeafe; font-size:13px; }
  .upload-grid { display:grid; grid-template-columns:1fr auto; gap:16px; align-items:end; }
  .upload-label, .report-field label { display:block; margin-bottom:8px; font-weight:900; font-size:13px; }
  .upload-input { width:100%; background:#0f2c59; border:1px solid rgba(191,219,254,.22); border-radius:14px; padding:14px; color:#fff; }
  .info-strip, .message-strip, .small-note { margin-top:12px; background:#0f2c59; border:1px solid rgba(191,219,254,.16); padding:12px; border-radius:12px; color:#e0f2fe; font-weight:700; font-size:13px; }
  .message-strip { border-left:5px solid #38bdf8; }
  .availability-summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
  .availability-summary-card { background:#fff; color:#0f172a; border-radius:16px; padding:16px; box-shadow:0 14px 28px rgba(0,0,0,.22); }
  .availability-card-title { display:block; color:#475569; font-size:12px; letter-spacing:.6px; font-weight:900; }
  .availability-card-value { display:block; font-size:30px; margin:7px 0; color:#184785; }
  .availability-card-note { margin:0; color:#334155; font-size:13px; }
  .availability-main-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr); gap:16px; align-items:start; }
  .availability-side-column { display:grid; gap:16px; }
  .availability-table-wrap { overflow:auto; border-radius:14px; }
  .availability-table { width:100%; border-collapse:collapse; min-width:900px; background:#21487d; }
  .availability-table th { background:#f8fafc; color:#0f172a; text-align:left; padding:12px; font-size:12px; position:sticky; top:0; z-index:1; }
  .availability-table td { padding:12px; border-top:1px solid rgba(255,255,255,.08); font-size:13px; vertical-align:top; }
  .empty-cell, .empty-card { text-align:center; padding:22px; color:#dbeafe; font-weight:800; }
  .status-badge { border:0; border-radius:999px; padding:7px 12px; font-weight:900; font-size:12px; color:#fff; white-space:nowrap; cursor:pointer; }
  .green { background:#047857; } .amber { background:#d97706; } .red { background:#dc2626; } .blue { background:#2563eb; } .orange { background:#ea580c; } .grey { background:#475569; }
  .bar-chart { height:260px; display:flex; align-items:end; gap:12px; overflow:auto; padding:10px 0; }
  .bar-item { min-width:54px; display:flex; height:220px; align-items:center; flex-direction:column; justify-content:flex-end; gap:7px; }
  .bar-track { width:36px; height:160px; background:rgba(255,255,255,.13); border-radius:999px; display:flex; align-items:flex-end; overflow:hidden; }
  .bar-fill { width:100%; background:#60a5fa; border-radius:999px 999px 0 0; }
  .bar-value, .bar-label { font-size:11px; font-weight:900; color:#dbeafe; }
  .report-grid, .edit-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:14px; }
  input, select { width:100%; padding:12px 14px; border-radius:12px; border:1px solid #c7d3e4; background:#fff; color:#173f78; font-size:14px; outline:none; }
  .wide-search { max-width:620px; margin-bottom:8px; }
  .primary-btn, .secondary-btn, .tiny-btn { border:0; border-radius:14px; padding:12px 18px; font-weight:900; cursor:pointer; }
  .primary-btn { background:#f59e0b; color:#fff; }
  .secondary-btn { background:#0f2247; color:#fff; border:1px solid rgba(255,255,255,.18); }
  .tiny-btn { padding:8px 11px; background:#e0f2fe; color:#0f172a; }
  .tiny-btn.danger { background:#fecaca; color:#7f1d1d; }
  button:disabled { opacity:.55; cursor:not-allowed; }
  @media (max-width:900px) { .availability-page { padding:12px; } .brand-panel, .availability-main-grid, .upload-grid { grid-template-columns:1fr; } .brand-logo { font-size:24px; } .top-login-strip { border-radius:14px; flex-direction:column; } }
`;

