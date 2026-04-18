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

const STORAGE_KEY = "machine_availability_final_v1";

const starterMachines: Machine[] = [
  {
    id: "EX210",
    type: "Excavator",
    department: "Mining",
    status: "AVAILABLE",
    location: "Pit A",
    availability: "92%",
  },
  {
    id: "DT104",
    type: "Dump Truck",
    department: "Hauling",
    status: "DOWN",
    location: "Workshop",
    availability: "61%",
  },
  {
    id: "WL33",
    type: "Wheel Loader",
    department: "Plant",
    status: "AVAILABLE",
    location: "ROM Pad",
    availability: "88%",
  },
];

export default function MachineAvailabilityPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
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
    setSearch("");
    setMessage("Sample data loaded");
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
    const t = search.toLowerCase().trim();

    if (!t) return machines;

    return machines.filter(
      (m) =>
        m.id.toLowerCase().includes(t) ||
        m.type.toLowerCase().includes(t) ||
        m.department.toLowerCase().includes(t) ||
        m.location.toLowerCase().includes(t) ||
        m.status.toLowerCase().includes(t)
    );
  }, [machines, search]);

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
        ).toFixed(1)
      : "0.0";

  return (
    <div style={pageStyle}>
      <style>{`
        @media print {
          input, select, button {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
        }
      `}</style>

      <div style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>WORKSHOP CONTROL</div>
          <h1 style={titleStyle}>Machine Availability Dashboard</h1>
          <p style={subtitleStyle}>
            Final dashboard with add, edit, delete, search, status toggle, CSV upload,
            CSV export, print report, and auto save.
          </p>
        </div>
      </div>

      <div style={summaryGridStyle}>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Total Machines</div>
          <div style={cardValueStyle}>{totalMachines}</div>
        </div>

        <div style={cardStyle}>
          <div style={cardLabelStyle}>Available</div>
          <div style={cardValueStyle}>{availableCount}</div>
        </div>

        <div style={cardStyle}>
          <div style={cardLabelStyle}>Down</div>
          <div style={cardValueStyle}>{downCount}</div>
        </div>

        <div style={cardStyle}>
          <div style={cardLabelStyle}>Average Availability</div>
          <div style={cardValueStyle}>{averageAvailability}%</div>
        </div>
      </div>

      <section style={panelStyle}>
        <div style={sectionTitleWrapStyle}>
          <h2 style={sectionTitleStyle}>Import / Export / Tools</h2>
          <p style={sectionTextStyle}>
            Use CSV only. Upload CSV, export CSV, print report, or reset sample data.
          </p>
        </div>

        <div style={actionRowStyle}>
          <input type="file" accept=".csv" onChange={handleCsvUpload} />
          <button style={primaryButtonStyle} onClick={exportCsv}>
            Export CSV
          </button>
          <button style={secondaryButtonStyle} onClick={printReport}>
            Print Report
          </button>
          <button style={secondaryButtonStyle} onClick={resetSampleData}>
            Load Sample Data
          </button>
        </div>

        {message ? <div style={messageStyle}>{message}</div> : null}
      </section>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={sectionTitleWrapStyle}>
            <h2 style={sectionTitleStyle}>
              {editingId ? "Edit Machine" : "Add Machine"}
            </h2>
            <p style={sectionTextStyle}>
              {editingId
                ? "Update the selected machine and save changes."
                : "Enter new machine details and add to the register."}
            </p>
          </div>

          <div style={formGridStyle}>
            <input
              style={inputStyle}
              placeholder="Unit No"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Machine Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
            <select
              style={inputStyle}
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as MachineStatus,
                })
              }
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="DOWN">DOWN</option>
            </select>
            <input
              style={inputStyle}
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Availability %"
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
            />
          </div>

          <div style={actionRowStyle}>
            <button style={primaryButtonStyle} onClick={saveMachine}>
              {editingId ? "Update Machine" : "Add Machine"}
            </button>
            <button style={secondaryButtonStyle} onClick={clearForm}>
              Clear
            </button>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionTitleWrapStyle}>
            <h2 style={sectionTitleStyle}>Search Register</h2>
            <p style={sectionTextStyle}>
              Search by unit, type, department, location, or status.
            </p>
          </div>

          <input
            style={inputStyle}
            placeholder="Search machines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>
      </div>

      <section style={panelStyle}>
        <div style={sectionTitleWrapStyle}>
          <h2 style={sectionTitleStyle}>Machine Register</h2>
          <p style={sectionTextStyle}>
            Live register with edit, delete, status update, and filtering.
          </p>
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Department</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Availability</th>
                <th style={thStyle}>Edit</th>
                <th style={thStyle}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filteredMachines.length > 0 ? (
                filteredMachines.map((m) => (
                  <tr key={m.id}>
                    <td style={tdStyle}>{m.id}</td>
                    <td style={tdStyle}>{m.type}</td>
                    <td style={tdStyle}>{m.department}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => toggleStatus(m.id)}
                        style={
                          m.status === "AVAILABLE"
                            ? availableBadgeStyle
                            : downBadgeStyle
                        }
                      >
                        {m.status}
                      </button>
                    </td>
                    <td style={tdStyle}>{m.location}</td>
                    <td style={tdStyle}>{m.availability}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => editMachine(m)}
                        style={editButtonStyle}
                      >
                        Edit
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => deleteMachine(m.id)}
                        style={deleteButtonStyle}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={emptyStateStyle} colSpan={8}>
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

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  background:
    "radial-gradient(circle at top, rgba(37, 99, 235, 0.18), transparent 30%), #081120",
  color: "#ffffff",
};

const heroStyle: React.CSSProperties = {
  marginBottom: "20px",
  padding: "24px",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #0f172a, #13233d)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  boxShadow: "0 20px 45px rgba(0, 0, 0, 0.25)",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "1.8px",
  color: "#60a5fa",
  fontWeight: 700,
  marginBottom: "8px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "32px",
  fontWeight: 800,
};

const subtitleStyle: React.CSSProperties = {
  margin: "10px 0 0 0",
  color: "#cbd5e1",
  fontSize: "15px",
  maxWidth: "720px",
  lineHeight: 1.6,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "20px",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(148, 163, 184, 0.15)",
  borderRadius: "18px",
  padding: "20px",
  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.2)",
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#94a3b8",
  marginBottom: "10px",
};

const cardValueStyle: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: 800,
  color: "#ffffff",
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 0.9fr",
  gap: "20px",
  marginBottom: "20px",
};

const panelStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(148, 163, 184, 0.15)",
  borderRadius: "20px",
  padding: "20px",
  boxShadow: "0 18px 36px rgba(0, 0, 0, 0.22)",
  marginBottom: "20px",
};

const sectionTitleWrapStyle: React.CSSProperties = {
  marginBottom: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 700,
};

const sectionTextStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: "#94a3b8",
  fontSize: "14px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "12px",
};

const actionRowStyle: React.CSSProperties = {
  marginTop: "14px",
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #243244",
  background: "#0b1324",
  color: "#ffffff",
  fontSize: "14px",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#111827",
  color: "#e2e8f0",
  fontWeight: 700,
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  marginTop: "14px",
  color: "#93c5fd",
  fontSize: "14px",
  fontWeight: 600,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1000px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 12px",
  borderBottom: "1px solid #243244",
  color: "#94a3b8",
  fontSize: "13px",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid rgba(36, 50, 68, 0.7)",
  fontSize: "14px",
};

const availableBadgeStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: "none",
  background: "rgba(34, 197, 94, 0.18)",
  color: "#4ade80",
  fontWeight: 700,
  cursor: "pointer",
};

const downBadgeStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: "none",
  background: "rgba(239, 68, 68, 0.18)",
  color: "#f87171",
  fontWeight: 700,
  cursor: "pointer",
};

const editButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(96, 165, 250, 0.35)",
  background: "rgba(59, 130, 246, 0.12)",
  color: "#93c5fd",
  fontWeight: 700,
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(239, 68, 68, 0.35)",
  background: "rgba(239, 68, 68, 0.12)",
  color: "#fca5a5",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStateStyle: React.CSSProperties = {
  padding: "24px",
  textAlign: "center",
  color: "#94a3b8",
};
