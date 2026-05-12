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

const LOCAL_KEY = "turbo_energy_shared_machine_register_v3";
const FOREMAN_SESSION_KEY = "turbo_energy_foreman_session_v3";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const FOREMAN_USERS = [
  { username: "foreman", password: "1234", name: "Foreman" },
  { username: "workshop", password: "1234", name: "Workshop Foreman" },
  { username: "chargehand", password: "1234", name: "Chargehand" },
];

const SAMPLE_MACHINES: Machine[] = [
  {
    id: "sample-fel-001",
    fleet: "FEL 001",
    type: "FEL",
    machineType: "Front End Loader",
    status: "Available",
    location: "Workshop",
    department: "Plant",
    availability: 100,
    repairReason: "",
    sparesEta: "",
    majorRepair: false,
    updated: new Date().toISOString(),
  },
  {
    id: "sample-ht-001",
    fleet: "HT 001",
    type: "HT",
    machineType: "Haul Truck",
    status: "Down",
    location: "Workshop",
    department: "Mining",
    availability: 0,
    repairReason: "Awaiting inspection",
    sparesEta: "",
    majorRepair: false,
    updated: new Date().toISOString(),
  },
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

function normalizeMachine(row: any): Machine {
  const fleet = cleanText(row.fleet || row.fleet_number || row.registration || row.unit);
  const type = cleanText(row.type || row.machine_group || row.group);
  const machineType = cleanText(row.machineType || row.machine_type || row.machine);
  const status = cleanText(row.status || row.machine_status) || "Available";

  return {
    id: cleanText(row.id) || makeId({ fleet }),
    fleet: fleet || "UNKNOWN",
    type: type || machineType || "OTHER",
    machineType: machineType || type || "Machine",
    status,
    location: cleanText(row.location) || "Unknown",
    department: cleanText(row.department) || "Unassigned",
    availability: safeNumber(row.availability, status.toLowerCase().includes("available") ? 100 : 0),
    repairReason: cleanText(row.repairReason || row.repair_reason || row.reason),
    sparesEta: cleanText(row.sparesEta || row.spares_eta || row.eta),
    majorRepair:
      Boolean(row.majorRepair) ||
      Boolean(row.major_repair) ||
      status.toLowerCase().includes("major repair"),
    updated: cleanText(row.updated || row.updated_at) || new Date().toISOString(),
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
    throw new Error("Supabase is not connected.");
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
  return res.json();
}

async function loadMachinesFromCloud(): Promise<Machine[]> {
  const rows = await supabaseFetch(
    "machine_register?select=*&order=fleet.asc",
    {
      method: "GET",
    }
  );

  if (!Array.isArray(rows)) return [];
  return rows.map(fromSupabaseRow).filter((m) => m.fleet);
}

async function saveMachineToCloud(machine: Machine) {
  await supabaseFetch("machine_register", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(toSupabaseRow(machine)),
  });
}

function loadLocalMachines(): Machine[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMachine);
  } catch {
    return [];
  }
}

function saveLocalMachines(machines: Machine[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(machines));
}

function isAvailable(machine: Machine) {
  const status = machine.status.toLowerCase();
  return (
    !machine.majorRepair &&
    (status.includes("available") ||
      status.includes("online") ||
      status.includes("working"))
  );
}

function isDown(machine: Machine) {
  return !machine.majorRepair && !isAvailable(machine);
}

function percent(value: number) {
  return `${safeNumber(value).toFixed(1)}%`;
}

export default function ForemanPage() {
  const [loggedInUser, setLoggedInUser] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "available" | "down" | "major">("all");

  useEffect(() => {
    const saved = localStorage.getItem(FOREMAN_SESSION_KEY);
    if (saved) setLoggedInUser(saved);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSyncMessage("");

      try {
        const cloudMachines = await loadMachinesFromCloud();

        if (cloudMachines.length > 0) {
          setMachines(cloudMachines);
          saveLocalMachines(cloudMachines);
          setSyncMessage(`Loaded ${cloudMachines.length} machines from shared register.`);
          return;
        }

        const localMachines = loadLocalMachines();

        if (localMachines.length > 0) {
          setMachines(localMachines);
          setSyncMessage(
            `Shared register is empty. Loaded ${localMachines.length} machines from this device backup.`
          );
          return;
        }

        setMachines(SAMPLE_MACHINES);
        saveLocalMachines(SAMPLE_MACHINES);
        setSyncMessage(
          "No shared register found yet. Showing sample machines only. Upload/save the full register from admin."
        );
      } catch (err: any) {
        const localMachines = loadLocalMachines();

        if (localMachines.length > 0) {
          setMachines(localMachines);
          setSyncMessage(
            `Could not connect to shared register. Loaded ${localMachines.length} machines from this device backup.`
          );
        } else {
          setMachines(SAMPLE_MACHINES);
          setSyncMessage(
            "Could not connect to shared register and no device backup was found. Showing sample machines only."
          );
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

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
          map.get(key) ||
          {
            department: key,
            total: 0,
            available: 0,
            down: 0,
            percent: 0,
          };

        current.total += 1;

        if (isAvailable(m)) {
          current.available += 1;
        } else {
          current.down += 1;
        }

        current.percent =
          current.total > 0 ? (current.available / current.total) * 100 : 0;

        map.set(key, current);
      });

    return Array.from(map.values()).sort((a, b) =>
      a.department.localeCompare(b.department)
    );
  }, [machines]);

  async function handleLogin(e: React.FormEvent) {
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
  }

  function logout() {
    localStorage.removeItem(FOREMAN_SESSION_KEY);
    setLoggedInUser("");
    setUsername("");
    setPassword("");
  }

  async function refreshSharedRegister() {
    setLoading(true);
    setSyncMessage("");

    try {
      const cloudMachines = await loadMachinesFromCloud();

      if (cloudMachines.length === 0) {
        setSyncMessage("Shared register is empty. Admin must upload/save the full register.");
        return;
      }

      setMachines(cloudMachines);
      saveLocalMachines(cloudMachines);
      setSyncMessage(`Refreshed successfully. ${cloudMachines.length} machines loaded.`);
    } catch {
      setSyncMessage("Could not refresh from shared register. Check Supabase connection.");
    } finally {
      setLoading(false);
    }
  }

  async function updateMachineStatus(id: string, status: string) {
    const next = machines.map((m) => {
      if (m.id !== id) return m;

      return {
        ...m,
        status,
        availability: status.toLowerCase().includes("available") ? 100 : 0,
        majorRepair: status.toLowerCase().includes("major repair"),
        updated: new Date().toISOString(),
      };
    });

    setMachines(next);
    saveLocalMachines(next);

    const changed = next.find((m) => m.id === id);
    if (!changed) return;

    try {
      await saveMachineToCloud(changed);
      setSyncMessage(`${changed.fleet} updated and saved to shared register.`);
    } catch {
      setSyncMessage(
        `${changed.fleet} updated on this device, but could not save to shared register.`
      );
    }
  }

  async function updateMachineReason(id: string, repairReason: string) {
    const next = machines.map((m) =>
      m.id === id
        ? {
            ...m,
            repairReason,
            updated: new Date().toISOString(),
          }
        : m
    );

    setMachines(next);
    saveLocalMachines(next);

    const changed = next.find((m) => m.id === id);
    if (!changed) return;

    try {
      await saveMachineToCloud(changed);
      setSyncMessage(`${changed.fleet} reason saved.`);
    } catch {
      setSyncMessage(`${changed.fleet} reason saved on this device only.`);
    }
  }

  if (!loggedInUser) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <section className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-orange-400">
              Turbo Energy
            </p>
            <h1 className="text-3xl font-bold mt-2">Foreman Login</h1>
            <p className="text-slate-400 mt-2">
              Login to view the full shared machine availability register.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Username</label>
              <input
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-orange-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="foreman"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Password</label>
              <input
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-orange-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="1234"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold py-3"
            >
              Open Foreman Register
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <header className="rounded-2xl bg-slate-950 text-white p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-orange-400">
                Turbo Energy
              </p>
              <h1 className="text-2xl md:text-4xl font-bold mt-1">
                Foreman Machine Availability
              </h1>
              <p className="text-slate-300 mt-1">
                Logged in as {loggedInUser}. All data loads from the shared register.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={refreshSharedRegister}
                className="rounded-xl bg-white text-slate-950 px-4 py-2 font-bold"
              >
                Refresh Register
              </button>
              <button
                onClick={logout}
                className="rounded-xl bg-slate-800 text-white px-4 py-2 font-bold border border-slate-600"
              >
                Logout
              </button>
            </div>
          </div>

          {syncMessage && (
            <div className="mt-4 rounded-xl bg-slate-800 border border-slate-700 p-3 text-sm text-slate-200">
              {syncMessage}
            </div>
          )}
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500 font-bold">TOTAL ACTIVE</p>
            <p className="text-3xl font-black">{stats.total}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500 font-bold">AVAILABLE</p>
            <p className="text-3xl font-black text-green-700">{stats.available}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500 font-bold">REPAIRS / DOWN</p>
            <p className="text-3xl font-black text-red-700">{stats.down}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500 font-bold">MAJOR REPAIRS</p>
            <p className="text-3xl font-black text-orange-700">{stats.major}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow col-span-2 md:col-span-1">
            <p className="text-xs text-slate-500 font-bold">AVAILABILITY</p>
            <p className="text-3xl font-black">{percent(stats.availability)}</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <input
              className="w-full md:max-w-xl rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
              placeholder="Search fleet, type, status, location, department, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`rounded-xl px-4 py-2 font-bold ${
                  activeTab === "all" ? "bg-slate-950 text-white" : "bg-slate-100"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("available")}
                className={`rounded-xl px-4 py-2 font-bold ${
                  activeTab === "available"
                    ? "bg-green-700 text-white"
                    : "bg-slate-100"
                }`}
              >
                Available
              </button>
              <button
                onClick={() => setActiveTab("down")}
                className={`rounded-xl px-4 py-2 font-bold ${
                  activeTab === "down" ? "bg-red-700 text-white" : "bg-slate-100"
                }`}
              >
                Down
              </button>
              <button
                onClick={() => setActiveTab("major")}
                className={`rounded-xl px-4 py-2 font-bold ${
                  activeTab === "major" ? "bg-orange-600 text-white" : "bg-slate-100"
                }`}
              >
                Major Repairs
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="text-xl font-black mb-3">Department Availability</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="p-3 text-left">Department</th>
                  <th className="p-3 text-left">Total</th>
                  <th className="p-3 text-left">Available</th>
                  <th className="p-3 text-left">Down</th>
                  <th className="p-3 text-left">Availability</th>
                </tr>
              </thead>
              <tbody>
                {departmentStats.map((d) => (
                  <tr key={d.department} className="border-b">
                    <td className="p-3 font-bold">{d.department}</td>
                    <td className="p-3">{d.total}</td>
                    <td className="p-3 text-green-700 font-bold">{d.available}</td>
                    <td className="p-3 text-red-700 font-bold">{d.down}</td>
                    <td className="p-3 font-bold">{percent(d.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-black">
              Machine List{" "}
              <span className="text-slate-500 text-base">
                ({filteredMachines.length})
              </span>
            </h2>

            {loading && <p className="text-sm text-slate-500">Loading...</p>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="p-3 text-left">Fleet</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Machine</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Department</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Availability</th>
                  <th className="p-3 text-left">Reason</th>
                  <th className="p-3 text-left">ETA</th>
                  <th className="p-3 text-left">Updated</th>
                </tr>
              </thead>

              <tbody>
                {filteredMachines.map((m) => (
                  <tr key={m.id} className="border-b align-top">
                    <td className="p-3 font-black">{m.fleet}</td>
                    <td className="p-3">{m.type}</td>
                    <td className="p-3">{m.machineType}</td>

                    <td className="p-3">
                      <select
                        value={m.status}
                        onChange={(e) => updateMachineStatus(m.id, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-2 bg-white"
                      >
                        <option>Available</option>
                        <option>Online</option>
                        <option>Working</option>
                        <option>Down</option>
                        <option>Repairs</option>
                        <option>Offline</option>
                        <option>Major Repair</option>
                      </select>
                    </td>

                    <td className="p-3">{m.department}</td>
                    <td className="p-3">{m.location}</td>
                    <td className="p-3 font-bold">{percent(m.availability)}</td>

                    <td className="p-3">
                      <input
                        value={m.repairReason}
                        onChange={(e) => updateMachineReason(m.id, e.target.value)}
                        placeholder="Reason"
                        className="w-full min-w-[220px] rounded-lg border border-slate-300 px-2 py-2"
                      />
                    </td>

                    <td className="p-3">{m.sparesEta || "-"}</td>

                    <td className="p-3 text-slate-500">
                      {m.updated ? new Date(m.updated).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}

                {filteredMachines.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-slate-500" colSpan={10}>
                      No machines found for this search/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
