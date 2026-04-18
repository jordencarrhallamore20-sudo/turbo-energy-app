"use client";

import { useEffect, useMemo, useState } from "react";

type Machine = {
  id: string;
  type: string;
  department: string;
  status: "AVAILABLE" | "DOWN";
  location: string;
  availability: string;
};

const STORAGE_KEY = "machines_v1";

export default function MachineAvailabilityPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    id: "",
    type: "",
    department: "",
    status: "AVAILABLE" as "AVAILABLE" | "DOWN",
    location: "",
    availability: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setMachines(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
  }, [machines]);

  const addMachine = () => {
    if (
      !form.id ||
      !form.type ||
      !form.department ||
      !form.location ||
      !form.availability
    )
      return;

    const exists = machines.some(
      (m) => m.id.toLowerCase() === form.id.toLowerCase()
    );
    if (exists) return;

    setMachines([
      {
        ...form,
        id: form.id.toUpperCase(),
        availability: form.availability.replace("%", "") + "%",
      },
      ...machines,
    ]);

    setForm({
      id: "",
      type: "",
      department: "",
      status: "AVAILABLE",
      location: "",
      availability: "",
    });
  };

  const deleteMachine = (id: string) => {
    setMachines(machines.filter((m) => m.id !== id));
  };

  const toggleStatus = (id: string) => {
    setMachines(
      machines.map((m) =>
        m.id === id
          ? {
              ...m,
              status: m.status === "AVAILABLE" ? "DOWN" : "AVAILABLE",
            }
          : m
      )
    );
  };

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
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
      <div style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>WORKSHOP CONTROL</div>
          <h1 style={titleStyle}>Machine Availability Dashboard</h1>
          <p style={subtitleStyle}>
            Track units, update machine status, search fast, and keep your fleet
            register clean.
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

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={sectionTitleWrapStyle}>
            <h2 style={sectionTitleStyle}>Add Machine</h2>
            <p style={sectionTextStyle}>
              Enter machine details and save them to your local app.
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
                  status: e.target.value as "AVAILABLE" | "DOWN",
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
            <button style={primaryButtonStyle} onClick={addMachine}>
              Add Machine
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
            Live machine list with status control and delete action.
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
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((m) => (
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
                  <td style={emptyStateStyle} colSpan={7}>
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

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "900px",
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
