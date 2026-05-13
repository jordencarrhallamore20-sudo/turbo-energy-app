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
  [key: string]: any;
};

const TABLE_CANDIDATES = [
  "machine_register",
  "machines",
  "fleet_machines",
  "machine_availability",
  "availability_register",
  "machine_availability_register",
];

const departments = [
  "Mining",
  "Logistics",
  "Plant",
  "Workshop",
  "Admin",
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
  "Tyre replacement",
  "Hydraulic leak",
  "Electrical fault",
  "Engine fault",
  "Transmission fault",
  "Brake fault",
  "Accident damage",
  "Awaiting spares",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function num(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function machineKey(machine: Machine) {
  return String(machine.id ?? machine.fleet);
}

function normalize(row: any): Machine {
  const fleet =
    clean(row.fleet) ||
    clean(row.fleet_no) ||
    clean(row.fleet_number) ||
    clean(row.unit) ||
    clean(row.machine_number);

  const type =
    clean(row.type) ||
    clean(row.machine_type) ||
    clean(row.machineType) ||
    clean(row.machine) ||
    clean(row.category) ||
    fleet;

  const rawStatus =
    clean(row.status) ||
    clean(row.machine_status) ||
    clean(row.condition) ||
    "Available";

  const status = rawStatus.toLowerCase().includes("major")
    ? "Major Repair"
    : rawStatus.toLowerCase().includes("maint")
    ? "Maintenance"
    : rawStatus.toLowerCase().includes("repair")
    ? "Repair"
    : rawStatus.toLowerCase().includes("down")
    ? "Down"
    : rawStatus || "Available";

  return {
    ...row,
    id: row.id,
    fleet,
    type,
    machine: clean(row.machine) || clean(row.name) || type,
    machine_type: type,
    status,
    department: clean(row.department) || clean(row.dept) || "Workshop",
    location: clean(row.location) || clean(row.site) || "Hwange",
    availability:
      row.availability ??
      row.availability_percent ??
      row.availability_percentage ??
      (status === "Available" ? 100 : 0),
    hours_worked:
      row.hours_worked ??
      row.hoursWorked ??
      row.worked_hours ??
      "",
    hours_down:
      row.hours_down ??
      row.hoursDown ??
      row.downtime_hours ??
      0,
    downtime_reason:
      clean(row.downtime_reason) ||
      clean(row.downtimeReason) ||
      clean(row.reason) ||
      clean(row.breakdown_reason),
    repair_reason:
      clean(row.repair_reason) ||
      clean(row.repairReason) ||
      clean(row.work_required),
    spares_eta:
      clean(row.spares_eta) ||
      clean(row.sparesEta) ||
      clean(row.eta),
    online_status:
      clean(row.online_status) ||
      clean(row.onlineStatus) ||
      clean(row.online_offline) ||
      (status === "Available" ? "Online" : "Offline"),
    major_repair:
      Boolean(row.major_repair) ||
      Boolean(row.majorRepair) ||
      status.toLowerCase().includes("major"),
    updated_at: row.updated_at,
    updated_by: row.updated_by || "Control",
  };
}

function isOfflineOrRepair(machine: Machine) {
  const status = clean(machine.status).toLowerCase();
  const online = clean(machine.online_status).toLowerCase();

  return (
    online === "offline" ||
    status.includes("down") ||
    status.includes("repair") ||
    status.includes("maintenance") ||
    status.includes("major")
  );
}

function statusClass(status: string) {
  const s = status.toLowerCase();

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
    const saved = sessionStorage.getItem("turbo_machine_control_login");
    if (saved === "true") setLoggedIn(true);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const name = loginName.trim().toLowerCase();
    const pass = loginPassword.trim();

    if ((name === "controle" || name === "control") && pass === "1234") {
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

    for (const table of TABLE_CANDIDATES) {
      const { data, error } = await supabase.from(table).select("*").limit(1500);

      if (!error && data && data.length > 0) {
        const loaded = data.map(normalize).filter((m) => m.fleet);
        const keepKey = selectedKeyRef.current;

        setTableName(table);
        setMachines(loaded);
        setLastRefresh(new Date().toLocaleTimeString());

        if (loaded.length > 0) {
          const kept = keepKey
            ? loaded.find((m) => machineKey(m) === keepKey)
            : null;

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
        return;
      }
    }

    setMachines([]);
    setSelectedKey("");
    selectedKeyRef.current = "";
    setDraft(null);
    setMessage("No machine register data found in Supabase.");
    setLastRefresh(new Date().toLocaleTimeString());
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

  const offlineMachines = useMemo(
    () => machines.filter(isOfflineOrRepair),
    [machines]
  );

  const stats = useMemo(() => {
    const total = machines.length;
    const offline = machines.filter(isOfflineOrRepair).length;
    const online = total - offline;
    const major = machines.filter((m) =>
      clean(m.status).toLowerCase().includes("major")
    ).length;

    return { total, online, offline, major };
  }, [machines]);

  useEffect(() => {
    if (searchedMachines.length === 0) {
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
      return;
    }

    const stillVisible = searchedMachines.find(
      (m) => machineKey(m) === selectedKey
    );

    if (stillVisible) {
      setDraft(stillVisible);
    } else {
      const first = searchedMachines[0];
      setSelectedKey(machineKey(first));
      selectedKeyRef.current = machineKey(first);
      setDraft(first);
    }
  }, [searchedMachines, selectedKey]);

  function buildUpdatePayload(patch: Partial<Machine>) {
    const payload: any = {};

    const writable = {
      status: patch.status,
      department: patch.department,
      location: patch.location,
      availability: patch.availability,
      hours_worked: patch.hours_worked,
      hours_down: patch.hours_down,
      downtime_reason: patch.downtime_reason,
      repair_reason: patch.repair_reason,
      spares_eta: patch.spares_eta,
      online_status: patch.online_status,
      major_repair: patch.major_repair,
      updated_at: new Date().toISOString(),
      updated_by: "Control",
    };

    Object.entries(writable).forEach(([key, value]) => {
      if (value !== undefined) payload[key] = value;
    });

    return payload;
  }

  async function updateMachine(machine: Machine, patch: Partial<Machine>) {
    if (!tableName) {
      setMessage("No Supabase table selected. Refresh first.");
      return;
    }

    const id = machine.id ?? machine.fleet;
    setSavingId(id);

    const nextMachine = normalize({
      ...machine,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: "Control",
    });

    setMachines((prev) =>
      prev.map((m) => (machineKey(m) === machineKey(machine) ? nextMachine : m))
    );

    setDraft(nextMachine);
    setSelectedKey(machineKey(nextMachine));
    selectedKeyRef.current = machineKey(nextMachine);

    let query = supabase.from(tableName).update(buildUpdatePayload(patch));

    if (machine.id !== undefined && machine.id !== null) {
      query = query.eq("id", machine.id);
    } else {
      query = query.eq("fleet", machine.fleet);
    }

    const { error } = await query;

    if (error) {
      setMessage(`Update failed: ${error.message}`);
      await loadMachines(false);
    } else {
      setMessage(`${machine.fleet} updated and saved to the live register.`);
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
      downtime_reason: machine.downtime_reason || "Booked offline by control",
      major_repair: false,
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
          <p className="loginText">
            Enter control details to access machine booking controls.
          </p>

          <form onSubmit={handleLogin} className="loginForm">
            <label>
              Username
              <input
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="controle"
              />
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
          <p>
            Search one machine, update its status, book online/offline, and
            monitor current breakdowns from one screen.
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

            <button
              className="btn smallBtn clearBtn"
              onClick={() => setSearch("")}
              type="button"
            >
              Clear
            </button>
          </div>

          <label>
            Select machine ({searchedMachines.length} found)
            <select
              value={selectedKey}
              onChange={(e) => selectMachine(e.target.value)}
            >
              {searchedMachines.map((m) => (
                <option key={machineKey(m)} value={machineKey(m)}>
                  {m.fleet} - {m.type} - {m.status}
                </option>
              ))}
            </select>
          </label>

          {!draft ? (
            <div className="emptyCard">
              {loading ? "Loading register..." : "No machine found."}
            </div>
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
                <span className={`pill ${statusClass(draft.status)}`}>
                  {draft.status}
                </span>
              </div>

              <div className="quickActions">
                <button
                  className="btn greenBtn"
                  onClick={() => bookOnline(draft)}
                  disabled={savingId === (draft.id ?? draft.fleet)}
                >
                  Book Online
                </button>

                <button
                  className="btn blueBtn"
                  onClick={() => bookOffline(draft)}
                  disabled={savingId === (draft.id ?? draft.fleet)}
                >
                  Book Offline
                </button>
              </div>

              <div className="sectionTitle">Machine Status</div>

              <div className="formGrid">
                <label>
                  Department
                  <select
                    value={draft.department}
                    onChange={(e) => updateDraft({ department: e.target.value })}
                  >
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      updateDraft({
                        status: e.target.value,
                        online_status:
                          e.target.value === "Available" ? "Online" : "Offline",
                        availability: e.target.value === "Available" ? 100 : 0,
                        major_repair: e.target.value === "Major Repair",
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
                  <select
                    value={draft.online_status || "Online"}
                    onChange={(e) =>
                      updateDraft({ online_status: e.target.value })
                    }
                  >
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                </label>

                <label>
                  Availability %
                  <input
                    value={draft.availability ?? ""}
                    onChange={(e) =>
                      updateDraft({ availability: e.target.value })
                    }
                  />
                </label>

                <label>
                  Hours Worked
                  <input
                    value={draft.hours_worked ?? ""}
                    onChange={(e) =>
                      updateDraft({ hours_worked: e.target.value })
                    }
                  />
                </label>

                <label>
                  Hours Down
                  <input
                    value={draft.hours_down ?? ""}
                    onChange={(e) =>
                      updateDraft({ hours_down: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="sectionTitle">Downtime Details</div>

              <div className="formGrid">
                <label>
                  Quick Downtime Reason
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        updateDraft({ downtime_reason: e.target.value });
                      }
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
                  <input
                    value={draft.downtime_reason ?? ""}
                    onChange={(e) =>
                      updateDraft({ downtime_reason: e.target.value })
                    }
                  />
                </label>

                <label>
                  Repair Reason / Work Required
                  <input
                    value={draft.repair_reason ?? ""}
                    onChange={(e) =>
                      updateDraft({ repair_reason: e.target.value })
                    }
                  />
                </label>

                <label>
                  ETA / Spares
                  <input
                    value={draft.spares_eta ?? ""}
                    onChange={(e) =>
                      updateDraft({ spares_eta: e.target.value })
                    }
                    placeholder="Example: Awaiting spares, 14 May..."
                  />
                </label>

                <label>
                  Location
                  <input
                    value={draft.location ?? ""}
                    onChange={(e) => updateDraft({ location: e.target.value })}
                  />
                </label>
              </div>

              <div className="saveRow">
                <span>
                  Last refresh: {lastRefresh || "-"}
                  {tableName ? ` | ${tableName}` : ""}
                </span>

                <button
                  className="btn whiteBtn saveBtn"
                  onClick={saveDraft}
                  disabled={savingId === (draft.id ?? draft.fleet)}
                >
                  {savingId === (draft.id ?? draft.fleet)
                    ? "Saving..."
                    : "Save Updates"}
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
                  offlineMachines.map((m) => (
                    <tr
                      key={`${m.id ?? m.fleet}-offline`}
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
                        <span className={`pill ${statusClass(m.status)}`}>
                          {m.status}
                        </span>
                      </td>
                      <td>{m.online_status || "-"}</td>
                      <td>{num(m.hours_down).toFixed(1)}</td>
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
    max-height: calc(100vh - 260px);
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
