"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Machine = {
  fleet: string;
  status: string;
  hoursWorked: number;
  hoursDown: number;
  onlineStatus: string;
  downtimeReason: string;
  repairReason: string;
};

export default function ForemanPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedFleet, setSelectedFleet] = useState("");
  const [form, setForm] = useState<Partial<Machine>>({});

  useEffect(() => {
    loadMachines();
  }, []);

  async function loadMachines() {
    const { data } = await supabase.from("machines").select("*");

    if (data) {
      setMachines(data);
      if (data.length > 0) {
        setSelectedFleet(data[0].fleet);
        setForm(data[0]);
      }
    }
  }

  function selectMachine(fleet: string) {
    const m = machines.find((x) => x.fleet === fleet);
    if (!m) return;
    setSelectedFleet(fleet);
    setForm(m);
  }

  async function save() {
    if (!selectedFleet) return;

    await supabase
      .from("machines")
      .update({
        status: form.status,
        hoursWorked: Number(form.hoursWorked || 0),
        hoursDown: Number(form.hoursDown || 0),
        onlineStatus: form.onlineStatus,
        downtimeReason: form.downtimeReason,
        repairReason: form.repairReason,
        updated: new Date().toLocaleDateString(),
      })
      .eq("fleet", selectedFleet);

    alert("Updated");
  }

  return (
    <div style={{ padding: 20, background: "#081733", minHeight: "100vh", color: "white" }}>
      <h1>Foreman Machine Update</h1>

      <select
        value={selectedFleet}
        onChange={(e) => selectMachine(e.target.value)}
        style={{ width: "100%", padding: 12, marginBottom: 20 }}
      >
        {machines.map((m) => (
          <option key={m.fleet} value={m.fleet}>
            {m.fleet}
          </option>
        ))}
      </select>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Status"
          value={form.status || ""}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        />

        <input
          type="number"
          placeholder="Hours Worked"
          value={form.hoursWorked || 0}
          onChange={(e) =>
            setForm({ ...form, hoursWorked: Number(e.target.value) })
          }
        />

        <input
          type="number"
          placeholder="Hours Down"
          value={form.hoursDown || 0}
          onChange={(e) =>
            setForm({ ...form, hoursDown: Number(e.target.value) })
          }
        />

        <select
          value={form.onlineStatus || ""}
          onChange={(e) =>
            setForm({ ...form, onlineStatus: e.target.value })
          }
        >
          <option>Online</option>
          <option>Offline</option>
          <option>Standby</option>
        </select>

        <input
          placeholder="Downtime Reason"
          value={form.downtimeReason || ""}
          onChange={(e) =>
            setForm({ ...form, downtimeReason: e.target.value })
          }
        />

        <input
          placeholder="Repair Reason"
          value={form.repairReason || ""}
          onChange={(e) =>
            setForm({ ...form, repairReason: e.target.value })
          }
        />

        <button
          onClick={save}
          style={{
            padding: 15,
            background: "orange",
            color: "white",
            fontWeight: "bold",
          }}
        >
          Save Update
        </button>
      </div>
    </div>
  );
}
