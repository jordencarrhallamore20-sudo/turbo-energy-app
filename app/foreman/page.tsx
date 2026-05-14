"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type MachineStatus = "Available" | "Down" | "Repair" | "Maintenance" | "Major Repair" | "Standby";

type Machine = {
  fleet: string;
  type: string;
  machine_type?: string;
  status: MachineStatus;
  department: string;
  location?: string;
  availability?: number | string;
  hours_worked?: number | string;
  hours_down?: number | string;
  downtime_reason?: string;
  repair_reason?: string;
  spares_eta?: string;
  online_status?: "Online" | "Offline" | string;
  major_repair?: boolean;
  updated_at?: string;
  updated_by?: string;
};

const TABLE = "machine_availability_live";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const departments = ["Mining", "Logistics", "Plant", "Workshop", "Admin", "Engineering & Civils", "Charging Station", "Stores & Procurement"];
const statuses: MachineStatus[] = ["Available", "Down", "Repair", "Maintenance", "Major Repair", "Standby"];
const quickReasons = ["", "Checks and greasing", "Service", "Tyre replacement", "Hydraulic leak", "Electrical fault", "Engine fault", "Transmission fault", "Brake fault", "Accident damage", "Awaiting spares"];

function clean(value: any) { return String(value ?? "").trim(); }
function num(value: any) { const n = Number(clean(value).replace("%", "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }
function round1(value: any) { return Number(num(value).toFixed(1)); }
function machineKey(machine: Machine) { return clean(machine.fleet).toUpperCase(); }

function normalizeStatus(value: any): MachineStatus {
  const s = clean(value).toLowerCase();
  if (s.includes("major")) return "Major Repair";
  if (s.includes("maint")) return "Maintenance";
  if (s.includes("repair")) return "Repair";
  if (s.includes("down") || s.includes("offline")) return "Down";
  if (s.includes("stand")) return "Standby";
  return "Available";
}

function normalize(row: any): Machine | null {
  const fleet = clean(row.fleet || row.id || row.unit || row.unit_no || row.fleet_no || row.fleet_number || row.machine_number);
  if (!fleet) return null;
  if (["fleet", "unit", "machine", "number"].includes(fleet.toLowerCase())) return null;

  const status = normalizeStatus(row.status || row.machine_status || row.condition || row.online_status);
  const onlineRaw = clean(row.online_status || row.onlineStatus || row.online_offline).toLowerCase();
  const online = onlineRaw.includes("off") ? "Offline" : onlineRaw.includes("on") ? "Online" : status === "Available" ? "Online" : "Offline";
  const type = clean(row.type || row.machine_type || row.machineType || row.category) || fleet.match(/^[A-Z]+/)?.[0] || "MACHINE";

  return {
    fleet: fleet.toUpperCase(),
    type: type.toUpperCase(),
    machine_type: clean(row.machine_type || row.machineType) || type.toUpperCase(),
    status,
    department: clean(row.department || row.dept) || "Workshop",
    location: clean(row.location || row.site) || "Hwange",
    availability: round1(row.availability ?? row.availability_percent ?? row.availability_percentage ?? (status === "Available" ? 100 : 0)),
    hours_worked: round1(row.hours_worked ?? row.hoursWorked ?? row.worked_hours ?? row.runtime ?? 0),
    hours_down: round1(row.hours_down ?? row.hoursDown ?? row.downtime_hours ?? row.downtime ?? 0),
    downtime_reason: clean(row.downtime_reason || row.downtimeReason || row.reason || row.breakdown_reason),
    repair_reason: clean(row.repair_reason || row.repairReason || row.work_required || row.workRequired),
    spares_eta: clean(row.spares_eta || row.sparesEta || row.eta),
    online_status: online,
    major_repair: Boolean(row.major_repair) || Boolean(row.majorRepair) || status === "Major Repair",
    updated_at: row.updated_at,
    updated_by: clean(row.updated_by || row.updatedBy) || "Control",
  };
}

function toDb(machine: Machine) {
  const status = normalizeStatus(machine.status);
  return {
    fleet: clean(machine.fleet).toUpperCase(),
    type: clean(machine.type).toUpperCase(),
    machine_type: clean(machine.machine_type || machine.type).toUpperCase(),
    department: clean(machine.department) || "Workshop",
    status,
    location: clean(machine.location) || "Hwange",
    availability: round1(machine.availability),
    hours_worked: round1(machine.hours_worked),
    hours_down: round1(machine.hours_down),
    downtime_reason: clean(machine.downtime_reason),
    repair_reason: clean(machine.repair_reason),
    spares_eta: clean(machine.spares_eta),
    online_status: clean(machine.online_status) === "Online" ? "Online" : "Offline",
    major_repair: Boolean(machine.major_repair) || status === "Major Repair",
    updated_at: new Date().toISOString(),
    updated_by: "Control",
  };
}

function isOfflineOrRepair(machine: Machine) {
  const status = clean(machine.status).toLowerCase();
  const online = clean(machine.online_status).toLowerCase();
  return online === "offline" || status.includes("down") || status.includes("repair") || status.includes("maintenance") || status.includes("major");
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
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  useEffect(() => { selectedKeyRef.current = selectedKey; }, [selectedKey]);
  useEffect(() => { if (sessionStorage.getItem("turbo_machine_control_login") === "true") setLoggedIn(true); }, []);

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
    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage("Vercel Supabase variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from(TABLE).select("*").order("fleet", { ascending: true }).limit(5000);
    if (error) {
      setMessage(`Supabase load failed: ${error.message}. Run the SQL setup file first.`);
      setMachines([]);
      setDraft(null);
      setSelectedKey("");
      setLoading(false);
      return;
    }

    const loaded = (data || []).map(normalize).filter((m): m is Machine => Boolean(m));
    setMachines(loaded);
    setLastRefresh(new Date().toLocaleTimeString());

    const keepKey = selectedKeyRef.current;
    const target = keepKey ? loaded.find((m) => machineKey(m) === keepKey) || loaded[0] : loaded[0];
    if (target) {
      setSelectedKey(machineKey(target));
      selectedKeyRef.current = machineKey(target);
      setDraft(target);
      setMessage(`Live register loaded: ${loaded.length} machine(s).`);
    } else {
      setSelectedKey("");
      selectedKeyRef.current = "";
      setDraft(null);
      setMessage("No machines found in live register. Open the main dashboard, upload the register, or press Sync Old Browser Data there.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMachines();
    const poll = setInterval(() => loadMachines(false), 12000);
    const channel = supabase.channel("machine-control-live-foreman").on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => loadMachines(false)).subscribe();
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchedMachines = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return machines;
    return machines.filter((m) => [m.fleet, m.type, m.machine_type, m.status, m.department, m.location, m.online_status, m.downtime_reason, m.repair_reason, m.spares_eta].join(" ").toLowerCase().includes(q));
  }, [machines, search]);

  const offlineMachines = useMemo(() => machines.filter(isOfflineOrRepair), [machines]);
  const stats = useMemo(() => {
    const total = machines.length;
    const offline = machines.filter(isOfflineOrRepair).length;
    const online = total - offline;
    const major = machines.filter((m) => clean(m.status).toLowerCase().includes("major") || m.major_repair).length;
    return { total, online, offline, major };
  }, [machines]);

  useEffect(() => {
    if (searchedMachines.length === 0) { setSelectedKey(""); selectedKeyRef.current = ""; setDraft(null); return; }
    const stillVisible = searchedMachines.find((m) => machineKey(m) === selectedKey);
    if (stillVisible) setDraft(stillVisible);
    else { const first = searchedMachines[0]; setSelectedKey(machineKey(first)); selectedKeyRef.current = machineKey(first); setDraft(first); }
  }, [searchedMachines, selectedKey]);

  async function saveMachine(machine: Machine) {
    const normalized = normalize(machine);
    if (!normalized) return;
    setSavingId(normalized.fleet);
    setMachines((prev) => prev.map((m) => (machineKey(m) === machineKey(normalized) ? normalized : m)));
    setDraft(normalized);
    setSelectedKey(machineKey(normalized));
    selectedKeyRef.current = machineKey(normalized);
    const { error } = await supabase.from(TABLE).upsert(toDb(normalized), { onConflict: "fleet" });
    if (error) {
      setMessage(`Update failed: ${error.message}`);
      await loadMachines(false);
    } else {
      setMessage(`${normalized.fleet} saved live. Other phones will see it after refresh or automatic sync.`);
      await loadMachines(false);
    }
    setSavingId(null);
  }

  async function saveDraft() { if (draft) await saveMachine({ ...draft, major_repair: draft.status === "Major Repair" || Boolean(draft.major_repair) }); }
  async function bookOnline(machine: Machine) { await saveMachine({ ...machine, status: "Available", online_status: "Online", availability: 100, hours_down: 0, downtime_reason: "", repair_reason: "", spares_eta: "", major_repair: false }); }
  async function bookOffline(machine: Machine) { await saveMachine({ ...machine, status: "Down", online_status: "Offline", availability: 0, downtime_reason: machine.downtime_reason || "Booked offline by control", major_repair: false }); }
  function updateDraft(patch: Partial<Machine>) { setDraft((prev) => (prev ? (normalize({ ...prev, ...patch }) as Machine) : prev)); }
  function selectMachine(key: string) { setSelectedKey(key); selectedKeyRef.current = key; const found = searchedMachines.find((m) => machineKey(m) === key); setDraft(found || null); }

  if (!loggedIn) {
    return <main className="page loginPage"><section className="loginBox"><p className="eyebrow">TURBO ENERGY</p><h1>Machine Controle Login</h1><p className="loginText">Enter control details to access machine booking controls.</p><form onSubmit={handleLogin} className="loginForm"><label>Username<input value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="controle" /></label><label>Password<input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="1234" /></label>{loginError && <div className="loginError">{loginError}</div>}<button className="btn whiteBtn" type="submit">Login</button></form></section><style jsx>{pageStyles}</style></main>;
  }

  return (
    <main className="page">
      <section className="hero"><div><p className="eyebrow">TURBO ENERGY</p><h1>Machine Controle</h1><p>Search one machine, update its status, book online/offline, and monitor current breakdowns from the shared live Supabase register.</p></div><div className="heroActions"><button className="btn whiteBtn" onClick={() => loadMachines()}>Refresh</button><button className="btn outlineBtn" onClick={() => (window.location.href = "/")}>Dashboard</button><button className="btn outlineBtn" onClick={logout}>Logout</button></div></section>
      {message && <section className="notice">{message}</section>}
      <section className="sourceBar">Live source: {TABLE} · Last refresh: {lastRefresh || "-"}</section>
      <section className="stats"><div className="stat"><span>Total Fleet</span><strong>{stats.total}</strong></div><div className="stat"><span>Online</span><strong className="greenText">{stats.online}</strong></div><div className="stat"><span>Breakdowns / Offline</span><strong className="blueText">{stats.offline}</strong></div><div className="stat"><span>Major Repairs</span><strong className="amberText">{stats.major}</strong></div></section>
      <section className="workArea">
        <section className="controlPanel"><div className="panelHeader"><div><h2>Machine Control</h2><p>Search, select, edit, then save updates.</p></div></div><div className="searchRow"><label>Search fleet<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Example: FEL05, TRL05, HT19..." /></label><button className="btn smallBtn clearBtn" onClick={() => setSearch("")} type="button">Clear</button></div><label>Select machine ({searchedMachines.length} found)<select value={selectedKey} onChange={(e) => selectMachine(e.target.value)}><option value="">Select...</option>{searchedMachines.map((m) => <option key={machineKey(m)} value={machineKey(m)}>{m.fleet} - {m.type} - {m.status}</option>)}</select></label>{!draft ? <div className="emptyCard">{loading ? "Loading live register..." : "No machine found."}</div> : <div className="machineFace"><div className="machineTitle"><div><h3>{draft.fleet} - {draft.machine_type || draft.type}</h3><p>{draft.department} · {draft.location || "-"}</p></div><span className={`pill ${statusClass(draft.status)}`}>{draft.status}</span></div><div className="quickActions"><button className="btn greenBtn" onClick={() => bookOnline(draft)} disabled={savingId === draft.fleet}>Book Online</button><button className="btn blueBtn" onClick={() => bookOffline(draft)} disabled={savingId === draft.fleet}>Book Offline</button></div><div className="sectionTitle">Machine Status</div><div className="formGrid"><label>Department<select value={draft.department} onChange={(e) => updateDraft({ department: e.target.value })}>{departments.map((d) => <option key={d}>{d}</option>)}</select></label><label>Status<select value={draft.status} onChange={(e) => { const status = e.target.value as MachineStatus; updateDraft({ status, online_status: status === "Available" ? "Online" : "Offline", availability: status === "Available" ? 100 : 0, major_repair: status === "Major Repair" }); }}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label><label>Online / Offline<select value={draft.online_status || "Online"} onChange={(e) => updateDraft({ online_status: e.target.value })}><option>Online</option><option>Offline</option></select></label><label>Availability %<input value={draft.availability ?? ""} onChange={(e) => updateDraft({ availability: e.target.value })} /></label><label>Hours Worked<input value={draft.hours_worked ?? ""} onChange={(e) => updateDraft({ hours_worked: e.target.value })} /></label><label>Hours Down<input value={draft.hours_down ?? ""} onChange={(e) => updateDraft({ hours_down: e.target.value })} /></label></div><div className="sectionTitle">Downtime Details</div><div className="formGrid"><label>Quick Downtime Reason<select value="" onChange={(e) => { if (e.target.value) updateDraft({ downtime_reason: e.target.value }); }}>{quickReasons.map((reason) => <option key={reason} value={reason}>{reason || "Select common reason..."}</option>)}</select></label><label>Downtime Reason<input value={draft.downtime_reason ?? ""} onChange={(e) => updateDraft({ downtime_reason: e.target.value })} /></label><label>Repair Reason / Work Required<input value={draft.repair_reason ?? ""} onChange={(e) => updateDraft({ repair_reason: e.target.value })} /></label><label>ETA / Spares<input value={draft.spares_eta ?? ""} onChange={(e) => updateDraft({ spares_eta: e.target.value })} placeholder="Example: Awaiting spares, 14 May..." /></label><label>Location<input value={draft.location ?? ""} onChange={(e) => updateDraft({ location: e.target.value })} /></label></div><div className="saveRow"><span>Last refresh: {lastRefresh || "-"}</span><button className="btn whiteBtn saveBtn" onClick={saveDraft} disabled={savingId === draft.fleet}>{savingId === draft.fleet ? "Saving..." : "Save Updates"}</button></div></div>}</section>
        <section className="breakdownPanel"><div className="panelHeader"><div><h2>Machines on Breakdown / Offline</h2><p>Click a fleet number to load it into Machine Control.</p></div><div className="countBadge">{offlineMachines.length}</div></div><div className="tableWrap"><table><thead><tr><th>Fleet</th><th>Type</th><th>Dept</th><th>Status</th><th>Online</th><th>Hours</th><th>Downtime Reason</th><th>Repair Reason</th><th>ETA</th></tr></thead><tbody>{loading ? <tr><td colSpan={9} className="empty">Loading Supabase register...</td></tr> : offlineMachines.length === 0 ? <tr><td colSpan={9} className="empty">No machines booked offline.</td></tr> : offlineMachines.map((m) => <tr key={`${m.fleet}-offline`} className="clickableRow" onClick={() => { setSearch(m.fleet); setSelectedKey(machineKey(m)); selectedKeyRef.current = machineKey(m); setDraft(m); }}><td><button className="fleetBtn" type="button">{m.fleet}</button></td><td>{m.type}</td><td>{m.department}</td><td><span className={`pill ${statusClass(m.status)}`}>{m.status}</span></td><td>{m.online_status || "-"}</td><td>{num(m.hours_down).toFixed(1)}</td><td>{m.downtime_reason || "-"}</td><td>{m.repair_reason || "-"}</td><td>{m.spares_eta || "-"}</td></tr>)}</tbody></table></div></section>
      </section><style jsx>{pageStyles}</style></main>
  );
}

const pageStyles = `
  * { box-sizing: border-box; } .page { min-height:100vh; background:radial-gradient(circle at top left, rgba(59,130,246,.22), transparent 30%), radial-gradient(circle at bottom right, rgba(14,116,144,.18), transparent 35%), linear-gradient(135deg,#06142b 0%,#0a2244 45%,#123763 100%); padding:18px; font-family:Arial,Helvetica,sans-serif; color:#fff; } .hero,.notice,.sourceBar,.stats,.workArea{max-width:1600px;margin:0 auto 14px} .hero{background:#020817;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;box-shadow:0 18px 44px rgba(0,0,0,.32);min-height:108px}.eyebrow{letter-spacing:6px;font-size:12px;font-weight:900;margin:0 0 7px;color:#bfdbfe}h1{font-size:34px;line-height:1;margin:0 0 8px}.hero p,.panelHeader p{margin:0;color:#dbeafe;font-size:14px}.heroActions{display:flex;gap:10px;flex-wrap:wrap}.btn{border:0;border-radius:12px;padding:12px 18px;font-weight:900;cursor:pointer;white-space:nowrap}.btn:disabled{opacity:.55;cursor:not-allowed}.whiteBtn{background:#fff;color:#020817}.outlineBtn{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35)}.greenBtn{background:#0f766e;color:#fff}.blueBtn{background:#2563eb;color:#fff}.smallBtn{padding:11px 14px}.clearBtn{background:#dbeafe;color:#0f172a}.notice,.sourceBar{background:rgba(2,8,23,.88);border-left:6px solid #38bdf8;color:#fff;padding:13px 18px;border-radius:12px;font-weight:800}.sourceBar{border-left-color:#f59e0b}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.stat{background:#fff;color:#020817;border-radius:16px;padding:15px 16px;box-shadow:0 14px 30px rgba(0,0,0,.22)}.stat span{text-transform:uppercase;color:#475569;font-size:12px;font-weight:900;letter-spacing:.8px}.stat strong{display:block;font-size:30px;margin-top:5px}.greenText{color:#047857}.blueText{color:#2563eb}.amberText{color:#d97706}.workArea{display:grid;grid-template-columns:470px minmax(0,1fr);gap:16px;align-items:start}.controlPanel,.breakdownPanel{background:rgba(18,55,99,.96);border:1px solid rgba(191,219,254,.22);border-radius:20px;padding:18px;box-shadow:0 18px 44px rgba(0,0,0,.28)}.controlPanel{position:sticky;top:14px}.panelHeader{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.panelHeader h2{margin:0 0 6px;font-size:21px}label{display:flex;flex-direction:column;gap:6px;color:#fff;font-size:12px;font-weight:900;margin-bottom:11px}input,select{width:100%;border:0;border-radius:12px;padding:12px;font-size:14px;color:#020817;background:#fff;outline:none}.searchRow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.machineFace{margin-top:13px;background:#1d4b80;border:1px solid rgba(191,219,254,.18);border-radius:18px;padding:15px}.machineTitle{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:13px}.machineTitle h3{margin:0 0 5px;font-size:20px}.machineTitle p{margin:0;color:#dbeafe;font-size:13px}.quickActions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:13px}.sectionTitle{margin:12px 0 9px;padding:8px 10px;border-radius:10px;background:rgba(2,8,23,.32);color:#dbeafe;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.6px}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.saveRow{margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;color:#dbeafe;font-size:12px}.saveBtn{min-width:140px}.countBadge{background:#1e3a5f;color:#f8fafc;font-size:22px;font-weight:900;min-width:52px;height:52px;border-radius:50%;display:grid;place-items:center}.tableWrap{overflow:auto;border-radius:14px;max-height:calc(100vh - 260px)}table{width:100%;border-collapse:collapse;background:#1e3f70;min-width:980px}th{position:sticky;top:0;z-index:1;background:#fff;color:#020817;text-align:left;font-size:12px;padding:13px}td{border-top:1px solid rgba(255,255,255,.08);padding:13px;color:#fff;font-size:13px;vertical-align:top}.clickableRow{cursor:pointer}.clickableRow:hover{background:rgba(59,130,246,.18)}.fleetBtn{background:transparent;color:#bfdbfe;border:0;font-weight:900;text-decoration:underline;cursor:pointer;padding:0}.empty,.emptyCard{text-align:center;color:#dbeafe;padding:24px;font-weight:800}.emptyCard{background:rgba(255,255,255,.08);border-radius:14px}.pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 14px;min-width:92px;font-size:12px;font-weight:900}.good{background:#0f766e;color:#d1fae5}.down{background:#2563eb;color:#dbeafe}.repair{background:#1d4ed8;color:#dbeafe}.maintenance{background:#0ea5e9;color:#ecfeff}.major{background:#d97706;color:#fff7ed}.neutral{background:#334155;color:#e2e8f0}.loginPage{display:grid;place-items:center}.loginBox{width:min(440px,100%);background:#020817;border:1px solid rgba(191,219,254,.2);border-radius:22px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,.45)}.loginBox h1{font-size:30px}.loginText{color:#dbeafe;margin:0 0 18px}.loginError{background:#1d4ed8;color:#fff;padding:12px;border-radius:12px;font-weight:800;margin-bottom:12px}@media(max-width:1150px){.workArea{grid-template-columns:1fr}.controlPanel{position:static}.tableWrap{max-height:none}}@media(max-width:760px){.page{padding:12px}.hero{flex-direction:column;align-items:stretch;padding:18px}h1{font-size:28px}.heroActions{display:grid;grid-template-columns:1fr 1fr}.stats{grid-template-columns:1fr 1fr}.formGrid,.quickActions,.searchRow{grid-template-columns:1fr}.saveRow{flex-direction:column;align-items:stretch}.clearBtn{width:100%}}@media(max-width:460px){.stats{grid-template-columns:1fr}.heroActions{grid-template-columns:1fr}.controlPanel,.breakdownPanel{padding:14px}}
`;

