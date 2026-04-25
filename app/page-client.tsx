"use client";

import { signOut } from "next-auth/react";
import * as XLSX from "xlsx";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Machine = {
  fleet: string;
  type: string;
  machineType: string;
  status: string;
  location: string;
  department: string;
  availability: number;
  updated: string;
  majorRepair: boolean;
  repairReason: string;
  sparesEta: string;
  hoursWorked: number;
  hoursDown: number;
  onlineStatus: string;
  downtimeReason: string;
};

type HistoryItem = {
  id: number;
  created_at: string;
  actor: string;
  action: string;
  fleet: string;
  field: string;
  old_value: string;
  new_value: string;
  notes: string;
};

type WorkbookSheetData = {
  name: string;
  rows: Record<string, unknown>[];
};

type DashboardClientProps = {
  role: string;
  username: string;
};

type RegisterFilter = "ALL" | "AVAILABLE" | "DOWN" | "MAJOR";

// Fixed departments from the uploaded department allocation workbook.
const departments = ["Mining", "Logistics", "Plant", "Workshop", "Engineering & Civils", "Stores & Procurement", "Admin"];
const onlineStatuses = ["Online", "Offline", "Standby"];

const FIXED_DEPARTMENT_BY_FLEET: Record<string, string> = {
  "ABH4195": "Admin",
  "AEK9938": "Admin",
  "AEX0450": "Admin",
  "AEX0451": "Admin",
  "AFC9890": "Admin",
  "AFE5504": "Admin",
  "AFK8279": "Admin",
  "AFN0307": "Admin",
  "AFR5684": "Admin",
  "AFX0359": "Admin",
  "AFX1489": "Admin",
  "AFX3400": "Admin",
  "AFX7681": "Admin",
  "AGA5421": "Admin",
  "AGA5514": "Admin",
  "AGA5529": "Admin",
  "AGE5580": "Admin",
  "AGE7705": "Admin",
  "AGP4457": "Admin",
  "AGP4458": "Admin",
  "AGP9562": "Admin",
  "AGQ7369": "Admin",
  "AGQ7370": "Admin",
  "AHH2977": "Admin",
  "CARGO05": "Engineering & Civils",
  "CH44": "Logistics",
  "CH46": "Logistics",
  "FEL02": "Plant",
  "FEL04": "Plant",
  "FEL05": "Plant",
  "FEL06": "Plant",
  "FEL07": "Plant",
  "FEL08": "Plant",
  "FEL09": "Plant",
  "FEL10": "Logistics",
  "FEL11": "Plant",
  "FEL12": "Plant",
  "FEL13": "Logistics",
  "FEL14": "Plant",
  "FEL15": "Plant",
  "HT01": "Plant",
  "HT02": "Plant",
  "HT03": "Logistics",
  "HT04": "Logistics",
  "HT06": "Logistics",
  "HT07": "Logistics",
  "HT08": "Logistics",
  "HT09": "Logistics",
  "HT10": "Logistics",
  "HT11": "Logistics",
  "HT12": "Plant",
  "HT13": "Logistics",
  "HT14": "Logistics",
  "HT15": "Logistics",
  "HT17": "Logistics",
  "HT18": "Logistics",
  "HT19": "Logistics",
  "HT20": "Logistics",
  "MWB01": "Mining",
  "TCD01": "Mining",
  "TCM01": "Engineering & Civils",
  "TCT01": "Workshop",
  "TDC01": "Mining",
  "TDC02": "Mining",
  "TDC03": "Mining",
  "TDC04": "Mining",
  "TDR01": "Mining",
  "TDR02": "Mining",
  "TDR03": "Mining",
  "TEX01": "Mining",
  "TEX02": "Mining",
  "TEX03": "Plant",
  "TEX04": "Mining",
  "TEX05": "Mining",
  "TEX06": "Mining",
  "TEX07": "Mining",
  "TFB01": "Stores & Procurement",
  "TFB02": "Stores & Procurement",
  "TFL01": "Stores & Procurement",
  "TFL02": "Workshop",
  "TG08": "Admin",
  "TG10": "Admin",
  "TLB01": "Engineering & Civils",
  "TLB03": "Mining",
  "TLG01": "Logistics",
  "TLG02": "Logistics",
  "TLT01": "Mining",
  "TLT02": "Mining",
  "TLT03": "Mining",
  "TLT04": "Mining",
  "TLT05": "Mining",
  "TLT06": "Mining",
  "TLT07": "Mining",
  "TMA01": "Mining",
  "TMB01": "Logistics",
  "TMD03": "Mining",
  "TMD05": "Mining",
  "TMD06": "Mining",
  "TMD07": "Mining",
  "TMD08": "Mining",
  "TMG01": "Mining",
  "TMR01": "Logistics",
  "TMT01": "Engineering & Civils",
  "TMT02": "Mining",
  "TPT01": "Stores & Procurement",
  "TRL01": "Logistics",
  "TRL02": "Logistics",
  "TRL03": "Logistics",
  "TRL04": "Logistics",
  "TRL05": "Logistics",
  "TRL06": "Logistics",
  "TRL07": "Logistics",
  "TRL08": "Logistics",
  "TRT01": "Mining",
  "TRT02": "Mining",
  "TRT03": "Mining",
  "TRT04": "Mining",
  "TRT05": "Mining",
  "TRT06": "Mining",
  "TRT07": "Mining",
  "TRT08": "Mining",
  "TRT09": "Mining",
  "TRT10": "Mining",
  "TRT11": "Mining",
  "TRT12": "Mining",
  "TRT13": "Mining",
  "TRT14": "Mining",
  "TRT15": "Mining",
  "TRT16": "Mining",
  "TRT17": "Mining",
  "TRT18": "Mining",
  "TRT19": "Mining",
  "TRT20": "Mining",
  "TT01": "Engineering & Civils",
  "TWC01": "Workshop",
  "TWC02": "Logistics",
  "TWP01": "Mining",
  "TWP02": "Mining",
  "TWP03": "Mining",
  "TWP04": "Logistics",
  "TWP07": "Mining",
  "TWP08": "Mining",
  "TWP09": "Mining",
  "TWS01": "Workshop",
  "TWS02": "Workshop",
  "TWS03": "Workshop",
  "WB01": "Logistics",
  "WB02": "Logistics",
  "WB03": "Logistics",
};

const sampleData: Machine[] = [
  {
    fleet: "FEL09",
    type: "FEL",
    machineType: "SL60",
    status: "Available",
    location: "Hwange",
    department: "Plant",
    availability: 88,
    updated: "19 Apr 2026",
    majorRepair: false,
    repairReason: "",
    sparesEta: "",
    hoursWorked: 210,
    hoursDown: 8,
    onlineStatus: "Online",
    downtimeReason: "",
  },
  {
    fleet: "TEX01",
    type: "TEX",
    machineType: "TK371",
    status: "Repair",
    location: "Hwange",
    department: "Mining",
    availability: 75,
    updated: "19 Apr 2026",
    majorRepair: false,
    repairReason: "Hydraulic leak",
    sparesEta: "26 Apr 2026",
    hoursWorked: 166,
    hoursDown: 24,
    onlineStatus: "Offline",
    downtimeReason: "Hydraulic system repair",
  },
  {
    fleet: "AFE 5504",
    type: "LDV",
    machineType: "Light Vehicle",
    status: "Available",
    location: "Hwange",
    department: "Logistics",
    availability: 92,
    updated: "19 Apr 2026",
    majorRepair: false,
    repairReason: "",
    sparesEta: "",
    hoursWorked: 180,
    hoursDown: 2,
    onlineStatus: "Online",
    downtimeReason: "",
  },
];

export default function DashboardClient({ role, username }: DashboardClientProps) {
  const isAdmin = role === "admin";

  const [machines, setMachines] = useState<Machine[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [selectedType, setSelectedType] = useState("ALL");
  const [registerFilter, setRegisterFilter] = useState<RegisterFilter>("ALL");
  const [search, setSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [fileName, setFileName] = useState("No file chosen");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [workbookSheets, setWorkbookSheets] = useState<WorkbookSheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [selectedFleet, setSelectedFleet] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("Plant");
  const [reportMachines, setReportMachines] = useState<string[]>([]);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportData, setReportData] = useState<HistoryItem[]>([]);

  useEffect(() => {
    void Promise.all([loadMachinesFromSupabase(), loadHistoryFromSupabase()]);

    const interval = setInterval(() => {
      void loadMachinesFromSupabase(false);
      void loadHistoryFromSupabase();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  async function loadMachinesFromSupabase(showLoader = true) {
    if (showLoader) setLoadingData(true);

    const { data, error } = await supabase
      .from("machines")
      .select(
        "fleet,type,machineType,status,location,department,availability,updated,majorRepair,repairReason,sparesEta,hoursWorked,hoursDown,onlineStatus,downtimeReason"
      );

    if (error) {
      console.error("Supabase load error:", error);
      const fallback = dedupeMachinesByFleet(sampleData.map((machine) => normalizeLoadedMachine(machine, true)));
      setMachines(fallback);
      if (!selectedFleet && fallback.length > 0) setSelectedFleet(fallback[0].fleet);
      setLoadingData(false);
      return;
    }

    const loaded =
      data && data.length > 0
        ? dedupeMachinesByFleet((data as Partial<Machine>[]).map((machine) => normalizeLoadedMachine(machine, true)))
        : dedupeMachinesByFleet(sampleData.map((machine) => normalizeLoadedMachine(machine, true)));

    setMachines(loaded);
    if (!selectedFleet && loaded.length > 0) setSelectedFleet(loaded[0].fleet);
    setLoadingData(false);
  }

  async function loadHistoryFromSupabase() {
    const { data, error } = await supabase
      .from("machine_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("History load error:", error);
      return;
    }

    setHistoryItems((data as HistoryItem[]) || []);
  }

  async function addHistoryEntry(entry: {
    action: string;
    fleet?: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    notes?: string;
  }) {
    const { error } = await supabase.from("machine_history").insert({
      actor: username,
      action: entry.action,
      fleet: entry.fleet || "",
      field: entry.field || "",
      old_value: entry.oldValue || "",
      new_value: entry.newValue || "",
      notes: entry.notes || "",
    });

    if (error) {
      console.error("History insert error:", error);
      return;
    }

    await loadHistoryFromSupabase();
  }

  async function saveMachines(data: Machine[], forceFixedDepartments = true) {
    const normalized = dedupeMachinesByFleet(data.map((machine) => normalizeLoadedMachine(machine, forceFixedDepartments)));
    setMachines(normalized);

    const payload = normalized.map((machine) => ({
      fleet: machine.fleet,
      type: machine.type,
      machineType: machine.machineType,
      status: machine.status,
      location: machine.location,
      department: machine.department,
      availability: Number(machine.availability) || 0,
      updated: machine.updated || "",
      majorRepair: Boolean(machine.majorRepair),
      repairReason: machine.repairReason || "",
      sparesEta: machine.sparesEta || "",
      hoursWorked: Number(machine.hoursWorked) || 0,
      hoursDown: Number(machine.hoursDown) || 0,
      onlineStatus: machine.onlineStatus || "Online",
      downtimeReason: machine.downtimeReason || "",
    }));

    const { error: deleteError } = await supabase.from("machines").delete().neq("fleet", "__NONE__");

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      alert("Could not clear old shared machine data.");
      return false;
    }

    const { error: insertError } = await supabase.from("machines").insert(payload);

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      alert("Could not save shared machine data.");
      return false;
    }

    return true;
  }

  async function generateReport() {
    if (!reportFrom || !reportTo) {
      alert("Select date range");
      return;
    }

    const from = `${reportFrom}T00:00:00`;
    const to = `${reportTo}T23:59:59`;

    const { data, error } = await supabase
      .from("machine_history")
      .select("*")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Report error:", error);
      alert("Error generating report");
      return;
    }

    const filtered = ((data as HistoryItem[]) || []).filter(
      (item) => reportMachines.length === 0 || reportMachines.includes(item.fleet)
    );

    setReportData(filtered);
  }

  function exportReportCsv() {
    if (reportData.length === 0) {
      alert("Generate a report first");
      return;
    }

    const headers = ["date", "fleet", "action", "field", "change", "notes", "actor"];
    const rows = reportData.map((item) =>
      [
        formatHistoryDate(item.created_at),
        item.fleet,
        item.action,
        item.field,
        `${item.old_value || "-"} -> ${item.new_value || "-"}`,
        item.notes,
        item.actor,
      ]
        .map(csvCell)
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "machine-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  const mainMachines = useMemo(() => machines.filter((m) => !m.majorRepair), [machines]);

  const totalMachines = machines.length;
  const availableMachines = mainMachines.filter((m) => m.status.toLowerCase().includes("avail")).length;
  const repairsMachines = mainMachines.filter((m) => !m.status.toLowerCase().includes("avail")).length;
  const majorRepairsMachines = machines.filter((m) => m.majorRepair).length;
  const locationCount = new Set(machines.map((m) => m.location)).size;

  const typeOptions = useMemo(() => {
    return ["ALL", ...Array.from(new Set(machines.map((m) => normalizeTypeLabel(m.type)))).sort()];
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      const matchesType = selectedType === "ALL" || normalizeTypeLabel(machine.type) === selectedType;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        term === "" ||
        machine.fleet.toLowerCase().includes(term) ||
        machine.type.toLowerCase().includes(term) ||
        machine.machineType.toLowerCase().includes(term) ||
        machine.status.toLowerCase().includes(term) ||
        machine.location.toLowerCase().includes(term) ||
        machine.department.toLowerCase().includes(term) ||
        machine.repairReason.toLowerCase().includes(term) ||
        machine.downtimeReason.toLowerCase().includes(term);

      let matchesRegisterFilter = true;
      if (registerFilter === "AVAILABLE") {
        matchesRegisterFilter = !machine.majorRepair && machine.status.toLowerCase().includes("avail");
      } else if (registerFilter === "DOWN") {
        matchesRegisterFilter = machine.majorRepair || !machine.status.toLowerCase().includes("avail");
      } else if (registerFilter === "MAJOR") {
        matchesRegisterFilter = machine.majorRepair;
      }

      return matchesType && matchesSearch && matchesRegisterFilter;
    });
  }, [machines, registerFilter, search, selectedType]);

  const filteredAdminMachines = useMemo(() => {
    const term = adminSearch.trim().toLowerCase();

    if (!term) return machines;

    return machines.filter((machine) => {
      return (
        machine.fleet.toLowerCase().includes(term) ||
        machine.type.toLowerCase().includes(term) ||
        machine.machineType.toLowerCase().includes(term) ||
        machine.status.toLowerCase().includes(term) ||
        machine.location.toLowerCase().includes(term) ||
        machine.department.toLowerCase().includes(term) ||
        machine.repairReason.toLowerCase().includes(term) ||
        machine.downtimeReason.toLowerCase().includes(term) ||
        machine.onlineStatus.toLowerCase().includes(term)
      );
    });
  }, [adminSearch, machines]);

  const repairOfflineMachines = useMemo(() => {
    return machines
      .filter((machine) => {
        const status = machine.status.toLowerCase();
        const online = machine.onlineStatus.toLowerCase();

        return (
          machine.majorRepair ||
          online === "offline" ||
          status.includes("repair") ||
          status.includes("down") ||
          status.includes("maint") ||
          status.includes("major")
        );
      })
      .sort((a, b) => {
        const dept = a.department.localeCompare(b.department);
        if (dept !== 0) return dept;
        return a.fleet.localeCompare(b.fleet);
      });
  }, [machines]);

  const selectedMachine = useMemo(() => {
    return machines.find((machine) => machine.fleet === selectedFleet) || filteredFallbackMachine(machines);
  }, [machines, selectedFleet]);

  const selectedMachineHistory = useMemo(() => {
    if (!selectedMachine) return [];
    return historyItems.filter((item) => item.fleet === selectedMachine.fleet).slice(0, 12);
  }, [historyItems, selectedMachine]);

  const topSummary = mainMachines.slice(0, 8);
  const majorRepairsList = useMemo(() => machines.filter((m) => m.majorRepair), [machines]);

  const groupedMachineTypeData = useMemo(() => {
    const groups: Record<string, number[]> = {};
    mainMachines.forEach((machine) => {
      const groupType = normalizeTypeLabel(machine.type);
      if (!groups[groupType]) groups[groupType] = [];
      groups[groupType].push(Number(machine.availability) || 0);
    });

    return Object.entries(groups)
      .map(([type, values]) => ({
        type,
        availability: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [mainMachines]);

  const departmentAvailability = useMemo(() => {
    const groups: Record<string, Machine[]> = {};
    machines.forEach((machine) => {
      const department = machine.department || "Unassigned";
      if (!groups[department]) groups[department] = [];
      groups[department].push(machine);
    });

    const orderedDepartments = [
      ...departments,
      ...Object.keys(groups).filter((department) => !departments.includes(department)).sort(),
    ];

    return orderedDepartments
      .filter((department) => (groups[department] || []).length > 0)
      .map((department) => {
        const items = groups[department] || [];
        const active = items.filter((m) => !m.majorRepair);
        const available = active.filter((m) => m.status.toLowerCase().includes("avail")).length;
        const percent = active.length === 0 ? 0 : Math.round((available / active.length) * 100);
        return { department, total: items.length, active: active.length, available, percent };
      });
  }, [machines]);

  useEffect(() => {
    if (departmentAvailability.length === 0) return;

    const exists = departmentAvailability.some((item) => item.department === selectedDepartment);
    if (!exists) {
      setSelectedDepartment(departmentAvailability[0].department);
    }
  }, [departmentAvailability, selectedDepartment]);

  const selectedDepartmentMachines = useMemo(() => {
    return machines.filter((machine) => machine.department === selectedDepartment);
  }, [machines, selectedDepartment]);

  const selectedDepartmentTypeBreakdown = useMemo(() => {
    const groups: Record<string, Machine[]> = {};

    selectedDepartmentMachines.forEach((machine) => {
      const type = normalizeTypeLabel(machine.type || inferTypeFromFleet(machine.fleet));
      if (!groups[type]) groups[type] = [];
      groups[type].push(machine);
    });

    return Object.entries(groups)
      .map(([type, items]) => {
        const active = items.filter((machine) => !machine.majorRepair);
        const available = active.filter((machine) =>
          machine.status.toLowerCase().includes("avail")
        ).length;
        const percent = active.length === 0 ? 0 : Math.round((available / active.length) * 100);
        const hoursWorked = roundNumber(items.reduce((sum, machine) => sum + Number(machine.hoursWorked || 0), 0));
        const hoursDown = roundNumber(items.reduce((sum, machine) => sum + Number(machine.hoursDown || 0), 0));

        return {
          type,
          total: items.length,
          active: active.length,
          available,
          percent,
          hoursWorked,
          hoursDown,
        };
      })
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [selectedDepartmentMachines]);

  async function updateMachineField(fleet: string, field: keyof Machine, value: string | number | boolean) {
    if (!isAdmin) {
      alert("Access denied: admin only");
      return;
    }

    const currentMachine = machines.find((m) => m.fleet === fleet);
    if (!currentMachine) return;

    const oldValue = String(currentMachine[field] ?? "");
    const newValue = String(value ?? "");

    const updated = machines.map((machine) =>
      machine.fleet === fleet
        ? normalizeLoadedMachine({ ...machine, [field]: value, updated: new Date().toLocaleDateString() })
        : machine
    );

    const saved = await saveMachines(updated, false);
    if (saved) {
      await addHistoryEntry({
        action: "Updated machine field",
        fleet,
        field: String(field),
        oldValue,
        newValue,
        notes: `${field} changed on ${fleet}`,
      });
    }
  }

  async function setMajorRepair(fleet: string, enabled: boolean) {
    if (!isAdmin) {
      alert("Access denied: admin only");
      return;
    }

    const currentMachine = machines.find((m) => m.fleet === fleet);
    if (!currentMachine) return;

    const updated = machines.map((machine) => {
      if (machine.fleet !== fleet) return machine;
      return normalizeLoadedMachine({
        ...machine,
        majorRepair: enabled,
        status: enabled ? "Major Repair" : "Available",
        repairReason: enabled ? machine.repairReason : "",
        sparesEta: enabled ? machine.sparesEta : "",
        onlineStatus: enabled ? "Offline" : machine.onlineStatus || "Online",
        updated: new Date().toLocaleDateString(),
      });
    });

    const saved = await saveMachines(updated, false);
    if (saved) {
      await addHistoryEntry({
        action: enabled ? "Moved to major repair" : "Removed from major repair",
        fleet,
        field: "majorRepair",
        oldValue: String(currentMachine.majorRepair),
        newValue: String(enabled),
        notes: enabled ? "Machine moved out of active fleet" : "Machine returned to active fleet",
      });
    }
  }

  function handleExport() {
    if (!isAdmin) {
      alert("Access denied: admin only");
      return;
    }

    const headers = [
      "fleet",
      "type",
      "machineType",
      "status",
      "location",
      "department",
      "availability",
      "majorRepair",
      "repairReason",
      "sparesEta",
      "hoursWorked",
      "hoursDown",
      "onlineStatus",
      "downtimeReason",
      "updated",
    ];

    const rows = machines.map((machine) =>
      [
        machine.fleet,
        machine.type,
        machine.machineType,
        machine.status,
        machine.location,
        machine.department,
        machine.availability,
        machine.majorRepair,
        machine.repairReason,
        machine.sparesEta,
        machine.hoursWorked,
        machine.hoursDown,
        machine.onlineStatus,
        machine.downtimeReason,
        machine.updated,
      ]
        .map(csvCell)
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "turbo-machine-register.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    if (!isAdmin) {
      alert("Access denied: admin only");
      return;
    }
    window.print();
  }

  async function handleRefresh() {
    await Promise.all([loadMachinesFromSupabase(), loadHistoryFromSupabase()]);
  }

  async function handleSpreadsheetUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!isAdmin) {
      alert("Admin only");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".csv")) {
        const text = await file.text();
        const parsed = parseCSV(text);

        if (parsed.length > 0) {
          const saved = await saveMachines(parsed);
          if (saved) await addHistoryEntry({ action: "Uploaded CSV", notes: `${file.name} uploaded with ${parsed.length} rows` });
          setSheetNames(["CSV"]);
          setWorkbookSheets([{ name: "CSV", rows: [] }]);
          setActiveSheet("CSV");
          setSelectedFleet(parsed[0]?.fleet || "");
        } else {
          alert("CSV uploaded but no valid rows were found.");
        }
        return;
      }

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsm")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        const sheets: WorkbookSheetData[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          return { name, rows };
        });

        setWorkbookSheets(sheets);
        setSheetNames(workbook.SheetNames);

        const preferredSheet =
          sheets.find((s) => s.name === "Summary") ||
          sheets.find((s) => s.name === "Summary (Excl Tyre)") ||
          sheets.find((s) => isSummaryLikeSheet(s.rows)) ||
          sheets[0];

        if (!preferredSheet) {
          alert("No usable sheets found.");
          return;
        }

        const parsed = parseSelectedSheet(preferredSheet.name, preferredSheet.rows);

        if (parsed.length > 0) {
          const saved = await saveMachines(parsed);
          if (saved) {
            await addHistoryEntry({
              action: "Uploaded workbook",
              notes: `${file.name} loaded from sheet ${preferredSheet.name} with ${parsed.length} rows`,
            });
          }
          setActiveSheet(preferredSheet.name);
          setSelectedFleet(parsed[0]?.fleet || "");
        } else {
          alert("Spreadsheet loaded, but the selected sheet did not contain machine summary rows.");
        }
        return;
      }

      alert("Please upload .xlsx, .xls, .xlsm, or .csv");
    } catch (error) {
      console.error(error);
      alert("Could not read spreadsheet file.");
    }
  }

  async function loadSheetByName(sheetName: string) {
    if (!isAdmin) {
      alert("Access denied: admin only");
      return;
    }

    const selected = workbookSheets.find((s) => s.name === sheetName);
    if (!selected) return;

    const parsed = parseSelectedSheet(selected.name, selected.rows);

    if (parsed.length > 0) {
      const saved = await saveMachines(parsed);
      if (saved) await addHistoryEntry({ action: "Loaded workbook sheet", notes: `Sheet ${sheetName} loaded with ${parsed.length} rows` });
      setActiveSheet(sheetName);
      setSelectedFleet(parsed[0]?.fleet || "");
    } else {
      alert(`Sheet "${sheetName}" does not contain machine summary rows for the dashboard.`);
    }
  }

  function scrollToBottomRegister() {
    const el = document.getElementById("bottom-register");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  function showAvailableOnly() {
    setRegisterFilter("AVAILABLE");
    setSelectedType("ALL");
    setSearch("");
    scrollToBottomRegister();
  }

  function showRepairsDownOnly() {
    setRegisterFilter("DOWN");
    setSelectedType("ALL");
    setSearch("");
    scrollToBottomRegister();
  }

  function showMajorRepairsOnly() {
    setRegisterFilter("MAJOR");
    setSelectedType("ALL");
    setSearch("");
    const el = document.getElementById("major-repairs");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  function showAllMachines() {
    setRegisterFilter("ALL");
    setSelectedType("ALL");
    setSearch("");
    scrollToBottomRegister();
  }

  if (loadingData) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#081733",
          color: "white",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 800,
          fontSize: "20px",
        }}
      >
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="page">
      <div className="shell">
        <div className="topMetaRow noPrint">
          <div className="userBadge">
            Logged in as: <strong>{username}</strong> ({isAdmin ? "admin" : "user"})
          </div>
          <button className="logoutButton" onClick={() => signOut({ callbackUrl: "/login" })}>
            Logout
          </button>
        </div>

        <header className="topbar noPrint">
          <div className="logoBox">
            <div className="logoText">TURBO ENERGY</div>
          </div>

          <div className="titleWrap">
            <h1>Turbo-Energy Machine Availability</h1>
            <p>Live fleet dashboard with admin movements, departments, repairs, history, and machine details</p>
          </div>

          <div className="topActions">
            {isAdmin && (
              <label htmlFor="csvUploadTop" className="pillButton primaryPill">
                Upload File
              </label>
            )}
            <button className="pillButton" onClick={showRepairsDownOnly}>
              Units Below 85%
            </button>
            <button className="pillButton" onClick={showMajorRepairsOnly}>
              Major Repairs
            </button>
            <button className="pillButton" onClick={showAllMachines}>
              Bottom Register
            </button>
          </div>
        </header>

        <main className="dashboardGrid">
          <section className="leftColumn">
            <div className="kpiGrid noPrint">
              <KpiCard icon="🏗" title="TOTAL MACHINES" value={totalMachines} note="All units in the register" onClick={showAllMachines} />
              <KpiCard icon="✅" title="AVAILABLE" value={availableMachines} note="Active units marked available" onClick={showAvailableOnly} />
              <KpiCard icon="🔧" title="REPAIRS / DOWN" value={repairsMachines} note="Active units needing attention" onClick={showRepairsDownOnly} />
              <KpiCard icon="📍" title="LOCATIONS" value={locationCount} note="Distinct operating locations" />
            </div>

            {isAdmin && (
              <section className="panel noPrint">
                <div className="panelHeader">
                  <div>
                    <h2>Admin Upload and Save</h2>
                    <p>Upload spreadsheet XLSX, XLS, XLSM, or CSV</p>
                  </div>

                  <div className="panelButtons">
                    <button className="actionButton orangeButton" onClick={handleExport}>
                      Export CSV
                    </button>
                    <button className="actionButton whiteButton" onClick={handlePrint}>
                      Print page
                    </button>
                  </div>
                </div>

                <div className="uploadArea">
                  <input
                    id="csvUploadTop"
                    type="file"
                    accept=".xlsx,.xls,.xlsm,.csv"
                    onChange={handleSpreadsheetUpload}
                    className="hiddenInput"
                  />
                  <label htmlFor="csvUploadTop" className="filePicker">
                    Choose File
                  </label>
                  <span className="fileName">{fileName}</span>
                </div>

                <div className="infoBox">Shared mode and history are active. Duplicates by fleet are removed automatically.</div>
              </section>
            )}

            {isAdmin && (
              <section className="panel noPrint">
                <div className="sectionHeading">
                  <h2>Admin Machine Controls</h2>
                  <p>Edit hours, online status, downtime reason, department, and repairs.</p>
                </div>

                <div className="adminList adminListTop">
                  {machines.map((machine) => (
                    <div key={machine.fleet} className="adminCard">
                      <div className="adminTop">
                        <div>
                          <strong>{machine.fleet}</strong> - {machine.machineType}
                        </div>
                        <span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>
                          {machine.majorRepair ? "Major Repair" : machine.status}
                        </span>
                      </div>

                      <div className="adminGrid">
                        <div>
                          <label>Department</label>
                          <select
                            value={machine.department}
                            onChange={(e) => void updateMachineField(machine.fleet, "department", e.target.value)}
                            className="selectInput"
                          >
                            {departments.map((dep) => (
                              <option key={dep} value={dep}>
                                {dep}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label>Status</label>
                          <select
                            value={machine.majorRepair ? "Major Repair" : machine.status}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "Major Repair") {
                                void setMajorRepair(machine.fleet, true);
                              } else {
                                void updateMachineField(machine.fleet, "status", value);
                                if (machine.majorRepair) void setMajorRepair(machine.fleet, false);
                              }
                            }}
                            className="selectInput"
                          >
                            <option value="Available">Available</option>
                            <option value="Repair">Repair</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Down">Down</option>
                            <option value="Major Repair">Major Repair</option>
                          </select>
                        </div>

                        <div>
                          <label>Availability %</label>
                          <input
                            className="textInput"
                            type="number"
                            value={machine.availability}
                            onChange={(e) => void updateMachineField(machine.fleet, "availability", Number(e.target.value || 0))}
                          />
                        </div>

                        <div>
                          <label>Hours Worked</label>
                          <input
                            className="textInput"
                            type="number"
                            value={machine.hoursWorked}
                            onChange={(e) => void updateMachineField(machine.fleet, "hoursWorked", Number(e.target.value || 0))}
                          />
                        </div>

                        <div>
                          <label>Hours Down</label>
                          <input
                            className="textInput"
                            type="number"
                            value={machine.hoursDown}
                            onChange={(e) => void updateMachineField(machine.fleet, "hoursDown", Number(e.target.value || 0))}
                          />
                        </div>

                        <div>
                          <label>Online / Offline</label>
                          <select
                            value={machine.onlineStatus}
                            onChange={(e) => void updateMachineField(machine.fleet, "onlineStatus", e.target.value)}
                            className="selectInput"
                          >
                            {onlineStatuses.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label>Downtime Reason</label>
                          <input
                            className="textInput"
                            type="text"
                            value={machine.downtimeReason}
                            onChange={(e) => void updateMachineField(machine.fleet, "downtimeReason", e.target.value)}
                          />
                        </div>

                        <div>
                          <label>Repair Reason</label>
                          <input
                            className="textInput"
                            type="text"
                            value={machine.repairReason}
                            onChange={(e) => void updateMachineField(machine.fleet, "repairReason", e.target.value)}
                          />
                        </div>

                        <div>
                          <label>Spares ETA</label>
                          <input
                            className="textInput"
                            type="text"
                            value={machine.sparesEta}
                            onChange={(e) => void updateMachineField(machine.fleet, "sparesEta", e.target.value)}
                          />
                        </div>

                        <div>
                          <label>Location</label>
                          <input
                            className="textInput"
                            type="text"
                            value={machine.location}
                            onChange={(e) => void updateMachineField(machine.fleet, "location", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="adminActions">
                        {!machine.majorRepair ? (
                          <button className="miniAction orangeMini" onClick={() => void setMajorRepair(machine.fleet, true)}>
                            Move to major repair
                          </button>
                        ) : (
                          <button className="miniAction" onClick={() => void setMajorRepair(machine.fleet, false)}>
                            Remove from major repair
                          </button>
                        )}
                        <button className="miniAction" onClick={() => setSelectedFleet(machine.fleet)}>
                          Open detail
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

                        <section className="panel noPrint" id="repairs-offline-list">
              <div className="sectionHeading">
                <h2>Machines Booked for Repairs / Offline</h2>
                <p>All machines currently booked down, offline, maintenance, repair, or major repair with the reasons entered by the team.</p>
              </div>

              <div className="majorRepairSummary">
                <div className="majorBadge">{repairOfflineMachines.length}</div>
                <div>
                  <strong>{repairOfflineMachines.length}</strong> machine(s) currently requiring attention
                </div>
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
                      <th>Spares ETA</th>
                      <th>Location</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repairOfflineMachines.length === 0 ? (
                      <tr>
                        <td colSpan={11}>No machines are currently booked for repair or offline.</td>
                      </tr>
                    ) : (
                      repairOfflineMachines.map((machine) => (
                        <tr
                          key={`repair-offline-${machine.fleet}`}
                          className={selectedFleet === machine.fleet ? "selectedRow" : "clickableRow"}
                          onClick={() => setSelectedFleet(machine.fleet)}
                        >
                          <td>{machine.fleet}</td>
                          <td>{machine.machineType}</td>
                          <td>{machine.department}</td>
                          <td>
                            <span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>
                              {machine.majorRepair ? "Major Repair" : machine.status}
                            </span>
                          </td>
                          <td>{machine.onlineStatus}</td>
                          <td>{machine.hoursDown}</td>
                          <td>{machine.downtimeReason || "-"}</td>
                          <td>{machine.repairReason || "-"}</td>
                          <td>{machine.sparesEta || "-"}</td>
                          <td>{machine.location}</td>
                          <td>{machine.updated}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

<section className="panel reportPanel" id="report-generator">
              <div className="sectionHeading reportHeader">
                <div>
                  <h2>Report Generator</h2>
                  <p>Select machines and dates to generate a report from history.</p>
                </div>
                <div className="reportActions noPrint">
                  <button className="pillButton" onClick={() => void generateReport()}>
                    Generate Report
                  </button>
                  <button className="pillButton" onClick={printReport}>
                    Print Report
                  </button>
                  <button className="pillButton" onClick={exportReportCsv}>
                    Export Report CSV
                  </button>
                </div>
              </div>

              <div className="reportFilters noPrint">
                <select
                  multiple
                  value={reportMachines}
                  onChange={(e) => setReportMachines(Array.from(e.target.selectedOptions, (option) => option.value))}
                  className="selectInput reportMachineSelect"
                >
                  {machines.map((machine) => (
                    <option key={machine.fleet} value={machine.fleet}>
                      {machine.fleet} - {machine.machineType}
                    </option>
                  ))}
                </select>

                <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="textInput" />
                <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="textInput" />
              </div>

              <div className="printTitle">
                <h1>Turbo Energy Machine Report</h1>
                <p>
                  Date range: {reportFrom || "Not selected"} to {reportTo || "Not selected"} | Machines: {reportMachines.length > 0 ? reportMachines.join(", ") : "All machines"}
                </p>
                <p>Generated by: {username} | Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
              </div>

              <div className="reportCount">Records: {reportData.length}</div>

              <div className="tableWrap reportTableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Fleet</th>
                      <th>Action</th>
                      <th>Field</th>
                      <th>Change</th>
                      <th>Notes</th>
                      <th>Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No report generated yet.</td>
                      </tr>
                    ) : (
                      reportData.map((item) => (
                        <tr key={item.id}>
                          <td>{formatHistoryDate(item.created_at)}</td>
                          <td>{item.fleet || "-"}</td>
                          <td>{item.action || "-"}</td>
                          <td>{item.field || "-"}</td>
                          <td>{item.old_value || "-"} → {item.new_value || "-"}</td>
                          <td>{item.notes || "-"}</td>
                          <td>{item.actor || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel noPrint">
              <div className="sectionTitleRow">
                <h2>Availability by Machine Type</h2>
                <span>% Available</span>
              </div>

              <div className="chartPanel">
                <div className="chartGridLines">
                  <div><span>100%</span></div>
                  <div><span>80%</span></div>
                  <div><span>60%</span></div>
                  <div><span>40%</span></div>
                  <div><span>20%</span></div>
                </div>

                <div className="barsArea">
                  {groupedMachineTypeData.map((item, index) => (
                    <div key={item.type} className="barGroup">
                      <div className="barValue">{item.availability}%</div>
                      <div className={`bar ${index % 4 === 3 ? "highlightBar" : ""}`} style={{ height: `${Math.max(item.availability * 1.7, 18)}px` }} />
                      <div className="barLabel">{item.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="footNote">Major repair units are excluded from the machine type availability graph.</p>
            </section>

            <section className="panel noPrint">
              <div className="sectionHeading">
                <h2>Department Availability</h2>
                <p>Click a department to open its machine type availability breakdown.</p>
              </div>

              <div className="departmentGrid">
                {departmentAvailability.map((item) => (
                  <button
                    key={item.department}
                    type="button"
                    className={`departmentCard departmentButton ${
                      selectedDepartment === item.department ? "selectedDepartmentCard" : ""
                    }`}
                    onClick={() => setSelectedDepartment(item.department)}
                  >
                    <div className="departmentHead">
                      <h3>{item.department}</h3>
                      <span>{item.percent}%</span>
                    </div>
                    <div className="departmentBarTrack">
                      <div className="departmentBarFill" style={{ width: `${item.percent}%` }} />
                    </div>
                    <div className="departmentMeta">
                      <span>Total: {item.total}</span>
                      <span>Active: {item.active}</span>
                      <span>Available: {item.available}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel noPrint" id="department-drilldown">
              <div className="sectionHeading drilldownHeading">
                <div>
                  <h2>{selectedDepartment} Machine Type Availability</h2>
                  <p>Grouped by machine type inside this department. Major repairs are shown but excluded from active availability.</p>
                </div>
                <span className="majorBadge wideBadge">{selectedDepartmentMachines.length} machine(s)</span>
              </div>

              <div className="departmentTypeGrid">
                {selectedDepartmentTypeBreakdown.length === 0 ? (
                  <div className="mutedCard">No machines found for this department.</div>
                ) : (
                  selectedDepartmentTypeBreakdown.map((item) => (
                    <div key={item.type} className="departmentTypeCard">
                      <div className="departmentHead">
                        <h3>{item.type}</h3>
                        <span>{item.percent}%</span>
                      </div>
                      <div className="departmentBarTrack">
                        <div className="departmentBarFill" style={{ width: `${item.percent}%` }} />
                      </div>
                      <div className="departmentMeta">
                        <span>Total: {item.total}</span>
                        <span>Active: {item.active}</span>
                        <span>Available: {item.available}</span>
                      </div>
                      <div className="departmentMeta">
                        <span>Worked: {item.hoursWorked}</span>
                        <span>Down: {item.hoursDown}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="tableWrap departmentMachineTable">
                <table>
                  <thead>
                    <tr>
                      <th>Fleet</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Availability</th>
                      <th>Hours Worked</th>
                      <th>Hours Down</th>
                      <th>Online</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDepartmentMachines.map((machine) => (
                      <tr
                        key={`${selectedDepartment}-${machine.fleet}`}
                        className={selectedFleet === machine.fleet ? "selectedRow" : "clickableRow"}
                        onClick={() => setSelectedFleet(machine.fleet)}
                      >
                        <td>{machine.fleet}</td>
                        <td>{machine.machineType}</td>
                        <td>
                          <span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>
                            {machine.majorRepair ? "Major Repair" : machine.status}
                          </span>
                        </td>
                        <td>{machine.availability}%</td>
                        <td>{machine.hoursWorked}</td>
                        <td>{machine.hoursDown}</td>
                        <td>{machine.onlineStatus}</td>
                        <td>{machine.downtimeReason || machine.repairReason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel noPrint" id="major-repairs">
              <div className="sectionHeading">
                <h2>Machines on Major Repairs</h2>
                <p>These units are removed from the main availability percentage.</p>
              </div>

              <div className="majorRepairSummary">
                <div className="majorBadge">{majorRepairsMachines}</div>
                <div><strong>{majorRepairsMachines}</strong> unit(s) on major repair</div>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fleet</th>
                      <th>Machine</th>
                      <th>Department</th>
                      <th>Reason</th>
                      <th>Spares ETA</th>
                      <th>Status</th>
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {majorRepairsList.length === 0 ? (
                      <tr><td colSpan={isAdmin ? 7 : 6}>No machines on major repair.</td></tr>
                    ) : (
                      majorRepairsList.map((machine) => (
                        <tr key={machine.fleet} className="clickableRow" onClick={() => setSelectedFleet(machine.fleet)}>
                          <td>{machine.fleet}</td>
                          <td>{machine.machineType}</td>
                          <td>{machine.department}</td>
                          <td>{machine.repairReason || machine.downtimeReason || "-"}</td>
                          <td>{machine.sparesEta || "-"}</td>
                          <td><span className="statusPill statusMajor">Major Repair</span></td>
                          {isAdmin && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <button className="miniAction" onClick={() => void setMajorRepair(machine.fleet, false)}>
                                Return to main list
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedMachine && (
              <section className="panel noPrint">
                <div className="sectionHeading">
                  <h2>Selected Machine Detail</h2>
                  <p>Full machine detail, status, hours, reasons, and availability history.</p>
                </div>

                <div className="detailGrid">
                  <div className="detailCard">
                    <h3>{selectedMachine.fleet}</h3>
                    <p>{selectedMachine.machineType}</p>
                    <span className={`statusPill ${getStatusClass(selectedMachine.status, selectedMachine.majorRepair)}`}>
                      {selectedMachine.majorRepair ? "Major Repair" : selectedMachine.status}
                    </span>
                  </div>
                  <DetailMini label="Availability" value={`${selectedMachine.availability}%`} />
                  <DetailMini label="Online / Offline" value={selectedMachine.onlineStatus} />
                  <DetailMini label="Hours Worked" value={String(selectedMachine.hoursWorked)} />
                  <DetailMini label="Hours Down" value={String(selectedMachine.hoursDown)} />
                  <DetailMini label="Department" value={selectedMachine.department} />
                  <DetailMini label="Location" value={selectedMachine.location} />

                  <div className="detailWide">
                    <label>Repair / Downtime Reason</label>
                    <strong>{selectedMachine.downtimeReason || selectedMachine.repairReason || "-"}</strong>
                  </div>

                  <div className="detailWide">
                    <label>Availability History</label>
                    <div className="historyStack compactHistory">
                      {selectedMachineHistory.length === 0 ? (
                        <div className="mutedCard">No history yet for this machine.</div>
                      ) : (
                        selectedMachineHistory.map((item) => <HistoryCard key={item.id} item={item} />)
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="panel noPrint">
              <div className="sectionHeading">
                <h2>Top Machine Summary</h2>
                <p>Quick summary of active machines only.</p>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fleet Number</th>
                      <th>Machine Type</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Availability %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSummary.map((machine) => (
                      <tr key={machine.fleet} className="clickableRow" onClick={() => setSelectedFleet(machine.fleet)}>
                        <td>{machine.fleet}</td>
                        <td>{machine.machineType}</td>
                        <td><span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>{machine.status}</span></td>
                        <td>{machine.location}</td>
                        <td>{machine.availability}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <aside className="rightColumn noPrint">
            <section className="panel">
              <div className="sectionHeading">
                <h2>Recent Activity</h2>
                <p>Latest shared changes across the dashboard.</p>
              </div>

              <div className="historyStack">
                {historyItems.length === 0 ? (
                  <div className="mutedCard">No history yet.</div>
                ) : (
                  historyItems.slice(0, 12).map((item) => <HistoryCard key={item.id} item={item} />)
                )}
              </div>
            </section>

            <section className="panel" id="bottom-register">
              <div className="sectionHeading">
                <h2>Bottom Machine by-Machine Register</h2>
                <p>Click any machine row to open full machine details.</p>
              </div>

              <div className="controlsRow">
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="selectInput">
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>{option === "ALL" ? "All Machines" : option}</option>
                  ))}
                </select>

                <select value={registerFilter} onChange={(e) => setRegisterFilter(e.target.value as RegisterFilter)} className="selectInput">
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">Available Only</option>
                  <option value="DOWN">Repairs / Down</option>
                  <option value="MAJOR">Major Repairs</option>
                </select>

                <div className="searchWrap">
                  <span>⌕</span>
                  <input type="text" placeholder="Type fleet number or type..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <button className="pillButton solidButton" onClick={() => void handleRefresh()}>{loadingData ? "Refreshing..." : "Refresh data"}</button>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fleet Number</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Availability</th>
                      <th>Hours Worked</th>
                      <th>Hours Down</th>
                      <th>Online</th>
                      <th>Reason</th>
                      <th>Department</th>
                      <th>Location</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMachines.map((machine) => (
                      <tr
                        key={`${machine.fleet}-${machine.updated}`}
                        className={selectedFleet === machine.fleet ? "selectedRow" : "clickableRow"}
                        onClick={() => setSelectedFleet(machine.fleet)}
                      >
                        <td>{machine.fleet}</td>
                        <td>{machine.machineType}</td>
                        <td><span className={`statusPill ${getStatusClass(machine.status, machine.majorRepair)}`}>{machine.majorRepair ? "Major Repair" : machine.status}</span></td>
                        <td>{machine.availability}%</td>
                        <td>{machine.hoursWorked}</td>
                        <td>{machine.hoursDown}</td>
                        <td>{machine.onlineStatus}</td>
                        <td>{machine.downtimeReason || machine.repairReason || "-"}</td>
                        <td>{machine.department}</td>
                        <td>{machine.location}</td>
                        <td>{machine.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bottomLine">
                <span>Turbo Energy - Machine Availability Dashboard</span>
                <span>Last updated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
              </div>
            </section>

            {isAdmin && sheetNames.length > 0 && (
              <section className="sheetTabsPanel">
                <div className="sheetTabsHeader">
                  <h3>Workbook Sheets</h3>
                  <p>Click a sheet tab to load it into the dashboard.</p>
                </div>

                <div className="sheetTabs">
                  {sheetNames.map((name) => (
                    <button key={name} className={`sheetTab ${activeSheet === name ? "activeSheetTab" : ""}`} onClick={() => void loadSheetByName(name)}>
                      {name}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </main>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          color: #f3f7ff;
          background:
            radial-gradient(circle at top left, rgba(90, 130, 255, 0.18), transparent 24%),
            radial-gradient(circle at top right, rgba(242, 154, 31, 0.14), transparent 22%),
            linear-gradient(180deg, #091c43 0%, #081733 100%);
          font-family: Arial, Helvetica, sans-serif;
        }

        .shell {
          width: min(1460px, calc(100% - 24px));
          margin: 0 auto;
          padding: 0 0 24px;
          overflow-x: hidden;
        }

        .topMetaRow {
          width: min(1460px, calc(100% - 24px));
          margin: 14px auto 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .userBadge {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(10, 23, 52, 0.5);
          color: white;
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
        }

        .logoutButton {
          padding: 10px 16px;
          background: #d94141;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        }

        .topbar {
          display: grid;
          grid-template-columns: 370px 1fr auto;
          gap: 18px;
          align-items: center;
          padding: 14px 18px;
          background: linear-gradient(180deg, rgba(23, 50, 95, 0.96), rgba(13, 34, 74, 0.96));
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 18px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
          margin-top: 12px;
        }

        .logoBox {
          background: rgba(255, 255, 255, 0.92);
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
        }

        .logoText {
          color: #8a9abb;
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .titleWrap { text-align: center; }
        .titleWrap h1 { margin: 0; font-size: 20px; font-weight: 800; }
        .titleWrap p { margin: 6px 0 0; font-size: 14px; color: #c8d4ea; }

        .topActions, .panelButtons, .reportActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .pillButton {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(10, 23, 52, 0.5);
          color: white;
          border-radius: 999px;
          padding: 12px 18px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }

        .primaryPill, .orangeButton, .orangeMini, .activeSheetTab {
          background: linear-gradient(180deg, #ffb24c, #f29a1f);
          color: white;
          border: none;
        }

        .solidButton { background: rgba(14, 35, 74, 0.95); }

        .dashboardGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(360px, 1fr);
          gap: 16px;
          margin-top: 14px;
          min-width: 0;
        }

        .leftColumn, .rightColumn {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .panel, .tableWrap, .chartPanel { min-width: 0; }

        .kpiCard {
          background: rgba(255, 255, 255, 0.97);
          color: #17325f;
          border-radius: 22px;
          padding: 18px;
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 14px;
          align-items: center;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
          min-width: 0;
        }

        .clickableCard, .clickableRow { cursor: pointer; }
        .clickableRow:hover { background: rgba(255, 255, 255, 0.06); }
        .selectedRow { background: rgba(255, 177, 75, 0.16); cursor: pointer; }

        .kpiIcon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(79, 140, 255, 0.15);
          font-size: 24px;
        }

        .kpiText h4 { margin: 0 0 6px; font-size: 13px; font-weight: 800; }
        .kpiValue { margin: 0 0 8px; font-size: 22px; line-height: 1; font-weight: 900; }
        .kpiText p { margin: 0; font-size: 13px; color: #5f7196; }

        .panel, .sheetTabsPanel {
          background: linear-gradient(180deg, rgba(17, 42, 87, 0.92), rgba(10, 29, 63, 0.94));
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
        }

        .panelHeader, .reportHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .panelHeader h2, .sectionHeading h2, .sectionTitleRow h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
        }

        .panelHeader p, .sectionHeading p {
          margin: 6px 0 0;
          color: #c8d4ea;
          font-size: 14px;
        }

        .actionButton {
          border: none;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .whiteButton { background: rgba(255, 255, 255, 0.97); color: #17325f; }

        .uploadArea, .infoBox {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          padding: 14px;
        }

        .uploadArea {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .hiddenInput { display: none; }

        .filePicker {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.95);
          color: #17325f;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .fileName { color: #d9e4f7; font-size: 14px; font-weight: 700; word-break: break-word; }
        .infoBox { margin-top: 12px; color: #c8d4ea; font-size: 14px; line-height: 1.45; }

        .sectionTitleRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .sectionTitleRow span { font-size: 14px; font-weight: 800; }

        .chartPanel {
          position: relative;
          min-height: 310px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 20px 20px 16px 56px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02));
          overflow-x: auto;
          overflow-y: hidden;
          max-width: 100%;
        }

        .chartGridLines {
          position: absolute;
          left: 56px;
          right: 18px;
          top: 18px;
          bottom: 54px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        }

        .chartGridLines div { position: relative; border-top: 1px dashed rgba(255, 255, 255, 0.12); }
        .chartGridLines span { position: absolute; left: -54px; top: -8px; font-size: 12px; font-weight: 700; color: #c8d4ea; }

        .barsArea {
          position: relative;
          width: max-content;
          min-width: 100%;
          height: 270px;
          display: flex;
          justify-content: flex-start;
          align-items: flex-end;
          gap: 14px;
          z-index: 1;
          padding-right: 12px;
        }

        .barGroup {
          width: 58px;
          min-width: 58px;
          max-width: 58px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }

        .barValue { font-size: 15px; font-weight: 900; }
        .bar { width: 42px; border-radius: 14px 14px 4px 4px; background: linear-gradient(180deg, rgba(225, 235, 255, 0.98), rgba(169, 189, 235, 0.92)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 10px 18px rgba(0, 0, 0, 0.16); }
        .highlightBar { background: linear-gradient(180deg, #bed6ff, #6f9fff); }
        .barLabel { font-size: 12px; font-weight: 900; color: #eaf0ff; text-align: center; white-space: nowrap; }
        .footNote { margin: 12px 0 0; font-size: 14px; color: #c8d4ea; }
        .sectionHeading { margin-bottom: 12px; }

        .departmentGrid, .detailGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .departmentTypeGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .departmentButton {
          width: 100%;
          color: inherit;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
        }

        .selectedDepartmentCard {
          border-color: rgba(255, 207, 103, 0.9) !important;
          box-shadow: 0 0 0 1px rgba(255, 207, 103, 0.4);
        }

        .drilldownHeading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .wideBadge {
          width: auto !important;
          padding: 0 14px;
          border-radius: 999px !important;
          white-space: nowrap;
        }

        .departmentMachineTable {
          margin-top: 14px;
        }

        .departmentCard, .departmentTypeCard, .detailCard, .detailMini, .detailWide {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.04);
          min-width: 0;
        }

        .detailCard h3, .departmentHead h3 { margin: 0 0 4px; font-size: 16px; }
        .detailCard p { margin: 0 0 10px; color: #c8d4ea; }
        .detailMini label, .detailWide label { display: block; margin-bottom: 8px; font-size: 12px; color: #cfdbf4; font-weight: 700; }
        .detailMini strong, .detailWide strong { font-size: 16px; }
        .detailWide { grid-column: 1 / -1; }

        .departmentHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 10px;
        }

        .departmentHead span { font-size: 16px; font-weight: 900; color: #ffcf67; }
        .departmentBarTrack { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); overflow: hidden; margin-bottom: 10px; }
        .departmentBarFill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #7db2ff, #4f8cff); }
        .departmentMeta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #cfdbf4; }

        .majorRepairSummary { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .majorBadge { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255, 177, 75, 0.18); color: #ffcf67; font-weight: 900; font-size: 18px; }

        .tableWrap {
          overflow-x: auto;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
        }

        table { width: 100%; border-collapse: collapse; min-width: 1100px; }
        th { background: rgba(255, 255, 255, 0.96); color: #17325f; text-align: left; padding: 12px 14px; font-size: 13px; font-weight: 900; }
        td { padding: 12px 14px; font-size: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }

        .statusPill { display: inline-flex; align-items: center; justify-content: center; min-width: 92px; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 900; }
        .statusAvailable { background: rgba(65, 184, 108, 0.18); color: #52dd84; }
        .statusRepair { background: rgba(239, 193, 77, 0.18); color: #ffd75d; }
        .statusDown { background: rgba(201, 72, 96, 0.18); color: #ff7b93; }
        .statusMajor { background: rgba(255, 177, 75, 0.18); color: #ffcf67; }

        .historyStack { display: flex; flex-direction: column; gap: 12px; }
        .compactHistory { max-height: 320px; overflow: auto; }
        .mutedCard { border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px 16px; background: rgba(255, 255, 255, 0.05); color: #e7eeff; font-size: 14px; line-height: 1.45; }
        .historyCard { border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px 16px; background: rgba(255, 255, 255, 0.04); }
        .historyTop { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 8px; font-size: 14px; }
        .historyTop span { color: #cfdbf4; font-size: 12px; font-weight: 700; }
        .historyMeta, .historyChange { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #dbe5f7; margin-bottom: 6px; }
        .historyNotes { font-size: 13px; color: #ffffff; }

        .adminSearchRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }

        .adminSearchCount {
          color: #d8e1f6;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .adminList { display: flex; flex-direction: column; gap: 12px; max-height: 760px; overflow: auto; padding-right: 4px; }
        .adminListTop { max-height: 620px; }
        .adminCard { border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px; background: rgba(255, 255, 255, 0.04); }
        .adminTop { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
        .adminGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .adminGrid label { display: block; font-size: 12px; color: #cfdbf4; margin-bottom: 6px; font-weight: 700; }

        .selectInput, .textInput {
          width: 100%;
          border: none;
          outline: none;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 700;
          color: #17325f;
          background: white;
          min-width: 0;
        }

        .adminActions { margin-top: 12px; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
        .miniAction { border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(10, 23, 52, 0.5); color: white; border-radius: 999px; padding: 10px 14px; font-size: 13px; font-weight: 800; cursor: pointer; }

        .controlsRow, .reportFilters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .reportMachineSelect { min-height: 130px; flex: 1 1 320px; }
        .reportFilters .textInput { max-width: 190px; }
        .printTitle { margin-bottom: 12px; }
        .printTitle h1 { display: none; }
        .reportCount { margin-bottom: 10px; font-weight: 800; color: #e7eeff; }

        .searchWrap { flex: 1; min-width: 220px; display: flex; align-items: center; background: white; border-radius: 12px; overflow: hidden; }
        .searchWrap span { padding: 0 12px; color: #637ba5; font-weight: 900; }
        .searchWrap input { border: none; outline: none; width: 100%; padding: 12px 14px 12px 0; font-size: 14px; font-weight: 700; color: #17325f; min-width: 0; }

        .bottomLine { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; font-size: 13px; color: #d8e1f6; flex-wrap: wrap; }

        .sheetTabsHeader h3 { margin: 0; font-size: 16px; font-weight: 900; }
        .sheetTabsHeader p { margin: 6px 0 0; color: #c8d4ea; font-size: 14px; }
        .sheetTabs { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
        .sheetTab { border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(10, 23, 52, 0.5); color: white; border-radius: 999px; padding: 10px 14px; font-size: 13px; font-weight: 800; cursor: pointer; }

        @media (max-width: 1280px) {
          .topbar { grid-template-columns: 1fr; text-align: center; }
          .topActions { justify-content: center; }
          .dashboardGrid { grid-template-columns: 1fr; }
          .panelHeader, .reportHeader { flex-direction: column; }
        }

        @media (max-width: 860px) {
          .kpiGrid, .departmentGrid, .detailGrid, .adminGrid { grid-template-columns: 1fr; }
          .logoText { font-size: 26px; }
          .titleWrap h1 { font-size: 17px; }
          .chartPanel { padding-left: 44px; }
          .chartGridLines { left: 44px; }
          .bar { width: 36px; }
          .barGroup { width: 50px; min-width: 50px; max-width: 50px; }
          .barLabel { font-size: 11px; }
          .bottomLine, .adminTop, .topMetaRow, .historyTop { flex-direction: column; align-items: flex-start; }
        }

        @media print {
          .noPrint { display: none !important; }
          .page { background: white !important; color: black !important; }
          .shell { width: 100%; padding: 0; }
          .dashboardGrid { display: block; }
          .reportPanel { box-shadow: none; border: none; background: white; color: black; padding: 0; }
          .printTitle h1 { display: block; margin: 0 0 8px; color: black; }
          .printTitle p { color: black; margin: 3px 0; }
          .tableWrap { border: 1px solid #333; background: white; overflow: visible; }
          table { min-width: 0; width: 100%; font-size: 11px; }
          th { background: #e8e8e8 !important; color: black; padding: 6px; }
          td { color: black; padding: 6px; border-bottom: 1px solid #ccc; }
        }
      `}</style>
    </div>
  );
}

function KpiCard({
  icon,
  title,
  value,
  note,
  onClick,
}: {
  icon: string;
  title: string;
  value: number;
  note: string;
  onClick?: () => void;
}) {
  return (
    <div className={`kpiCard ${onClick ? "clickableCard" : ""}`} onClick={onClick}>
      <div className="kpiIcon">{icon}</div>
      <div className="kpiText">
        <h4>{title}</h4>
        <div className="kpiValue">{value}</div>
        <p>{note}</p>
      </div>
    </div>
  );
}

function DetailMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="detailMini">
      <label>{label}</label>
      <strong>{value}</strong>
    </div>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <div className="historyCard">
      <div className="historyTop">
        <strong>{item.action}</strong>
        <span>{formatHistoryDate(item.created_at)}</span>
      </div>
      <div className="historyMeta">
        <span><strong>User:</strong> {item.actor || "-"}</span>
        {item.fleet ? <span><strong>Fleet:</strong> {item.fleet}</span> : null}
        {item.field ? <span><strong>Field:</strong> {item.field}</span> : null}
      </div>
      {(item.old_value || item.new_value) && (
        <div className="historyChange">
          <span><strong>Old:</strong> {item.old_value || "-"}</span>
          <span><strong>New:</strong> {item.new_value || "-"}</span>
        </div>
      )}
      {item.notes ? <div className="historyNotes">{item.notes}</div> : null}
    </div>
  );
}

function getStatusClass(status: string, majorRepair?: boolean) {
  if (majorRepair) return "statusMajor";
  const value = status.toLowerCase();
  if (value.includes("avail")) return "statusAvailable";
  if (value.includes("repair") || value.includes("maint")) return "statusRepair";
  return "statusDown";
}

function normalizeTypeLabel(type: string) {
  const cleaned = String(type || "").toUpperCase().trim();
  if (cleaned === "LV") return "LDV";
  return cleaned;
}

function isSummaryLikeSheet(rows: Record<string, unknown>[]) {
  if (!rows.length) return false;
  const first = normalizeKeys(rows[0]);
  return (
    ("machine" in first || "fleet" in first || "fleet number" in first) &&
    ("availability" in first || "availability %" in first)
  );
}

function isRegistrationStyleFleet(fleet: string) {
  const cleaned = String(fleet || "").toUpperCase().trim();
  return /^[A-Z]{3}\s?\d{3,4}$/.test(cleaned);
}

function normalizeFleetKey(value: string) {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

function getFixedDepartmentForFleet(fleet: string) {
  return FIXED_DEPARTMENT_BY_FLEET[normalizeFleetKey(fleet)] || "";
}

function normalizeLoadedMachine(machine: Partial<Machine>, forceFixedDepartment = false): Machine {
  const fleet = String(machine.fleet || "UNIT").trim();
  const isRegistration = isRegistrationStyleFleet(fleet);
  const normalizedType = isRegistration ? "LDV" : normalizeTypeLabel(String(machine.type || inferTypeFromFleet(fleet)));
  const status = String(machine.status || "Available");

  return {
    fleet,
    type: normalizedType,
    machineType: normalizedType === "LDV" ? "Light Vehicle" : String(machine.machineType || fleet),
    status,
    location: String(machine.location || "Hwange"),
    department: String(
      getFixedDepartmentForFleet(fleet) ||
        (forceFixedDepartment ? "" : machine.department) ||
        inferDepartmentFromType(normalizedType)
    ),
    availability: Number(machine.availability || 0),
    updated: String(machine.updated || new Date().toLocaleDateString()),
    majorRepair: Boolean(machine.majorRepair),
    repairReason: String(machine.repairReason || ""),
    sparesEta: String(machine.sparesEta || ""),
    hoursWorked: Number(machine.hoursWorked || 0),
    hoursDown: Number(machine.hoursDown || 0),
    onlineStatus: String(machine.onlineStatus || (status.toLowerCase().includes("avail") ? "Online" : "Offline")),
    downtimeReason: String(machine.downtimeReason || ""),
  };
}

function parseCSV(text: string): Machine[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());

  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split(",").map((col) => col.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cols[index] || "";
      });
      return normalizeMachine(row);
    })
    .filter((row) => row.fleet && row.machineType);
}

function parseSelectedSheet(sheetName: string, rows: Record<string, unknown>[]): Machine[] {
  const lower = sheetName.toLowerCase();
  if (lower.includes("summary")) return mapSummaryRows(rows);
  const normalizedFirst = rows[0] ? normalizeKeys(rows[0]) : {};
  if ("machine" in normalizedFirst && "availability" in normalizedFirst) return mapSummaryRows(rows);
  return [];
}

function mapSummaryRows(rows: Record<string, unknown>[]): Machine[] {
  return rows
    .map((row) => {
      const n = normalizeKeys(row);
      const fleet = String(n["machine"] || n["fleet"] || n["fleet number"] || "").trim();
      if (!fleet) return null;

      const inferredType = normalizeTypeLabel(inferTypeFromFleet(fleet));
      const availabilityRaw = n["availability"] ?? n["availability %"] ?? "";
      let availability = Number(availabilityRaw);
      if (!Number.isFinite(availability)) availability = 0;
      if (availability <= 1) availability = Math.round(availability * 10000) / 100;

      const downtime = Number(n["downtime"] || 0);
      const status = availability >= 85 ? "Available" : availability > 0 ? "Repair" : downtime >= 359 ? "Down" : "Repair";

      return normalizeLoadedMachine({
        fleet,
        type: inferredType,
        machineType: inferredType === "LDV" ? "Light Vehicle" : fleet,
        status,
        location: "Hwange",
        department: inferDepartmentFromType(inferredType),
        availability,
        updated: new Date().toLocaleDateString(),
        majorRepair: false,
        repairReason: "",
        sparesEta: "",
        hoursWorked: Number(n["hours worked"] || n["hoursworked"] || 0),
        hoursDown: Number(n["hours down"] || n["hoursdown"] || downtime || 0),
        onlineStatus: status.toLowerCase().includes("avail") ? "Online" : "Offline",
        downtimeReason: String(n["downtime reason"] || n["reason"] || ""),
      }, true);
    })
    .filter((row): row is Machine => Boolean(row));
}

function normalizeKeys(row: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[String(key).trim().toLowerCase()] = String(value ?? "").trim();
  });
  return normalized;
}

function normalizeMachine(row: Record<string, string>): Machine {
  const majorRepair =
    String(row.majorrepair || row["major repair"] || "").toLowerCase() === "true" ||
    String(row.status || "").toLowerCase().includes("major");

  const fleet = row.fleet || row["fleet number"] || row.unit || "UNIT";
  const type = normalizeTypeLabel(row.type || inferTypeFromFleet(fleet));

  return normalizeLoadedMachine({
    fleet,
    type,
    machineType: row["machine type"] || row.machinetype || row.model || (type === "LDV" ? "Light Vehicle" : fleet),
    status: majorRepair ? "Major Repair" : row.status || "Available",
    location: row.location || "Hwange",
    department: row.department || inferDepartmentFromType(type),
    availability: Number(row.availability || row["availability %"] || row.percent || 0),
    updated: row.updated || new Date().toLocaleDateString(),
    majorRepair,
    repairReason: row.repairreason || row["repair reason"] || "",
    sparesEta: row.spareseta || row["spares eta"] || "",
    hoursWorked: Number(row.hoursworked || row["hours worked"] || 0),
    hoursDown: Number(row.hoursdown || row["hours down"] || 0),
    onlineStatus: row.onlinestatus || row["online status"] || "Online",
    downtimeReason: row.downtimereason || row["downtime reason"] || row.reason || "",
  }, true);
}

function inferTypeFromFleet(fleet: string) {
  const cleaned = fleet.toUpperCase().trim();
  if (isRegistrationStyleFleet(cleaned)) return "LDV";

  const knownHeavyPrefixes = ["FEL", "TEX", "TRT", "HT", "TRL", "TDC", "GEN", "WB", "LV", "LDV", "WT", "EX", "DT", "TLB", "CARGO"];
  for (const prefix of knownHeavyPrefixes) {
    if (cleaned.startsWith(prefix)) return prefix === "LV" ? "LDV" : prefix;
  }

  const lettersOnly = cleaned.match(/^[A-Z]+/);
  if (!lettersOnly) return "GEN";
  return lettersOnly[0];
}

function inferDepartmentFromType(type: string) {
  const t = normalizeTypeLabel(type);
  if (t === "LDV") return "Logistics";
  if (["FEL", "HT", "TEX", "WB", "EX", "DT"].includes(t)) return "Mining";
  if (["TRT", "TRL", "TDC", "TLB", "CARGO"].includes(t)) return "Logistics";
  return "Plant";
}

function formatHistoryDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function filteredFallbackMachine(machines: Machine[]) {
  return machines.length > 0 ? machines[0] : undefined;
}

function dedupeMachinesByFleet(machines: Machine[]) {
  const map = new Map<string, Machine>();
  for (const machine of machines) {
    const key = machine.fleet.trim().toUpperCase();
    map.set(key, machine);
  }
  return Array.from(map.values());
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

