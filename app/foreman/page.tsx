"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Machine = {
  fleet: string;
  type?: string;
  machineType?: string;
  status: string;
  location?: string;
  department?: string;
  availability?: number;
  updated?: string;
  majorRepair?: boolean;
  repairReason: string;
  sparesEta?: string;
  hoursWorked: number;
  hoursDown: number;
  onlineStatus: string;
  downtimeReason: string;
  downtimeStartedAt?: string | null;
};

type QueuedUpdate = {
  id: string;
  createdAt: string;
  actor: string;
  fleet: string;
  payload: {
    status: string;
    hoursWorked: number;
    hoursDown: number;
    onlineStatus: string;
    downtimeReason: string;
    repairReason: string;
    updated: string;
    downtimeStartedAt: string | null;
  };
  history: {
    action: string;
    fleet: string;
    field: string;
    oldValue: string;
    newValue: string;
    notes: string;
  };
};

const FOREMAN_PIN = "1234";
const OFFLINE_QUEUE_KEY = "turbo_foreman_offline_queue_v1";

const statusOptions = ["Available", "Repair", "Maintenance", "Down", "Major Repair"];
const onlineOptions = ["Online", "Offline", "Standby"];

export default function MachineUpdatePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [pin, setPin] = useState("");
  const [foremanName, setForemanName] = useState("");

  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedFleet, setSelectedFleet] = useState("");
  const [form, setForm] = useState<Partial<Machine>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const selectedMachine = useMemo(() => {
    return machines.find((machine) => machine.fleet === selectedFleet);
  }, [machines, selectedFleet]);

  const filteredMachines = useMemo(() => {
    const term = search.trim().toLowerCase();

    return machines.filter((machine) => {
      if (!term) return true;

      return (
        machine.fleet.toLowerCase().includes(term) ||
        String(machine.machineType || "").toLowerCase().includes(term) ||
        String(machine.type || "").toLowerCase().includes(term) ||
        String(machine.department || "").toLowerCase().includes(term) ||
        String(machine.location || "").toLowerCase().includes(term)
      );
    });
  }, [machines, search]);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setQueuedCount(readQueue().length);

    function handleOnline() {
      setIsOnline(true);
      void syncOfflineQueue();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (loggedIn) {
      void loadMachines();
      if (navigator.onLine) void syncOfflineQueue();
    }
  }, [loggedIn]);

  async function loadMachines() {
    setLoading(true);

    const cached = readCachedMachines();
    if (cached.length > 0) {
      setMachines(cached);
      if (!selectedFleet) {
        setSelectedFleet(cached[0].fleet);
        setForm(cached[0]);
      }
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("machines")
      .select(
        'fleet,type,machineType,status,location,department,availability,updated,majorRepair,repairReason,sparesEta,hoursWorked,hoursDown,onlineStatus,downtimeReason,downtimeStartedAt'
      )
      .order("fleet", { ascending: true });

    if (error) {
      console.error(error);
      alert("Could not load live machines. Using saved offline list if available.");
      setLoading(false);
      return;
    }

    const normalized = ((data || []) as Machine[]).map(normalizeMachine);
    setMachines(normalized);
    writeCachedMachines(normalized);

    if (normalized.length > 0) {
      const existing = normalized.find((machine) => machine.fleet === selectedFleet);
      const chosen = existing || normalized[0];
      setSelectedFleet(chosen.fleet);
      setForm(chosen);
    }

    setLoading(false);
  }

  function handleLogin() {
    if (!foremanName.trim()) {
      alert("Enter your name.");
      return;
    }

    if (pin !== FOREMAN_PIN) {
      alert("Wrong PIN.");
      return;
    }

    setLoggedIn(true);
  }

  function handleSearch(value: string) {
    setSearch(value);

    const found = machines.find((machine) =>
      machine.fleet.toLowerCase().includes(value.toLowerCase()) ||
      String(machine.machineType || "").toLowerCase().includes(value.toLowerCase()) ||
      String(machine.type || "").toLowerCase().includes(value.toLowerCase()) ||
      String(machine.department || "").toLowerCase().includes(value.toLowerCase()) ||
      String(machine.location || "").toLowerCase().includes(value.toLowerCase())
    );

    if (found) {
      setSelectedFleet(found.fleet);
      setForm(found);
    }
  }

  function selectMachine(fleet: string) {
    const machine = machines.find((item) => item.fleet === fleet);
    if (!machine) return;

    setSelectedFleet(fleet);
    setForm(machine);
  }

  async function addHistoryEntry(entry: {
    action: string;
    fleet: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    notes?: string;
  }) {
    const { error } = await supabase.from("machine_history").insert({
      actor: foremanName || "Machine Update",
      action: entry.action,
      fleet: entry.fleet,
      field: entry.field || "",
      old_value: entry.oldValue || "",
      new_value: entry.newValue || "",
      notes: entry.notes || "",
    });

    if (error) {
      console.error("History insert error:", error);
    }
  }

  function buildUpdate(): QueuedUpdate | null {
    if (!selectedFleet || !selectedMachine) {
      alert("Select a machine first.");
      return null;
    }

    const oldOnlineStatus = selectedMachine.onlineStatus || "Online";
    const newOnlineStatus = String(form.onlineStatus || "Online");

    const oldStatus = selectedMachine.status || "Available";
    const newStatus = String(form.status || "Available");

    const oldHoursDown = Number(selectedMachine.hoursDown || 0);
    const typedHoursDown = Number(form.hoursDown || 0);

    let downtimeStartedAt = selectedMachine.downtimeStartedAt || null;
    let finalHoursDown = typedHoursDown;

    const wasRunning = isMachineRunning(oldStatus, oldOnlineStatus);
    const isRunningNow = isMachineRunning(newStatus, newOnlineStatus);

    // Start downtime when machine moves from running to down/offline/repair.
    if (wasRunning && !isRunningNow) {
      downtimeStartedAt = new Date().toISOString();
    }

    // Close downtime and add duration when machine moves back online/running.
    if (!wasRunning && isRunningNow && downtimeStartedAt) {
      const downStart = new Date(downtimeStartedAt).getTime();
      const now = Date.now();

      if (!Number.isNaN(downStart) && now > downStart) {
        const extraHours = roundToTwo((now - downStart) / 1000 / 60 / 60);
        finalHoursDown = roundToTwo(oldHoursDown + extraHours);
      }

      downtimeStartedAt = null;
    }

    // If saved as down/offline but no start time exists, start it now.
    if (!isRunningNow && !downtimeStartedAt) {
      downtimeStartedAt = new Date().toISOString();
    }

    const payload = {
      status: newStatus,
      hoursWorked: Number(form.hoursWorked || 0),
      hoursDown: finalHoursDown,
      onlineStatus: newOnlineStatus,
      downtimeReason: String(form.downtimeReason || ""),
      repairReason: String(form.repairReason || ""),
      updated: new Date().toLocaleDateString(),
      downtimeStartedAt,
    };

    return {
      id: `${selectedFleet}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      actor: foremanName || "Machine Update",
      fleet: selectedFleet,
      payload,
      history: {
        action: "Mobile machine update",
        fleet: selectedFleet,
        field: "status/online/hours",
        oldValue: `${oldStatus} / ${oldOnlineStatus} / Down ${oldHoursDown}`,
        newValue: `${newStatus} / ${newOnlineStatus} / Down ${finalHoursDown}`,
        notes:
          String(form.downtimeReason || form.repairReason || "").trim() ||
          "Mobile machine update",
      },
    };
  }

  async function save() {
    const update = buildUpdate();
    if (!update) return;

    setSaving(true);

    applyLocalUpdate(update);

    if (!navigator.onLine) {
      queueUpdate(update);
      setQueuedCount(readQueue().length);
      alert("No internet. Update saved offline and will sync when signal returns.");
      setSaving(false);
      return;
    }

    const ok = await sendUpdateToSupabase(update);

    if (!ok) {
      queueUpdate(update);
      setQueuedCount(readQueue().length);
      alert("Could not reach server. Update saved offline and will sync later.");
      setSaving(false);
      return;
    }

    await loadMachines();
    alert("Machine updated.");
    setSaving(false);
  }

  function applyLocalUpdate(update: QueuedUpdate) {
    const updatedMachines = machines.map((machine) =>
      machine.fleet === update.fleet
        ? normalizeMachine({
            ...machine,
            ...update.payload,
          })
        : machine
    );

    setMachines(updatedMachines);
    writeCachedMachines(updatedMachines);

    const updated = updatedMachines.find((machine) => machine.fleet === update.fleet);
    if (updated) {
      setForm(updated);
      setSelectedFleet(updated.fleet);
    }
  }

  async function sendUpdateToSupabase(update: QueuedUpdate) {
    const { error } = await supabase
      .from("machines")
      .update(update.payload)
      .eq("fleet", update.fleet);

    if (error) {
      console.error(error);
      return false;
    }

    await addHistoryEntry({
      action: update.history.action,
      fleet: update.history.fleet,
      field: update.history.field,
      oldValue: update.history.oldValue,
      newValue: update.history.newValue,
      notes: update.history.notes,
    });

    return true;
  }

  async function syncOfflineQueue() {
    const queue = readQueue();

    if (queue.length === 0 || !navigator.onLine) {
      setQueuedCount(queue.length);
      return;
    }

    setSyncing(true);

    const failed: QueuedUpdate[] = [];

    for (const update of queue) {
      const ok = await sendUpdateToSupabase(update);
      if (!ok) failed.push(update);
    }

    writeQueue(failed);
    setQueuedCount(failed.length);
    setSyncing(false);

    if (failed.length === 0) {
      await loadMachines();
    }
  }

  if (!loggedIn) {
    return (
      <div className="page">
        <div className="loginCard">
          <div className="logoText">TURBO ENERGY</div>
          <h1>Machine Update Login</h1>
          <p>Enter your name and PIN to update machine status from your phone.</p>

          <input
            className="input"
            placeholder="Your name"
            value={foremanName}
            onChange={(event) => setForemanName(event.target.value)}
          />

          <input
            className="input"
            placeholder="PIN"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLogin();
            }}
          />

          <button className="primaryButton" onClick={handleLogin}>
            Login
          </button>

          <div className="hintBox">
            Default PIN is <strong>1234</strong>. Change FOREMAN_PIN in this file when ready.
          </div>
        </div>

        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="appShell">
        <header className="header">
          <div>
            <div className="logoText">TURBO ENERGY</div>
            <h1>Machine Update</h1>
            <p>Logged in as {foremanName}</p>
          </div>

          <button
            className="logoutButton"
            onClick={() => {
              setLoggedIn(false);
              setPin("");
            }}
          >
            Logout
          </button>
        </header>

        <section className="statusPanel">
          <div className={isOnline ? "connectionOnline" : "connectionOffline"}>
            {isOnline ? "Online" : "Offline Mode"}
          </div>

          <div className="queueText">
            Queued updates: <strong>{queuedCount}</strong>
          </div>

          <button
            className="smallButton"
            onClick={() => void syncOfflineQueue()}
            disabled={!isOnline || syncing || queuedCount === 0}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </section>

        <section className="panel">
          <label className="label">Search machine</label>
          <input
            className="input"
            placeholder="Search fleet, type, department, location..."
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
          />

          <label className="label">Select machine</label>
          <select
            className="input"
            value={selectedFleet}
            onChange={(event) => selectMachine(event.target.value)}
          >
            {filteredMachines.map((machine) => (
              <option key={machine.fleet} value={machine.fleet}>
                {machine.fleet} - {machine.machineType || machine.type || ""}
              </option>
            ))}
          </select>

          <div className="smallText">
            Showing {filteredMachines.length} of {machines.length} machines
          </div>
        </section>

        {loading ? (
          <section className="panel">
            <strong>Loading machines...</strong>
          </section>
        ) : (
          <section className="panel">
            <div className="machineHeader">
              <div>
                <h2>{selectedFleet || "No machine selected"}</h2>
                <p>{form.machineType || form.type || "-"}</p>
              </div>
              <span className={`statusBadge ${getStatusClass(String(form.status || ""))}`}>
                {form.status || "-"}
              </span>
            </div>

            {form.downtimeStartedAt && (
              <div className="warningBox">
                Downtime active since: {formatDateTime(form.downtimeStartedAt)}
              </div>
            )}

            <div className="formGrid">
              <div>
                <label className="label">Machine Status</label>
                <select
                  className="input"
                  value={form.status || "Available"}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  {statusOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Online / Offline</label>
                <select
                  className="input"
                  value={form.onlineStatus || "Online"}
                  onChange={(event) =>
                    setForm({ ...form, onlineStatus: event.target.value })
                  }
                >
                  {onlineOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Hours Worked</label>
                <input
                  className="input"
                  type="number"
                  value={form.hoursWorked ?? 0}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      hoursWorked: Number(event.target.value || 0),
                    })
                  }
                />
              </div>

              <div>
                <label className="label">Hours Down</label>
                <input
                  className="input"
                  type="number"
                  value={form.hoursDown ?? 0}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      hoursDown: Number(event.target.value || 0),
                    })
                  }
                />
              </div>

              <div className="span2">
                <label className="label">Downtime Reason</label>
                <input
                  className="input"
                  placeholder="Example: hydraulic leak, tyre, electrical fault"
                  value={form.downtimeReason || ""}
                  onChange={(event) =>
                    setForm({ ...form, downtimeReason: event.target.value })
                  }
                />
              </div>

              <div className="span2">
                <label className="label">Repair Reason</label>
                <input
                  className="input"
                  placeholder="Repair notes"
                  value={form.repairReason || ""}
                  onChange={(event) =>
                    setForm({ ...form, repairReason: event.target.value })
                  }
                />
              </div>
            </div>

            <button
              className="primaryButton"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving..." : isOnline ? "Save Update" : "Save Offline"}
            </button>

            <button className="secondaryButton" onClick={() => void loadMachines()}>
              Refresh Machines
            </button>
          </section>
        )}

        <section className="panel">
          <h3>How offline mode and downtime works</h3>
          <p>
            If there is no signal, the update is saved on the phone and queued.
            When internet returns, it syncs automatically. Downtime starts when
            the machine is booked Offline, Down, Repair, Maintenance, or Major
            Repair. When it is booked back Online/Available, the system adds the
            elapsed time to Hours Down and clears the downtime start time.
          </p>
        </section>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

function normalizeMachine(machine: Partial<Machine>): Machine {
  const status = String(machine.status || "Available");
  const onlineStatus = String(
    machine.onlineStatus ||
      (status.toLowerCase().includes("avail") ? "Online" : "Offline")
  );

  return {
    fleet: String(machine.fleet || "UNIT"),
    type: String(machine.type || ""),
    machineType: String(machine.machineType || machine.fleet || ""),
    status,
    location: String(machine.location || ""),
    department: String(machine.department || ""),
    availability: Number(machine.availability || 0),
    updated: String(machine.updated || ""),
    majorRepair: Boolean(machine.majorRepair),
    repairReason: String(machine.repairReason || ""),
    sparesEta: String(machine.sparesEta || ""),
    hoursWorked: Number(machine.hoursWorked || 0),
    hoursDown: Number(machine.hoursDown || 0),
    onlineStatus,
    downtimeReason: String(machine.downtimeReason || ""),
    downtimeStartedAt: machine.downtimeStartedAt || null,
  };
}

function isMachineRunning(status: string, onlineStatus: string) {
  const cleanStatus = status.toLowerCase();
  const cleanOnline = onlineStatus.toLowerCase();

  if (cleanOnline === "offline") return false;
  if (cleanStatus.includes("down")) return false;
  if (cleanStatus.includes("repair")) return false;
  if (cleanStatus.includes("maint")) return false;
  if (cleanStatus.includes("major")) return false;

  return true;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function getStatusClass(status: string) {
  const value = status.toLowerCase();
  if (value.includes("avail")) return "green";
  if (value.includes("repair") || value.includes("maint")) return "yellow";
  if (value.includes("major") || value.includes("down")) return "red";
  return "blue";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function readQueue(): QueuedUpdate[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedUpdate[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedUpdate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function queueUpdate(update: QueuedUpdate) {
  const queue = readQueue();
  writeQueue([...queue, update]);
}

function readCachedMachines(): Machine[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem("turbo_cached_machines_v1");
    return raw ? (JSON.parse(raw) as Machine[]).map(normalizeMachine) : [];
  } catch {
    return [];
  }
}

function writeCachedMachines(machines: Machine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("turbo_cached_machines_v1", JSON.stringify(machines));
}

const styles = `
  .page {
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(90, 130, 255, 0.18), transparent 26%),
      radial-gradient(circle at top right, rgba(242, 154, 31, 0.14), transparent 22%),
      linear-gradient(180deg, #091c43 0%, #081733 100%);
    color: white;
    font-family: Arial, Helvetica, sans-serif;
  }

  .appShell {
    width: min(760px, calc(100% - 24px));
    margin: 0 auto;
    padding: 18px 0 28px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 14px;
  }

  .logoText {
    color: #ffb24c;
    font-weight: 900;
    letter-spacing: 1px;
    font-size: 18px;
  }

  h1 {
    margin: 6px 0 4px;
    font-size: 24px;
    font-weight: 900;
  }

  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 900;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 17px;
  }

  p {
    margin: 0;
    color: #c8d4ea;
    line-height: 1.45;
  }

  .loginCard,
  .panel,
  .statusPanel {
    background: linear-gradient(180deg, rgba(17, 42, 87, 0.96), rgba(10, 29, 63, 0.96));
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    box-shadow: 0 18px 40px rgba(0,0,0,0.26);
  }

  .loginCard {
    width: min(420px, calc(100% - 24px));
    margin: 40px auto;
    padding: 22px;
  }

  .panel,
  .statusPanel {
    padding: 16px;
    margin-bottom: 14px;
  }

  .statusPanel {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
  }

  .connectionOnline,
  .connectionOffline {
    border-radius: 999px;
    padding: 8px 12px;
    font-weight: 900;
    font-size: 13px;
  }

  .connectionOnline {
    background: rgba(65,184,108,0.18);
    color: #52dd84;
  }

  .connectionOffline {
    background: rgba(201,72,96,0.18);
    color: #ff7b93;
  }

  .queueText {
    color: #d8e1f6;
    font-size: 14px;
  }

  .smallButton {
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.1);
    color: white;
    border-radius: 999px;
    padding: 9px 12px;
    font-weight: 900;
    cursor: pointer;
  }

  .smallButton:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .label {
    display: block;
    margin: 12px 0 7px;
    color: #cfdbf4;
    font-size: 13px;
    font-weight: 800;
  }

  .input {
    width: 100%;
    border: none;
    outline: none;
    border-radius: 12px;
    padding: 14px;
    font-size: 16px;
    font-weight: 700;
    color: #17325f;
    background: white;
    box-sizing: border-box;
  }

  .primaryButton,
  .secondaryButton,
  .logoutButton {
    width: 100%;
    border: none;
    border-radius: 14px;
    padding: 15px 18px;
    margin-top: 14px;
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
  }

  .primaryButton {
    background: linear-gradient(180deg, #ffb24c, #f29a1f);
    color: white;
  }

  .primaryButton:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .secondaryButton {
    background: rgba(255,255,255,0.12);
    color: white;
    border: 1px solid rgba(255,255,255,0.16);
  }

  .logoutButton {
    width: auto;
    margin-top: 0;
    background: #d94141;
    color: white;
    padding: 12px 16px;
  }

  .hintBox,
  .warningBox {
    margin-top: 14px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    padding: 12px;
    color: #e7eeff;
    background: rgba(255,255,255,0.05);
    line-height: 1.45;
  }

  .warningBox {
    background: rgba(255,177,75,0.14);
    color: #ffcf67;
    font-weight: 800;
    margin-bottom: 12px;
  }

  .smallText {
    margin-top: 8px;
    color: #c8d4ea;
    font-size: 13px;
    font-weight: 700;
  }

  .machineHeader {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 10px;
  }

  .statusBadge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 96px;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 900;
  }

  .green {
    background: rgba(65,184,108,0.18);
    color: #52dd84;
  }

  .yellow {
    background: rgba(239,193,77,0.18);
    color: #ffd75d;
  }

  .red {
    background: rgba(201,72,96,0.18);
    color: #ff7b93;
  }

  .blue {
    background: rgba(79,140,255,0.18);
    color: #8ab6ff;
  }

  .formGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .span2 {
    grid-column: span 2;
  }

  @media (max-width: 640px) {
    .appShell {
      width: min(100% - 16px, 760px);
      padding-top: 10px;
    }

    .header,
    .machineHeader {
      flex-direction: column;
    }

    .statusPanel {
      grid-template-columns: 1fr;
    }

    .logoutButton {
      width: 100%;
    }

    .formGrid {
      grid-template-columns: 1fr;
    }

    .span2 {
      grid-column: span 1;
    }

    h1 {
      font-size: 22px;
    }
  }
`;

