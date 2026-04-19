import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = "force-dynamic"

export default async function Dashboard() {
  const { data: machines } = await supabase
    .from("machines")
    .select("*")

  const total = machines?.length || 0
  const available = machines?.filter(m => m.status === "Available").length || 0
  const down = machines?.filter(m => m.status !== "Available").length || 0
  const locations = new Set(machines?.map(m => m.location)).size

  return (
    <div style={{ background: "#0f2747", minHeight: "100vh", padding: 20, color: "white" }}>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src="/logo.png" style={{ height: 50 }} />
        <h1>Turbo-Energy Machine Availability</h1>

        <div>
          <button style={btn}>Upload File</button>
          <button style={btn}>Units Below 85%</button>
          <button style={btn}>Bottom Register</button>
        </div>
      </div>

      {/* KPI ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 15, marginTop: 20 }}>
        <Card title="TOTAL MACHINES" value={total} />
        <Card title="AVAILABLE" value={available} />
        <Card title="REPAIRS / DOWN" value={down} />
        <Card title="LOCATIONS" value={locations} />
      </div>

      {/* UPLOAD PANEL */}
      <div style={panel}>
        <h3>Admin Upload and Save</h3>
        <input type="file" />
        <div style={{ marginTop: 10 }}>
          <button style={btnOrange}>Export CSV</button>
          <button style={btn}>Print report</button>
        </div>
      </div>

      {/* GRAPH SECTION */}
      <div style={panel}>
        <h3>Availability by Machine Type</h3>

        <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
          {groupByType(machines).map((g: any) => (
            <div key={g.type} style={{ textAlign: "center" }}>
              <div style={{
                height: g.percent * 2,
                width: 40,
                background: "#5fa8ff",
                borderRadius: 6
              }} />
              <p>{g.type}</p>
              <small>{g.percent}%</small>
            </div>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div style={panel}>
        <h3>Machine Register</h3>

        {machines?.map((m) => (
          <div key={m.id} style={{ padding: 10, borderBottom: "1px solid #2c4b6f" }}>
            <b>{m.name}</b> - {m.model} - {m.status} - {m.location}
          </div>
        ))}
      </div>

    </div>
  )
}

/* COMPONENTS */

function Card({ title, value }: any) {
  return (
    <div style={{
      background: "#1b3b63",
      padding: 20,
      borderRadius: 10
    }}>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  )
}

function groupByType(data: any[]) {
  const map: any = {}

  data?.forEach((m) => {
    const type = m.model

    if (!map[type]) {
      map[type] = { total: 0, available: 0 }
    }

    map[type].total++
    if (m.status === "Available") map[type].available++
  })

  return Object.keys(map).map((k) => ({
    type: k,
    percent: Math.round((map[k].available / map[k].total) * 100)
  }))
}

/* STYLES */

const panel = {
  background: "#132f4f",
  padding: 20,
  borderRadius: 10,
  marginTop: 20
}

const btn = {
  marginLeft: 10,
  padding: "8px 15px",
  background: "#1b3b63",
  color: "white",
  border: "none",
  borderRadius: 6
}

const btnOrange = {
  ...btn,
  background: "#ff8c00"
}
