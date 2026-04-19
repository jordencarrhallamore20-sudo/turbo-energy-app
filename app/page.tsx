"use client";

import { useEffect, useState } from "react";

type Machine = {
  fleet: string;
  type: string;
  machineType: string;
  status: string;
  location: string;
  availability: number;
  updated: string;
};

export default function Page() {
  const [data, setData] = useState<Machine[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("machines");
    if (stored) {
      setData(JSON.parse(stored));
    } else {
      const sample: Machine[] = [
        { fleet: "FEL10", type: "FEL", machineType: "SL60", status: "Available", location: "Hwange", availability: 88, updated: "19 Apr" },
        { fleet: "TEX01", type: "TEX", machineType: "TK371", status: "Repair", location: "Kariba", availability: 75, updated: "18 Apr" },
        { fleet: "TRT07", type: "TRT", machineType: "TR100", status: "Available", location: "Hwange", availability: 100, updated: "18 Apr" },
        { fleet: "HT03", type: "HT", machineType: "773E", status: "Repair", location: "Binga", availability: 82, updated: "17 Apr" },
        { fleet: "GEN02", type: "GEN", machineType: "WTS000", status: "Available", location: "Hwange", availability: 67, updated: "18 Apr" },
      ];
      setData(sample);
      localStorage.setItem("machines", JSON.stringify(sample));
    }
  }, []);

  const total = data.length;
  const available = data.filter(d => d.status === "Available").length;
  const repairs = total - available;
  const locations = new Set(data.map(d => d.location)).size;

  return (
    <div style={{ padding: 20, color: "white", fontFamily: "Arial" }}>
      
      <h1>Turbo Energy Machine Availability</h1>

      {/* KPI ROW */}
      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <Card title="Total Machines" value={total} />
        <Card title="Available" value={available} />
        <Card title="Repairs" value={repairs} />
        <Card title="Locations" value={locations} />
      </div>

      {/* TABLE */}
      <div style={{ marginTop: 30 }}>
        <h2>Machine Register</h2>
        <table style={{ width: "100%", marginTop: 10 }}>
          <thead>
            <tr>
              <th>Fleet</th>
              <th>Type</th>
              <th>Status</th>
              <th>Location</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => (
              <tr key={i}>
                <td>{m.fleet}</td>
                <td>{m.machineType}</td>
                <td>{m.status}</td>
                <td>{m.location}</td>
                <td>{m.availability}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div style={{
      background: "white",
      color: "black",
      padding: 20,
      borderRadius: 10,
      minWidth: 150
    }}>
      <div style={{ fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}
