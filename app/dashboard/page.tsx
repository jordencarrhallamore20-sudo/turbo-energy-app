export const dynamic = "force-dynamic"

import { createClient } from "@supabase/supabase-js"

type Machine = {
  id: string
  name: string
  model: string
  status: string
  department: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getStatusColor(status: string) {
  const s = status?.toLowerCase() || ""
  if (s.includes("avail")) return "green"
  if (s.includes("repair")) return "orange"
  if (s.includes("down")) return "red"
  return "gray"
}

function getType(name: string) {
  return name?.slice(0, 3).toUpperCase() || "OTH"
}

export default async function Page() {
  const { data } = await supabase.from("machines").select("*")
  const machines: Machine[] = data || []

  const total = machines.length
  const available = machines.filter(m => getStatusColor(m.status) === "green").length
  const down = machines.filter(m => getStatusColor(m.status) === "red").length

  // TYPE GROUPING
  const typeMap: any = {}
  machines.forEach(m => {
    const type = getType(m.name)

    if (!typeMap[type]) {
      typeMap[type] = { total: 0, available: 0, down: 0 }
    }

    typeMap[type].total++
    if (getStatusColor(m.status) === "green") typeMap[type].available++
    if (getStatusColor(m.status) === "red") typeMap[type].down++
  })

  // DEPARTMENT GROUPING
  const deptMap: any = {}
  machines.forEach(m => {
    const dept = m.department || "Unassigned"

    if (!deptMap[dept]) {
      deptMap[dept] = []
    }

    deptMap[dept].push(m)
  })

  return (
    <div className="page">

      <div className="header">
        <div className="header-left">
          <img src="/logo.png" className="logo" />
          <h1>Machine Availability</h1>
        </div>

        <button className="upload-btn">Upload Excel</button>
      </div>

      <div className="stats">
        <div className="card">Total: {total}</div>
        <div className="card">Available: {available}</div>
        <div className="card">Down: {down}</div>
      </div>

      {/* TYPE BREAKDOWN */}
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

      {/* DEPARTMENTS */}
      <div className="departments">
        {Object.keys(deptMap).map(dept => (
          <div key={dept} className="department">
            <h2>{dept}</h2>

            {deptMap[dept].map((m: Machine) => (
              <div key={m.id} className="machine">
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

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Model</th>
              <th>Status</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.model}</td>
                <td>{m.status}</td>
                <td>{m.department}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
