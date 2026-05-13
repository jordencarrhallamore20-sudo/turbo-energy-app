"use client";

import React, { useEffect, useMemo, useState } from "react";

type Machine = {
  id: string;
  fleet: string;
  type: string;
  machineType: string;
  status: string;
  location: string;
  department: string;
  availability: number;
  repairReason: string;
  sparesEta: string;
  majorRepair: boolean;
  updated: string;
};

type ForemanUser = {
  username: string;
  password: string;
  name: string;
};

const LOCAL_KEY = "turbo_energy_shared_machine_register_v4";
const OLD_LOCAL_KEY = "turbo_energy_shared_machine_register_v3";
const FOREMAN_SESSION_KEY = "turbo_energy_foreman_session_v4";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const FOREMAN_USERS: ForemanUser[] = [
  { username: "foreman", password: "1234", name: "Foreman" },
  { username: "workshop", password: "1234", name: "Workshop Foreman" },
  { username: "chargehand", password: "1234", name: "Chargehand" },
  { username: "manager", password: "1234", name: "Workshop Manager" },
  { username: "admin", password: "1234", name: "Admin" },
];

const STATUS_OPTIONS = [
  "Available",
  "Online",
  "Working",
  "Down",
  "Repairs",
  "Offline",
  "Awaiting Spares",
  "Service",
  "Major Repair",
];

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : fallback;
}

function makeId(machine: Partial<Machine>): string {
  const base =
    cleanText(machine.fleet) ||
    cleanText(machine.id) ||
    `machine-${Date.now()}-${Math.random()}`;

  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function statusIsAvailable(status: string) {
  const s = status.toLowerCase();
  return s.includes("available") || s.includes("online") || s.includes("working");
}

function statusIsMajorRepair(status: string) {
  return status.toLowerCase().includes("major repair");
}

function normalizeMachine(row: any): Machine {
  const fleet = cleanText(
    row.fleet ||
      row.fleet_number ||
      row.fleetNumber ||
      row.registration ||
      row.reg ||
      row.unit ||
      row.machine_no ||
      row.machineNo
  );

  const type = cleanText(
    row.type ||
      row.machine_group ||
      row.machineGroup ||
      row.group ||
      row.category ||
      row.unit_type ||
      row.unitType
  );

  const machineType = cleanText(
    row.machineType ||
      row.machine_type ||
      row.machine ||
      row.description ||
      row.equipment ||
      row.model
  );

  const status = cleanText(row.status || row.machine_status || row.machineStatus) || "Available";

  const majorRepair =
    Boolean(row.majorRepair) ||
    Boolean(row.major_repair) ||
    statusIsMajorRepair(status);

  return {
    id: cleanText(row.id) || makeId({ fleet }),
    fleet: fleet || "UNKNOWN",
    type: type || machineType || "OTHER",
    machineType: machineType || type || "Machine",
    status,
    location: cleanText(row.location || row.site || row.area) || "Unknown",
    department: cleanText(row.department || row.dept || row.section) || "Unassigned",
    availability: safeNumber(
      row.availability ?? row.availability_percent ?? row.availabilityPercent,
      statusIsAvailable(status) && !majorRepair ? 100 : 0
    ),
    repairReason: cleanText(
      row.repairReason ||
        row.repair_reason ||
        row.reason ||
        row.breakdown_reason ||
        row.breakdownReason ||
        row.comment ||
        row.comments
    ),
    sparesEta: cleanText(row.sparesEta || row.spares_eta || row.eta || row.spares || row.parts_eta),
    majorRepair,
    updated: cleanText(row.updated || row.updated_at || row.last_updated) || new Date().toISOString(),
  };
}

function toSupabaseRow(machine: Machine) {
  return {
    id: machine.id,
    fleet: machine.fleet,
    type: machine.type,
    machine_type: machine.machineType,
    status: machine.status,
    location: machine.location,
    department: machine.department,
    availability: machine.availability,
    repair_reason: machine.repairReason,
    spares_eta: machine.sparesEta,
    major_repair: machine.majorRepair,
    updated_at: new Date().toISOString(),
  };
}

function fromSupabaseRow(row: any): Machine {
  return normalizeMachine({
    id: row.id,
    fleet: row.fleet,
    type: row.type,
    machineType: row.machine_type,
    status: row.status,
    location: row.location,
    department: row.department,
    availability: row.availability,
    repairReason: row.repair_reason,
    sparesEta: row.spares_eta,
    majorRepair: row.major_repair,
    updated: row.updated_at,
  });
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment keys are missing.");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Supabase error ${res.status}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadMachinesFromCloud(): Promise<Machine[]> {
  const rows = await supabaseFetch("machine_register?select=*&order=fleet.asc", {
    method: "GET",
  });

  if (!Array.isArray(rows)) return [];

  return rows
    .map(fromSupabaseRow)
    .filter((m) => m.fleet && m.fleet !== "UNKNOWN")
    .sort((a, b) => a.fleet.localeCompare(b.fleet, undefined, { numeric: true }));
}

async function saveMachineToCloud(machine: Machine) {
  await supabaseFetch("machine_register?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(toSupabaseRow(machine)),
  });
}

function readLocalKey(key: string): Machine[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeMachine)
      .filter((m) => m.fleet && !m.id.startsWith("sample-"));
  } catch {
    return [];
  }
}

function loadLocalMachines(): Machine[] {
  const latest = readLocalKey(LOCAL_KEY);
  if (latest.length > 0) return latest;

  const old = readLocalKey(OLD_LOCAL_KEY);
  if (old.length > 0) return old;

  return [];
}

function saveLocalMachines(machines: Machine[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(machines));
}

function clearLocalMachines() {
  localStorage.removeItem(LOCAL_KEY);
  localStorage.removeItem(OLD_LOCAL_KEY);
}

function isAvailable(machine: Machine) {
  return !machine.majorRepair && statusIsAvailable(machine.status);
}

function isDown(machine: Machine) {
  return !machine.majorRepair && !isAvailable(machine);
}

function percent(value: number) {
  return `${safeNumber(value).toFixed(1)}%`;
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusClass(machine: Machine) {
  if (machine.majorRepair) return "fm-pill fm-pill-major";
  if (isAvailable(machine)) return "fm-pill fm-pill-ok";
  return "fm-pill fm-pill-down";
}

export default function ForemanPage() {
  const [loggedInUser, setLoggedInUser] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "available" | "down" | "major">("all");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(FOREMAN_SESSION_KEY);
    if (saved) setLoggedInUser(saved);
  }, []);

  useEffect(() => {
    if (!loggedInUser) return;
    refreshSharedRegister(false);

    const interval = window.setInterval(() => {
      refreshSharedRegister(true);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loggedInUser]);

  const stats = useMemo(() => {
    const activeMachines = machines.filter((m) => !m.majorRepair);
    const available = activeMachines.filter(isAvailable).length;
    const down = activeMachines.filter(isDown).length;
    const major = machines.filter((m) => m.majorRepair).length;
    const total = activeMachines.length;
    const availability = total > 0 ? (available / total) * 100 : 0;

    return {
      total,
      available,
      down,
      major,
      availability,
      all: machines.length,
    };
  }, [machines]);

  const filteredMachines = useMemo(() => {
    const q = search.toLowerCase().trim();

    return machines.filter((m) => {
      if (activeTab === "available" && !isAvailable(m)) return false;
      if (activeTab === "down" && !isDown(m)) return false;
      if (activeTab === "major" && !m.majorRepair) return false;

      if (!q) return true;

      const combined = [
        m.fleet,
        m.type,
        m.machineType,
        m.status,
        m.location,
        m.department,
        m.repairReason,
        m.sparesEta,
      ]
        .join(" ")
        .toLowerCase();

      return combined.includes(q);
    });
  }, [machines, search, activeTab]);

  const departmentStats = useMemo(() => {
    const map = new Map<
      string,
      { department: string; total: number; available: number; down: number; percent: number }
    >();

    machines
      .filter((m) => !m.majorRepair)
      .forEach((m) => {
        const key = m.department || "Unassigned";
        const current =
          map.get(key) || {
            department: key,
            total: 0,
            available: 0,
            down: 0,
            percent: 0,
          };

        current.total += 1;

        if (isAvailable(m)) current.available += 1;
        else current.down += 1;

        current.percent = current.total > 0 ? (current.available / current.total) * 100 : 0;

        map.set(key, current);
      });

    return Array.from(map.values()).sort((a, b) => a.department.localeCompare(b.department));
  }, [machines]);

  async function refreshSharedRegister(silent = false) {
    if (!silent) {
      setLoading(true);
      setSyncMessage("");
    }

    try {
      const cloudMachines = await loadMachinesFromCloud();

      setMachines(cloudMachines);
      saveLocalMachines(cloudMachines);
      setLastRefresh(new Date().toLocaleTimeString());

      if (!silent) {
        if (cloudMachines.length > 0) {
          setSyncMessage(`Loaded ${cloudMachines.length} machines from the shared register.`);
        } else {
          setSyncMessage(
            "Shared register is empty. Upload/save the full machine register from the admin dashboard first."
          );
        }
      }
    } catch (err: any) {
      const localMachines = loadLocalMachines();

      if (localMachines.length > 0) {
        setMachines(localMachines);
        if (!silent) {
          setSyncMessage(
            `Could not connect to shared register. Showing ${localMachines.length} machines from this device backup.`
          );
        }
      } else {
        setMachines([]);
        if (!silent) {
          setSyncMessage(
            "Could not connect to shared register and no machine backup exists on this device. Check Supabase keys/table connection."
          );
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const found = FOREMAN_USERS.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password
    );

    if (!found) {
      alert("Incorrect foreman login details.");
      return;
    }

    localStorage.setItem(FOREMAN_SESSION_KEY, found.name);
    setLoggedInUser(found.name);
    setUsername("");
    setPassword("");
  }

  function logout() {
    localStorage.removeItem(FOREMAN_SESSION_KEY);
    setLoggedInUser("");
    setUsername("");
    setPassword("");
    setMachines([]);
    setSyncMessage("");
  }

  function updateMachineLocal(id: string, patch: Partial<Machine>) {
    setMachines((current) =>
      current.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              updated: new Date().toISOString(),
            }
          : m
      )
    );
  }

  async function saveMachine(machine: Machine, message = "Machine saved to shared register.") {
    const updatedMachine = {
      ...machine,
      majorRepair: statusIsMajorRepair(machine.status) || machine.majorRepair,
      availability:
        statusIsMajorRepair(machine.status) || machine.majorRepair
          ? 0
          : statusIsAvailable(machine.status)
          ? 100
          : 0,
      updated: new Date().toISOString(),
    };

    setSavingId(machine.id);

    const next = machines.map((m) => (m.id === machine.id ? updatedMachine : m));
    setMachines(next);
    saveLocalMachines(next);

    try {
      await saveMachineToCloud(updatedMachine);
      setSyncMessage(`${updatedMachine.fleet}: ${message}`);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      setSyncMessage(
        `${updatedMachine.fleet}: saved on this device only. Shared register did not update.`
      );
    } finally {
      setSavingId("");
    }
  }

  async function changeStatus(machine: Machine, status: string) {
    const majorRepair = statusIsMajorRepair(status);
    const availability = majorRepair ? 0 : statusIsAvailable(status) ? 100 : 0;

    const updatedMachine = {
      ...machine,
      status,
      majorRepair,
      availability,
      updated: new Date().toISOString(),
    };

    await saveMachine(updatedMachine, `status changed to ${status}.`);
  }

  function handleClearDeviceBackup() {
    clearLocalMachines();
    setSyncMessage("This device backup was cleared. Press Refresh Register to reload from Supabase.");
  }

  if (!loggedInUser) {
    return (
      <main className="fm-page fm-login-page">
        <section className="fm-login-card">
          <p className="fm-eyebrow">Turbo Energy</p>
          <h1>Foreman Login</h1>
          <p className="fm-muted">
            Login to book machines online, offline, down, available, repairs, or major repair.
          </p>

          <form onSubmit={handleLogin} className="fm-login-form">
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="foreman"
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="1234"
                type="password"
                autoComplete="current-password"
              />
            </label>

            <button type="submit" className="fm-primary-btn">
              Open Foreman Register
            </button>
          </form>

          <div className="fm-login-help">
            <b>Default users:</b> foreman / workshop / chargehand / manager / admin
            <br />
            <b>Password:</b> 1234
          </div>
        </section>

        <style>{styles}</style>
      </main>
    );
  }

  return (
    <main className="fm-page">
      <div className="fm-wrap">
        <header className="fm-header">
          <div>
            <p className="fm-eyebrow">Turbo Energy</p>
            <h1>Foreman Machine Availability</h1>
            <p>
              Logged in as <b>{loggedInUser}</b>. Multiple users can update machine status from
              this shared register.
            </p>
          </div>

          <div className="fm-header-actions">
            <button onClick={() => refreshSharedRegister(false)} className="fm-light-btn">
              {loading ? "Refreshing..." : "Refresh Register"}
            </button>
            <button onClick={handleClearDeviceBackup} className="fm-warn-btn">
              Clear Device Backup
            </button>
            <button onClick={logout} className="fm-dark-btn">
              Logout
            </button>
          </div>
        </header>

        {syncMessage && <div className="fm-message">{syncMessage}</div>}

        <section className="fm-kpi-grid">
          <div className="fm-kpi">
            <span>Total Active</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="fm-kpi">
            <span>Available</span>
            <strong className="fm-green">{stats.available}</strong>
          </div>
          <div className="fm-kpi">
            <span>Repairs / Down</span>
            <strong className="fm-red">{stats.down}</strong>
          </div>
          <div className="fm-kpi">
            <span>Major Repairs</span>
            <strong className="fm-orange">{stats.major}</strong>
          </div>
          <div className="fm-kpi">
            <span>Availability</span>
            <strong>{percent(stats.availability)}</strong>
          </div>
        </section>

        <section className="fm-panel">
          <div className="fm-toolbar">
            <input
              className="fm-search"
              placeholder="Search fleet, type, status, location, department, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="fm-tabs">
              <button
                onClick={() => setActiveTab("all")}
                className={activeTab === "all" ? "active" : ""}
              >
                All ({stats.all})
              </button>
              <button
                onClick={() => setActiveTab("available")}
                className={activeTab === "available" ? "active green" : ""}
              >
                Available ({stats.available})
              </button>
              <button
                onClick={() => setActiveTab("down")}
                className={activeTab === "down" ? "active red" : ""}
              >
                Down ({stats.down})
              </button>
              <button
                onClick={() => setActiveTab("major")}
                className={activeTab === "major" ? "active orange" : ""}
              >
                Major ({stats.major})
              </button>
            </div>
          </div>

          <p className="fm-small">
            Last refresh: {lastRefresh || "-"}. The page auto-refreshes every 30 seconds for
            multiple foremen using the system.
          </p>
        </section>

        <section className="fm-panel">
          <h2>Department Availability</h2>

          <div className="fm-table-box">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total</th>
                  <th>Available</th>
                  <th>Down</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {departmentStats.map((d) => (
                  <tr key={d.department}>
                    <td>
                      <b>{d.department}</b>
                    </td>
                    <td>{d.total}</td>
                    <td className="fm-green">
                      <b>{d.available}</b>
                    </td>
                    <td className="fm-red">
                      <b>{d.down}</b>
                    </td>
                    <td>
                      <b>{percent(d.percent)}</b>
                    </td>
                  </tr>
                ))}

                {departmentStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="fm-empty">
                      No department data loaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="fm-panel">
          <div className="fm-title-row">
            <h2>Machine List ({filteredMachines.length})</h2>
            {loading && <span className="fm-small">Loading...</span>}
          </div>

          <div className="fm-table-box">
            <table className="fm-table fm-machine-table">
              <thead>
                <tr>
                  <th>Fleet</th>
                  <th>Type</th>
                  <th>Machine</th>
                  <th>Status</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Availability</th>
                  <th>Reason / Work Required</th>
                  <th>ETA / Spares</th>
                  <th>Updated</th>
                  <th>Save</th>
                </tr>
              </thead>

              <tbody>
                {filteredMachines.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <b>{m.fleet}</b>
                    </td>
                    <td>{m.type}</td>
                    <td>{m.machineType}</td>

                    <td>
                      <select
                        value={m.status}
                        onChange={(e) => changeStatus(m, e.target.value)}
                        className="fm-select"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                      <div className={statusClass(m)}>{m.majorRepair ? "Major Repair" : m.status}</div>
                    </td>

                    <td>
                      <input
                        value={m.department}
                        onChange={(e) => updateMachineLocal(m.id, { department: e.target.value })}
                        className="fm-mini-input"
                      />
                    </td>

                    <td>
                      <input
                        value={m.location}
                        onChange={(e) => updateMachineLocal(m.id, { location: e.target.value })}
                        className="fm-mini-input"
                      />
                    </td>

                    <td>
                      <b>{percent(m.availability)}</b>
                    </td>

                    <td>
                      <textarea
                        value={m.repairReason}
                        onChange={(e) =>
                          updateMachineLocal(m.id, { repairReason: e.target.value })
                        }
                        placeholder="Reason / repair work / fault found"
                        className="fm-reason"
                      />
                    </td>

                    <td>
                      <input
                        value={m.sparesEta}
                        onChange={(e) => updateMachineLocal(m.id, { sparesEta: e.target.value })}
                        placeholder="ETA"
                        className="fm-mini-input"
                      />
                    </td>

                    <td className="fm-date">{formatDate(m.updated)}</td>

                    <td>
                      <button
                        onClick={() => saveMachine(m)}
                        disabled={savingId === m.id}
                        className="fm-save-btn"
                      >
                        {savingId === m.id ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredMachines.length === 0 && (
                  <tr>
                    <td colSpan={11} className="fm-empty">
                      No machines found. If this page only showed 2 old sample machines before,
                      press Clear Device Backup, then Refresh Register.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{styles}</style>
    </main>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

.fm-page {
  min-height: 100vh;
  background: #e5e7eb;
  color: #0f172a;
  padding: 16px;
  font-family: Arial, Helvetica, sans-serif;
}

.fm-wrap {
  max-width: 1450px;
  margin: 0 auto;
}

.fm-login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #020617;
  color: white;
}

.fm-login-card {
  width: 100%;
  max-width: 460px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 22px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
}

.fm-login-card h1 {
  margin: 8px 0 8px;
  font-size: 34px;
}

.fm-login-form {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}

.fm-login-form label {
  display: grid;
  gap: 6px;
  color: #cbd5e1;
  font-weight: 700;
}

.fm-login-form input,
.fm-search,
.fm-mini-input,
.fm-select,
.fm-reason {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
  background: white;
  color: #0f172a;
  font-size: 14px;
}

.fm-login-form input {
  background: #1e293b;
  color: white;
  border-color: #475569;
  padding: 13px 14px;
}

.fm-login-form input:focus,
.fm-search:focus,
.fm-mini-input:focus,
.fm-select:focus,
.fm-reason:focus {
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
}

.fm-login-help {
  margin-top: 18px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}

.fm-eyebrow {
  color: #fb923c;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  font-size: 12px;
  font-weight: 900;
  margin: 0 0 8px;
}

.fm-muted {
  color: #94a3b8;
  line-height: 1.5;
}

.fm-header {
  background: #020617;
  color: white;
  border-radius: 22px;
  padding: 22px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  box-shadow: 0 14px 35px rgba(15, 23, 42, 0.18);
}

.fm-header h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.1;
}

.fm-header p {
  margin: 8px 0 0;
  color: #cbd5e1;
}

.fm-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.fm-primary-btn,
.fm-light-btn,
.fm-dark-btn,
.fm-warn-btn,
.fm-save-btn {
  border: 0;
  border-radius: 12px;
  padding: 11px 15px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}

.fm-primary-btn {
  background: #f97316;
  color: white;
  width: 100%;
}

.fm-light-btn {
  background: white;
  color: #020617;
}

.fm-dark-btn {
  background: #1e293b;
  color: white;
  border: 1px solid #475569;
}

.fm-warn-btn {
  background: #fed7aa;
  color: #7c2d12;
}

.fm-save-btn {
  background: #0f172a;
  color: white;
  padding: 9px 13px;
}

.fm-save-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.fm-message {
  margin-top: 14px;
  background: #0f172a;
  color: white;
  border-left: 6px solid #f97316;
  border-radius: 14px;
  padding: 13px 15px;
  font-weight: 700;
}

.fm-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.fm-kpi {
  background: white;
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 8px 25px rgba(15, 23, 42, 0.08);
  border: 1px solid #e2e8f0;
}

.fm-kpi span {
  display: block;
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.fm-kpi strong {
  display: block;
  font-size: 34px;
  margin-top: 6px;
  font-weight: 1000;
}

.fm-green {
  color: #15803d;
}

.fm-red {
  color: #b91c1c;
}

.fm-orange {
  color: #c2410c;
}

.fm-panel {
  background: white;
  border-radius: 20px;
  padding: 16px;
  margin-top: 14px;
  box-shadow: 0 8px 25px rgba(15, 23, 42, 0.08);
  border: 1px solid #e2e8f0;
}

.fm-panel h2 {
  margin: 0 0 12px;
  font-size: 22px;
}

.fm-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.fm-search {
  max-width: 620px;
}

.fm-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fm-tabs button {
  border: 0;
  border-radius: 12px;
  padding: 10px 13px;
  font-weight: 900;
  background: #f1f5f9;
  color: #0f172a;
  cursor: pointer;
}

.fm-tabs button.active {
  background: #020617;
  color: white;
}

.fm-tabs button.active.green {
  background: #15803d;
}

.fm-tabs button.active.red {
  background: #b91c1c;
}

.fm-tabs button.active.orange {
  background: #ea580c;
}

.fm-small {
  color: #64748b;
  font-size: 13px;
  margin: 10px 0 0;
}

.fm-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fm-table-box {
  width: 100%;
  overflow-x: auto;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
}

.fm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.fm-machine-table {
  min-width: 1280px;
}

.fm-table th {
  background: #020617;
  color: white;
  text-align: left;
  padding: 12px;
  white-space: nowrap;
}

.fm-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 10px 12px;
  vertical-align: top;
}

.fm-table tr:nth-child(even) td {
  background: #f8fafc;
}

.fm-select {
  min-width: 145px;
}

.fm-mini-input {
  min-width: 130px;
}

.fm-reason {
  min-width: 250px;
  min-height: 52px;
  resize: vertical;
}

.fm-date {
  color: #64748b;
  white-space: nowrap;
  font-size: 12px;
}

.fm-pill {
  display: inline-block;
  margin-top: 7px;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 900;
}

.fm-pill-ok {
  background: #dcfce7;
  color: #166534;
}

.fm-pill-down {
  background: #fee2e2;
  color: #991b1b;
}

.fm-pill-major {
  background: #ffedd5;
  color: #9a3412;
}

.fm-empty {
  text-align: center;
  color: #64748b;
  padding: 24px !important;
  font-weight: 700;
}

@media (max-width: 900px) {
  .fm-page {
    padding: 10px;
  }

  .fm-header,
  .fm-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .fm-header-actions {
    justify-content: flex-start;
  }

  .fm-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fm-kpi strong {
    font-size: 30px;
  }

  .fm-search {
    max-width: none;
  }
}

@media (max-width: 520px) {
  .fm-kpi-grid {
    grid-template-columns: 1fr;
  }

  .fm-header-actions button {
    width: 100%;
  }
}
`;
