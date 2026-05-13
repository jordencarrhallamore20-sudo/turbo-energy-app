"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

type Machine = {
  id?: string | number;
  fleet: string;
  type: string;
  machine?: string;
  machineType?: string;
  machine_type?: string;
  status: string;
  department: string;
  location?: string;
  availability?: number | string;
  hours_worked?: number | string;
  hoursWorked?: number | string;
  hours_down?: number | string;
  hoursDown?: number | string;
  downtime_reason?: string;
  downtimeReason?: string;
  repair_reason?: string;
  repairReason?: string;
  spares_eta?: string;
  sparesEta?: string;
  online_status?: string;
  onlineStatus?: string;
  major_repair?: boolean;
  majorRepair?: boolean;
  updated?: string;
  updated_at?: string;
  updated_by?: string;
  __raw?: any;
  [key: string]: any;
};

type DataSource =
  | { kind: "localStorage"; key: string; path: (string | number)[]; label: string }
  | { kind: "supabase"; table: string; label: string }
  | null;

const DASHBOARD_PRIMARY_KEY = "turboMachineData";

const EXACT_LOCAL_KEYS = [
  "turboMachineData",
  "turbo_machine_data",
  "turboMachineAvailabilityData",
  "turboEnergyMachineAvailability",
  "machineAvailabilityData",
  "machineRegister",
  "availabilityRegister",
  "machines",
];

const SUPABASE_TABLE_CANDIDATES = [
  "machine_availability_register",
  "availability_register",
  "machine_availability",
  "turbo_machine_availability",
  "turbo_availability_register",
  "main_machine_availability",
  "machine_register",
];

const departments = [
  "Mining",
  "Logistics",
  "Plant",
  "Workshop",
  "Admin",
  "Stores & Procurement",
  "Engineering & Civils",
  "Charging Station",
];

const statuses = [
  "Available",
  "Down",
  "Repair",
  "Maintenance",
  "Major Repair",
  "Standby",
];

const quickReasons = [
  "",
  "Checks and greasing",
  "Service",
  "Service 500 hr",
  "Tyre replacement",
  "No power",
  "Hydraulic leak",
  "Electrical fault",
  "Engine fault",
  "Transmission fault",
  "Brake fault",
  "Reverse alarm",
  "Accident",
  "Awaiting spares",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function num(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bool(value: any) {
  if (typeof value === "boolean") return value;
  const v = lower(value);
  return ["true", "yes", "y", "1", "major repair", "major"].includes(v);
}

function fleetKey(value: any) {
  return clean(value).toUpperCase().replace(/\s+/g, "");
}

function machineKey(machine: Machine) {
  return fleetKey(machine.fleet || machine.id);
}

function typeFromFleet(fleet: string) {
  const letters = clean(fleet).match(/^[A-Za-z]+/);
  const prefix = letters ? letters[0].toUpperCase() : "MACHINE";

  if (["AFE", "AFN", "AFR", "AFX", "AFC", "AEX", "AFK", "ABH", "AEK", "AGA", "AGE", "AGP", "AGQ", "AHH"].includes(prefix)) {
    return "LDV";
  }

  return prefix || "MACHINE";
}

function isHeaderOrBadFleet(fleet: string) {
  const f = lower(fleet);
  if (!f) return true;

  const bad = [
    "fleet",
    "fleet no",
    "fleet number",
    "machine",
    "machine no",
    "machine number",
    "unit",
    "unit no",
    "registration",
    "reg number",
    "total",
    "totals",
  ];

  if (bad.includes(f)) return true;
  if (f.includes("fleet") && f.includes("number")) return true;
  if (f.includes("machine") && f.includes("number")) return true;
  if (f.length > 40) return true;

  return false;
}

function normalStatus(row: any, rawStatus: string) {
  const statusText = lower(rawStatus);
  const major = bool(row.majorRepair) || bool(row.major_repair) || statusText.includes("major");

  if (major) return "Major Repair";
  if (statusText.includes("avail") || statusText === "online") return "Available";
  if (statusText.includes("stand")) return "Standby";
  if (statusText.includes("maint") || statusText.includes("service")) return "Maintenance";
  if (statusText.includes("repair")) return "Repair";
  if (statusText.includes("down") || statusText.includes("offline")) return "Down";

  return clean(rawStatus) || "Available";
}

function normalize(row: any): Machine {
  const fleet =
    clean(row.fleet) ||
    clean(row.fleetNumber) ||
    clean(row.fleet_number) ||
    clean(row.fleet_no) ||
    clean(row.unit) ||
    clean(row.unitNumber) ||
    clean(row.machine_number) ||
    clean(row.machineNo) ||
    clean(row.registration) ||
    clean(row.regNumber);

  const type =
    clean(row.type) ||
    clean(row.machineTypeGroup) ||
    clean(row.machine_type_group) ||
    typeFromFleet(fleet);

  const machineType =
    clean(row.machineType) ||
    clean(row.machine_type) ||
    clean(row.machine) ||
    clean(row.model) ||
    clean(row.description) ||
    type;

  const rawStatus =
    clean(row.status) ||
    clean(row.machineStatus) ||
    clean(row.machine_status) ||
    clean(row.condition) ||
    (bool(row.majorRepair) || bool(row.major_repair) ? "Major Repair" : "Available");

  const status = normalStatus(row, rawStatus);
  const major = bool(row.majorRepair) || bool(row.major_repair) || status === "Major Repair";

  const onlineStatus =
    clean(row.onlineStatus) ||
    clean(row.online_status) ||
    clean(row.online_offline) ||
    (status === "Available" ? "Online" : "Offline");

  return {
    ...row,
    __raw: row,
    id: row.id,
    fleet,
    type,
    machine: machineType,
    machineType,
    machine_type: machineType,
    status,
    department: clean(row.department) || clean(row.dept) || "Workshop",
    location: clean(row.location) || clean(row.site) || "Hwange",
    availability:
      row.availability ??
      row.availabilityPercent ??
      row.availability_percent ??
      row.availability_percentage ??
      (status === "Available" ? 100 : 0),
    hours_worked:
      row.hours_worked ??
      row.hoursWorked ??
      row.worked_hours ??
      row.hours ??
      "",
    hoursWorked:
      row.hoursWorked ??
      row.hours_worked ??
      row.worked_hours ??
      row.hours ??
      "",
    hours_down:
      row.hours_down ??
      row.hoursDown ??
      row.downtime_hours ??
      row.downHours ??
      0,
    hoursDown:
      row.hoursDown ??
      row.hours_down ??
      row.downtime_hours ??
      row.downHours ??
      0,
    downtime_reason:
      clean(row.downtime_reason) ||
      clean(row.downtimeReason) ||
      clean(row.breakdown_reason) ||
      clean(row.reason),
    downtimeReason:
      clean(row.downtimeReason) ||
      clean(row.downtime_reason) ||
      clean(row.breakdown_reason) ||
      clean(row.reason),
    repair_reason:
      clean(row.repair_reason) ||
      clean(row.repairReason) ||
      clean(row.work_required),
    repairReason:
      clean(row.repairReason) ||
      clean(row.repair_reason) ||
      clean(row.work_required),
    spares_eta:
      clean(row.spares_eta) ||
      clean(row.sparesEta) ||
      clean(row.eta),
    sparesEta:
      clean(row.sparesEta) ||
      clean(row.spares_eta) ||
      clean(row.eta),
    online_status: onlineStatus,
    onlineStatus,
    major_repair: major,
    majorRepair: major,
    updated: clean(row.updated) || clean(row.updated_at) || new Date().toLocaleString(),
    updated_at: clean(row.updated_at) || clean(row.updated) || new Date().toISOString(),
    updated_by: clean(row.updated_by) || "Control",
  };
}

function isValidMachine(row: any) {
  const m = normalize(row);
  if (isHeaderOrBadFleet(m.fleet)) return false;

  const searchable = [m.fleet, m.type, m.machineType, m.status, m.department, m.location].join(" ");
  if (!/[A-Za-z0-9]/.test(searchable)) return false;

  return true;
}

function cleanMachineList(rows: any[]) {
  const map = new Map<string, Machine>();

  rows.forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    if (!isValidMachine(row)) return;

    const machine = normalize(row);
    map.set(machineKey(machine), machine);
  });

  return Array.from(map.values()).sort((a, b) => a.fleet.localeCompare(b.fleet, undefined, { numeric: true }));
}

function isMachineArray(value: any) {
  if (!Array.isArray(value) || value.length === 0) return false;
  const sample = value.slice(0, 25);
  const valid = sample.filter((item) => item && typeof item === "object" && !Array.isArray(item) && isValidMachine(item));
  return valid.length >= Math.min(2, sample.length);
}

function scoreLocalCandidate(key: string, path: (string | number)[], rows: any[]) {
  const cleaned = cleanMachineList(rows);
  if (cleaned.length === 0) return -9999;

  const k = key.toLowerCase();
  let score = cleaned.length;

  if (key === DASHBOARD_PRIMARY_KEY) score += 10000;
  if (EXACT_LOCAL_KEYS.includes(key)) score += 3000;
  if (k.includes("turbo")) score += 250;
  if (k.includes("availability")) score += 250;
  if (k.includes("machine")) score += 180;
  if (k.includes("fleet")) score += 120;
  if (path.join(".").toLowerCase().includes("machine")) score += 150;
  if (cleaned.length >= 20 && cleaned.length <= 300) score += 700;
  if (cleaned.length > 350) score -= 2000;

  const hasAvailabilityFields = rows.some((row) =>
    row &&
    typeof row === "object" &&
    ("availability" in row || "majorRepair" in row || "repairReason" in row || "sparesEta" in row)
  );
  if (hasAvailabilityFields) score += 800;

  return score;
}

function walkForMachineArrays(value: any, path: (string | number)[] = [], out: { path: (string | number)[]; rows: any[] }[] = []) {
  if (!value || typeof value !== "object") return out;

  if (isMachineArray(value)) {
    out.push({ path, rows: value });
    return out;
  }

  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((child, index) => walkForMachineArrays(child, [...path, index], out));
    return out;
  }

  Object.entries(value).forEach(([childKey, childValue]) => {
    if (["machines", "machineData", "data", "register", "rows", "dataset", "fleet", "items", "records", "state"].some((name) => childKey.toLowerCase().includes(name.toLowerCase()))) {
      walkForMachineArrays(childValue, [...path, childKey], out);
    } else if (typeof childValue === "object" && childValue !== null) {
      walkForMachineArrays(childValue, [...path, childKey], out);
    }
  });

  return out;
}

function readValueAtPath(root: any, path: (string | number)[]) {
  return path.reduce((current, part) => (current == null ? undefined : current[part as any]), root);
}

function setValueAtPath(root: any, path: (string | number)[], value: any) {
  if (path.length === 0) return value;

  const clone = Array.isArray(root) ? [...root] : { ...root };
  let current = clone;

  for (let index = 0; index < path.length - 1; index += 1) {
    const part = path[index];
    const next = current[part as any];
    current[part as any] = Array.isArray(next) ? [...next] : { ...next };
    current = current[part as any];
  }

  current[path[path.length - 1] as any] = value;
  return clone;
}

function toDashboardRow(machine: Machine) {
  const status = machine.majorRepair || machine.major_repair ? "Major Repair" : machine.status;
  const updatedDate = new Date().toLocaleString();

  return {
    ...(machine.__raw || {}),
    ...machine,
    fleet: machine.fleet,
    type: machine.type || typeFromFleet(machine.fleet),
    machineType: machine.machineType || machine.machine_type || machine.machine || machine.type,
    machine_type: machine.machineType || machine.machine_type || machine.machine || machine.type,
    machine: machine.machine || machine.machineType || machine.machine_type || machine.type,
    status,
    location: machine.location || "Hwange",
    department: machine.department || "Workshop",
    availability: num(machine.availability),
    hours_worked: machine.hours_worked ?? machine.hoursWorked ?? "",
    hoursWorked: machine.hoursWorked ?? machine.hours_worked ?? "",
    hours_down: num(machine.hours_down ?? machine.hoursDown),
    hoursDown: num(machine.hoursDown ?? machine.hours_down),
    downtime_reason: machine.downtime_reason || machine.downtimeReason || "",
    downtimeReason: machine.downtimeReason || machine.downtime_reason || "",
    repair_reason: machine.repair_reason || machine.repairReason || "",
    repairReason: machine.repairReason || machine.repair_reason || "",
    spares_eta: machine.spares_eta || machine.sparesEta || "",
    sparesEta: machine.sparesEta || machine.spares_eta || "",
    online_status: machine.online_status || machine.onlineStatus || (status === "Available" ? "Online" : "Offline"),
    onlineStatus: machine.onlineStatus || machine.online_status || (status === "Available" ? "Online" : "Offline"),
    majorRepair: status === "Major Repair" || bool(machine.majorRepair) || bool(machine.major_repair),
    major_repair: status === "Major Repair" || bool(machine.majorRepair) || bool(machine.major_repair),
    updated: updatedDate,
    updated_at: new Date().toISOString(),
    updated_by: "Foreman Control",
  };
}

function isOfflineOrRepair(machine: Machine) {
  const status = lower(machine.status);
  const online = lower(machine.online_status || machine.onlineStatus);

  return (
    online === "offline" ||
    status.includes("down") ||
    status.includes("repair") ||
    status.includes("maintenance") ||
    status.includes("major") ||
    status.includes("standby")
  );
}

function statusClass(status: string) {
  const s = status.toLowerCase();

  if (s.includes("available")) return "good";
  if (s.includes("major")) return "major";
  if (s.includes("repair")) return "repair";
  if (s.includes("maint")) return "maintenance";
  if (s.includes("down")) return "down";
  if (s.includes("stand")) return "neutral";

  return "neutral";
}

function buildSupabasePayload(machine: Machine) {
  return {
    fleet: machine.fleet,
    type: machine.type,
    machine_type: machine.machineType || machine.machine_type || machine.machine || machine.type,
    status: machine.status,
    department: machine.department,
    location: machine.location,
    availability: num(machine.availability),
    hours_worked: machine.hours_worked ?? machine.hoursWorked ?? null,
    hours_down: num(machine.hours_down ?? machine.hoursDown),
    downtime_reason: machine.downtime_reason || machine.downtimeReason || "",
    repair_reason: machine.repair_reason || machine.repairReason || "",
    spares_eta: machine.spares_eta || machine.sparesEta || "",
    online_status: machine.online_status || machine.onlineStatus || (machine.status === "Available" ? "Online" : "Offline"),
    major_repair: machine.status === "Major Repair" || bool(machine.majorRepair) || bool(machine.major_repair),
    updated_at: new Date().toISOString(),
    updated_by: "Foreman Control",
  };
}

export default function MachineControlPage() {
  const selectedKeyRef = useRef("");
  const sourceRef = useRef<DataSource>(null);

  const [loggedIn, setLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [source, setSource] = useState<DataSource>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    const saved = sessionStorage.getItem("turbo_machine_control_login");
    if (saved === "true") setLoggedIn(true);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const name = loginName.trim().toLowerCase();
    const pass = loginPassword.trim();

    if ((name === "controle" || name === "control" || name === "foreman" || name === "admin") && pass === "1234") {
      sessionStorage.setItem("turbo_machine_control_login", "true");
      setLoggedIn(true);
      setLoginError("");
      setTimeout(() => loadMachines(), 50);
      return;
    }

    setLoginError("Invalid control login details.");
  }

  function logout() {
    sessionStorage.removeItem("turbo_machine_control_login");
    setLoggedIn(false);
    setLoginName("");
    setLoginPassword("");
  }

  function chooseLocalStorageSource() {
    if (typeof window === "undefined") return null;

    const candidates: { key: string; path: (string | number)[]; rows: any[]; score: number }[] = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const found = walkForMachineArrays(parsed);

        found.forEach((item) => {
          candidates.push({
            key,
            path: item.path,
            rows: item.rows,
            score: scoreLocalCandidate(key, item.path, item.rows),
          });
        });
      } catch {
        // ignore non JSON values
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];

    if (!chosen || chosen.score < 0) return null;

    return {
      source: {
        kind: "localStorage" as const,
        key: chosen.key,
        path: chosen.path,
        label: `main dashboard browser register: ${chosen.key}${chosen.path.length ? `/${chosen.path.join("/")}` : ""}`,
      },
      machines: cleanMachineList(chosen.rows),
    };
  }

  async function chooseSupabaseSource() {
    if (!supabase) return null;

    for (const table of SUPABASE_TABLE_CANDIDATES) {
      const { data, error } = await supabase.from(table).select("*").limit(1200);

      if (error || !data || data.length === 0) continue;

      const cleaned = cleanMachineList(data);
      const hasAvailabilityFields = data.some((row) =>
        row &&
        typeof row === "object" &&
        ("availability" in row || "majorRepair" in row || "major_repair" in row || "repairReason" in row || "sparesEta" in row)
      );

      if (cleaned.length > 0 && cleaned.length <= 350 && hasAvailabilityFields) {
        return {
          source: {
            kind: "supabase" as const,
            table,
            label: `Supabase live availability table: ${table}`,
          },
          machines: cleaned,
        };
      }
    }

    return null;
  }

  function applyLoadedData(nextMachines: Machine[], nextSource: DataSource) {
    const keepKey = selectedKeyRef.current;

    setSource(nextSource);
    sourceRef.current = nextSource;
    setMachines(nextMachines);
    setLastRefresh(new Date().toLocaleTimeString());

    if (nextMachines.length > 0) {
      const kept = keepKey ? nextMachines.find((m) => machineKey(m) === keepKey) : null;
      const target = kept || nextMachines[0];

      setSelectedKey(machineKey(target));
      selectedKeyRef.current = machineKey(target);
      setDraft(target);
    } else {
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
    }
  }

  async function loadMachines(showLoading = true) {
    if (showLoading) setLoading(true);
    setMessage("");

    const local = chooseLocalStorageSource();

    if (local && local.machines.length > 0) {
      applyLoadedData(local.machines, local.source);
      setMessage(`Loaded ${local.machines.length} machine(s) from the same dashboard register.`);
      setLoading(false);
      return;
    }

    const remote = await chooseSupabaseSource();

    if (remote && remote.machines.length > 0) {
      applyLoadedData(remote.machines, remote.source);
      setMessage(`Loaded ${remote.machines.length} machine(s) from Supabase availability table.`);
      setLoading(false);
      return;
    }

    setMachines([]);
    setSelectedKey("");
    selectedKeyRef.current = "";
    setDraft(null);
    setSource(null);
    sourceRef.current = null;
    setLastRefresh(new Date().toLocaleTimeString());
    setMessage(
      "No main dashboard register found. Open the main Machine Availability page once on this same browser, or upload the register there, then press Refresh here."
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!loggedIn) return;

    loadMachines();

    const timer = setInterval(() => {
      loadMachines(false);
    }, 20000);

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.toLowerCase().includes("machine") || event.key.toLowerCase().includes("turbo")) {
        loadMachines(false);
      }
    };

    const onTurboUpdate = () => loadMachines(false);

    window.addEventListener("storage", onStorage);
    window.addEventListener("turbo-machine-data-updated", onTurboUpdate);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("turbo-machine-availability");
      channel.onmessage = () => loadMachines(false);
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("turbo-machine-data-updated", onTurboUpdate);
      if (channel) channel.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (!source || source.kind !== "supabase" || !supabase) return;

    const channel = supabase
      .channel(`machine-control-${source.table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: source.table,
        },
        () => {
          loadMachines(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const searchedMachines = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return machines;

    return machines.filter((m) =>
      [
        m.fleet,
        m.type,
        m.machine,
        m.machineType,
        m.machine_type,
        m.status,
        m.department,
        m.location,
        m.online_status,
        m.onlineStatus,
        m.downtime_reason,
        m.downtimeReason,
        m.repair_reason,
        m.repairReason,
        m.spares_eta,
        m.sparesEta,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [machines, search]);

  const offlineMachines = useMemo(() => machines.filter(isOfflineOrRepair), [machines]);

  const stats = useMemo(() => {
    const total = machines.length;
    const offline = machines.filter(isOfflineOrRepair).length;
    const online = total - offline;
    const major = machines.filter((m) => clean(m.status).toLowerCase().includes("major") || bool(m.majorRepair) || bool(m.major_repair)).length;

    return { total, online, offline, major };
  }, [machines]);

  useEffect(() => {
    if (searchedMachines.length === 0) {
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
      return;
    }

    const stillVisible = searchedMachines.find((m) => machineKey(m) === selectedKey);

    if (stillVisible) {
      setDraft(stillVisible);
    } else {
      const first = searchedMachines[0];
      setSelectedKey(machineKey(first));
      selectedKeyRef.current = machineKey(first);
      setDraft(first);
    }
  }, [searchedMachines, selectedKey]);

  function saveToMainLocalStorage(nextMachines: Machine[], activeSource: DataSource) {
    if (typeof window === "undefined") return;

    const dashboardRows = nextMachines.map(toDashboardRow);

    if (activeSource && activeSource.kind === "localStorage") {
      try {
        const raw = localStorage.getItem(activeSource.key);
        const parsed = raw ? JSON.parse(raw) : [];
        const currentRows = readValueAtPath(parsed, activeSource.path);

        if (Array.isArray(currentRows)) {
          const mergedByFleet = new Map<string, any>();
          currentRows.forEach((row) => {
            if (row && typeof row === "object") {
              const normalized = normalize(row);
              if (!isHeaderOrBadFleet(normalized.fleet)) {
                mergedByFleet.set(machineKey(normalized), row);
              }
            }
          });

          dashboardRows.forEach((row) => mergedByFleet.set(machineKey(row), row));
          const merged = Array.from(mergedByFleet.values()).sort((a, b) => clean(a.fleet).localeCompare(clean(b.fleet), undefined, { numeric: true }));
          const updatedRoot = setValueAtPath(parsed, activeSource.path, merged);
          localStorage.setItem(activeSource.key, JSON.stringify(updatedRoot));
        }
      } catch {
        localStorage.setItem(activeSource.key, JSON.stringify(dashboardRows));
      }
    }

    localStorage.setItem(DASHBOARD_PRIMARY_KEY, JSON.stringify(dashboardRows));
    window.dispatchEvent(new Event("turbo-machine-data-updated"));

    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("turbo-machine-availability");
      channel.postMessage({ type: "machines-updated", at: Date.now() });
      channel.close();
    }
  }

  async function saveToSupabase(machine: Machine, activeSource: DataSource) {
    if (!supabase || !activeSource || activeSource.kind !== "supabase") return null;

    const payload = buildSupabasePayload(machine);
    let query = supabase.from(activeSource.table).update(payload);

    if (machine.id !== undefined && machine.id !== null) {
      query = query.eq("id", machine.id);
    } else {
      query = query.eq("fleet", machine.fleet);
    }

    const { error } = await query;
    return error;
  }

  async function updateMachine(machine: Machine, patch: Partial<Machine>) {
    const id = machine.id ?? machine.fleet;
    const activeSource = sourceRef.current;
    setSavingId(id);

    const patched = normalize({
      ...machine,
      ...patch,
      updated: new Date().toLocaleString(),
      updated_at: new Date().toISOString(),
      updated_by: "Foreman Control",
    });

    const nextMachines = machines.map((m) => (machineKey(m) === machineKey(machine) ? patched : m));

    setMachines(nextMachines);
    setDraft(patched);
    setSelectedKey(machineKey(patched));
    selectedKeyRef.current = machineKey(patched);

    saveToMainLocalStorage(nextMachines, activeSource);

    const error = await saveToSupabase(patched, activeSource);

    if (error) {
      setMessage(`Saved to dashboard browser register, but Supabase update failed: ${error.message}`);
    } else {
      setMessage(`${patched.fleet} saved to the same main dashboard register.`);
    }

    setLastRefresh(new Date().toLocaleTimeString());
    setSavingId(null);
  }

  async function saveDraft() {
    if (!draft) return;

    const status = draft.majorRepair || draft.major_repair ? "Major Repair" : draft.status;

    await updateMachine(draft, {
      status,
      department: draft.department,
      location: draft.location,
      availability: draft.availability,
      hours_worked: draft.hours_worked ?? draft.hoursWorked,
      hoursWorked: draft.hoursWorked ?? draft.hours_worked,
      hours_down: draft.hours_down ?? draft.hoursDown,
      hoursDown: draft.hoursDown ?? draft.hours_down,
      downtime_reason: draft.downtime_reason ?? draft.downtimeReason,
      downtimeReason: draft.downtimeReason ?? draft.downtime_reason,
      repair_reason: draft.repair_reason ?? draft.repairReason,
      repairReason: draft.repairReason ?? draft.repair_reason,
      spares_eta: draft.spares_eta ?? draft.sparesEta,
      sparesEta: draft.sparesEta ?? draft.spares_eta,
      online_status: draft.online_status ?? draft.onlineStatus,
      onlineStatus: draft.onlineStatus ?? draft.online_status,
      major_repair: status === "Major Repair",
      majorRepair: status === "Major Repair",
    });
  }

  async function bookOnline(machine: Machine) {
    await updateMachine(machine, {
      status: "Available",
      online_status: "Online",
      onlineStatus: "Online",
      availability: 100,
      hours_down: 0,
      hoursDown: 0,
      downtime_reason: "",
      downtimeReason: "",
      repair_reason: "",
      repairReason: "",
      spares_eta: "",
      sparesEta: "",
      major_repair: false,
      majorRepair: false,
    });
  }

  async function bookOffline(machine: Machine) {
    await updateMachine(machine, {
      status: "Down",
      online_status: "Offline",
      onlineStatus: "Offline",
      availability: 0,
      downtime_reason: machine.downtime_reason || machine.downtimeReason || "Booked offline by foreman",
      downtimeReason: machine.downtimeReason || machine.downtime_reason || "Booked offline by foreman",
      major_repair: false,
      majorRepair: false,
    });
  }

  function updateDraft(patch: Partial<Machine>) {
    setDraft((prev) => (prev ? normalize({ ...prev, ...patch }) : prev));
  }

  function selectMachine(key: string) {
    setSelectedKey(key);
    selectedKeyRef.current = key;
    const found = searchedMachines.find((m) => machineKey(m) === key);
    setDraft(found || null);
  }

  if (!loggedIn) {
    return (
      <main className="page loginPage">
        <section className="loginBox">
          <p className="eyebrow">TURBO ENERGY</p>
          <h1>Machine Controle Login</h1>
          <p className="loginText">Enter control details to access machine booking controls.</p>

          <form onSubmit={handleLogin} className="loginForm">
            <label>
              Username
              <input value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="controle" />
            </label>

            <label>
              Password
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="1234" />
            </label>

            {loginError && <div className="loginError">{loginError}</div>}

            <button className="btn whiteBtn" type="submit">
              Login
            </button>
          </form>
        </section>

        <style jsx>{pageStyles}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">TURBO ENERGY</p>
          <h1>Machine Controle</h1>
          <p>Search one machine, update its status, book online/offline, and monitor current breakdowns from the live main dashboard register.</p>
        </div>

        <div className="heroActions">
          <button className="btn whiteBtn" onClick={() => loadMachines()} type="button">
            Refresh
          </button>
          <button className="btn outlineBtn" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </section>

      {message && <section className="notice">{message}</section>}

      <section className="sourceBar">
        Live source: {source?.label || "waiting for main dashboard register"} · Last refresh: {lastRefresh || "-"}
      </section>

      <section className="stats">
        <div className="stat">
          <span>Total Fleet</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat">
          <span>Online</span>
          <strong className="greenText">{stats.online}</strong>
        </div>
        <div className="stat">
          <span>Breakdowns / Offline</span>
          <strong className="blueText">{stats.offline}</strong>
        </div>
        <div className="stat">
          <span>Major Repairs</span>
          <strong className="amberText">{stats.major}</strong>
        </div>
      </section>

      <section className="workArea">
        <section className="controlPanel">
          <div className="panelHeader">
            <div>
              <h2>Machine Control</h2>
              <p>Search, select, edit, then save updates.</p>
            </div>
          </div>

          <div className="searchRow">
            <label>
              Search fleet
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Example: FEL05, TRL05, HT19..." />
            </label>

            <button className="btn smallBtn clearBtn" onClick={() => setSearch("")} type="button">
              Clear
            </button>
          </div>

          <label>
            Select machine ({searchedMachines.length} found)
            <select value={selectedKey} onChange={(e) => selectMachine(e.target.value)} disabled={searchedMachines.length === 0}>
              {searchedMachines.map((m) => (
                <option key={machineKey(m)} value={machineKey(m)}>
                  {m.fleet} - {m.type} - {m.status}
                </option>
              ))}
            </select>
          </label>

          {!draft ? (
            <div className="emptyCard">{loading ? "Loading register..." : "No machine found."}</div>
          ) : (
            <div className="machineFace">
              <div className="machineTitle">
                <div>
                  <h3>
                    {draft.fleet} - {draft.machineType || draft.machine_type || draft.machine || draft.type}
                  </h3>
                  <p>
                    {draft.department} · {draft.location || "-"}
                  </p>
                </div>
                <span className={`pill ${statusClass(draft.status)}`}>{draft.majorRepair || draft.major_repair ? "Major Repair" : draft.status}</span>
              </div>

              <div className="quickActions">
                <button className="btn greenBtn" onClick={() => bookOnline(draft)} disabled={savingId === (draft.id ?? draft.fleet)} type="button">
                  Book Online
                </button>

                <button className="btn blueBtn" onClick={() => bookOffline(draft)} disabled={savingId === (draft.id ?? draft.fleet)} type="button">
                  Book Offline
                </button>
              </div>

              <div className="sectionTitle">Machine Status</div>

              <div className="formGrid">
                <label>
                  Department
                  <select value={draft.department} onChange={(e) => updateDraft({ department: e.target.value })}>
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={draft.majorRepair || draft.major_repair ? "Major Repair" : draft.status}
                    onChange={(e) =>
                      updateDraft({
                        status: e.target.value,
                        online_status: e.target.value === "Available" ? "Online" : "Offline",
                        onlineStatus: e.target.value === "Available" ? "Online" : "Offline",
                        availability: e.target.value === "Available" ? 100 : 0,
                        major_repair: e.target.value === "Major Repair",
                        majorRepair: e.target.value === "Major Repair",
                      })
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Online / Offline
                  <select value={draft.online_status || draft.onlineStatus || "Online"} onChange={(e) => updateDraft({ online_status: e.target.value, onlineStatus: e.target.value })}>
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                </label>

                <label>
                  Availability %
                  <input value={draft.availability ?? ""} onChange={(e) => updateDraft({ availability: e.target.value })} />
                </label>

                <label>
                  Hours Worked
                  <input value={draft.hours_worked ?? draft.hoursWorked ?? ""} onChange={(e) => updateDraft({ hours_worked: e.target.value, hoursWorked: e.target.value })} />
                </label>

                <label>
                  Hours Down
                  <input value={draft.hours_down ?? draft.hoursDown ?? ""} onChange={(e) => updateDraft({ hours_down: e.target.value, hoursDown: e.target.value })} />
                </label>
              </div>

              <div className="sectionTitle">Downtime Details</div>

              <div className="formGrid">
                <label>
                  Quick Downtime Reason
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) updateDraft({ downtime_reason: e.target.value, downtimeReason: e.target.value });
                    }}
                  >
                    {quickReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason || "Select common reason..."}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Downtime Reason
                  <input value={draft.downtime_reason ?? draft.downtimeReason ?? ""} onChange={(e) => updateDraft({ downtime_reason: e.target.value, downtimeReason: e.target.value })} />
                </label>

                <label>
                  Repair Reason / Work Required
                  <input value={draft.repair_reason ?? draft.repairReason ?? ""} onChange={(e) => updateDraft({ repair_reason: e.target.value, repairReason: e.target.value })} />
                </label>

                <label>
                  ETA / Spares
                  <input value={draft.spares_eta ?? draft.sparesEta ?? ""} onChange={(e) => updateDraft({ spares_eta: e.target.value, sparesEta: e.target.value })} placeholder="Example: Awaiting spares, 14 May..." />
                </label>

                <label>
                  Location
                  <input value={draft.location ?? ""} onChange={(e) => updateDraft({ location: e.target.value })} />
                </label>
              </div>

              <div className="saveRow">
                <span>
                  Last refresh: {lastRefresh || "-"}
                  {source?.label ? ` | ${source.label}` : ""}
                </span>

                <button className="btn whiteBtn saveBtn" onClick={saveDraft} disabled={savingId === (draft.id ?? draft.fleet)} type="button">
                  {savingId === (draft.id ?? draft.fleet) ? "Saving..." : "Save Updates"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="breakdownPanel">
          <div className="panelHeader">
            <div>
              <h2>Machines on Breakdown / Offline</h2>
              <p>Click a fleet number to load it into Machine Control.</p>
            </div>
            <div className="countBadge">{offlineMachines.length}</div>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Fleet</th>
                  <th>Type</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>Online</th>
                  <th>Hours</th>
                  <th>Downtime Reason</th>
                  <th>Repair Reason</th>
                  <th>ETA</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="empty">
                      Loading register...
                    </td>
                  </tr>
                ) : offlineMachines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty">
                      No machines booked offline.
                    </td>
                  </tr>
                ) : (
                  offlineMachines.map((m) => (
                    <tr
                      key={`${machineKey(m)}-offline`}
                      className="clickableRow"
                      onClick={() => {
                        setSearch(m.fleet);
                        setSelectedKey(machineKey(m));
                        selectedKeyRef.current = machineKey(m);
                        setDraft(m);
                      }}
                    >
                      <td>
                        <button className="fleetBtn" type="button">
                          {m.fleet}
                        </button>
                      </td>
                      <td>{m.type}</td>
                      <td>{m.department}</td>
                      <td>
                        <span className={`pill ${statusClass(m.status)}`}>{m.majorRepair || m.major_repair ? "Major Repair" : m.status}</span>
                      </td>
                      <td>{m.online_status || m.onlineStatus || "-"}</td>
                      <td>{num(m.hours_down ?? m.hoursDown).toFixed(1)}</td>
                      <td>{m.downtime_reason || m.downtimeReason || "-"}</td>
                      <td>{m.repair_reason || m.repairReason || "-"}</td>
                      <td>{m.spares_eta || m.sparesEta || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <style jsx>{pageStyles}</style>
    </main>
  );
}

const pageStyles = `
  * {
    box-sizing: border-box;
  }

  .page {
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(59, 130, 246, 0.22), transparent 30%),
      radial-gradient(circle at bottom right, rgba(14, 116, 144, 0.18), transparent 35%),
      linear-gradient(135deg, #06142b 0%, #0a2244 45%, #123763 100%);
    padding: 18px;
    font-family: Arial, Helvetica, sans-serif;
    color: #ffffff;
  }

  .hero,
  .notice,
  .sourceBar,
  .stats,
  .workArea {
    max-width: 1600px;
    margin: 0 auto 14px auto;
  }

  .hero {
    background: #020817;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    padding: 20px 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
    min-height: 108px;
  }

  .eyebrow {
    letter-spacing: 6px;
    font-size: 12px;
    font-weight: 900;
    margin: 0 0 7px;
    color: #bfdbfe;
  }

  h1 {
    font-size: 34px;
    line-height: 1;
    margin: 0 0 8px;
  }

  .hero p,
  .panelHeader p {
    margin: 0;
    color: #dbeafe;
    font-size: 14px;
  }

  .heroActions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn {
    border: 0;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 900;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }

  .btn:hover {
    transform: translateY(-1px);
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }

  .whiteBtn {
    background: #ffffff;
    color: #020817;
  }

  .outlineBtn {
    background: transparent;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.35);
  }

  .greenBtn {
    background: #0f766e;
    color: #ffffff;
  }

  .blueBtn {
    background: #2563eb;
    color: #ffffff;
  }

  .smallBtn {
    padding: 11px 14px;
  }

  .clearBtn {
    background: #dbeafe;
    color: #0f172a;
  }

  .notice {
    background: rgba(2, 8, 23, 0.88);
    border-left: 6px solid #38bdf8;
    color: #ffffff;
    padding: 13px 18px;
    border-radius: 12px;
    font-weight: 800;
  }

  .sourceBar {
    background: rgba(2, 8, 23, 0.88);
    border-left: 6px solid #f59e0b;
    color: #ffffff;
    padding: 13px 18px;
    border-radius: 12px;
    font-weight: 900;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .stat {
    background: #ffffff;
    color: #020817;
    border-radius: 16px;
    padding: 15px 16px;
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
  }

  .stat span {
    text-transform: uppercase;
    color: #475569;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.8px;
  }

  .stat strong {
    display: block;
    font-size: 30px;
    margin-top: 5px;
  }

  .greenText {
    color: #047857;
  }

  .blueText {
    color: #2563eb;
  }

  .amberText {
    color: #d97706;
  }

  .workArea {
    display: grid;
    grid-template-columns: 470px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .controlPanel,
  .breakdownPanel {
    background: rgba(18, 55, 99, 0.96);
    border: 1px solid rgba(191, 219, 254, 0.22);
    border-radius: 20px;
    padding: 18px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
  }

  .controlPanel {
    position: sticky;
    top: 14px;
  }

  .panelHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .panelHeader h2 {
    margin: 0 0 6px;
    font-size: 21px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 11px;
  }

  input,
  select {
    width: 100%;
    border: 0;
    border-radius: 12px;
    padding: 12px;
    font-size: 14px;
    color: #020817;
    background: #ffffff;
    outline: none;
  }

  select:disabled {
    opacity: 0.7;
  }

  input:focus,
  select:focus {
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.42);
  }

  .searchRow {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: end;
  }

  .machineFace {
    margin-top: 13px;
    background: #1d4b80;
    border: 1px solid rgba(191, 219, 254, 0.18);
    border-radius: 18px;
    padding: 15px;
  }

  .machineTitle {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 13px;
  }

  .machineTitle h3 {
    margin: 0 0 5px;
    font-size: 20px;
  }

  .machineTitle p {
    margin: 0;
    color: #dbeafe;
    font-size: 13px;
  }

  .quickActions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 13px;
  }

  .sectionTitle {
    margin: 12px 0 9px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(2, 8, 23, 0.32);
    color: #dbeafe;
    font-weight: 900;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .formGrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .saveRow {
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    color: #dbeafe;
    font-size: 12px;
  }

  .saveBtn {
    min-width: 140px;
  }

  .countBadge {
    background: #1e3a5f;
    color: #f8fafc;
    font-size: 22px;
    font-weight: 900;
    min-width: 52px;
    height: 52px;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }

  .tableWrap {
    overflow: auto;
    border-radius: 14px;
    max-height: calc(100vh - 330px);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: #1e3f70;
    min-width: 980px;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #ffffff;
    color: #020817;
    text-align: left;
    font-size: 12px;
    padding: 13px;
  }

  td {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding: 13px;
    color: #ffffff;
    font-size: 13px;
    vertical-align: top;
  }

  .clickableRow {
    cursor: pointer;
  }

  .clickableRow:hover {
    background: rgba(59, 130, 246, 0.18);
  }

  .fleetBtn {
    background: transparent;
    color: #bfdbfe;
    border: 0;
    font-weight: 900;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }

  .empty,
  .emptyCard {
    text-align: center;
    color: #dbeafe;
    padding: 24px;
    font-weight: 800;
  }

  .emptyCard {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 14px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 7px 14px;
    min-width: 92px;
    font-size: 12px;
    font-weight: 900;
  }

  .good {
    background: #0f766e;
    color: #d1fae5;
  }

  .down {
    background: #2563eb;
    color: #dbeafe;
  }

  .repair {
    background: #1d4ed8;
    color: #dbeafe;
  }

  .maintenance {
    background: #0ea5e9;
    color: #ecfeff;
  }

  .major {
    background: #d97706;
    color: #fff7ed;
  }

  .neutral {
    background: #334155;
    color: #e2e8f0;
  }

  .loginPage {
    display: grid;
    place-items: center;
  }

  .loginBox {
    width: min(440px, 100%);
    background: #020817;
    border: 1px solid rgba(191, 219, 254, 0.2);
    border-radius: 22px;
    padding: 28px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  }

  .loginBox h1 {
    font-size: 30px;
  }

  .loginText {
    color: #dbeafe;
    margin: 0 0 18px;
  }

  .loginError {
    background: #1d4ed8;
    color: #ffffff;
    padding: 12px;
    border-radius: 12px;
    font-weight: 800;
    margin-bottom: 12px;
  }

  @media (max-width: 1150px) {
    .workArea {
      grid-template-columns: 1fr;
    }

    .controlPanel {
      position: static;
    }

    .tableWrap {
      max-height: none;
    }
  }

  @media (max-width: 760px) {
    .page {
      padding: 12px;
    }

    .hero {
      flex-direction: column;
      align-items: stretch;
      padding: 18px;
    }

    h1 {
      font-size: 28px;
    }

    .heroActions {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .stats {
      grid-template-columns: 1fr 1fr;
    }

    .formGrid {
      grid-template-columns: 1fr;
    }

    .quickActions {
      grid-template-columns: 1fr;
    }

    .saveRow {
      flex-direction: column;
      align-items: stretch;
    }

    .searchRow {
      grid-template-columns: 1fr;
    }

    .clearBtn {
      width: 100%;
    }
  }

  @media (max-width: 460px) {
    .stats {
      grid-template-columns: 1fr;
    }

    .heroActions {
      grid-template-columns: 1fr;
    }

    .controlPanel,
    .breakdownPanel {
      padding: 14px;
    }
  }
`;

