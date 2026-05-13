"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Machine = {
  id?: string | number;
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
  __fleet_column?: string;
  __fleet_value?: string;
  [key: string]: any;
};

/*
  IMPORTANT FIX:
  This foreman/control screen must only read from the main availability register.
  Do not add machine_register, machines, or fleet_machines here, because those
  tables can belong to the other workshop apps and will pull the wrong fleet list.
*/
const MAIN_REGISTER_TABLES = [
  "machine_availability",
  "machine_availability_register",
  "availability_register",
];

const FIELD_ALIASES: Record<string, string[]> = {
  fleet: [
    "fleet",
    "fleet_no",
    "fleet no",
    "fleet_number",
    "fleet number",
    "unit",
    "unit_no",
    "unit no",
    "unit_number",
    "unit number",
    "machine_number",
    "machine number",
    "machine_no",
    "machine no",
    "asset",
    "asset_no",
    "asset no",
    "asset_number",
    "asset number",
    "registration",
    "reg",
    "reg_no",
    "reg no",
    "reg_number",
    "reg number",
  ],
  type: [
    "type",
    "machine_type",
    "machine type",
    "machineType",
    "category",
    "class",
    "group",
    "machine",
  ],
  machine: ["machine", "machine_name", "machine name", "name", "description"],
  status: ["status", "machine_status", "machine status", "condition"],
  department: ["department", "dept", "section"],
  location: ["location", "site", "area"],
  availability: [
    "availability",
    "availability_%",
    "availability %",
    "availability_percent",
    "availability percent",
    "availability_percentage",
    "availability percentage",
    "available_%",
    "available %",
  ],
  hours_worked: [
    "hours_worked",
    "hours worked",
    "hoursWorked",
    "worked_hours",
    "worked hours",
    "running_hours",
    "running hours",
  ],
  hours_down: [
    "hours_down",
    "hours down",
    "hoursDown",
    "downtime_hours",
    "downtime hours",
    "down_hours",
    "down hours",
  ],
  downtime_reason: [
    "downtime_reason",
    "downtime reason",
    "downtimeReason",
    "reason",
    "breakdown_reason",
    "breakdown reason",
    "down_reason",
    "down reason",
    "fault",
  ],
  repair_reason: [
    "repair_reason",
    "repair reason",
    "repairReason",
    "work_required",
    "work required",
    "repairs_required",
    "repairs required",
  ],
  spares_eta: [
    "spares_eta",
    "spares eta",
    "sparesEta",
    "eta",
    "eta_spares",
    "eta spares",
    "spares",
  ],
  online_status: [
    "online_status",
    "online status",
    "onlineStatus",
    "online_offline",
    "online offline",
    "online/offline",
    "online",
  ],
  major_repair: ["major_repair", "major repair", "majorRepair"],
  updated_at: ["updated_at", "updated at", "updatedAt", "updated"],
  updated_by: ["updated_by", "updated by", "updatedBy"],
};

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
  "Hydraulic leak",
  "Electrical fault",
  "Engine fault",
  "Transmission fault",
  "Brake fault",
  "Accident damage",
  "Reverse alarm",
  "Awaiting spares",
];

function clean(value: any) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function normalizedColumn(value: string) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleCase(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function num(value: any) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function boolish(value: any) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;

  const text = clean(value).toLowerCase();
  return ["true", "yes", "y", "1", "major", "major repair"].includes(text);
}

function pickField(row: any, aliases: string[]) {
  const keyMap: Record<string, string> = {};

  Object.keys(row || {}).forEach((key) => {
    keyMap[normalizedColumn(key)] = key;
  });

  for (const alias of aliases) {
    const actualKey = keyMap[normalizedColumn(alias)];
    if (actualKey !== undefined) {
      return { key: actualKey, value: row[actualKey] };
    }
  }

  return { key: "", value: "" };
}

function findColumn(columns: string[], aliases: string[]) {
  const keyMap: Record<string, string> = {};

  columns.forEach((key) => {
    keyMap[normalizedColumn(key)] = key;
  });

  for (const alias of aliases) {
    const actualKey = keyMap[normalizedColumn(alias)];
    if (actualKey !== undefined) return actualKey;
  }

  return "";
}

function canonicalFleet(value: any) {
  return clean(value).toUpperCase().replace(/\s+/g, " ");
}

function machineKey(machine: Machine) {
  return canonicalFleet(machine.fleet);
}

function isBadFleet(value: any) {
  const fleet = canonicalFleet(value);
  const basic = fleet.toLowerCase();

  if (!fleet) return true;
  if (fleet.length > 35) return true;
  if (!/[a-z0-9]/i.test(fleet)) return true;

  const badHeaders = new Set([
    "fleet",
    "fleet no",
    "fleet number",
    "machine",
    "machine no",
    "machine number",
    "unit",
    "unit no",
    "unit number",
    "registration",
    "reg",
    "reg no",
    "status",
    "type",
    "department",
    "location",
    "total",
    "grand total",
    "undefined",
    "null",
  ]);

  return badHeaders.has(basic);
}

function inferTypeFromFleet(fleet: string) {
  const match = canonicalFleet(fleet).match(/^[A-Z]+/);
  return match ? match[0] : "Machine";
}

function normalizeStatus(rawStatus: any, rawOnline: any) {
  const status = clean(rawStatus).toLowerCase();
  const online = clean(rawOnline).toLowerCase();

  if (status.includes("major")) return "Major Repair";
  if (status.includes("maint")) return "Maintenance";
  if (status.includes("repair")) return "Repair";
  if (status.includes("break") || status.includes("down")) return "Down";
  if (status.includes("stand")) return "Standby";
  if (status.includes("avail") || status.includes("online")) return "Available";
  if (status.includes("offline")) return "Down";
  if (!status && online.includes("offline")) return "Down";
  if (!status) return "Available";

  return titleCase(status);
}

function normalizeOnline(rawOnline: any, status: string) {
  const online = clean(rawOnline).toLowerCase();

  if (online.includes("offline")) return "Offline";
  if (online.includes("online")) return "Online";

  return status === "Available" ? "Online" : "Offline";
}

function normalizeRow(row: any): Machine {
  const fleetField = pickField(row, FIELD_ALIASES.fleet);
  const typeField = pickField(row, FIELD_ALIASES.type);
  const machineField = pickField(row, FIELD_ALIASES.machine);
  const statusField = pickField(row, FIELD_ALIASES.status);
  const departmentField = pickField(row, FIELD_ALIASES.department);
  const locationField = pickField(row, FIELD_ALIASES.location);
  const availabilityField = pickField(row, FIELD_ALIASES.availability);
  const hoursWorkedField = pickField(row, FIELD_ALIASES.hours_worked);
  const hoursDownField = pickField(row, FIELD_ALIASES.hours_down);
  const downtimeReasonField = pickField(row, FIELD_ALIASES.downtime_reason);
  const repairReasonField = pickField(row, FIELD_ALIASES.repair_reason);
  const sparesEtaField = pickField(row, FIELD_ALIASES.spares_eta);
  const onlineField = pickField(row, FIELD_ALIASES.online_status);
  const majorRepairField = pickField(row, FIELD_ALIASES.major_repair);
  const updatedAtField = pickField(row, FIELD_ALIASES.updated_at);
  const updatedByField = pickField(row, FIELD_ALIASES.updated_by);

  const fleet = canonicalFleet(fleetField.value);
  const rawStatus = statusField.value;
  const status = normalizeStatus(rawStatus, onlineField.value);
  const onlineStatus = normalizeOnline(onlineField.value, status);
  const type = clean(typeField.value) || inferTypeFromFleet(fleet);

  return {
    ...row,
    id: row.id,
    fleet,
    type,
    machine: clean(machineField.value) || type,
    machine_type: type,
    status,
    department: clean(departmentField.value) || "Workshop",
    location: clean(locationField.value) || "Hwange",
    availability:
      availabilityField.value !== "" && availabilityField.value !== null
        ? availabilityField.value
        : status === "Available"
        ? 100
        : 0,
    hours_worked:
      hoursWorkedField.value !== "" && hoursWorkedField.value !== null
        ? hoursWorkedField.value
        : "",
    hours_down:
      hoursDownField.value !== "" && hoursDownField.value !== null
        ? hoursDownField.value
        : 0,
    downtime_reason: clean(downtimeReasonField.value),
    repair_reason: clean(repairReasonField.value),
    spares_eta: clean(sparesEtaField.value),
    online_status: onlineStatus,
    major_repair: boolish(majorRepairField.value) || status === "Major Repair",
    updated_at: clean(updatedAtField.value),
    updated_by: clean(updatedByField.value) || "Control",
    __fleet_column: fleetField.key || "fleet",
    __fleet_value: clean(fleetField.value),
  };
}

function prepareMachines(rows: any[]) {
  const byFleet = new Map<string, { machine: Machine; index: number }>();

  rows
    .map(normalizeRow)
    .filter((machine) => !isBadFleet(machine.fleet))
    .forEach((machine, index) => {
      const key = machineKey(machine);
      const previous = byFleet.get(key);

      if (!previous) {
        byFleet.set(key, { machine, index });
        return;
      }

      const previousTime = Date.parse(clean(previous.machine.updated_at)) || 0;
      const currentTime = Date.parse(clean(machine.updated_at)) || 0;

      if (currentTime > previousTime) {
        byFleet.set(key, { machine, index });
        return;
      }

      if (currentTime === previousTime && index > previous.index) {
        byFleet.set(key, { machine, index });
      }
    });

  return Array.from(byFleet.values())
    .map((item) => item.machine)
    .sort((a, b) => {
      const typeCompare = clean(a.type).localeCompare(clean(b.type), undefined, {
        numeric: true,
        sensitivity: "base",
      });

      if (typeCompare !== 0) return typeCompare;

      return clean(a.fleet).localeCompare(clean(b.fleet), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function tableScore(table: string, rows: any[], machines: Machine[]) {
  const columns = Object.keys(rows[0] || {});
  let score = machines.length;

  if (findColumn(columns, FIELD_ALIASES.status)) score += 100;
  if (findColumn(columns, FIELD_ALIASES.availability)) score += 100;
  if (findColumn(columns, FIELD_ALIASES.online_status)) score += 60;
  if (findColumn(columns, FIELD_ALIASES.hours_down)) score += 40;
  if (findColumn(columns, FIELD_ALIASES.downtime_reason)) score += 40;

  const priority = MAIN_REGISTER_TABLES.length - MAIN_REGISTER_TABLES.indexOf(table);
  return score + priority * 10000;
}

function isOfflineOrRepair(machine: Machine) {
  const status = clean(machine.status).toLowerCase();
  const online = clean(machine.online_status).toLowerCase();

  return (
    online === "offline" ||
    machine.major_repair === true ||
    status.includes("down") ||
    status.includes("repair") ||
    status.includes("maintenance") ||
    status.includes("major")
  );
}

function statusClass(status: string) {
  const s = clean(status).toLowerCase();

  if (s.includes("available")) return "good";
  if (s.includes("major")) return "major";
  if (s.includes("repair")) return "repair";
  if (s.includes("maint")) return "maintenance";
  if (s.includes("down")) return "down";

  return "neutral";
}

export default function MachineControlPage() {
  const selectedKeyRef = useRef("");

  const [loggedIn, setLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tableName, setTableName] = useState("");
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    const saved = sessionStorage.getItem("turbo_machine_control_login");
    if (saved === "true") setLoggedIn(true);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const name = loginName.trim().toLowerCase();
    const pass = loginPassword.trim();

    if ((name === "controle" || name === "control" || name === "foreman") && pass === "1234") {
      sessionStorage.setItem("turbo_machine_control_login", "true");
      setLoggedIn(true);
      setLoginError("");
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

  async function loadMachines(showLoading = true) {
    if (showLoading) setLoading(true);
    setMessage("");

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage("Supabase environment variables are missing on Vercel.");
      setLoading(false);
      return;
    }

    const foundRegisters: Array<{
      table: string;
      rows: any[];
      machines: Machine[];
      score: number;
    }> = [];

    for (const table of MAIN_REGISTER_TABLES) {
      const { data, error } = await supabase.from(table).select("*").limit(5000);

      if (error || !data || data.length === 0) continue;

      const cleaned = prepareMachines(data);
      if (cleaned.length === 0) continue;

      foundRegisters.push({
        table,
        rows: data,
        machines: cleaned,
        score: tableScore(table, data, cleaned),
      });
    }

    if (foundRegisters.length === 0) {
      setMachines([]);
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
      setTableName("");
      setTableColumns([]);
      setMessage(
        "No main availability register found. This page is locked to machine_availability / machine_availability_register / availability_register so it does not pull wrong data from the other apps."
      );
      setLastRefresh(new Date().toLocaleTimeString());
      setLoading(false);
      return;
    }

    foundRegisters.sort((a, b) => b.score - a.score);
    const chosen = foundRegisters[0];
    const loaded = chosen.machines;
    const keepKey = selectedKeyRef.current;

    setTableName(chosen.table);
    setTableColumns(Object.keys(chosen.rows[0] || {}));
    setMachines(loaded);
    setLastRefresh(new Date().toLocaleTimeString());

    if (loaded.length > 0) {
      const kept = keepKey ? loaded.find((machine) => machineKey(machine) === keepKey) : null;
      const target = kept || loaded[0];

      setSelectedKey(machineKey(target));
      selectedKeyRef.current = machineKey(target);
      setDraft(target);
    } else {
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadMachines();

    const timer = setInterval(() => {
      loadMachines(false);
    }, 30000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tableName) return;

    const channel = supabase
      .channel(`machine-control-${tableName}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
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
  }, [tableName]);

  const searchedMachines = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return machines;

    return machines.filter((machine) =>
      [
        machine.fleet,
        machine.type,
        machine.machine,
        machine.machine_type,
        machine.status,
        machine.department,
        machine.location,
        machine.online_status,
        machine.downtime_reason,
        machine.repair_reason,
        machine.spares_eta,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [machines, search]);

  const offlineMachines = useMemo(() => machines.filter(isOfflineOrRepair), [machines]);

  const stats = useMemo(() => {
    const total = machines.length;
    const offline = offlineMachines.length;
    const online = total - offline;
    const major = machines.filter(
      (machine) => machine.major_repair === true || clean(machine.status).toLowerCase().includes("major")
    ).length;

    return { total, online, offline, major };
  }, [machines, offlineMachines]);

  useEffect(() => {
    if (searchedMachines.length === 0) {
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
      return;
    }

    const stillVisible = searchedMachines.find((machine) => machineKey(machine) === selectedKey);

    if (stillVisible) {
      setDraft(stillVisible);
    } else {
      const first = searchedMachines[0];
      setSelectedKey(machineKey(first));
      selectedKeyRef.current = machineKey(first);
      setDraft(first);
    }
  }, [searchedMachines, selectedKey]);

  function writePayloadValue(payload: any, fieldName: string, value: any) {
    if (value === undefined) return;

    const column = findColumn(tableColumns, FIELD_ALIASES[fieldName] || [fieldName]);
    if (column) payload[column] = value;
  }

  function buildUpdatePayload(patch: Partial<Machine>) {
    const payload: any = {};

    writePayloadValue(payload, "status", patch.status);
    writePayloadValue(payload, "department", patch.department);
    writePayloadValue(payload, "location", patch.location);
    writePayloadValue(payload, "availability", patch.availability);
    writePayloadValue(payload, "hours_worked", patch.hours_worked);
    writePayloadValue(payload, "hours_down", patch.hours_down);
    writePayloadValue(payload, "downtime_reason", patch.downtime_reason);
    writePayloadValue(payload, "repair_reason", patch.repair_reason);
    writePayloadValue(payload, "spares_eta", patch.spares_eta);
    writePayloadValue(payload, "online_status", patch.online_status);
    writePayloadValue(payload, "major_repair", patch.major_repair);

    const updatedAtColumn = findColumn(tableColumns, FIELD_ALIASES.updated_at);
    const updatedByColumn = findColumn(tableColumns, FIELD_ALIASES.updated_by);

    if (updatedAtColumn) payload[updatedAtColumn] = new Date().toISOString();
    if (updatedByColumn) payload[updatedByColumn] = "Control";

    return payload;
  }

  async function updateMachine(machine: Machine, patch: Partial<Machine>) {
    if (!tableName) {
      setMessage("No Supabase availability table selected. Refresh first.");
      return;
    }

    const saveKey = machineKey(machine);
    setSavingId(saveKey);

    const nextMachine = normalizeRow({
      ...machine,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: "Control",
    });

    setMachines((previous) =>
      previous.map((item) => (machineKey(item) === saveKey ? nextMachine : item))
    );

    setDraft(nextMachine);
    setSelectedKey(machineKey(nextMachine));
    selectedKeyRef.current = machineKey(nextMachine);

    const payload = buildUpdatePayload(patch);

    if (Object.keys(payload).length === 0) {
      setMessage("No matching writable columns found in the selected availability table.");
      setSavingId(null);
      await loadMachines(false);
      return;
    }

    let query = supabase.from(tableName).update(payload);

    if (machine.id !== undefined && machine.id !== null && tableColumns.includes("id")) {
      query = query.eq("id", machine.id);
    } else {
      const fleetColumn = machine.__fleet_column || findColumn(tableColumns, FIELD_ALIASES.fleet) || "fleet";
      query = query.eq(fleetColumn, machine.__fleet_value || machine.fleet);
    }

    const { error } = await query;

    if (error) {
      setMessage(`Update failed: ${error.message}`);
      await loadMachines(false);
    } else {
      setMessage(`${machine.fleet} updated and saved to ${tableName}.`);
      await loadMachines(false);
    }

    setSavingId(null);
  }

  async function saveDraft() {
    if (!draft) return;

    await updateMachine(draft, {
      status: draft.status,
      department: draft.department,
      location: draft.location,
      availability: draft.availability,
      hours_worked: draft.hours_worked,
      hours_down: draft.hours_down,
      downtime_reason: draft.downtime_reason,
      repair_reason: draft.repair_reason,
      spares_eta: draft.spares_eta,
      online_status: draft.online_status,
      major_repair: draft.status === "Major Repair" || draft.major_repair === true,
    });
  }

  async function bookOnline(machine: Machine) {
    await updateMachine(machine, {
      status: "Available",
      online_status: "Online",
      availability: 100,
      hours_down: 0,
      downtime_reason: "",
      repair_reason: "",
      spares_eta: "",
      major_repair: false,
    });
  }

  async function bookOffline(machine: Machine) {
    await updateMachine(machine, {
      status: "Down",
      online_status: "Offline",
      availability: 0,
      downtime_reason: machine.downtime_reason || "Booked offline by control",
      major_repair: false,
    });
  }

  function updateDraft(patch: Partial<Machine>) {
    setDraft((previous) => (previous ? normalizeRow({ ...previous, ...patch }) : previous));
  }

  function selectMachine(key: string) {
    setSelectedKey(key);
    selectedKeyRef.current = key;
    const found = searchedMachines.find((machine) => machineKey(machine) === key);
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
              <input
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                placeholder="controle"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="1234"
              />
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
          <p>
            Search one machine, update its status, book online/offline, and monitor current breakdowns from the live main availability register.
          </p>
        </div>

        <div className="heroActions">
          <button className="btn whiteBtn" onClick={() => loadMachines()}>
            Refresh
          </button>
          <button className="btn outlineBtn" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      {message && <section className="notice">{message}</section>}

      <section className="sourceNotice">
        Live source: <strong>{tableName || "main availability register"}</strong> · Last refresh: {lastRefresh || "-"}
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
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Example: FEL05, TRL05, HT19..."
              />
            </label>

            <button className="btn smallBtn clearBtn" onClick={() => setSearch("")} type="button">
              Clear
            </button>
          </div>

          <label>
            Select machine ({searchedMachines.length} found)
            <select
              value={selectedKey}
              onChange={(event) => selectMachine(event.target.value)}
              disabled={searchedMachines.length === 0}
            >
              {searchedMachines.map((machine) => (
                <option key={machineKey(machine)} value={machineKey(machine)}>
                  {machine.fleet} - {machine.type} - {machine.status}
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
                    {draft.fleet} - {draft.machine || draft.type}
                  </h3>
                  <p>
                    {draft.department} · {draft.location || "-"}
                  </p>
                </div>
                <span className={`pill ${statusClass(draft.status)}`}>{draft.status}</span>
              </div>

              <div className="quickActions">
                <button
                  className="btn greenBtn"
                  onClick={() => bookOnline(draft)}
                  disabled={savingId === machineKey(draft)}
                >
                  Book Online
                </button>

                <button
                  className="btn blueBtn"
                  onClick={() => bookOffline(draft)}
                  disabled={savingId === machineKey(draft)}
                >
                  Book Offline
                </button>
              </div>

              <div className="sectionTitle">Machine Status</div>

              <div className="formGrid">
                <label>
                  Department
                  <select value={draft.department} onChange={(event) => updateDraft({ department: event.target.value })}>
                    {departments.map((department) => (
                      <option key={department}>{department}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      updateDraft({
                        status: event.target.value,
                        online_status: event.target.value === "Available" ? "Online" : "Offline",
                        availability: event.target.value === "Available" ? 100 : 0,
                        major_repair: event.target.value === "Major Repair",
                      })
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Online / Offline
                  <select value={draft.online_status || "Online"} onChange={(event) => updateDraft({ online_status: event.target.value })}>
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                </label>

                <label>
                  Availability %
                  <input value={draft.availability ?? ""} onChange={(event) => updateDraft({ availability: event.target.value })} />
                </label>

                <label>
                  Hours Worked
                  <input value={draft.hours_worked ?? ""} onChange={(event) => updateDraft({ hours_worked: event.target.value })} />
                </label>

                <label>
                  Hours Down
                  <input value={draft.hours_down ?? ""} onChange={(event) => updateDraft({ hours_down: event.target.value })} />
                </label>
              </div>

              <div className="sectionTitle">Downtime Details</div>

              <div className="formGrid">
                <label>
                  Quick Downtime Reason
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) updateDraft({ downtime_reason: event.target.value });
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
                  <input value={draft.downtime_reason ?? ""} onChange={(event) => updateDraft({ downtime_reason: event.target.value })} />
                </label>

                <label>
                  Repair Reason / Work Required
                  <input value={draft.repair_reason ?? ""} onChange={(event) => updateDraft({ repair_reason: event.target.value })} />
                </label>

                <label>
                  ETA / Spares
                  <input
                    value={draft.spares_eta ?? ""}
                    onChange={(event) => updateDraft({ spares_eta: event.target.value })}
                    placeholder="Example: Awaiting spares, 14 May..."
                  />
                </label>

                <label>
                  Location
                  <input value={draft.location ?? ""} onChange={(event) => updateDraft({ location: event.target.value })} />
                </label>
              </div>

              <div className="saveRow">
                <span>
                  Fleet key: {machineKey(draft)} {tableName ? `| ${tableName}` : ""}
                </span>

                <button className="btn whiteBtn saveBtn" onClick={saveDraft} disabled={savingId === machineKey(draft)}>
                  {savingId === machineKey(draft) ? "Saving..." : "Save Updates"}
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
                      Loading Supabase register...
                    </td>
                  </tr>
                ) : offlineMachines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty">
                      No machines booked offline.
                    </td>
                  </tr>
                ) : (
                  offlineMachines.map((machine) => (
                    <tr
                      key={`${machineKey(machine)}-offline`}
                      className="clickableRow"
                      onClick={() => {
                        setSearch(machine.fleet);
                        setSelectedKey(machineKey(machine));
                        selectedKeyRef.current = machineKey(machine);
                        setDraft(machine);
                      }}
                    >
                      <td>
                        <button className="fleetBtn" type="button">
                          {machine.fleet}
                        </button>
                      </td>
                      <td>{machine.type}</td>
                      <td>{machine.department}</td>
                      <td>
                        <span className={`pill ${statusClass(machine.status)}`}>{machine.status}</span>
                      </td>
                      <td>{machine.online_status || "-"}</td>
                      <td>{num(machine.hours_down).toFixed(1)}</td>
                      <td>{machine.downtime_reason || "-"}</td>
                      <td>{machine.repair_reason || "-"}</td>
                      <td>{machine.spares_eta || "-"}</td>
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
  .sourceNotice,
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

  .notice,
  .sourceNotice {
    background: rgba(2, 8, 23, 0.88);
    border-left: 6px solid #38bdf8;
    color: #ffffff;
    padding: 13px 18px;
    border-radius: 12px;
    font-weight: 800;
  }

  .sourceNotice {
    border-left-color: #f59e0b;
    color: #dbeafe;
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
    max-height: calc(100vh - 280px);
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

