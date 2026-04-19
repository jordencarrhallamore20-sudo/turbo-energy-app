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
  const value = (status || "").toLowerCase()
  if (value.includes("avail")) return "green"
  if (value.includes("repair")) return "orange"
  if (value.includes("down")) return "red"
  return "gray"
}

function getType(name: string) {
  return (name || "").slice(0, 3).toUpperCase() || "OTH"
}

export default async function Page() {
  const { data } = await supabase.from("machines").select("*")
  const machines: Machine[] = data || []

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
        <button className="upload-btn">Upload Excel</button>
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

    </div>
  )
}
