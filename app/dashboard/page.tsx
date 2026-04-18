"use client";

import { useEffect, useMemo, useState } from "react";

type MachineStatus = "AVAILABLE" | "DOWN";

type Machine = {
  id: string;
  type: string;
  department: string;
  status: MachineStatus;
  location: string;
  availability: string;
};

const STORAGE_KEY = "machine_availability_prototype_v2";

const starterMachines: Machine[] = [
  {
    id: "FEL10",
    type: "SL60",
    department: "Mining",
    status: "AVAILABLE",
    location: "Hwange",
    availability: "96.4%",
  },
  {
    id: "HT12",
    type: "Haul Truck",
    department: "Operations",
    status: "AVAILABLE",
    location: "North Pit",
    availability: "94.8%",
  },
  {
    id: "LV33",
    type: "Light Vehicle",
    department: "Admin",
    status: "DOWN",
    location: "Main Yard",
    availability: "78.2%",
  },
  {
    id: "WB05",
    type: "Water Bowser",
    department: "Support",
    status: "AVAILABLE",
    location: "Plant Area",
    availability: "95.0%",
  },
  {
    id: "TG02",
    type: "Generator",
    department: "Utilities",
    status: "AVAILABLE",
    location: "South Section",
    availability: "100.0%",
  },
];

export default function MachineAvailabilityPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    id: "",
    type: "",
    department: "",
    status: "AVAILABLE" as MachineStatus,
    location: "",
    availability: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        setMachines(JSON.parse(saved));
      } catch {
        setMachines(starterMachines);
      }
    } else {
      setMachines(starterMachines);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
  }, [machines]);

  const clearForm = () => {
    setForm({
      id: "",
      type: "",
      department: "",
      status: "AVAILABLE",
      location: "",
      availability: "",
    });
    setEditingId(null);
  };

  const saveMachine = () => {
    if (
      !form.id.trim() ||
      !form.type.trim() ||
      !form.department.trim() ||
      !form.location.trim() ||
      !form.availability.trim()
    ) {
      setMessage("Fill all fields");
      return;
    }

    const cleanId = form.id.trim().toUpperCase();
    const availabilityNumber = Number(form.availability.replace("%", "").trim());

    if (Number.isNaN(availabilityNumber)) {
      setMessage("Availability must be a number");
      return;
    }

    const cleanMachine: Machine = {
      id: cleanId,
      type: form.type.trim(),
      department: form.department.trim(),
      status: form.status,
      location: form.location.trim(),
      availability: `${availabilityNumber}%`,
    };

    if (editingId) {
      const duplicate = machines.some(
        (m) => m.id !== editingId && m.id.toLowerCase() === cleanId.toLowerCase()
      );

      if (duplicate) {
        setMessage("Unit already exists");
        return;
      }

      setMachines((current) =>
        current.map((m) => (m.id === editingId ? cleanMachine : m))
      );

      setMessage("Machine updated");
      clearForm();
      return;
    }

    const exists = machines.some((m) => m.id.toLowerCase() === cleanId.toLowerCase());

    if (exists) {
      setMessage("Unit already exists");
      return;
    }

    setMachines((current) => [cleanMachine, ...current]);
    setMessage("Machine added");
    clearForm();
  };

  const editMachine = (machine: Machine) => {
    setForm({
      id: machine.id,
      type: machine.type,
      department: machine.department,
      status: machine.status,
      location: machine.location,
      availability: machine.availability.replace("%", ""),
    });
    setEditingId(machine.id);
    setMessage("Editing machine");
  };

  const deleteMachine = (id: string) => {
    setMachines((current) => current.filter((m) => m.id !== id));
    if (editingId === id) {
      clearForm();
    }
    setMessage("Machine deleted");
  };

  const toggleStatus = (id: string) => {
    setMachines((current) =>
      current.map((m) =>
        m.id === id
          ? {
              ...m,
              status: m.status === "AVAILABLE" ? "DOWN" : "AVAILABLE",
            }
          : m
      )
    );
    setMessage("Status updated");
  };

  const resetSampleData = () => {
    setMachines(starterMachines);
    clearForm();
    setSearchTerm("");
    setMessage("Reset to sample data");
  };

  const exportCsv = () => {
    const headers = ["id,type,department,status,location,availability"];
    const rows = machines.map(
      (m) =>
        `"${m.id}","${m.type}","${m.department}","${m.status}","${m.location}","${m.availability}"`
    );

    const csv = [...headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "machine-availability.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage("CSV exported");
  };

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean);

      if (rows.length < 2) {
        setMessage("CSV file is empty");
        return;
      }

      const parseCsvLine = (line: string) => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }

        result.push(current.trim());
        return result.map((item) => item.replace(/^"|"$/g, ""));
      };

      const headers = parseCsvLine(rows[0]).map((h) => h.toLowerCase());

      const findIndex = (names: string[]) =>
        headers.findIndex((header) => names.includes(header));

      const idIndex = findIndex(["id", "unit", "unit no", "unitno"]);
      const typeIndex = findIndex(["type", "machine type"]);
      const departmentIndex = findIndex(["department"]);
      const statusIndex = findIndex(["status"]);
      const locationIndex = findIndex(["location"]);
      const availabilityIndex = findIndex(["availability", "availability %"]);

      if (
        idIndex === -1 ||
        typeIndex === -1 ||
        departmentIndex === -1 ||
        locationIndex === -1 ||
        availabilityIndex === -1
      ) {
        setMessage("CSV headers not recognised");
        return;
      }

      const parsedMachines: Machine[] = rows
        .slice(1)
        .map((row) => {
          const cols = parseCsvLine(row);

          const id = (cols[idIndex] || "").toUpperCase();
          const type = cols[typeIndex] || "";
          const department = cols[departmentIndex] || "";
          const status = ((cols[statusIndex] || "AVAILABLE").toUpperCase() === "DOWN"
            ? "DOWN"
            : "AVAILABLE") as MachineStatus;
          const location = cols[locationIndex] || "";
          const rawAvailability = (cols[availabilityIndex] || "").replace("%", "").trim();

          if (!id || !type || !department || !location || !rawAvailability) {
            return null;
          }

          const availabilityNumber = Number(rawAvailability);

          return {
            id,
            type,
            department,
            status,
            location,
            availability: `${Number.isNaN(availabilityNumber) ? 0 : availabilityNumber}%`,
          };
        })
        .filter((machine): machine is Machine => Boolean(machine));

      if (parsedMachines.length === 0) {
        setMessage("No valid rows found");
        return;
      }

      setMachines(parsedMachines);
      clearForm();
      setMessage(`Loaded ${parsedMachines.length} machines from CSV`);
    } catch {
      setMessage("CSV upload failed");
    }
  };

  const printReport = () => {
    window.print();
  };

  const filteredMachines = useMemo(() => {
    const t = searchTerm.toLowerCase().trim();

    if (!t) return machines;

    return machines.filter(
      (m) =>
        m.id.toLowerCase().includes(t) ||
        m.type.toLowerCase().includes(t) ||
        m.department.toLowerCase().includes(t) ||
        m.location.toLowerCase().includes(t) ||
        m.status.toLowerCase().includes(t)
    );
  }, [machines, searchTerm]);

  const totalMachines = machines.length;
  const availableCount = machines.filter((m) => m.status === "AVAILABLE").length;
  const downCount = machines.filter((m) => m.status === "DOWN").length;

  const averageAvailability =
    machines.length > 0
      ? (
          machines.reduce((sum, machine) => {
            const value = Number(machine.availability.replace("%", ""));
            return sum + (Number.isNaN(value) ? 0 : value);
          }, 0) / machines.length
        ).toFixed(2)
      : "0.00";

  const totalRunTime = machines
    .reduce((sum, machine) => {
      const value = Number(machine.availability.replace("%", ""));
      return sum + (Number.isNaN(value) ? 0 : value * 10);
    }, 0)
    .toFixed(2);

  const totalDowntime = machines
    .reduce((sum, machine) => {
      const value = Number(machine.availability.replace("%", ""));
      return sum + (100 - (Number.isNaN(value) ? 0 : value));
    }, 0)
    .toFixed(2);

  const unitsBelow85 = machines.filter((m) => {
    const value = Number(m.availability.replace("%", ""));
    return !Number.isNaN(value) && value < 85;
  }).length;

  const summaryCards = [
    {
      title: "TOTAL MACHINES",
      value: String(totalMachines),
      note: "Active fleet units only",
    },
    {
      title: "AVERAGE FLEET AVAILABILITY",
      value: `${averageAvailability}%`,
      note: "Average across active listed machines",
    },
    {
      title: "TOTAL RUN TIME (HRS)",
      value: totalRunTime,
      note: "Calculated from current listed machines",
    },
    {
      title: "TOTAL DOWNTIME (HRS)",
      value: totalDowntime,
      note: "Combined downtime across current list",
    },
    {
      title: "UNITS BELOW 85%",
      value: String(unitsBelow85),
      note: "Click to view lowest availability units",
    },
  ];

  const groupedAverages = Object.values(
    machines.reduce((acc, machine) => {
      const key = machine.type.toUpperCase();
      const availabilityValue = Number(machine.availability.replace("%", "")) || 0;

      if (!acc[key]) {
        acc[key] = {
          type: key,
          units: 0,
          availabilityTotal: 0,
          runTime: 0,
          downtime: 0,
          status: "GREEN",
        };
      }

      acc[key].units += 1;
      acc[key].availabilityTotal += availabilityValue;
      acc[key].runTime += availabilityValue * 10;
      acc[key].downtime += 100 - availabilityValue;

      return acc;
    }, {} as Record<
      string,
      {
        type: string;
        units: number;
        availabilityTotal: number;
        runTime: number;
        downtime: number;
        status: string;
      }
    >)
  ).map((item) => {
    const avg = item.units > 0 ? item.availabilityTotal / item.units : 0;

    return {
      type: item.type,
      units: item.units,
      availability: `${avg.toFixed(2)}%`,
      runTime: item.runTime.toFixed(2),
      downtime: item.downtime.toFixed(2),
      status: avg >= 90 ? "GREEN" : avg >= 80 ? "AMBER" : "RED",
    };
  });

  const chartBars = groupedAverages.map((row) => {
    const value = Number(row.availability.replace("%", ""));
    return {
      label: row.type,
      value: `${value.toFixed(1)}%`,
      height: `${Math.max(value, 8)}%`,
    };
  });

  return (
    <div className="availability-page">
      <style>{`
        @media print {
          input, select, button {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <section className="upload-panel">
        <div className="section-heading">
          <h2>Admin Upload and Save</h2>
        </div>

        <div className="upload-grid">
          <div className="upload-main">
            <label className="upload-label">Upload CSV workbook</label>
            <input className="upload-input" type="file" accept=".csv" onChange={handleCsvUpload} />
          </div>

          <div className="upload-actions">
            <button className="primary-btn" onClick={exportCsv}>
              Export CSV
            </button>
            <button className="secondary-btn" onClick={resetSampleData}>
              Reset to sample data
            </button>
            <button className="secondary-btn" onClick={printReport}>
              Print report
            </button>
          </div>
        </div>

        <div className="info-strip">
          Upload a CSV file or manage machines directly in the app. Add, edit,
          search, export, print, and save browser data without losing the original layout.
        </div>

        {message ? (
          <div style={{ marginTop: "12px", color: "#184785", fontWeight: 600 }}>
            {message}
          </div>
        ) : null}
      </section>

      <section className="availability-summary-grid">
        {summaryCards.map((card) => (
          <div className="availability-summary-card" key={card.title}>
            <span className="availability-card-title">{card.title}</span>
            <strong className="availability-card-value">{card.value}</strong>
            <p className="availability-card-note">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="availability-main-grid">
        <div className="availability-panel large-panel">
          <div className="panel-title-wrap">
            <h2>Grouped Machine Type Averages</h2>
            <p>
              Same machine types grouped together, including Light Vehicles.
              Major repair units are excluded.
            </p>
          </div>

          <div className="availability-table-wrap">
            <table className="availability-table">
              <thead>
                <tr>
                  <th>Machine Type</th>
                  <th>Units</th>
                  <th>Average Availability</th>
                  <th>Total Run Time</th>
                  <th>Total Downtime</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedAverages.map((row) => (
                  <tr key={row.type}>
                    <td>{row.type}</td>
                    <td>{row.units}</td>
                    <td>{row.availability}</td>
                    <td>{row.runTime}</td>
                    <td>{row.downtime}</td>
                    <td>
                      <span
                        className={
                          row.status === "GREEN"
                            ? "status-badge green"
                            : row.status === "AMBER"
                            ? "status-badge amber"
                            : "status-badge red"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="availability-side-column">
          <div className="availability-panel">
            <div className="panel-title-wrap">
              <h2>Monthly Trends</h2>
              <p>Type averages from current saved dataset</p>
            </div>

            <div className="bar-chart">
              {chartBars.map((bar) => (
                <div className="bar-item" key={bar.label}>
                  <span className="bar-value">{bar.value}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ height: bar.height }} />
                  </div>
                  <span className="bar-label">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="availability-panel">
            <div className="panel-title-wrap">
              <h2>PDF Report Generator</h2>
            </div>

            <div className="report-grid">
              <div className="report-field">
                <label>Report type</label>
                <select defaultValue="Monthly">
                  <option>Monthly</option>
                  <option>Weekly</option>
                  <option>Daily</option>
                </select>
              </div>

              <div className="report-field">
                <label>Report title / period</label>
                <input type="text" placeholder="e.g. April 2026" />
              </div>
            </div>

            <div className="report-actions">
              <button className="primary-btn" onClick={printReport}>
                Generate report
              </button>
              <button className="secondary-btn" onClick={exportCsv}>
                Download CSV
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="availability-panel bottom-register-panel">
        <div className="panel-title-wrap">
          <h2>{editingId ? "Edit Machine" : "Add Machine"}</h2>
          <p>
            Keep the original dashboard style, but now add or edit live machine data.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <input
            type="text"
            placeholder="Unit No"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            style={fieldStyle}
          />
          <input
            type="text"
            placeholder="Machine Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            style={fieldStyle}
          />
          <input
            type="text"
            placeholder="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            style={fieldStyle}
          />
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as MachineStatus,
              })
            }
            style={fieldStyle}
          >
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="DOWN">DOWN</option>
          </select>
          <input
            type="text"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            style={fieldStyle}
          />
          <input
            type="text"
            placeholder="Availability %"
            value={form.availability}
            onChange={(e) => setForm({ ...form, availability: e.target.value })}
            style={fieldStyle}
          />
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
          <button className="primary-btn" onClick={saveMachine}>
            {editingId ? "Update Machine" : "Add Machine"}
          </button>
          <button className="secondary-btn" onClick={clearForm}>
            Clear
          </button>
        </div>

        <div className="panel-title-wrap">
          <h2>Bottom Machine Register</h2>
          <p>
            Full machine list with department, status, location, availability, edit,
            delete, and lookup search.
          </p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="Search by unit, type, department, location or status"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...fieldStyle,
              width: "100%",
              maxWidth: "480px",
            }}
          />
        </div>

        <div className="availability-table-wrap">
          <table className="availability-table">
            <thead>
              <tr>
                <th>Unit No</th>
                <th>Machine Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Location</th>
                <th>Availability</th>
                <th>Edit</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filteredMachines.length > 0 ? (
                filteredMachines.map((machine) => (
                  <tr key={machine.id}>
                    <td>{machine.id}</td>
                    <td>{machine.type}</td>
                    <td>{machine.department}</td>
                    <td>
                      <button
                        onClick={() => toggleStatus(machine.id)}
                        className={
                          machine.status === "AVAILABLE"
                            ? "status-badge green"
                            : "status-badge red"
                        }
                        style={statusButtonStyle}
                      >
                        {machine.status}
                      </button>
                    </td>
                    <td>{machine.location}</td>
                    <td>{machine.availability}</td>
                    <td>
                      <button
                        className="secondary-btn"
                        onClick={() => editMachine(machine)}
                        style={smallButtonStyle}
                      >
                        Edit
                      </button>
                    </td>
                    <td>
                      <button
                        className="secondary-btn"
                        onClick={() => deleteMachine(machine.id)}
                        style={smallButtonStyle}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "20px" }}>
                    No machines found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #c7d3e4",
  background: "#ffffff",
  color: "#173f78",
  fontSize: "14px",
};

const statusButtonStyle: React.CSSProperties = {
  border: "none",
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
};
