"use client";

import { useMemo, useState } from "react";

type Machine = {
  id: string;
  type: string;
  department: string;
  status: "AVAILABLE" | "DOWN";
  location: string;
  availability: string;
};

export default function MachineAvailabilityPage() {
  const summaryCards = [
    {
      title: "Total Machines",
      value: "144",
      note: "Active fleet units only",
    },
    {
      title: "Average Fleet Availability",
      value: "85.36%",
      note: "Average across active listed machines",
    },
    {
      title: "Total Run Time Hours",
      value: "48,882.5",
      note: "Scheduled minus downtime hours",
    },
    {
      title: "Units Below 85%",
      value: "11",
      note: "Click to view lowest availability units",
    },
  ];

  const groupedAverages = [
    {
      type: "CARGO",
      units: 1,
      availability: "100.00%",
      runTime: "360.00",
      downtime: "0.00",
      status: "GREEN",
    },
    {
      type: "CH",
      units: 2,
      availability: "98.51%",
      runTime: "709.29",
      downtime: "10.71",
      status: "GREEN",
    },
    {
      type: "HT",
      units: 17,
      availability: "95.96%",
      runTime: "5,872.93",
      downtime: "247.07",
      status: "GREEN",
    },
    {
      type: "LIGHT VEHICLES",
      units: 118,
      availability: "82.87%",
      runTime: "39,834.47",
      downtime: "2,646.00",
      status: "RED",
    },
    {
      type: "TG",
      units: 2,
      availability: "100.00%",
      runTime: "720.00",
      downtime: "0.00",
      status: "GREEN",
    },
    {
      type: "TT",
      units: 1,
      availability: "100.00%",
      runTime: "360.00",
      downtime: "0.00",
      status: "GREEN",
    },
    {
      type: "WB",
      units: 3,
      availability: "94.98%",
      runTime: "1,025.84",
      downtime: "54.16",
      status: "GREEN",
    },
  ];

  const chartBars = [
    { label: "CARGO", value: "100.0%", height: "100%" },
    { label: "CH", value: "98.5%", height: "98%" },
    { label: "HT", value: "96.0%", height: "96%" },
    { label: "LIGHT VEHICLES", value: "82.9%", height: "83%" },
    { label: "TG", value: "100.0%", height: "100%" },
    { label: "TT", value: "100.0%", height: "100%" },
    { label: "WB", value: "95.0%", height: "95%" },
  ];

  const [searchTerm, setSearchTerm] = useState("");
  const [machines, setMachines] = useState<Machine[]>([
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
  ]);

  const filteredMachines = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) return machines;

    return machines.filter(
      (machine) =>
        machine.id.toLowerCase().includes(term) ||
        machine.type.toLowerCase().includes(term) ||
        machine.department.toLowerCase().includes(term) ||
        machine.location.toLowerCase().includes(term) ||
        machine.status.toLowerCase().includes(term)
    );
  }, [machines, searchTerm]);

  const toggleStatus = (id: string) => {
    setMachines((current) =>
      current.map((machine) =>
        machine.id === id
          ? {
              ...machine,
              status: machine.status === "AVAILABLE" ? "DOWN" : "AVAILABLE",
            }
          : machine
      )
    );
  };

  return (
    <div className="availability-page">
      <section className="upload-panel">
        <div className="section-heading">
          <h2>Admin Upload and Save</h2>
        </div>

        <div className="upload-grid">
          <div className="upload-main">
            <label className="upload-label">Upload Excel workbook</label>
            <input className="upload-input" type="file" />
          </div>

          <div className="upload-actions">
            <button className="primary-btn">Upload and Save</button>
            <button className="secondary-btn">Reset to sample data</button>
          </div>
        </div>

        <div className="info-strip">
          Upload a normal workbook. The app will look across sheets for machine,
          downtime, scheduled, availability, and optional event data.
        </div>
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
              <h2>Availability by Type</h2>
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
                <select>
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
              <button className="primary-btn">Generate report</button>
              <button className="secondary-btn">Download PDF</button>
            </div>
          </div>
        </div>
      </section>

      <section className="availability-panel bottom-register-panel">
        <div className="panel-title-wrap">
          <h2>Bottom Machine Register</h2>
          <p>
            Full machine list with department, status, location, and latest
            recorded availability.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Search by unit, type, department, location or status"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid #2a3348",
              minWidth: "280px",
              width: "100%",
              maxWidth: "420px",
              background: "#111827",
              color: "#ffffff",
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
                        style={{ border: "none", cursor: "pointer" }}
                      >
                        {machine.status}
                      </button>
                    </td>
                    <td>{machine.location}</td>
                    <td>{machine.availability}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
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
