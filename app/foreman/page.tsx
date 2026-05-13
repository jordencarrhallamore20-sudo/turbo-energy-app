"use client";

import React, { useEffect, useMemo, useState } from "react";
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

function clean(value: any) {
  return String(value ?? "").trim();
}

function num(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
    department:
      clean(row.department) ||
      clean(row.dept) ||
      "Workshop",
    location:
      clean(row.location) ||
      clean(row.site) ||
      "Hwange",
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
    updated_by: row.updated_by || "Foreman",
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

export default function ForemanPage() {
  const [tableName, setTableName] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  async function loadMachines() {
    setLoading(true);
    setMessage("");

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage("Supabase environment variables are missing on Vercel.");
      setLoading(false);
      return;
    }

    for (const table of TABLE_CANDIDATES) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(1000);

      if (!error && data && data.length > 0) {
        setTableName(table);
        setMachines(data.map(normalize).filter((m) => m.fleet));
        setLastRefresh(new Date().toLocaleTimeString());
        setLoading(false);
        return;
      }
    }

    setMachines([]);
    setMessage(
      "No machine register data found in Supabase. Check that the admin dashboard is saving the full register to the correct Supabase table."
    );
    setLastRefresh(new Date().toLocaleTimeString());
    setLoading(false);
  }

  useEffect(() => {
    loadMachines();

    const timer = setInterval(() => {
      loadMachines();
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const filteredMachines = useMemo(() => {
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
    () => filteredMachines.filter(isOfflineOrRepair),
    [filteredMachines]
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

  function buildUpdatePayload(machine: Machine, patch: Partial<Machine>) {
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
      updated_by: "Foreman",
    };

    Object.entries(writable).forEach(([key, value]) => {
      if (value !== undefined) payload[key] = value;
    });

    return payload;
  }

  async function updateMachine(machine: Machine, patch: Partial<Machine>) {
    if (!tableName) {
      setMessage("No Supabase table selected. Refresh the register first.");
      return;
    }

    const id = machine.id ?? machine.fleet;
    setSavingId(id);

    const nextMachine = {
      ...machine,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: "Foreman",
    };

    setMachines((prev) =>
      prev.map((m) =>
        (m.id ?? m.fleet) === id ? normalize(nextMachine) : m
      )
    );

    const payload = buildUpdatePayload(machine, patch);

    let query = supabase.from(tableName).update(payload);

    if (machine.id !== undefined && machine.id !== null) {
      query = query.eq("id", machine.id);
    } else {
      query = query.eq("fleet", machine.fleet);
    }

    const { error } = await query;

    if (error) {
      setMessage(`Supabase update failed: ${error.message}`);
      await loadMachines();
    } else {
      setMessage(`${machine.fleet} updated successfully.`);
    }

    setSavingId(null);
  }

  async function bookOnline(machine: Machine) {
    await updateMachine(machine, {
      status: "Available",
      online_status: "Online",
      availability: 100,
      hours_down: 0,
      downtime_reason: "",
      repair_reason: "",
      major_repair: false,
    });
  }

  async function bookOffline(machine: Machine) {
    await updateMachine(machine, {
      status: "Down",
      online_status: "Offline",
      availability: 0,
      downtime_reason:
        machine.downtime_reason || "Booked offline by foreman",
      major_repair: false,
    });
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">TURBO ENERGY</p>
          <h1>Foreman Machine Control</h1>
          <p>
            Supabase live register. Book machines online or offline and update
            repair information from phone or computer.
          </p>
        </div>

        <button className="btn light" onClick={loadMachines}>
          Refresh Register
        </button>
      </section>

      {message && <section className="notice">{message}</section>}

      <section className="stats">
        <div className="stat">
          <span>Total Machines</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="stat">
          <span>Online</span>
          <strong className="green">{stats.online}</strong>
        </div>

        <div className="stat">
          <span>Booked Offline</span>
          <strong className="red">{stats.offline}</strong>
        </div>

        <div className="stat">
          <span>Major Repairs</span>
          <strong className="orange">{stats.major}</strong>
        </div>
      </section>

      <section className="toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fleet, type, status, department, location, reason..."
        />

        <p>
          Last refresh: {lastRefresh || "-"}{" "}
          {tableName ? `| Supabase table: ${tableName}` : ""}
        </p>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Machines Booked for Repairs / Offline</h2>
            <p>
              All machines currently booked down, offline, maintenance, repair,
              or major repair.
            </p>
          </div>

          <div className="countBadge">{offlineMachines.length}</div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Fleet</th>
                <th>Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Online</th>
                <th>Hours Down</th>
                <th>Downtime Reason</th>
                <th>Repair Reason</th>
                <th>ETA / Spares</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty">
                    Loading Supabase machine register...
                  </td>
                </tr>
              ) : offlineMachines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    No machines currently booked offline.
                  </td>
                </tr>
              ) : (
                offlineMachines.map((m) => (
                  <tr key={`${m.id ?? m.fleet}-offline`}>
                    <td>{m.fleet}</td>
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

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Machine List and Controls</h2>
            <p>
              Search the fleet and update machine status, offline reason, repair
              reason, hours down and spares ETA.
            </p>
          </div>

          <div className="countBadge">{filteredMachines.length}</div>
        </div>

        <div className="cards">
          {loading ? (
            <div className="emptyCard">Loading machines from Supabase...</div>
          ) : filteredMachines.length === 0 ? (
            <div className="emptyCard">
              No machines found. Refresh after saving the register from the
              admin dashboard.
            </div>
          ) : (
            filteredMachines.map((m) => (
              <article className="machineCard" key={`${m.id ?? m.fleet}-card`}>
                <div className="cardTop">
                  <div>
                    <h3>
                      {m.fleet} - {m.machine || m.type}
                    </h3>
                    <p>
                      {m.department} · {m.location || "-"}
                    </p>
                  </div>

                  <span className={`pill ${statusClass(m.status)}`}>
                    {m.status}
                  </span>
                </div>

                <div className="quickActions">
                  <button
                    className="btn greenBtn"
                    onClick={() => bookOnline(m)}
                    disabled={savingId === (m.id ?? m.fleet)}
                  >
                    Book Online
                  </button>

                  <button
                    className="btn redBtn"
                    onClick={() => bookOffline(m)}
                    disabled={savingId === (m.id ?? m.fleet)}
                  >
                    Book Offline
                  </button>
                </div>

                <div className="formGrid">
                  <label>
                    Department
                    <select
                      value={m.department}
                      onChange={(e) =>
                        updateMachine(m, { department: e.target.value })
                      }
                    >
                      {departments.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      value={m.status}
                      onChange={(e) =>
                        updateMachine(m, {
                          status: e.target.value,
                          online_status:
                            e.target.value === "Available"
                              ? "Online"
                              : "Offline",
                          availability:
                            e.target.value === "Available" ? 100 : 0,
                          major_repair:
                            e.target.value === "Major Repair",
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
                      value={m.online_status || "Online"}
                      onChange={(e) =>
                        updateMachine(m, {
                          online_status: e.target.value,
                        })
                      }
                    >
                      <option>Online</option>
                      <option>Offline</option>
                    </select>
                  </label>

                  <label>
                    Availability %
                    <input
                      value={m.availability ?? ""}
                      onChange={(e) =>
                        updateMachine(m, { availability: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Hours Worked
                    <input
                      value={m.hours_worked ?? ""}
                      onChange={(e) =>
                        updateMachine(m, { hours_worked: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Hours Down
                    <input
                      value={m.hours_down ?? ""}
                      onChange={(e) =>
                        updateMachine(m, { hours_down: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Downtime Reason
                    <input
                      value={m.downtime_reason ?? ""}
                      onChange={(e) =>
                        updateMachine(m, {
                          downtime_reason: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Repair Reason / Work Required
                    <input
                      value={m.repair_reason ?? ""}
                      onChange={(e) =>
                        updateMachine(m, {
                          repair_reason: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    ETA / Spares
                    <input
                      value={m.spares_eta ?? ""}
                      onChange={(e) =>
                        updateMachine(m, { spares_eta: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Location
                    <input
                      value={m.location ?? ""}
                      onChange={(e) =>
                        updateMachine(m, { location: e.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="cardFooter">
                  <span>
                    Updated:{" "}
                    {m.updated_at
                      ? new Date(m.updated_at).toLocaleString()
                      : "-"}{" "}
                    · User: {m.updated_by || "Foreman"}
                  </span>

                  <button
                    className="btn light"
                    onClick={() => loadMachines()}
                  >
                    Recheck
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #dfe3e8;
          padding: 28px;
          font-family: Arial, Helvetica, sans-serif;
          color: #ffffff;
        }

        .hero,
        .notice,
        .stats,
        .toolbar,
        .panel {
          max-width: 1480px;
          margin: 0 auto 18px auto;
        }

        .hero {
          background: #020817;
          border-radius: 18px;
          padding: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }

        .eyebrow {
          letter-spacing: 6px;
          font-size: 12px;
          font-weight: 900;
          margin: 0 0 8px;
        }

        h1 {
          font-size: 38px;
          line-height: 1;
          margin: 0 0 10px;
        }

        .hero p {
          margin: 0;
          color: #dbeafe;
          font-size: 15px;
        }

        .btn {
          border: 0;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .light {
          background: #ffffff;
          color: #020817;
        }

        .greenBtn {
          background: #14532d;
          color: white;
        }

        .redBtn {
          background: #7f1d1d;
          color: white;
        }

        .notice {
          background: #111827;
          border-left: 6px solid #f97316;
          color: #ffffff;
          padding: 15px 18px;
          border-radius: 12px;
          font-weight: 800;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .stat {
          background: #ffffff;
          color: #020817;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12);
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
          font-size: 34px;
          margin-top: 8px;
        }

        .green {
          color: #15803d;
        }

        .red {
          color: #dc2626;
        }

        .orange {
          color: #ea580c;
        }

        .toolbar {
          background: #ffffff;
          color: #020817;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12);
        }

        .toolbar input {
          width: 100%;
          max-width: 760px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 13px;
          font-size: 14px;
        }

        .toolbar p {
          color: #475569;
          margin: 10px 0 0;
          font-size: 13px;
        }

        .panel {
          background: #18345d;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.25);
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: center;
          margin-bottom: 18px;
        }

        .panelHeader h2 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        .panelHeader p {
          margin: 0;
          color: #dbeafe;
          font-size: 14px;
        }

        .countBadge {
          background: #374151;
          color: #fbbf24;
          font-size: 22px;
          font-weight: 900;
          min-width: 52px;
          height: 52px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }

        .tableWrap {
          overflow-x: auto;
          border-radius: 14px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: #1e3a66;
          min-width: 980px;
        }

        th {
          background: #f8fafc;
          color: #0f172a;
          text-align: left;
          font-size: 13px;
          padding: 15px;
        }

        td {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 15px;
          color: #ffffff;
          font-size: 14px;
          vertical-align: top;
        }

        .empty {
          text-align: center;
          color: #cbd5e1;
          padding: 28px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 7px 15px;
          min-width: 96px;
          font-size: 12px;
          font-weight: 900;
        }

        .good {
          background: #0f766e;
          color: #bbf7d0;
        }

        .down {
          background: #4c1d95;
          color: #fb7185;
        }

        .repair,
        .maintenance {
          background: #4b5563;
          color: #fde047;
        }

        .major {
          background: #713f12;
          color: #fde68a;
        }

        .neutral {
          background: #334155;
          color: #e2e8f0;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .machineCard {
          background: #1b3761;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          padding: 16px;
        }

        .cardTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        .cardTop h3 {
          margin: 0 0 6px;
          font-size: 18px;
        }

        .cardTop p {
          margin: 0;
          color: #dbeafe;
          font-size: 13px;
        }

        .quickActions {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 900;
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
        }

        .cardFooter {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #cbd5e1;
          font-size: 12px;
        }

        .emptyCard {
          grid-column: 1 / -1;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 25px;
          text-align: center;
          color: #dbeafe;
          font-weight: 800;
        }

        @media (max-width: 900px) {
          .page {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
            align-items: stretch;
            padding: 22px;
          }

          h1 {
            font-size: 30px;
          }

          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .cards {
            grid-template-columns: 1fr;
          }

          .formGrid {
            grid-template-columns: 1fr;
          }

          .quickActions {
            flex-direction: column;
          }

          .cardFooter {
            flex-direction: column;
            align-items: stretch;
          }

          .panelHeader {
            align-items: flex-start;
          }
        }

        @media (max-width: 520px) {
          .stats {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 26px;
          }

          .panel {
            padding: 15px;
          }

          .pill {
            min-width: auto;
          }
        }
      `}</style>
    </main>
  );
}
