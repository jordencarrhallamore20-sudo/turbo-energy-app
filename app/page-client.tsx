"use client";

import React, { ChangeEvent, useEffect, useMemo, useState } from "react";

type MachineStatus =
  | "AVAILABLE"
  | "DOWN"
  | "OFFLINE"
  | "MAJOR_REPAIR"
  | "UNKNOWN";

type MachineRow = {
  id: string;
  fleet: string;
  type: string;
  machineType: string;
  status: string;
  normalizedStatus: MachineStatus;
  location: string;
  department: string;
  availability: number | null;
  updated: string;
  majorRepair: boolean;
  repairReason: string;
  sparesEta: string;
  hoursWorked: number | null;
  hoursDown: number | null;
  onlineStatus: string;
  downtimeReason: string;
};

type HistoryRow = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  fleet: string;
  field: string;
  oldValue: string;
  newValue: string;
  notes: string;
};

type DashboardFilter =
  | "ALL"
  | "AVAILABLE"
  | "DOWN"
  | "MAJOR_REPAIR"
  | "DEPARTMENT";

const STORAGE_MACHINES = "turbo-energy-availability-machines-v11";
const STORAGE_HISTORY = "turbo-energy-availability-history-v11";

const EMPTY_MACHINE: MachineRow = {
  id: "",
  fleet: "",
  type: "",
  machineType: "",
  status: "",
  normalizedStatus: "UNKNOWN",
  location: "",
  department: "",
  availability: null,
  updated: "",
  majorRepair: false,
  repairReason: "",
  sparesEta: "",
  hoursWorked: null,
  hoursDown: null,
  onlineStatus: "",
  downtimeReason: "",
};

function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normaliseKey(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).replace("%", "").replace(",", ".").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundOne(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${roundOne(value)}%`;
}

function yesNo(value: unknown): boolean {
  const text = clean(value).toLowerCase();
  return ["yes", "y", "true", "1", "major", "majorrepair", "major repair", "longterm", "long term"].includes(text);
}

function isRegistrationFleet(fleet: string): boolean {
  const compact = clean(fleet).replace(/\s+/g, "").toUpperCase();
  return /^A[A-Z]{2}\d{4}$/.test(compact);
}

function normaliseMachineType(machineType: string, fleet: string): string {
  const raw = clean(machineType).toUpperCase();

  if (isRegistrationFleet(fleet)) return "LDV";

  if (!raw) return "UNKNOWN";
  if (raw.includes("LIGHT") || raw.includes("LDV") || raw.includes("VEHICLE")) return "LDV";
  if (raw.includes("FEL") || raw.includes("LOADER") || raw.includes("FRONT END")) return "FEL";
  if (raw.includes("EXCAVATOR") || raw.includes("TEX") || raw.includes("EXC")) return "TEX";
  if (raw.includes("DOZER") || raw.includes("TDC") || raw.includes("BULL")) return "TDC";
  if (raw.includes("TRUCK") || raw.includes("HT") || raw.includes("HOWO")) return "HT";
  if (raw.includes("TRAILER") || raw.includes("TRL")) return "TRL";
  if (raw.includes("TRACTOR") || raw.includes("TRT")) return "TRT";

  return raw;
}

function normaliseStatus(status: string, onlineStatus: string, majorRepair: boolean): MachineStatus {
  if (majorRepair) return "MAJOR_REPAIR";

  const joined = `${clean(status)} ${clean(onlineStatus)}`.toLowerCase();

  if (!joined.trim()) return "UNKNOWN";

  const hasDown =
    joined.includes("down") ||
    joined.includes("offline") ||
    joined.includes("breakdown") ||
    joined.includes("repair") ||
    joined.includes("stopped") ||
    joined.includes("not available");

  if (hasDown) return joined.includes("offline") ? "OFFLINE" : "DOWN";

  const hasAvailable =
    joined.includes("available") ||
    joined.includes("online") ||
    joined.includes("working") ||
    joined.includes("running") ||
    joined.includes("operational") ||
    joined.includes("ready") ||
    joined.includes("active");

  if (hasAvailable) return "AVAILABLE";

  return "UNKNOWN";
}

function getValue(row: Record<string, unknown>, wantedKeys: string[]): unknown {
  const normalizedRow: Record<string, unknown> = {};

  Object.keys(row).forEach((key) => {
    normalizedRow[normaliseKey(key)] = row[key];
  });

  for (const wanted of wantedKeys) {
    const value = normalizedRow[normaliseKey(wanted)];
    if (value !== undefined && value !== null && clean(value) !== "") return value;
  }

  return "";
}

function buildMachineFromUploadRow(
  row: Record<string, unknown>,
  existing: Map<string, MachineRow>
): MachineRow | null {
  const fleet = clean(
    getValue(row, [
      "fleet",
      "fleet no",
      "fleet number",
      "fleetnumber",
      "machine",
      "machine no",
      "machine number",
      "unit",
      "registration",
      "reg",
    ])
  ).toUpperCase();

  if (!fleet) return null;

  const previous = existing.get(fleet);

  const typeText = clean(getValue(row, ["type", "equipment type", "category"]));
  const machineTypeText = clean(getValue(row, ["machine type", "machinetype", "class", "asset type"]));
  const machineType = normaliseMachineType(machineTypeText || typeText, fleet);

  const uploadedMajorRepair = yesNo(
    getValue(row, ["major repair", "majorRepair", "long term repair", "long term rebuild"])
  );

  const majorRepair = previous?.majorRepair ?? uploadedMajorRepair;

  const uploadedStatus = clean(getValue(row, ["status", "machine status", "availability status"]));
  const uploadedOnlineStatus = clean(getValue(row, ["online status", "onlineStatus", "online/offline"]));
  const normalizedStatus = normaliseStatus(
    previous?.status || uploadedStatus,
    previous?.onlineStatus || uploadedOnlineStatus,
    majorRepair
  );

  return {
    id: previous?.id || `${fleet}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    fleet,
    type: typeText || previous?.type || machineType,
    machineType,
    status: previous?.status || uploadedStatus || (majorRepair ? "Major Repair" : ""),
    normalizedStatus,
    location: previous?.location || clean(getValue(row, ["location", "site", "area"])) || "",
    department: previous?.department || clean(getValue(row, ["department", "dept", "section"])) || "Unassigned",
    availability: parseNumber(getValue(row, ["availability", "availability %", "availability percent", "avail"])),
    updated: clean(getValue(row, ["updated", "date", "last updated", "last update"])) || new Date().toLocaleDateString(),
    majorRepair,
    repairReason:
      previous?.repairReason ||
      clean(getValue(row, ["repair reason", "repairReason", "reason", "major repair reason"])) ||
      "",
    sparesEta:
      previous?.sparesEta ||
      clean(getValue(row, ["spares eta", "sparesEta", "eta", "expected date", "spares arrival"])) ||
      "",
    hoursWorked: parseNumber(getValue(row, ["hours worked", "hoursWorked", "worked hours"])),
    hoursDown: parseNumber(getValue(row, ["hours down", "hoursDown", "down hours", "downtime hours"])),
    onlineStatus: previous?.onlineStatus || uploadedOnlineStatus || "",
    downtimeReason:
      previous?.downtimeReason ||
      clean(getValue(row, ["downtime reason", "downtimeReason", "down reason", "breakdown reason"])) ||
      "",
  };
}

function createHistory(
  fleet: string,
  action: string,
  field: string,
  oldValue: string,
  newValue: string,
  notes = ""
): HistoryRow {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toLocaleString(),
    actor: "Admin",
    action,
    fleet,
    field,
    oldValue,
    newValue,
    notes,
  };
}

function safeLocalStorageRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeLocalStorageWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage may be blocked on some phones/browsers. The app must still run.
  }
}

function csvEscape(value: unknown): string {
  const text = clean(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function statusLabel(machine: MachineRow): string {
  if (machine.majorRepair) return "Major Repair";
  if (machine.normalizedStatus === "AVAILABLE") return "Available";
  if (machine.normalizedStatus === "DOWN") return "Down";
  if (machine.normalizedStatus === "OFFLINE") return "Offline";
  return machine.status || "Unknown";
}


type ReportSummaryRow = {
  name: string;
  total: number;
  active: number;
  available: number;
  down: number;
  majorExcluded: number;
  percent: number;
  hoursWorked: number;
  hoursDown: number;
};

function availabilityValue(machine: MachineRow): number {
  if (machine.majorRepair) return 0;
  if (machine.availability !== null && Number.isFinite(machine.availability)) {
    return Math.max(0, Math.min(100, machine.availability));
  }
  return machine.normalizedStatus === "AVAILABLE" ? 100 : 0;
}

function groupAvailabilityPercent(items: MachineRow[]): number {
  const active = items.filter((machine) => !machine.majorRepair);
  if (active.length === 0) return 0;
  return active.reduce((sum, machine) => sum + availabilityValue(machine), 0) / active.length;
}

function activeCount(items: MachineRow[]): number {
  return items.filter((machine) => !machine.majorRepair).length;
}

function availableCount(items: MachineRow[]): number {
  return items.filter((machine) => !machine.majorRepair && machine.normalizedStatus === "AVAILABLE").length;
}

function buildReportSummary(
  items: MachineRow[],
  getName: (machine: MachineRow) => string
): ReportSummaryRow[] {
  const groups = new Map<string, ReportSummaryRow & { availabilityTotal: number }>();

  items.forEach((machine) => {
    const name = clean(getName(machine)) || "Unassigned";
    const current =
      groups.get(name) ||
      {
        name,
        total: 0,
        active: 0,
        available: 0,
        down: 0,
        majorExcluded: 0,
        percent: 0,
        hoursWorked: 0,
        hoursDown: 0,
        availabilityTotal: 0,
      };

    current.total += 1;

    if (machine.majorRepair) {
      current.majorExcluded += 1;
    } else {
      current.active += 1;
      current.availabilityTotal += availabilityValue(machine);
      current.hoursWorked += machine.hoursWorked || 0;
      current.hoursDown += machine.hoursDown || 0;

      if (machine.normalizedStatus === "AVAILABLE") current.available += 1;
      else current.down += 1;
    }

    groups.set(name, current);
  });

  return Array.from(groups.values())
    .map((item) => ({
      name: item.name,
      total: item.total,
      active: item.active,
      available: item.available,
      down: item.down,
      majorExcluded: item.majorExcluded,
      percent: item.active === 0 ? 0 : item.availabilityTotal / item.active,
      hoursWorked: item.hoursWorked,
      hoursDown: item.hoursDown,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function DashboardPage() {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [mainSearch, setMainSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selectedFleet, setSelectedFleet] = useState("");
  const [notice, setNotice] = useState("");

  const [adminFleet, setAdminFleet] = useState("");
  const [adminDepartment, setAdminDepartment] = useState("");
  const [adminLocation, setAdminLocation] = useState("");
  const [adminReason, setAdminReason] = useState("");
  const [adminEta, setAdminEta] = useState("");
  const [adminOnlineStatus, setAdminOnlineStatus] = useState("");
  const [adminDowntimeReason, setAdminDowntimeReason] = useState("");

  const [reportSelectedFleets, setReportSelectedFleets] = useState<string[]>([]);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportGeneratedAt, setReportGeneratedAt] = useState("");

  useEffect(() => {
    setMachines(safeLocalStorageRead<MachineRow[]>(STORAGE_MACHINES, []));
    setHistory(safeLocalStorageRead<HistoryRow[]>(STORAGE_HISTORY, []));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    safeLocalStorageWrite(STORAGE_MACHINES, machines);
  }, [machines, loaded]);

  useEffect(() => {
    if (!loaded) return;
    safeLocalStorageWrite(STORAGE_HISTORY, history);
  }, [history, loaded]);

  const machineByFleet = useMemo(() => {
    const map = new Map<string, MachineRow>();
    machines.forEach((machine) => map.set(machine.fleet, machine));
    return map;
  }, [machines]);

  const selectedMachine = useMemo(() => {
    if (!selectedFleet) return null;
    return machineByFleet.get(selectedFleet) || null;
  }, [machineByFleet, selectedFleet]);

  const activeMachines = useMemo(() => {
    return machines.filter((machine) => !machine.majorRepair);
  }, [machines]);

  const majorRepairMachines = useMemo(() => {
    return machines.filter((machine) => machine.majorRepair);
  }, [machines]);

  const availableMachines = useMemo(() => {
    return activeMachines.filter((machine) => machine.normalizedStatus === "AVAILABLE");
  }, [activeMachines]);

  const downMachines = useMemo(() => {
    return activeMachines.filter((machine) => machine.normalizedStatus !== "AVAILABLE");
  }, [activeMachines]);

  const uniqueLocations = useMemo(() => {
    return new Set(activeMachines.map((machine) => machine.location).filter(Boolean));
  }, [activeMachines]);

  const overallAvailability = useMemo(() => {
    if (activeMachines.length === 0) return 0;
    return (availableMachines.length / activeMachines.length) * 100;
  }, [activeMachines.length, availableMachines.length]);

  const totalHoursWorked = useMemo(() => {
    return activeMachines.reduce((sum, machine) => sum + (machine.hoursWorked || 0), 0);
  }, [activeMachines]);

  const totalHoursDown = useMemo(() => {
    return activeMachines.reduce((sum, machine) => sum + (machine.hoursDown || 0), 0);
  }, [activeMachines]);

  const typeStats = useMemo(() => {
    const grouped = new Map<string, { type: string; total: number; available: number }>();

    activeMachines.forEach((machine) => {
      const key = machine.machineType || "UNKNOWN";
      const current = grouped.get(key) || { type: key, total: 0, available: 0 };
      current.total += 1;
      if (machine.normalizedStatus === "AVAILABLE") current.available += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        percent: item.total === 0 ? 0 : (item.available / item.total) * 100,
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [activeMachines]);

  const departmentStats = useMemo(() => {
    const grouped = new Map<string, { department: string; total: number; available: number; down: number }>();

    activeMachines.forEach((machine) => {
      const key = machine.department || "Unassigned";
      const current = grouped.get(key) || { department: key, total: 0, available: 0, down: 0 };
      current.total += 1;
      if (machine.normalizedStatus === "AVAILABLE") current.available += 1;
      else current.down += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        percent: item.total === 0 ? 0 : (item.available / item.total) * 100,
      }))
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [activeMachines]);

  const filteredMachines = useMemo(() => {
    const search = mainSearch.trim().toLowerCase();

    return machines
      .filter((machine) => {
        if (filter === "AVAILABLE") return !machine.majorRepair && machine.normalizedStatus === "AVAILABLE";
        if (filter === "DOWN") return !machine.majorRepair && machine.normalizedStatus !== "AVAILABLE";
        if (filter === "MAJOR_REPAIR") return machine.majorRepair;
        if (filter === "DEPARTMENT") return !machine.majorRepair && machine.department === departmentFilter;
        return true;
      })
      .filter((machine) => {
        if (!search) return true;
        const joined = [
          machine.fleet,
          machine.machineType,
          machine.status,
          machine.location,
          machine.department,
          machine.repairReason,
          machine.sparesEta,
          machine.downtimeReason,
        ]
          .join(" ")
          .toLowerCase();
        return joined.includes(search);
      })
      .sort((a, b) => {
        if (a.majorRepair !== b.majorRepair) return a.majorRepair ? 1 : -1;
        return a.fleet.localeCompare(b.fleet);
      });
  }, [machines, filter, departmentFilter, mainSearch]);

  const adminSearchResults = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();

    if (!search) return machines.slice(0, 30).sort((a, b) => a.fleet.localeCompare(b.fleet));

    return machines
      .filter((machine) => {
        const joined = [
          machine.fleet,
          machine.machineType,
          machine.department,
          machine.location,
          machine.status,
          machine.repairReason,
          machine.downtimeReason,
        ]
          .join(" ")
          .toLowerCase();

        return joined.includes(search);
      })
      .slice(0, 30)
      .sort((a, b) => a.fleet.localeCompare(b.fleet));
  }, [adminSearch, machines]);

  const selectedHistory = useMemo(() => {
    if (!selectedFleet) return [];
    return history.filter((item) => item.fleet === selectedFleet).slice(0, 80);
  }, [history, selectedFleet]);


  const reportFleetOptions = useMemo(() => {
    return machines.slice().sort((a, b) => a.fleet.localeCompare(b.fleet));
  }, [machines]);

  const reportMachines = useMemo(() => {
    if (reportSelectedFleets.length === 0) return machines;
    const selected = new Set(reportSelectedFleets);
    return machines.filter((machine) => selected.has(machine.fleet));
  }, [machines, reportSelectedFleets]);

  const reportActiveMachines = useMemo(() => {
    return reportMachines.filter((machine) => !machine.majorRepair);
  }, [reportMachines]);

  const reportAvailableMachines = useMemo(() => {
    return reportActiveMachines.filter((machine) => machine.normalizedStatus === "AVAILABLE");
  }, [reportActiveMachines]);

  const reportDownMachines = useMemo(() => {
    return reportActiveMachines.filter((machine) => machine.normalizedStatus !== "AVAILABLE");
  }, [reportActiveMachines]);

  const reportOverallAvailability = useMemo(() => {
    if (reportActiveMachines.length === 0) return 0;
    return (
      reportActiveMachines.reduce((sum, machine) => sum + availabilityValue(machine), 0) /
      reportActiveMachines.length
    );
  }, [reportActiveMachines]);

  const reportMachineTypeSummary = useMemo(() => {
    return buildReportSummary(reportMachines, (machine) => machine.machineType || "UNKNOWN");
  }, [reportMachines]);

  const reportDepartmentSummary = useMemo(() => {
    return buildReportSummary(reportMachines, (machine) => machine.department || "Unassigned");
  }, [reportMachines]);

  const reportDepartmentTypeSummary = useMemo(() => {
    return buildReportSummary(
      reportMachines,
      (machine) => `${machine.department || "Unassigned"} - ${machine.machineType || "UNKNOWN"}`
    );
  }, [reportMachines]);

  const reportMachineComparison = useMemo(() => {
    return reportMachines
      .slice()
      .sort((a, b) => a.fleet.localeCompare(b.fleet))
      .map((machine) => {
        const machineType = machine.machineType || "UNKNOWN";
        const department = machine.department || "Unassigned";
        const sameTypeMachines = machines.filter((item) => (item.machineType || "UNKNOWN") === machineType);
        const departmentMachines = machines.filter((item) => (item.department || "Unassigned") === department);
        const departmentTypeMachines = machines.filter(
          (item) => (item.department || "Unassigned") === department && (item.machineType || "UNKNOWN") === machineType
        );

        return {
          fleet: machine.fleet,
          machineType,
          department,
          status: statusLabel(machine),
          included: machine.majorRepair ? "No" : "Yes",
          machinePercent: machine.majorRepair ? 0 : availabilityValue(machine),
          sameTypePercent: groupAvailabilityPercent(sameTypeMachines),
          sameTypeAvailable: availableCount(sameTypeMachines),
          sameTypeActive: activeCount(sameTypeMachines),
          departmentPercent: groupAvailabilityPercent(departmentMachines),
          departmentAvailable: availableCount(departmentMachines),
          departmentActive: activeCount(departmentMachines),
          departmentTypePercent: groupAvailabilityPercent(departmentTypeMachines),
          departmentTypeAvailable: availableCount(departmentTypeMachines),
          departmentTypeActive: activeCount(departmentTypeMachines),
          reason: machine.repairReason || machine.downtimeReason || "-",
        };
      });
  }, [machines, reportMachines]);

  const reportHistory = useMemo(() => {
    const selected = new Set(reportSelectedFleets);

    return history.filter((item) => {
      if (selected.size > 0 && !selected.has(item.fleet)) return false;

      if (!reportFrom && !reportTo) return true;

      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime())) return true;

      if (reportFrom) {
        const start = new Date(`${reportFrom}T00:00:00`);
        if (date < start) return false;
      }

      if (reportTo) {
        const end = new Date(`${reportTo}T23:59:59`);
        if (date > end) return false;
      }

      return true;
    });
  }, [history, reportFrom, reportSelectedFleets, reportTo]);

  function addHistory(entry: HistoryRow) {
    setHistory((previous) => [entry, ...previous].slice(0, 1000));
  }

  function recalcMachineStatus(machine: MachineRow): MachineRow {
    return {
      ...machine,
      normalizedStatus: normaliseStatus(machine.status, machine.onlineStatus, machine.majorRepair),
    };
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setNotice("Reading upload...");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      let rows: Record<string, unknown>[] = [];

      if (extension === "csv") {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        const headers = lines.shift()?.split(",").map((header) => header.trim()) || [];

        rows = lines.map((line) => {
          const values = line.split(",");
          const row: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });
          return row;
        });
      } else {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
      }

      const existing = new Map<string, MachineRow>();
      machines.forEach((machine) => existing.set(machine.fleet, machine));

      const uploadedMachines = rows
        .map((row) => buildMachineFromUploadRow(row, existing))
        .filter((machine): machine is MachineRow => Boolean(machine));

      const uploadedFleetSet = new Set(uploadedMachines.map((machine) => machine.fleet));

      const preservedAdminOnlyMachines = machines.filter((machine) => !uploadedFleetSet.has(machine.fleet));

      const nextMachines = [...uploadedMachines, ...preservedAdminOnlyMachines].map(recalcMachineStatus);

      setMachines(nextMachines);
      addHistory(
        createHistory(
          "SYSTEM",
          "Excel/CSV Upload",
          "machines",
          `${machines.length}`,
          `${nextMachines.length}`,
          `Uploaded file: ${file.name}`
        )
      );

      setNotice(
        `Upload complete. Active fleet used for percentages: ${
          nextMachines.filter((machine) => !machine.majorRepair).length
        }. Major repairs visible but excluded: ${nextMachines.filter((machine) => machine.majorRepair).length}.`
      );
    } catch (error) {
      setNotice("Upload failed. Check that the Excel/CSV headings include fleet/machine number and status.");
    } finally {
      event.target.value = "";
    }
  }

  function selectForAdmin(machine: MachineRow) {
    setAdminFleet(machine.fleet);
    setAdminDepartment(machine.department || "");
    setAdminLocation(machine.location || "");
    setAdminReason(machine.repairReason || "");
    setAdminEta(machine.sparesEta || "");
    setAdminOnlineStatus(machine.onlineStatus || machine.status || "");
    setAdminDowntimeReason(machine.downtimeReason || "");
    setSelectedFleet(machine.fleet);
  }

  function updateMachine(fleet: string, updater: (machine: MachineRow) => MachineRow, action: string, notes = "") {
    const current = machineByFleet.get(fleet);
    if (!current) {
      setNotice("Fleet number not found.");
      return;
    }

    const updated = recalcMachineStatus(updater(current));

    setMachines((previous) => previous.map((machine) => (machine.fleet === fleet ? updated : machine)));

    addHistory(
      createHistory(
        fleet,
        action,
        "machine",
        `${statusLabel(current)} / ${current.department}`,
        `${statusLabel(updated)} / ${updated.department}`,
        notes
      )
    );

    setNotice(`${fleet} updated. Major repair units remain visible but are excluded from percentage calculations.`);
  }

  function applyAdminDetails() {
    const fleet = adminFleet.trim().toUpperCase();
    if (!fleet) {
      setNotice("Choose or type a fleet number first.");
      return;
    }

    updateMachine(
      fleet,
      (machine) => ({
        ...machine,
        department: adminDepartment.trim() || machine.department || "Unassigned",
        location: adminLocation.trim() || machine.location,
      }),
      "Admin Details Updated",
      "Department/location updated"
    );
  }

  function moveToMajorRepair() {
    const fleet = adminFleet.trim().toUpperCase();
    if (!fleet) {
      setNotice("Choose or type a fleet number first.");
      return;
    }

    updateMachine(
      fleet,
      (machine) => ({
        ...machine,
        majorRepair: true,
        status: "Major Repair",
        onlineStatus: "Major Repair",
        repairReason: adminReason.trim() || machine.repairReason || "Major repair",
        sparesEta: adminEta.trim() || machine.sparesEta,
      }),
      "Moved To Major Repair",
      `Reason: ${adminReason.trim() || "Major repair"}`
    );
  }

  function returnFromMajorRepair() {
    const fleet = adminFleet.trim().toUpperCase();
    if (!fleet) {
      setNotice("Choose or type a fleet number first.");
      return;
    }

    updateMachine(
      fleet,
      (machine) => ({
        ...machine,
        majorRepair: false,
        status: "Available",
        onlineStatus: "Online",
        repairReason: "",
        sparesEta: "",
      }),
      "Returned From Major Repair",
      "Machine returned to active fleet percentage calculations"
    );
  }

  function markOnlineOffline(normalized: "AVAILABLE" | "DOWN" | "OFFLINE") {
    const fleet = adminFleet.trim().toUpperCase();
    if (!fleet) {
      setNotice("Choose or type a fleet number first.");
      return;
    }

    const label =
      normalized === "AVAILABLE" ? "Available" : normalized === "OFFLINE" ? "Offline" : "Down";

    updateMachine(
      fleet,
      (machine) => ({
        ...machine,
        majorRepair: false,
        status: label,
        onlineStatus: adminOnlineStatus.trim() || label,
        downtimeReason: normalized === "AVAILABLE" ? "" : adminDowntimeReason.trim() || machine.downtimeReason,
      }),
      `Marked ${label}`,
      normalized === "AVAILABLE" ? "Machine active" : adminDowntimeReason.trim()
    );
  }

  function exportCsv() {
    const headers = [
      "Fleet",
      "Machine Type",
      "Status",
      "Location",
      "Department",
      "Major Repair",
      "Repair Reason",
      "Spares ETA",
      "Hours Worked",
      "Hours Down",
      "Online Status",
      "Downtime Reason",
      "Included In Percentage",
    ];

    const rows = machines.map((machine) => [
      machine.fleet,
      machine.machineType,
      statusLabel(machine),
      machine.location,
      machine.department,
      machine.majorRepair ? "Yes" : "No",
      machine.repairReason,
      machine.sparesEta,
      roundOne(machine.hoursWorked),
      roundOne(machine.hoursDown),
      machine.onlineStatus,
      machine.downtimeReason,
      machine.majorRepair ? "No" : "Yes",
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `turbo-energy-availability-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  function clearFilters() {
    setFilter("ALL");
    setDepartmentFilter("");
    setMainSearch("");
  }


  function handleReportMachineSelection(event: ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    setReportSelectedFleets(selected);
  }

  function generateAvailabilityReport() {
    setReportGeneratedAt(new Date().toLocaleString());
    setNotice("Report generated. Major repair machines are shown but excluded from percentage calculations.");
  }

  function exportReportCsv() {
    const generatedAt = reportGeneratedAt || new Date().toLocaleString();
    if (!reportGeneratedAt) setReportGeneratedAt(generatedAt);

    const machineRows = reportMachines.map((machine) => [
      machine.fleet,
      machine.machineType,
      statusLabel(machine),
      machine.department,
      machine.location,
      machine.majorRepair ? "Excluded" : `${roundOne(availabilityValue(machine))}%`,
      roundOne(machine.hoursWorked),
      roundOne(machine.hoursDown),
      machine.repairReason || machine.downtimeReason || "-",
      machine.majorRepair ? "No" : "Yes",
    ]);

    const typeRows = reportMachineTypeSummary.map((item) => [
      item.name,
      item.active,
      item.available,
      item.down,
      item.majorExcluded,
      `${roundOne(item.percent)}%`,
      roundOne(item.hoursWorked),
      roundOne(item.hoursDown),
    ]);

    const departmentRows = reportDepartmentSummary.map((item) => [
      item.name,
      item.active,
      item.available,
      item.down,
      item.majorExcluded,
      `${roundOne(item.percent)}%`,
      roundOne(item.hoursWorked),
      roundOne(item.hoursDown),
    ]);

    const departmentTypeRows = reportDepartmentTypeSummary.map((item) => [
      item.name,
      item.active,
      item.available,
      item.down,
      item.majorExcluded,
      `${roundOne(item.percent)}%`,
      roundOne(item.hoursWorked),
      roundOne(item.hoursDown),
    ]);

    const comparisonRows = reportMachineComparison.map((item) => [
      item.fleet,
      item.machineType,
      item.department,
      item.status,
      item.included,
      `${roundOne(item.machinePercent)}%`,
      `${roundOne(item.sameTypePercent)}%`,
      `${item.sameTypeAvailable}/${item.sameTypeActive}`,
      `${roundOne(item.departmentPercent)}%`,
      `${item.departmentAvailable}/${item.departmentActive}`,
      `${roundOne(item.departmentTypePercent)}%`,
      `${item.departmentTypeAvailable}/${item.departmentTypeActive}`,
      item.reason,
    ]);

    const historyRows = reportHistory.map((item) => [
      item.createdAt,
      item.fleet,
      item.action,
      item.field,
      `${item.oldValue || "-"} -> ${item.newValue || "-"}`,
      item.notes,
      item.actor,
    ]);

    const rows = [
      ["Turbo Energy Machine Availability Report"],
      ["Generated by", "Admin"],
      ["Generated on", generatedAt],
      ["Date range", `${reportFrom || "Not selected"} to ${reportTo || "Not selected"}`],
      ["Machines", reportSelectedFleets.length ? reportSelectedFleets.join(" | ") : "All machines"],
      [],
      ["Overall Summary"],
      ["Selected machines", reportMachines.length],
      ["Active machines counted", reportActiveMachines.length],
      ["Available active machines", reportAvailableMachines.length],
      ["Down/offline active machines", reportDownMachines.length],
      ["Major repair excluded", reportMachines.filter((machine) => machine.majorRepair).length],
      ["Overall availability", `${roundOne(reportOverallAvailability)}%`],
      [],
      ["Machine / Same Type / Department Percentage Snapshot"],
      [
        "Fleet",
        "Type",
        "Department",
        "Status",
        "Included",
        "Machine %",
        "Same Type %",
        "Same Type Available/Active",
        "Department %",
        "Department Available/Active",
        "Department + Type %",
        "Department + Type Available/Active",
        "Reason",
      ],
      ...comparisonRows,
      [],
      ["Machine Detail"],
      ["Fleet", "Type", "Status", "Department", "Location", "% Available", "Hours Worked", "Hours Down", "Reason", "Included"],
      ...machineRows,
      [],
      ["Availability by Machine Type"],
      ["Machine Type", "Active", "Available", "Down/Offline", "Major Repair Excluded", "% Available", "Hours Worked", "Hours Down"],
      ...typeRows,
      [],
      ["Availability by Department"],
      ["Department", "Active", "Available", "Down/Offline", "Major Repair Excluded", "% Available", "Hours Worked", "Hours Down"],
      ...departmentRows,
      [],
      ["Availability by Department and Machine Type"],
      ["Department - Type", "Active", "Available", "Down/Offline", "Major Repair Excluded", "% Available", "Hours Worked", "Hours Down"],
      ...departmentTypeRows,
      [],
      ["History Records"],
      ["Date", "Fleet", "Action", "Field", "Change", "Notes", "Actor"],
      ...historyRows,
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `turbo-energy-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function clearReportFilters() {
    setReportSelectedFleets([]);
    setReportFrom("");
    setReportTo("");
    setReportGeneratedAt("");
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Turbo Energy</p>
          <h1>Machine Availability</h1>
          <p className="hero-note">
            Major repair machines stay visible in the register and repair sections, but they are excluded from
            total fleet counts, availability percentages, charts, and department availability.
          </p>
        </div>

        <div className="upload-panel">
          <label className="upload-button">
            Upload Excel / CSV
            <input accept=".xlsx,.xls,.csv" type="file" onChange={handleUpload} />
          </label>
          <button className="secondary-button" onClick={exportCsv} type="button">
            Export CSV
          </button>
          <button className="secondary-button" onClick={printReport} type="button">
            Print
          </button>
        </div>
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section className="kpi-grid">
        <button className="kpi-card" onClick={clearFilters} type="button">
          <span>Total Active Fleet</span>
          <strong>{activeMachines.length}</strong>
          <small>{majorRepairMachines.length} major repair excluded</small>
        </button>

        <button className="kpi-card good" onClick={() => setFilter("AVAILABLE")} type="button">
          <span>Available</span>
          <strong>{availableMachines.length}</strong>
          <small>{formatPercent(overallAvailability)} active fleet availability</small>
        </button>

        <button className="kpi-card danger" onClick={() => setFilter("DOWN")} type="button">
          <span>Repairs / Down</span>
          <strong>{downMachines.length}</strong>
          <small>Active fleet only</small>
        </button>

        <button className="kpi-card" onClick={() => setFilter("MAJOR_REPAIR")} type="button">
          <span>Major Repairs</span>
          <strong>{majorRepairMachines.length}</strong>
          <small>Visible, not counted in percentages</small>
        </button>

        <div className="kpi-card">
          <span>Locations</span>
          <strong>{uniqueLocations.size}</strong>
          <small>Active fleet only</small>
        </div>

        <div className="kpi-card">
          <span>Hours</span>
          <strong>{roundOne(totalHoursWorked)}</strong>
          <small>{roundOne(totalHoursDown)} hours down, active fleet only</small>
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Availability by Machine Type</h2>
              <p>Calculations exclude machines under major repair.</p>
            </div>
          </div>

          {typeStats.length === 0 ? (
            <div className="empty-box">Upload your Excel/CSV file to show machine type availability.</div>
          ) : (
            <div className="bar-list">
              {typeStats.map((item) => (
                <div className="bar-row" key={item.type}>
                  <div className="bar-meta">
                    <strong>{item.type}</strong>
                    <span>
                      {item.available}/{item.total} available · {formatPercent(item.percent)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Department Availability</h2>
              <p>Click a department to drill down into active fleet machines.</p>
            </div>
          </div>

          {departmentStats.length === 0 ? (
            <div className="empty-box">No department data yet.</div>
          ) : (
            <div className="department-grid">
              {departmentStats.map((item) => (
                <button
                  className="department-card"
                  key={item.department}
                  onClick={() => {
                    setFilter("DEPARTMENT");
                    setDepartmentFilter(item.department);
                  }}
                  type="button"
                >
                  <span>{item.department}</span>
                  <strong>{formatPercent(item.percent)}</strong>
                  <small>
                    {item.available}/{item.total} available · {item.down} down
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel report-panel" id="availability-report">
        <div className="panel-heading">
          <div>
            <h2>Report Generator</h2>
            <p>
              Select machines and dates to report machine availability, same-type availability, and department
              availability percentages.
            </p>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={generateAvailabilityReport} type="button">
              Generate Report
            </button>
            <button className="secondary-button" onClick={printReport} type="button">
              Print Report
            </button>
            <button className="secondary-button" onClick={exportReportCsv} type="button">
              Export Report CSV
            </button>
          </div>
        </div>

        <div className="report-control-grid">
          <label>
            Machines
            <select multiple value={reportSelectedFleets} onChange={handleReportMachineSelection}>
              {reportFleetOptions.map((machine) => (
                <option key={machine.id} value={machine.fleet}>
                  {machine.fleet} - {machine.machineType}
                </option>
              ))}
            </select>
          </label>

          <label>
            From date
            <input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
          </label>

          <label>
            To date
            <input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
          </label>
        </div>

        <div className="button-row report-button-row">
          <button className="secondary-button" onClick={clearReportFilters} type="button">
            Clear Report Filters
          </button>
        </div>

        <div className="active-filter report-meta">
          <strong>Date range:</strong> {reportFrom || "Not selected"} to {reportTo || "Not selected"} |{" "}
          <strong>Machines:</strong> {reportSelectedFleets.length ? reportSelectedFleets.join(", ") : "All machines"} |{" "}
          <strong>Generated:</strong> {reportGeneratedAt || "Not generated yet"}
        </div>

        <div className="report-summary-grid">
          <div className="detail-card">
            <span>Selected machines</span>
            <strong>{reportMachines.length}</strong>
          </div>
          <div className="detail-card">
            <span>Active counted</span>
            <strong>{reportActiveMachines.length}</strong>
          </div>
          <div className="detail-card">
            <span>Available</span>
            <strong>{reportAvailableMachines.length}</strong>
          </div>
          <div className="detail-card">
            <span>Availability</span>
            <strong>{formatPercent(reportOverallAvailability)}</strong>
          </div>
        </div>

        <h3 className="report-section-title">Machine / Same Type / Department Percentages</h3>
        <div className="table-wrap report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fleet</th>
                <th>Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Machine %</th>
                <th>Same Type %</th>
                <th>Same Type Count</th>
                <th>Department %</th>
                <th>Department Count</th>
                <th>Dept + Type %</th>
                <th>Dept + Type Count</th>
                <th>Included</th>
              </tr>
            </thead>
            <tbody>
              {reportMachineComparison.length === 0 ? (
                <tr>
                  <td colSpan={12}>No machines selected.</td>
                </tr>
              ) : (
                reportMachineComparison.map((item) => (
                  <tr key={`report-compare-${item.fleet}`}>
                    <td>{item.fleet}</td>
                    <td>{item.machineType}</td>
                    <td>{item.department}</td>
                    <td>{item.status}</td>
                    <td>{item.included === "No" ? "Excluded" : formatPercent(item.machinePercent)}</td>
                    <td>{formatPercent(item.sameTypePercent)}</td>
                    <td>
                      {item.sameTypeAvailable}/{item.sameTypeActive}
                    </td>
                    <td>{formatPercent(item.departmentPercent)}</td>
                    <td>
                      {item.departmentAvailable}/{item.departmentActive}
                    </td>
                    <td>{formatPercent(item.departmentTypePercent)}</td>
                    <td>
                      {item.departmentTypeAvailable}/{item.departmentTypeActive}
                    </td>
                    <td>{item.included}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3 className="report-section-title">Machine Detail</h3>
        <div className="table-wrap report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fleet</th>
                <th>Type</th>
                <th>Status</th>
                <th>Department</th>
                <th>Location</th>
                <th>% Available</th>
                <th>Hours Worked</th>
                <th>Hours Down</th>
                <th>Reason</th>
                <th>Included</th>
              </tr>
            </thead>
            <tbody>
              {reportMachines.length === 0 ? (
                <tr>
                  <td colSpan={10}>No machines selected.</td>
                </tr>
              ) : (
                reportMachines.map((machine) => (
                  <tr className={machine.majorRepair ? "major-row" : ""} key={`report-${machine.id}`}>
                    <td>{machine.fleet}</td>
                    <td>{machine.machineType}</td>
                    <td>{statusLabel(machine)}</td>
                    <td>{machine.department}</td>
                    <td>{machine.location || "-"}</td>
                    <td>{machine.majorRepair ? "Excluded" : `${roundOne(availabilityValue(machine))}%`}</td>
                    <td>{roundOne(machine.hoursWorked)}</td>
                    <td>{roundOne(machine.hoursDown)}</td>
                    <td>{machine.repairReason || machine.downtimeReason || "-"}</td>
                    <td>{machine.majorRepair ? "No" : "Yes"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="two-column report-two-column">
          <div>
            <h3 className="report-section-title">Availability by Machine Type</h3>
            <div className="table-wrap report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Machine Type</th>
                    <th>Active</th>
                    <th>Available</th>
                    <th>Down</th>
                    <th>Excluded</th>
                    <th>% Available</th>
                  </tr>
                </thead>
                <tbody>
                  {reportMachineTypeSummary.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No report data.</td>
                    </tr>
                  ) : (
                    reportMachineTypeSummary.map((item) => (
                      <tr key={`type-${item.name}`}>
                        <td>{item.name}</td>
                        <td>{item.active}</td>
                        <td>{item.available}</td>
                        <td>{item.down}</td>
                        <td>{item.majorExcluded}</td>
                        <td>{formatPercent(item.percent)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="report-section-title">Availability by Department</h3>
            <div className="table-wrap report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Active</th>
                    <th>Available</th>
                    <th>Down</th>
                    <th>Excluded</th>
                    <th>% Available</th>
                  </tr>
                </thead>
                <tbody>
                  {reportDepartmentSummary.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No report data.</td>
                    </tr>
                  ) : (
                    reportDepartmentSummary.map((item) => (
                      <tr key={`department-${item.name}`}>
                        <td>{item.name}</td>
                        <td>{item.active}</td>
                        <td>{item.available}</td>
                        <td>{item.down}</td>
                        <td>{item.majorExcluded}</td>
                        <td>{formatPercent(item.percent)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <h3 className="report-section-title">Availability by Department and Machine Type</h3>
        <div className="table-wrap report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department - Type</th>
                <th>Active</th>
                <th>Available</th>
                <th>Down</th>
                <th>Excluded</th>
                <th>% Available</th>
                <th>Hours Worked</th>
                <th>Hours Down</th>
              </tr>
            </thead>
            <tbody>
              {reportDepartmentTypeSummary.length === 0 ? (
                <tr>
                  <td colSpan={8}>No report data.</td>
                </tr>
              ) : (
                reportDepartmentTypeSummary.map((item) => (
                  <tr key={`department-type-${item.name}`}>
                    <td>{item.name}</td>
                    <td>{item.active}</td>
                    <td>{item.available}</td>
                    <td>{item.down}</td>
                    <td>{item.majorExcluded}</td>
                    <td>{formatPercent(item.percent)}</td>
                    <td>{roundOne(item.hoursWorked)}</td>
                    <td>{roundOne(item.hoursDown)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3 className="report-section-title">History Records</h3>
        <div className="table-wrap report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Fleet</th>
                <th>Action</th>
                <th>Field</th>
                <th>Change</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {reportHistory.length === 0 ? (
                <tr>
                  <td colSpan={6}>No history records for this report selection.</td>
                </tr>
              ) : (
                reportHistory.slice(0, 120).map((item) => (
                  <tr key={`report-history-${item.id}`}>
                    <td>{item.createdAt}</td>
                    <td>{item.fleet}</td>
                    <td>{item.action}</td>
                    <td>{item.field}</td>
                    <td>
                      {item.oldValue || "-"} → {item.newValue || "-"}
                    </td>
                    <td>{item.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Admin Controls</h2>
            <p>Search fleet number, assign department, mark down/offline, or move to major repair.</p>
          </div>
        </div>

        <div className="admin-layout">
          <div className="admin-search-card">
            <label>Fleet search</label>
            <input
              placeholder="Search fleet, type, department, reason..."
              value={adminSearch}
              onChange={(event) => setAdminSearch(event.target.value)}
            />

            <div className="admin-results">
              {adminSearchResults.length === 0 ? (
                <div className="empty-box small">No machines found.</div>
              ) : (
                adminSearchResults.map((machine) => (
                  <button
                    className={adminFleet === machine.fleet ? "result-row active" : "result-row"}
                    key={machine.id}
                    onClick={() => selectForAdmin(machine)}
                    type="button"
                  >
                    <strong>{machine.fleet}</strong>
                    <span>{machine.machineType}</span>
                    <em className={machine.majorRepair ? "pill major" : "pill"}>{statusLabel(machine)}</em>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="admin-form-card">
            <div className="form-grid">
              <label>
                Fleet number
                <input
                  placeholder="e.g. FEL 01"
                  value={adminFleet}
                  onChange={(event) => setAdminFleet(event.target.value.toUpperCase())}
                />
              </label>

              <label>
                Department
                <input
                  placeholder="e.g. Plant / Mining / Transport"
                  value={adminDepartment}
                  onChange={(event) => setAdminDepartment(event.target.value)}
                />
              </label>

              <label>
                Location
                <input
                  placeholder="e.g. Hwange"
                  value={adminLocation}
                  onChange={(event) => setAdminLocation(event.target.value)}
                />
              </label>

              <label>
                Online / Offline status
                <input
                  placeholder="Online, Offline, Down..."
                  value={adminOnlineStatus}
                  onChange={(event) => setAdminOnlineStatus(event.target.value)}
                />
              </label>

              <label className="full">
                Downtime reason
                <textarea
                  placeholder="Reason when machine is down/offline"
                  value={adminDowntimeReason}
                  onChange={(event) => setAdminDowntimeReason(event.target.value)}
                />
              </label>

              <label className="full">
                Major repair reason
                <textarea
                  placeholder="Reason shown under major repairs"
                  value={adminReason}
                  onChange={(event) => setAdminReason(event.target.value)}
                />
              </label>

              <label>
                Spares ETA
                <input
                  placeholder="Expected spares date"
                  value={adminEta}
                  onChange={(event) => setAdminEta(event.target.value)}
                />
              </label>
            </div>

            <div className="button-row">
              <button className="secondary-button" onClick={applyAdminDetails} type="button">
                Save Details
              </button>
              <button className="good-button" onClick={() => markOnlineOffline("AVAILABLE")} type="button">
                Mark Available
              </button>
              <button className="warning-button" onClick={() => markOnlineOffline("DOWN")} type="button">
                Mark Down
              </button>
              <button className="warning-button" onClick={() => markOnlineOffline("OFFLINE")} type="button">
                Mark Offline
              </button>
              <button className="danger-button" onClick={moveToMajorRepair} type="button">
                Move to Major Repair
              </button>
              <button className="secondary-button" onClick={returnFromMajorRepair} type="button">
                Return to Active Fleet
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Major Repair / Long Term Rebuild</h2>
            <p>These machines are visible here and in the full register, but excluded from active fleet percentages.</p>
          </div>
          <button className="secondary-button" onClick={() => setFilter("MAJOR_REPAIR")} type="button">
            Show Only Major Repairs
          </button>
        </div>

        {majorRepairMachines.length === 0 ? (
          <div className="empty-box">No machines are currently under major repair.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fleet</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Reason</th>
                  <th>Spares ETA</th>
                  <th>Hours Down</th>
                </tr>
              </thead>
              <tbody>
                {majorRepairMachines.map((machine) => (
                  <tr key={machine.id}>
                    <td>
                      <button className="link-button" onClick={() => setSelectedFleet(machine.fleet)} type="button">
                        {machine.fleet}
                      </button>
                    </td>
                    <td>{machine.machineType}</td>
                    <td>{machine.department}</td>
                    <td>{machine.location}</td>
                    <td>{machine.repairReason || machine.downtimeReason || "-"}</td>
                    <td>{machine.sparesEta || "-"}</td>
                    <td>{roundOne(machine.hoursDown)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Machine Availability Register</h2>
            <p>
              This register shows all machines. The “Included” column confirms whether the machine affects percentage
              calculations.
            </p>
          </div>
          <div className="register-actions">
            <input
              placeholder="Search fleet, department, location, reason..."
              value={mainSearch}
              onChange={(event) => setMainSearch(event.target.value)}
            />
            <button className="secondary-button" onClick={clearFilters} type="button">
              Clear
            </button>
          </div>
        </div>

        <div className="active-filter">
          <strong>Current view:</strong>{" "}
          {filter === "ALL"
            ? "All machines"
            : filter === "DEPARTMENT"
            ? `Department - ${departmentFilter}`
            : filter.replace("_", " ")}
        </div>

        {filteredMachines.length === 0 ? (
          <div className="empty-box">No machines match this view.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fleet</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Availability</th>
                  <th>Hours Worked</th>
                  <th>Hours Down</th>
                  <th>Reason</th>
                  <th>Included</th>
                </tr>
              </thead>
              <tbody>
                {filteredMachines.map((machine) => (
                  <tr className={machine.majorRepair ? "major-row" : ""} key={machine.id}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => {
                          setSelectedFleet(machine.fleet);
                          selectForAdmin(machine);
                        }}
                        type="button"
                      >
                        {machine.fleet}
                      </button>
                    </td>
                    <td>{machine.machineType}</td>
                    <td>
                      <span className={machine.majorRepair ? "pill major" : "pill"}>{statusLabel(machine)}</span>
                    </td>
                    <td>{machine.department}</td>
                    <td>{machine.location || "-"}</td>
                    <td>{machine.majorRepair ? "Excluded" : machine.availability !== null ? `${roundOne(machine.availability)}%` : "-"}</td>
                    <td>{roundOne(machine.hoursWorked)}</td>
                    <td>{roundOne(machine.hoursDown)}</td>
                    <td>{machine.repairReason || machine.downtimeReason || "-"}</td>
                    <td>{machine.majorRepair ? "No" : "Yes"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Machine Detail & History</h2>
            <p>Select a machine to view status, hours, reasons, and admin movement history.</p>
          </div>
          <select value={selectedFleet} onChange={(event) => setSelectedFleet(event.target.value)}>
            <option value="">Select machine</option>
            {machines
              .slice()
              .sort((a, b) => a.fleet.localeCompare(b.fleet))
              .map((machine) => (
                <option key={machine.id} value={machine.fleet}>
                  {machine.fleet} - {machine.machineType}
                </option>
              ))}
          </select>
        </div>

        {!selectedMachine ? (
          <div className="empty-box">No machine selected.</div>
        ) : (
          <div className="detail-grid">
            <div className="detail-card">
              <span>Fleet</span>
              <strong>{selectedMachine.fleet}</strong>
            </div>
            <div className="detail-card">
              <span>Type</span>
              <strong>{selectedMachine.machineType}</strong>
            </div>
            <div className="detail-card">
              <span>Status</span>
              <strong>{statusLabel(selectedMachine)}</strong>
            </div>
            <div className="detail-card">
              <span>Included in percentages</span>
              <strong>{selectedMachine.majorRepair ? "No" : "Yes"}</strong>
            </div>
            <div className="detail-card">
              <span>Hours worked</span>
              <strong>{roundOne(selectedMachine.hoursWorked)}</strong>
            </div>
            <div className="detail-card">
              <span>Hours down</span>
              <strong>{roundOne(selectedMachine.hoursDown)}</strong>
            </div>
            <div className="detail-card wide">
              <span>Reason</span>
              <strong>{selectedMachine.repairReason || selectedMachine.downtimeReason || "-"}</strong>
            </div>
          </div>
        )}

        {selectedMachine && (
          <div className="history-list">
            <h3>History</h3>
            {selectedHistory.length === 0 ? (
              <div className="empty-box small">No history yet for this machine.</div>
            ) : (
              selectedHistory.map((item) => (
                <div className="history-row" key={item.id}>
                  <strong>{item.action}</strong>
                  <span>{item.createdAt}</span>
                  <p>
                    {item.oldValue} → {item.newValue}
                  </p>
                  {item.notes && <small>{item.notes}</small>}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page-shell {
          min-height: 100vh;
          padding: 28px;
          color: #102033;
          background:
            radial-gradient(circle at top left, rgba(30, 64, 175, 0.2), transparent 28rem),
            linear-gradient(135deg, #eef3fb 0%, #f8fafc 42%, #e2e8f0 100%);
        }

        .hero-card,
        .panel,
        .kpi-card {
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(10px);
        }

        .hero-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-radius: 28px;
          padding: 28px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1d4ed8;
        }

        h1,
        h2,
        h3,
        p {
          margin-top: 0;
        }

        h1 {
          margin-bottom: 8px;
          font-size: clamp(32px, 5vw, 56px);
          line-height: 0.98;
          color: #0f172a;
        }

        h2 {
          margin-bottom: 4px;
          font-size: 22px;
          color: #0f172a;
        }

        h3 {
          margin: 24px 0 10px;
          font-size: 17px;
        }

        .hero-note,
        .panel-heading p {
          margin-bottom: 0;
          color: #64748b;
        }

        .upload-panel,
        .button-row,
        .register-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }

        .upload-button,
        button,
        select {
          border: 0;
          border-radius: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .upload-button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 12px 18px;
          color: white;
          background: #1e3a8a;
        }

        .upload-button input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        .secondary-button,
        .good-button,
        .warning-button,
        .danger-button {
          min-height: 44px;
          padding: 11px 16px;
        }

        .secondary-button {
          color: #0f172a;
          background: #e2e8f0;
        }

        .good-button {
          color: white;
          background: #15803d;
        }

        .warning-button {
          color: #111827;
          background: #facc15;
        }

        .danger-button {
          color: white;
          background: #b91c1c;
        }

        .notice {
          margin: 18px 0;
          border-left: 5px solid #1d4ed8;
          border-radius: 16px;
          padding: 14px 18px;
          color: #1e3a8a;
          background: #dbeafe;
          font-weight: 700;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin: 18px 0;
        }

        .kpi-card {
          display: flex;
          min-height: 138px;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          border-radius: 24px;
          padding: 18px;
          text-align: left;
        }

        .kpi-card span,
        .detail-card span {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
        }

        .kpi-card strong {
          font-size: 36px;
          line-height: 1;
          color: #0f172a;
        }

        .kpi-card small {
          color: #64748b;
          font-weight: 700;
        }

        .kpi-card.good {
          border-color: rgba(21, 128, 61, 0.25);
          background: #ecfdf5;
        }

        .kpi-card.danger {
          border-color: rgba(185, 28, 28, 0.25);
          background: #fef2f2;
        }

        .two-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panel {
          margin-bottom: 18px;
          border-radius: 26px;
          padding: 22px;
        }

        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .bar-list {
          display: grid;
          gap: 14px;
        }

        .bar-row {
          display: grid;
          gap: 8px;
        }

        .bar-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #475569;
        }

        .bar-meta strong {
          color: #0f172a;
        }

        .bar-track {
          overflow: hidden;
          height: 14px;
          border-radius: 999px;
          background: #e2e8f0;
        }

        .bar-fill {
          height: 100%;
          border-radius: 999px;
          background: #1d4ed8;
        }

        .department-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .department-card {
          min-height: 116px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 16px;
          text-align: left;
          background: #f8fafc;
        }

        .department-card span {
          display: block;
          margin-bottom: 12px;
          color: #475569;
          font-weight: 900;
        }

        .department-card strong {
          display: block;
          margin-bottom: 8px;
          font-size: 28px;
          color: #0f172a;
        }

        .department-card small {
          color: #64748b;
          font-weight: 700;
        }

        .admin-layout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 18px;
        }

        .admin-search-card,
        .admin-form-card {
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 16px;
          background: #f8fafc;
        }

        label {
          display: grid;
          gap: 7px;
          color: #334155;
          font-weight: 900;
        }

        input,
        textarea,
        select {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 12px 13px;
          color: #0f172a;
          background: white;
          font: inherit;
          font-weight: 650;
          outline: none;
        }

        textarea {
          min-height: 82px;
          resize: vertical;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #1d4ed8;
          box-shadow: 0 0 0 4px rgba(29, 78, 216, 0.12);
        }

        .admin-results {
          display: grid;
          max-height: 470px;
          gap: 8px;
          overflow: auto;
          margin-top: 14px;
          padding-right: 4px;
        }

        .result-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 6px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 12px;
          text-align: left;
          background: white;
        }

        .result-row.active {
          border-color: #1d4ed8;
          background: #dbeafe;
        }

        .result-row span {
          color: #64748b;
          font-size: 13px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .full {
          grid-column: 1 / -1;
        }

        .button-row {
          margin-top: 16px;
        }

        .table-wrap {
          width: 100%;
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
        }

        table {
          width: 100%;
          min-width: 1000px;
          border-collapse: collapse;
          background: white;
        }

        th,
        td {
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 14px;
          text-align: left;
          vertical-align: top;
        }

        th {
          position: sticky;
          top: 0;
          z-index: 1;
          color: #475569;
          background: #f8fafc;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .major-row td {
          background: #fff7ed;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 10px;
          color: #075985;
          background: #e0f2fe;
          font-size: 12px;
          font-style: normal;
          font-weight: 900;
          white-space: nowrap;
        }

        .pill.major {
          color: #9a3412;
          background: #ffedd5;
        }

        .link-button {
          padding: 0;
          color: #1d4ed8;
          background: transparent;
          font-weight: 900;
          text-decoration: underline;
        }

        .active-filter {
          margin-bottom: 12px;
          color: #475569;
          font-weight: 700;
        }

        .empty-box {
          border: 1px dashed #cbd5e1;
          border-radius: 18px;
          padding: 22px;
          color: #64748b;
          background: #f8fafc;
          font-weight: 800;
          text-align: center;
        }

        .empty-box.small {
          padding: 12px;
          font-size: 13px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .detail-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 16px;
          background: #f8fafc;
        }

        .detail-card strong {
          display: block;
          margin-top: 8px;
          color: #0f172a;
          font-size: 21px;
        }

        .detail-card.wide {
          grid-column: span 2;
        }

        .history-list {
          margin-top: 16px;
        }

        .history-row {
          border-left: 4px solid #1d4ed8;
          border-radius: 16px;
          margin-bottom: 10px;
          padding: 12px 14px;
          background: #f8fafc;
        }

        .history-row strong {
          color: #0f172a;
        }

        .history-row span {
          margin-left: 10px;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .history-row p {
          margin: 8px 0 0;
          color: #334155;
        }

        .history-row small {
          display: block;
          margin-top: 6px;
          color: #64748b;
          font-weight: 700;
        }

        .report-control-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1.4fr) minmax(160px, 0.6fr) minmax(160px, 0.6fr);
          gap: 14px;
          align-items: end;
        }

        .report-control-grid select[multiple] {
          min-height: 132px;
        }

        .report-button-row {
          margin-top: 14px;
        }

        .report-meta {
          margin-top: 14px;
        }

        .report-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 16px 0;
        }

        .report-section-title {
          margin-top: 18px;
        }

        .report-table-wrap {
          margin-bottom: 16px;
        }

        .report-table-wrap table {
          min-width: 1120px;
        }

        .report-two-column {
          margin-top: 6px;
          margin-bottom: 6px;
        }

        @media print {
          :global(body *) {
            visibility: hidden !important;
          }

          #availability-report,
          #availability-report * {
            visibility: visible !important;
          }

          #availability-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: 0;
            box-shadow: none;
            background: white;
          }

          #availability-report .button-row,
          #availability-report .report-control-grid,
          #availability-report .report-button-row,
          input,
          textarea,
          select,
          button {
            display: none !important;
          }

          .page-shell {
            padding: 0;
            background: white;
          }

          .report-table-wrap {
            overflow: visible;
          }

          .report-table-wrap table {
            min-width: 0;
            width: 100%;
            font-size: 10px;
          }
        }

        @media (max-width: 1200px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .two-column,
          .admin-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page-shell {
            padding: 14px;
          }

          .hero-card,
          .panel-heading,
          .register-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .kpi-grid,
          .department-grid,
          .form-grid,
          .detail-grid,
          .report-control-grid,
          .report-summary-grid {
            grid-template-columns: 1fr;
          }

          .detail-card.wide {
            grid-column: auto;
          }

          .hero-card,
          .panel {
            border-radius: 20px;
            padding: 16px;
          }

          .kpi-card {
            min-height: 110px;
          }
        }
      `}</style>
    </main>
  );
}



