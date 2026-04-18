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
    status: "AVAILABLE",
    location: "",
    availability: "",
  });

  // LOAD
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setMachines(JSON.parse(saved));
    }
  }, []);

  // SAVE
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
  }, [machines]);

  // ADD MACHINE
  const addMachine = () => {
    if (
      !form.id ||
      !form.type ||
      !form.department ||
      !form.location ||
      !form.availability
    )
      return;

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

  // DELETE
  const deleteMachine = (id: string) => {
    setMachines(machines.filter((m) => m.id !== id));
  };

  // TOGGLE STATUS
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

  // SEARCH
  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return machines.filter(
      (m) =>
        m.id.toLowerCase().includes(t) ||
        m.type.toLowerCase().includes(t) ||
        m.department.toLowerCase().includes(t) ||
        m.location.toLowerCase().includes(t)
    );
  }, [machines, search]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Machine Availability</h1>

      {/* ADD MACHINE */}
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        <input
          placeholder="Unit No"
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
        />
        <input
          placeholder="Type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        />
        <input
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />
        <select
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value as any })
          }
        >
          <option>AVAILABLE</option>
          <option>DOWN</option>
        </select>
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <input
          placeholder="Availability %"
          value={form.availability}
          onChange={(e) => setForm({ ...form, availability: e.target.value })}
        />

        <button onClick={addMachine}>Add Machine</button>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search machines..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 20 }}
      />

      {/* TABLE */}
      <table border={1} cellPadding={8} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Type</th>
            <th>Department</th>
            <th>Status</th>
            <th>Location</th>
            <th>Availability</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id}>
              <td>{m.id}</td>
              <td>{m.type}</td>
              <td>{m.department}</td>
              <td>
                <button onClick={() => toggleStatus(m.id)}>
                  {m.status}
                </button>
              </td>
              <td>{m.location}</td>
              <td>{m.availability}</td>
              <td>
                <button onClick={() => deleteMachine(m.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
