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

  const total = machines.length
  const available = machines.filter(m => getStatusColor(m.status) === "green").length
  const down = machines.filter(m => getStatusColor(m.status) === "red").length

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
