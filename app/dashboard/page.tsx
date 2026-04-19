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

export default async function Page() {
  const { data } = await supabase.from("machines").select("*")

  const machines: Machine[] = data || []

  return (
    <div className="page">

      {/* TOP BAR */}
      <div className="topbar">
        <div className="logo">YOUR LOGO</div>
        <div className="actions">
          <button className="btn">Upload Excel</button>
        </div>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="card">Total: {machines.length}</div>
        <div className="card">
          Available: {machines.filter(m => getStatusColor(m.status) === "green").length}
        </div>
        <div className="card">
          Down: {machines.filter(m => getStatusColor(m.status) === "red").length}
        </div>
      </div>

      {/* MACHINE LIST */}
      <div className="list">
        {machines.map((m) => (
          <div key={m.id} className="machine">
            <div>{m.name}</div>
            <div>{m.model}</div>
            <div className={`status ${getStatusColor(m.status)}`}>
              {m.status}
            </div>
          </div>
        ))}
      </div>

      {/* TABLE */}
      <table className="table">
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
  )
}
