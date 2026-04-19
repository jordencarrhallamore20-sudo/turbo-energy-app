"use client"

import { useState } from "react"

type Machine = {
  name: string
  model: string
  status: string
  department: string
}

function getStatusColor(status: string) {
  const value = (status || "").toLowerCase()
  if (value.includes("avail")) return "green"
  if (value.includes("repair")) return "orange"
  if (value.includes("down")) return "red"
  return "gray"
}

function getType(name: string) {
  return (name || "").slice(0, 3).toUpperCase() || "OTH"
}

export default function Page() {
  const [machines, setMachines] = useState<Machine[]>([])

  function handleFile(e: any) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = (evt: any) => {
      const text = evt.target.result
      const rows = text.split("\n")

      const data: Machine[] = rows.slice(1).map((row: string) => {
        const [name, model, status, department] = row.split(",")
        return { name, model, status, department }
      })

      setMachines(data)
    }

    reader.readAsText(file)
  }

  const total = machines.length
  const available = machines.filter(m => getStatusColor(m.status) === "green").length
  const down = machines.filter(m => getStatusColor(m.status) === "red").length

  const typeMap: any = {}
  machines.forEach(m => {
    const type = getType(m.name)
    if (!typeMap[type]) typeMap[type] = { total: 0, available: 0, down: 0 }
    typeMap[type].total++
    if (getStatusColor(m.status) === "green") typeMap[type].available++
    if (getStatusColor(m.status) === "red") typeMap[type].down++
  })

  const deptMap: any = {}
  machines.forEach(m => {
    const dept = m.department || "Unassigned"
    if (!deptMap[dept]) deptMap[dept] = []
    deptMap[dept].push(m)
  })

  return (
    <div className="page">

      <div className="header">
        <div className="header-left">
          <img src="/logo.png" className="logo" />
          <h1>Machine Availability</h1>
        </div>

        <input type="file" accept=".csv" onChange={handleFile} />
      </div>

      <div className="stats">
        <div className="card">Total: {total}</div>
        <div className="card">Available: {available}</div>
        <div className="card">Down: {down}</div>
      </div>

      <div className="types">
        {Object.keys(typeMap).map(type => (
          <div key={type} className="type-card">
            <h3>{type}</h3>
            <p>Total: {typeMap[type].total}</p>
            <p>Available: {typeMap[type].available}</p>
            <p>Down: {typeMap[type].down}</p>
          </div>
        ))}
      </div>

      <div className="departments">
        {Object.keys(deptMap).map(dept => (
          <div key={dept} className="department">
            <h2>{dept}</h2>

            {deptMap[dept].map((m: Machine, i: number) => (
              <div key={i} className="machine">
                <div>{m.name}</div>
                <div>{m.model}</div>
                <div className={`status ${getStatusColor(m.status)}`}>
                  {m.status}
                </div>
              </div>
            ))}

          </div>
        ))}
      </div>

    </div>
  )
}
