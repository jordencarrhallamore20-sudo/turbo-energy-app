"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// IMPORTANT: one fixed live table only. Do not scan other app tables.
const LIVE_TABLE = "machine_availability_live";

const LOCAL_STORAGE_KEYS = [
  "turboMachineData",
  "turbo_machine_data",
  "machineAvailabilityData",
  "machine_availability_data",
  "availabilityRegister",
  "machineRegister",
  "machines",
];

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
  "Awaiting spares",
  "No power",
  "Gearbox",
  "Filtration",
  "Reverse alarm",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function toNumber(value: any, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const cleaned = String(value).replace(/,/g, ".").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function oneDecimal(value: any) {
  return toNumber(value, 0).toFixed(1);
}

function getValue(row: any, names: string[]) {
  if (!row || typeof row !== "object") return "";

  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && clean(row[name]) !== "") {
      return row[name];
    }
  }

  const keys = Object.keys(row);
  const normalisedNames = names.map((name) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  for (const key of keys) {
    const nk = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalisedNames.includes(nk) && clean(row[key]) !== "") return row[key];
  }

  return "";
}

function deriveTypeFromFleet(fleet: string) {
  const match = clean(fleet).toUpperCase().match(/^[A-Z]+/);
  return match?.[0] || clean(fleet).toUpperCase();
}

function normaliseStatus(value: any) {
  const raw = clean(value) || "Available";
  const s = raw.toLowerCase();

  if (s.includes("major")) return "Major Repair";
  if (s.includes("maint")) return "Maintenance";
  if (s.includes("repair")) return "Repair";
  if (s.includes("down") || s.includes("break")) return "Down";
  if (s.includes("stand")) return "Standby";
  if (s.includes("avail") || s.includes("online")) return "Available";

  return raw;
}

function normaliseOnlineStatus(value: any, status: string) {
  const raw = clean(value);
  const s = raw.toLowerCase();

  if (s.includes("off")) return "Offline";
  if (s.includes("on")) return "Online";
  return status === "Available" ? "Online" : "Offline";
}

function isBadFleet(value: string) {
  const v = lower(value);
  return (
    !v ||
    v === "fleet" ||
    v === "fleet no" ||
    v === "fleet number" ||
    v === "machine" ||
    v === "machine no" ||
    v === "unit" ||
    v === "registration" ||
    v.includes("total machine") ||
    v.includes("turbo energy")
  );
}

function normalize(row: any): Machine | null {
  if (!row || typeof row !== "object") return null;

  const fleet = clean(
    getValue(row, [
      "fleet",
      "Fleet",
      "fleet_no",
      "fleetNo",
      "fleet_number",
      "fleetNumber",
      "machine_number",
      "machineNumber",
      "unit",
      "Unit",
      "registration",
      "Registration",
      "field0",
      "0",
    ])
  ).toUpperCase();

  if (isBadFleet(fleet)) return null;

  const type = clean(
    getValue(row, [
      "type",
      "Type",
      "machine_type",
      "machineType",
      "category",
      "Category",
      "group",
      "Group",
      "field1",
      "1",
    ]) || deriveTypeFromFleet(fleet)
  ).toUpperCase();

  const status = normaliseStatus(
    getValue(row, ["status", "Status", "machine_status", "machineStatus", "condition", "field3", "3"])
  );

  const onlineStatus = normaliseOnlineStatus(
    getValue(row, [
      "online_status",
      "onlineStatus",
      "online_offline",
      "onlineOffline",
      "online",
      "Online",
      "field4",
      "4",
    ]),
    status
  );

  const availabilityRaw = getValue(row, [
    "availability",
    "Availability",
    "availability_percent",
    "availabilityPercent",
    "availability_percentage",
    "availabilityPercentage",
    "percent",
    "Percent",
    "field9",
    "9",
  ]);

  const majorRepair =
    Boolean(getValue(row, ["major_repair", "majorRepair"])) ||
    status.toLowerCase().includes("major");

  return {
    ...row,
    id: row.id,
    fleet,
    type,
    machine: clean(getValue(row, ["machine", "Machine", "name", "Name", "field1", "1"])) || type,
    machine_type: type,
    status,
    department:
      clean(getValue(row, ["department", "Department", "dept", "Dept", "field2", "2"])) ||
      "Workshop",
    location: clean(getValue(row, ["location", "Location", "site", "Site"])) || "Hwange",
    availability:
      availabilityRaw !== "" ? toNumber(availabilityRaw, status === "Available" ? 100 : 0) : status === "Available" ? 100 : 0,
    hours_worked: toNumber(
      getValue(row, ["hours_worked", "hoursWorked", "worked_hours", "workedHours", "hours worked"]),
      0
    ),
    hours_down: toNumber(
      getValue(row, ["hours_down", "hoursDown", "downtime_hours", "downtimeHours", "hours", "Hours", "field5", "5"]),
      0
    ),
    downtime_reason: clean(
      getValue(row, [
        "downtime_reason",
        "downtimeReason",
        "reason",
        "Reason",
        "breakdown_reason",
        "breakdownReason",
        "field6",
        "6",
      ])
    ),
    repair_reason: clean(
      getValue(row, [
        "repair_reason",
        "repairReason",
        "work_required",
        "workRequired",
        "repair",
        "Repair",
        "field7",
        "7",
      ])
    ),
    spares_eta: clean(
      getValue(row, ["spares_eta", "sparesEta", "eta", "ETA", "spares", "Spares", "field8", "8"])
    ),
    online_status: onlineStatus,
    major_repair: majorRepair,
    updated_at: row.updated_at || row.updatedAt,
    updated_by: row.updated_by || row.updatedBy || "Control",
    raw: row.raw || row,
  };
}

function uniqueMachines(rows: any[]) {
  const map = new Map<string, Machine>();

  rows.forEach((row) => {
    const machine = normalize(row);
    if (!machine) return;
    map.set(machine.fleet, machine);
  });

  return Array.from(map.values()).sort((a, b) => a.fleet.localeCompare(b.fleet));
}

function machineKey(machine: Machine) {
  return clean(machine.fleet);
}

function isOfflineOrRepair(machine: Machine) {
  const status = lower(machine.status);
  const online = lower(machine.online_status);

  return (
    online === "offline" ||
    status.includes("down") ||
    status.includes("repair") ||
    status.includes("maintenance") ||
    status.includes("major")
  );
}

function statusClass(status: string) {
  const s = lower(status);

  if (s.includes("available")) return "good";
  if (s.includes("major")) return "major";
  if (s.includes("repair")) return "repair";
  if (s.includes("maint")) return "maintenance";
  if (s.includes("down")) return "down";

  return "neutral";
}

function tryParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractArrayFromObject(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const candidates = [
    value.machines,
    value.data,
    value.rows,
    value.register,
    value.machineData,
    value.machineRegister,
    value.availabilityData,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }

  return [];
}

function readDashboardLocalRegister(): Machine[] {
  if (typeof window === "undefined") return [];

  let best: any[] = [];

  for (const key of LOCAL_STORAGE_KEYS) {
    const parsed = tryParseJson(window.localStorage.getItem(key));
    const rows = extractArrayFromObject(parsed);
    if (rows.length > best.length) best = rows;
  }

  // fallback: scan only likely dashboard keys, not login/session keys
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i) || "";
    const safeKey = key.toLowerCase();
    if (
      !safeKey.includes("machine") &&
      !safeKey.includes("availability") &&
      !safeKey.includes("turbo") &&
      !safeKey.includes("fleet")
    ) {
      continue;
    }
    if (safeKey.includes("login") || safeKey.includes("password") || safeKey.includes("auth")) continue;

    const parsed = tryParseJson(window.localStorage.getItem(key));
    const rows = extractArrayFromObject(parsed);
    if (rows.length > best.length) best = rows;
  }

  return uniqueMachines(best);
}

function writeLocalDashboardRegister(machines: Machine[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("turboMachineData", JSON.stringify(machines));
    window.localStorage.setItem("turbo_machine_data", JSON.stringify(machines));
  } catch {
    // local storage can fail in private browsing; live Supabase remains source of truth
  }
}

function toSupabasePayload(machine: Machine) {
  const normal = normalize(machine) || machine;
  const status = normaliseStatus(normal.status);
  const online_status = normaliseOnlineStatus(normal.online_status, status);

  return {
    fleet: clean(normal.fleet).toUpperCase(),
    type: clean(normal.type || deriveTypeFromFleet(normal.fleet)).toUpperCase(),
    machine: clean(normal.machine || normal.machine_type || normal.type || normal.fleet),
    machine_type: clean(normal.machine_type || normal.type || deriveTypeFromFleet(normal.fleet)).toUpperCase(),
    status,
    department: clean(normal.department || "Workshop"),
    location: clean(normal.location || "Hwange"),
    availability: toNumber(normal.availability, status === "Available" ? 100 : 0),
    hours_worked: toNumber(normal.hours_worked, 0),
    hours_down: toNumber(normal.hours_down, 0),
    downtime_reason: clean(normal.downtime_reason),
    repair_reason: clean(normal.repair_reason),
    spares_eta: clean(normal.spares_eta),
    online_status,
    major_repair: Boolean(normal.major_repair) || status === "Major Repair",
    updated_at: new Date().toISOString(),
    updated_by: clean(normal.updated_by || "Control"),
    raw: normal.raw || normal,
  };
}

async function upsertMachines(rows: Machine[]) {
  if (!supabase) throw new Error("Supabase environment variables are missing.");

  const payload = uniqueMachines(rows).map(toSupabasePayload);
  if (payload.length === 0) return;

  const chunkSize = 200;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from(LIVE_TABLE).upsert(chunk, { onConflict: "fleet" });
    if (error) throw error;
  }
}

export default function ForemanMachineControlPage() {
  const selectedKeyRef = useRef("");

  const [loggedIn, setLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [liveReady, setLiveReady] = useState(false);

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

  const loadMachines = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setMessage("");
    setWarning("");

    if (!supabase) {
      const localRows = readDashboardLocalRegister();
      setMachines(localRows);
      writeLocalDashboardRegister(localRows);
      setLiveReady(false);
      setWarning("Supabase env keys are missing on Vercel. This page can read this browser only, but other phones will not update until env keys are fixed.");
      setLastRefresh(new Date().toLocaleTimeString());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from(LIVE_TABLE)
      .select("*")
      .order("fleet", { ascending: true })
      .limit(3000);

    if (error) {
      const localRows = readDashboardLocalRegister();
      setMachines(localRows);
      writeLocalDashboardRegister(localRows);
      setLiveReady(false);
      setWarning(
        `Live database table problem: ${error.message}. Create the ${LIVE_TABLE} table with the SQL below, then press Refresh.`
      );
      setLastRefresh(new Date().toLocaleTimeString());
      setLoading(false);
      return;
    }

    let loaded = uniqueMachines(data || []);

    // First run: if the live table is empty but the dashboard has data in this browser,
    // seed the live database once so every phone starts seeing the same register.
    if (loaded.length === 0) {
      const localRows = readDashboardLocalRegister();
      if (localRows.length > 0) {
        try {
          await upsertMachines(localRows);
          const reread = await supabase
            .from(LIVE_TABLE)
            .select("*")
            .order("fleet", { ascending: true })
            .limit(3000);

          if (!reread.error) {
            loaded = uniqueMachines(reread.data || []);
            setMessage(`Synced ${loaded.length} machines from this dashboard browser to the live database.`);
          }
        } catch (syncError: any) {
          loaded = localRows;
          setWarning(`Could not sync local dashboard register to Supabase: ${syncError.message || syncError}`);
        }
      }
    }

    setMachines(loaded);
    writeLocalDashboardRegister(loaded);
    setLiveReady(true);
    setLastRefresh(new Date().toLocaleTimeString());

    const keepKey = selectedKeyRef.current;
    if (loaded.length > 0) {
      const kept = keepKey ? loaded.find((m) => machineKey(m) === keepKey) : null;
      const target = kept || loaded[0];
      setSelectedKey(machineKey(target));
      selectedKeyRef.current = machineKey(target);
      setDraft(target);
    } else {
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
      setWarning(
        "No live machines found. Open the main dashboard on this same browser once, then come back here and press Refresh so the live database can be seeded."
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadMachines();

    const timer = setInterval(() => {
      loadMachines(false);
    }, 20000);

    return () => clearInterval(timer);
  }, [loadMachines]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`foreman-live-${LIVE_TABLE}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: LIVE_TABLE,
        },
        () => {
          loadMachines(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMachines]);

  const searchedMachines = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return machines;

    return machines.filter((m) =>
      [
        m.fleet,
        m.type,
        m.machine,
        m.machine_type,
        m.status,
        m.department,
        m.location,
        m.online_status,
        m.downtime_reason,
        m.repair_reason,
        m.spares_eta,
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
    const major = machines.filter((m) => lower(m.status).includes("major") || m.major_repair).length;

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

  async function updateMachine(machine: Machine, patch: Partial<Machine>) {
    const nextMachine = normalize({
      ...machine,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: "Foreman",
    });

    if (!nextMachine) return;

    setSavingId(nextMachine.fleet);
    setMessage("");
    setWarning("");

    const nextList = uniqueMachines(
      machines.map((m) => (machineKey(m) === machineKey(machine) ? nextMachine : m))
    );

    setMachines(nextList);
    writeLocalDashboardRegister(nextList);
    setDraft(nextMachine);
    setSelectedKey(machineKey(nextMachine));
    selectedKeyRef.current = machineKey(nextMachine);

    if (!supabase) {
      setWarning("Saved only on this browser because Supabase env keys are missing. Other phones will not update yet.");
      setSavingId(null);
      return;
    }

    const { error } = await supabase
      .from(LIVE_TABLE)
      .upsert(toSupabasePayload(nextMachine), { onConflict: "fleet" });

    if (error) {
      setWarning(`Live save failed: ${error.message}`);
      await loadMachines(false);
    } else {
      setMessage(`${nextMachine.fleet} saved live. Other phones will update after Refresh or automatically.`);
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
      major_repair: draft.status === "Major Repair",
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
      downtime_reason: machine.downtime_reason || "Booked offline by foreman",
      major_repair: false,
    });
  }

  async function syncDashboardToLive() {
    const localRows = readDashboardLocalRegister();
    if (localRows.length === 0) {
      setWarning("No dashboard register was found in this browser. Open the main dashboard first, then return here.");
      return;
    }

    setLoading(true);
    setMessage("");
    setWarning("");

    try {
      await upsertMachines(localRows);
      setMessage(`Synced ${localRows.length} dashboard machines to the live Supabase register.`);
      await loadMachines(false);
    } catch (error: any) {
      setWarning(`Sync failed: ${error.message || error}`);
    }

    setLoading(false);
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
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
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
          <p>Live foreman page. Saves to Supabase so all phones and computers see the same machine status.</p>
        </div>

        <div className="heroActions">
          <button className="btn orangeBtn" onClick={syncDashboardToLive} disabled={loading}>
            Sync Dashboard
          </button>
          <button className="btn whiteBtn" onClick={() => loadMachines()} disabled={loading}>
            Refresh
          </button>
          <button className="btn outlineBtn" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      {warning && <section className="notice warningNotice">{warning}</section>}
      {message && <section className="notice">{message}</section>}

      <section className="sourceBar">
        Live source: {LIVE_TABLE} · {liveReady ? "Supabase live" : "Browser fallback"} · Last refresh: {lastRefresh || "-"}
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Example: FEL05, TRL05, HT19..."
              />
            </label>

            <button className="btn smallBtn clearBtn" onClick={() => setSearch("")} type="button">
              Clear
            </button>
          </div>

          <label>
            Select machine ({searchedMachines.length} found)
            <select value={selectedKey} onChange={(e) => selectMachine(e.target.value)}>
              {searchedMachines.map((m) => (
                <option key={machineKey(m)} value={machineKey(m)}>
                  {m.fleet} - {m.type} - {m.status}
                </option>
              ))}
            </select>
          </label>

          {!draft ? (
            <div className="emptyCard">{loading ? "Loading live register..." : "No machine found."}</div>
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
                <button className="btn greenBtn" onClick={() => bookOnline(draft)} disabled={savingId === draft.fleet}>
                  Book Online
                </button>

                <button className="btn blueBtn" onClick={() => bookOffline(draft)} disabled={savingId === draft.fleet}>
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
                    value={draft.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      updateDraft({
                        status: newStatus,
                        online_status: newStatus === "Available" ? "Online" : "Offline",
                        availability: newStatus === "Available" ? 100 : 0,
                        major_repair: newStatus === "Major Repair",
                      });
                    }}
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Online / Offline
                  <select value={draft.online_status || "Online"} onChange={(e) => updateDraft({ online_status: e.target.value })}>
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
                  <input value={draft.hours_worked ?? ""} onChange={(e) => updateDraft({ hours_worked: e.target.value })} />
                </label>

                <label>
                  Hours Down
                  <input value={draft.hours_down ?? ""} onChange={(e) => updateDraft({ hours_down: e.target.value })} />
                </label>
              </div>

              <div className="sectionTitle">Downtime Details</div>

              <div className="formGrid">
                <label>
                  Quick Downtime Reason
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) updateDraft({ downtime_reason: e.target.value });
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
                  <input value={draft.downtime_reason ?? ""} onChange={(e) => updateDraft({ downtime_reason: e.target.value })} />
                </label>

                <label>
                  Repair Reason / Work Required
                  <input value={draft.repair_reason ?? ""} onChange={(e) => updateDraft({ repair_reason: e.target.value })} />
                </label>

                <label>
                  ETA / Spares
                  <input
                    value={draft.spares_eta ?? ""}
                    onChange={(e) => updateDraft({ spares_eta: e.target.value })}
                    placeholder="Example: Awaiting spares, 14 May..."
                  />
                </label>

                <label>
                  Location
                  <input value={draft.location ?? ""} onChange={(e) => updateDraft({ location: e.target.value })} />
                </label>
              </div>

              <div className="saveRow">
                <span>Last refresh: {lastRefresh || "-"} | {liveReady ? "live Supabase" : "browser only"}</span>

                <button className="btn whiteBtn saveBtn" onClick={saveDraft} disabled={savingId === draft.fleet}>
                  {savingId === draft.fleet ? "Saving..." : "Save Updates"}
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
                    <td colSpan={9} className="empty">Loading live register...</td>
                  </tr>
                ) : offlineMachines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty">No machines booked offline.</td>
                  </tr>
                ) : (
                  offlineMachines.map((m) => (
                    <tr
                      key={`${m.fleet}-offline`}
                      className="clickableRow"
                      onClick={() => {
                        setSearch(m.fleet);
                        setSelectedKey(machineKey(m));
                        selectedKeyRef.current = machineKey(m);
                        setDraft(m);
                      }}
                    >
                      <td><button className="fleetBtn" type="button">{m.fleet}</button></td>
                      <td>{m.type}</td>
                      <td>{m.department}</td>
                      <td><span className={`pill ${statusClass(m.status)}`}>{m.status}</span></td>
                      <td>{m.online_status || "-"}</td>
                      <td>{oneDecimal(m.hours_down)}</td>
                      <td>{m.downtime_reason || "-"}</td>
                      <td>{m.repair_reason || "-"}</td>
                      <td>{m.spares_eta || "-"}</td>
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
  * { box-sizing: border-box; }

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

  .hero, .notice, .sourceBar, .stats, .workArea { max-width: 1600px; margin: 0 auto 14px auto; }

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

  .eyebrow { letter-spacing: 6px; font-size: 12px; font-weight: 900; margin: 0 0 7px; color: #bfdbfe; }
  h1 { font-size: 34px; line-height: 1; margin: 0 0 8px; }
  .hero p, .panelHeader p { margin: 0; color: #dbeafe; font-size: 14px; }
  .heroActions { display: flex; gap: 10px; flex-wrap: wrap; }

  .btn {
    border: 0;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 900;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }
  .btn:hover { transform: translateY(-1px); }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .whiteBtn { background: #ffffff; color: #020817; }
  .outlineBtn { background: transparent; color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.35); }
  .greenBtn { background: #0f766e; color: #ffffff; }
  .blueBtn { background: #2563eb; color: #ffffff; }
  .orangeBtn { background: #f59e0b; color: #111827; }
  .smallBtn { padding: 11px 14px; }
  .clearBtn { background: #dbeafe; color: #0f172a; }

  .notice, .sourceBar {
    background: rgba(2, 8, 23, 0.88);
    border-left: 6px solid #38bdf8;
    color: #ffffff;
    padding: 13px 18px;
    border-radius: 12px;
    font-weight: 800;
  }
  .warningNotice { border-left-color: #f59e0b; }
  .sourceBar { border-left-color: #f59e0b; }

  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .stat { background: #ffffff; color: #020817; border-radius: 16px; padding: 15px 16px; box-shadow: 0 14px 30px rgba(0,0,0,0.22); }
  .stat span { text-transform: uppercase; color: #475569; font-size: 12px; font-weight: 900; letter-spacing: 0.8px; }
  .stat strong { display: block; font-size: 30px; margin-top: 5px; }
  .greenText { color: #047857; }
  .blueText { color: #2563eb; }
  .amberText { color: #d97706; }

  .workArea { display: grid; grid-template-columns: 470px minmax(0, 1fr); gap: 16px; align-items: start; }
  .controlPanel, .breakdownPanel {
    background: rgba(18, 55, 99, 0.96);
    border: 1px solid rgba(191, 219, 254, 0.22);
    border-radius: 20px;
    padding: 18px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
  }
  .controlPanel { position: sticky; top: 14px; }
  .panelHeader { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
  .panelHeader h2 { margin: 0 0 6px; font-size: 21px; }

  label { display: flex; flex-direction: column; gap: 6px; color: #ffffff; font-size: 12px; font-weight: 900; margin-bottom: 11px; }
  input, select { width: 100%; border: 0; border-radius: 12px; padding: 12px; font-size: 14px; color: #020817; background: #ffffff; outline: none; }
  input:focus, select:focus { box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.42); }
  .searchRow { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }

  .machineFace { margin-top: 13px; background: #1d4b80; border: 1px solid rgba(191, 219, 254, 0.18); border-radius: 18px; padding: 15px; }
  .machineTitle { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 13px; }
  .machineTitle h3 { margin: 0 0 5px; font-size: 20px; }
  .machineTitle p { margin: 0; color: #dbeafe; font-size: 13px; }
  .quickActions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 13px; }
  .sectionTitle { margin: 12px 0 9px; padding: 8px 10px; border-radius: 10px; background: rgba(2,8,23,0.32); color: #dbeafe; font-weight: 900; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; }
  .formGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .saveRow { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #dbeafe; font-size: 12px; }
  .saveBtn { min-width: 140px; }

  .countBadge { background: #1e3a5f; color: #f8fafc; font-size: 22px; font-weight: 900; min-width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; }
  .tableWrap { overflow: auto; border-radius: 14px; max-height: calc(100vh - 260px); }
  table { width: 100%; border-collapse: collapse; background: #1e3f70; min-width: 980px; }
  th { position: sticky; top: 0; z-index: 1; background: #ffffff; color: #020817; text-align: left; font-size: 12px; padding: 13px; }
  td { border-top: 1px solid rgba(255,255,255,0.08); padding: 13px; color: #ffffff; font-size: 13px; vertical-align: top; }
  .clickableRow { cursor: pointer; }
  .clickableRow:hover { background: rgba(59, 130, 246, 0.18); }
  .fleetBtn { background: transparent; color: #bfdbfe; border: 0; font-weight: 900; text-decoration: underline; cursor: pointer; padding: 0; }
  .empty, .emptyCard { text-align: center; color: #dbeafe; padding: 24px; font-weight: 800; }
  .emptyCard { background: rgba(255,255,255,0.08); border-radius: 14px; }

  .pill { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 7px 14px; min-width: 92px; font-size: 12px; font-weight: 900; }
  .good { background: #0f766e; color: #d1fae5; }
  .down { background: #2563eb; color: #dbeafe; }
  .repair { background: #1d4ed8; color: #dbeafe; }
  .maintenance { background: #0ea5e9; color: #ecfeff; }
  .major { background: #d97706; color: #fff7ed; }
  .neutral { background: #334155; color: #e2e8f0; }

  .loginPage { display: grid; place-items: center; }
  .loginBox { width: min(440px, 100%); background: #020817; border: 1px solid rgba(191,219,254,0.2); border-radius: 22px; padding: 28px; box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
  .loginBox h1 { font-size: 30px; }
  .loginText { color: #dbeafe; margin: 0 0 18px; }
  .loginError { background: #1d4ed8; color: #ffffff; padding: 12px; border-radius: 12px; font-weight: 800; margin-bottom: 12px; }

  @media (max-width: 1150px) {
    .workArea { grid-template-columns: 1fr; }
    .controlPanel { position: static; }
    .tableWrap { max-height: none; }
  }

  @media (max-width: 760px) {
    .page { padding: 12px; }
    .hero { flex-direction: column; align-items: stretch; padding: 18px; }
    h1 { font-size: 28px; }
    .heroActions { display: grid; grid-template-columns: 1fr; }
    .stats { grid-template-columns: 1fr 1fr; }
    .formGrid { grid-template-columns: 1fr; }
    .quickActions { grid-template-columns: 1fr; }
    .saveRow { flex-direction: column; align-items: stretch; }
    .searchRow { grid-template-columns: 1fr; }
    .clearBtn { width: 100%; }
  }

  @media (max-width: 460px) {
    .stats { grid-template-columns: 1fr; }
    .controlPanel, .breakdownPanel { padding: 14px; }
  }
`;

