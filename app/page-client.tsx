"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
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
};

export default function DashboardClient({
  role,
  username,
}: {
  role: string;
  username: string;
}) {
  const [machines, setMachines] = useState<Machine[]>([]);

  // ✅ LOAD FROM SUPABASE
  useEffect(() => {
    async function loadMachines() {
      const { data, error } = await supabase
        .from("machines")
        .select("*");

      if (!error && data) {
        setMachines(data as Machine[]);
      }
    }

    loadMachines();
  }, []);

  // ✅ ADMIN UPLOAD → SAVE TO SUPABASE
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet) as Machine[];

    setMachines(json);

    // clear old data
    await supabase.from("machines").delete().neq("fleet", "");

    // insert new
    await supabase.from("machines").insert(json);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Turbo Energy Dashboard</h1>
      <p>Welcome, {username}</p>

      {role === "admin" && (
        <input type="file" accept=".xlsx" onChange={handleUpload} />
      )}

      <table border={1} cellPadding={5} style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>Fleet</th>
            <th>Type</th>
            <th>Status</th>
            <th>Location</th>
            <th>Department</th>
          </tr>
        </thead>
        <tbody>
          {machines.map((m, i) => (
            <tr key={i}>
              <td>{m.fleet}</td>
              <td>{m.type}</td>
              <td>{m.status}</td>
              <td>{m.location}</td>
              <td>{m.department}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
