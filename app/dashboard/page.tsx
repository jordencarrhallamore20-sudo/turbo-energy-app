export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

type MachineRow = {
  id: string
  name: string
  model: string
  status: string
  location: string
  created_at?: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function statusClass(status: string) {
  const s = (status || '').toLowerCase()
  if (s.includes('avail')) return 'green'
  if (s.includes('repair') || s.includes('down') || s.includes('break')) return 'red'
  return 'amber'
}

export default async function Page() {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .order('created_at', { ascending: false })

  const machines: MachineRow[] = data || []

  const total = machines.length
  const available = machines.filter((m) =>
    (m.status || '').toLowerCase().includes('avail')
  ).length
  const repairs = machines.filter((m) => {
    const s = (m.status || '').toLowerCase()
    return s.includes('repair') || s.includes('down') || s.includes('break')
  }).length
  const locations = new Set(machines.map((m) => m.location).filter(Boolean)).size

  return (
    <main className="tePage">
      <style>{`
        :root{
          --navy:#123c73;
          --navy2:#1d4d8e;
          --grey:#eef3f8;
          --line:#cad6e5;
          --text:#18314d;
          --green:#16803c;
          --amber:#b7791f;
          --red:#c0392b;
          --card:#ffffff;
        }

        *{box-sizing:border-box}
        body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f3f7fc;color:var(--text)}
        .tePage{background:#f3f7fc;min-height:100vh;color:var(--text)}

        .teHeader{
          background:var(--navy);
          color:#fff;
          padding:10px 18px 14px;
          position:sticky;
          top:0;
          z-index:10;
          border-bottom:4px solid #0d2e57;
        }

        .headerInner{
          display:grid;
          grid-template-columns:minmax(260px,360px) 1fr auto;
          align-items:center;
          gap:20px;
        }

        .logoWrap{display:flex;align-items:center;justify-content:flex-start}
        .logoChip{
          display:flex;
          align-items:center;
          justify-content:center;
          background:#fff;
          border-radius:18px;
          padding:10px 18px;
          min-height:72px;
          min-width:320px;
          box-shadow:0 2px 0 rgba(0,0,0,.1);
          color:var(--navy);
          font-weight:900;
          font-size:28px;
          letter-spacing:.5px;
        }

        .titleBlock{text-align:center;justify-self:center}
        .titleBlock h1{margin:0;font-size:28px;line-height:1.15;color:#fff}
        .sub{font-size:13px;opacity:.92;margin-top:6px}

        .topBtns{
          display:flex;
          gap:10px;
          align-items:center;
          flex-wrap:wrap;
          justify-content:flex-end;
        }

        .btn{
          background:var(--navy);
          color:#fff;
          border:none;
          border-radius:12px;
          padding:11px 16px;
          font-weight:800;
          cursor:pointer;
        }

        .btn.secondary{
          background:#fff;
          color:var(--navy);
          border:2px solid #b8c7db;
        }

        .btn.small{
          padding:10px 14px;
          border-radius:999px;
          font-size:12px;
          white-space:nowrap;
        }

        .wrap{
          max-width:1560px;
          margin:18px auto;
          padding:0 14px 30px;
        }

        .card{
          background:var(--card);
          border:1px solid var(--line);
          border-radius:20px;
          padding:18px;
          box-shadow:0 1px 0 rgba(17,53,97,.04);
        }

        .row{display:grid;gap:16px}
        .row2{grid-template-columns:1.1fr .9fr}
        .row3{grid-template-columns:1fr 1fr 1fr}
        .row4{grid-template-columns:repeat(4,1fr)}

        .sectionTitle{
          font-size:18px;
          font-weight:900;
          color:var(--navy);
          margin:0 0 8px;
        }

        .muted{font-size:13px;color:#6d7f96}
        .banner{
          background:#eaf2fc;
          border:1px solid #c7d8ef;
          border-radius:14px;
          padding:12px 14px;
          color:#35597e;
          font-size:13px;
        }

        .kpi .label{
          font-size:12px;
          font-weight:800;
          color:#5a7391;
        }

        .kpi .value{
          font-size:26px;
          font-weight:900;
          color:var(--navy);
          margin-top:8px;
        }

        .kpi .help{
          font-size:12px;
          color:#6c829d;
          margin-top:6px;
        }

        .chartBox{
          height:250px;
          border:1px solid var(--line);
          border-radius:16px;
          padding:12px;
          overflow:auto;
          background:#fff;
        }

        .chartPlaceholder{
          height:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#6d7f96;
          font-weight:700;
          background:linear-gradient(180deg,#f8fbff,#edf4fb);
          border-radius:12px;
          border:1px dashed #c7d8ef;
        }

        .tableWrap{
          max-height:410px;
          overflow:auto;
          border:1px solid var(--line);
          border-radius:14px;
          background:#fff;
        }

        table{width:100%;border-collapse:collapse}
        th,td{
          padding:12px 10px;
          border-bottom:1px solid #e6edf5;
          text-align:left;
          font-size:14px;
          vertical-align:top;
        }

        th{
          background:#eef4fb;
          position:sticky;
          top:0;
          z-index:1;
          color:#234870;
        }

        .badge{
          display:inline-block;
          padding:7px 12px;
          border-radius:999px;
          color:#fff;
          font-weight:800;
          font-size:12px;
        }

        .green{background:var(--green)}
        .amber{background:var(--amber)}
        .red{background:var(--red)}

        .noteItem{
          border:1px solid var(--line);
          border-radius:12px;
          padding:10px 12px;
          margin-bottom:8px;
          background:#fafcff;
        }

        .errorBox{
          margin-bottom:16px;
          background:#fff2f2;
          border:1px solid #f0c6c6;
          color:#9d2f2f;
          border-radius:14px;
          padding:12px 14px;
          font-size:14px;
          font-weight:700;
        }

        @media (max-width:1150px){
          .headerInner{grid-template-columns:1fr;gap:12px}
          .logoWrap{justify-content:center}
          .titleBlock{text-align:center}
          .topBtns{justify-content:center}
          .row2,.row3,.row4{grid-template-columns:1fr}
          .logoChip{min-width:auto;width:100%}
        }

        @media (max-width:700px){
          .logoChip{min-height:62px;font-size:22px}
          .titleBlock h1{font-size:22px}
          .btn.small{padding:8px 11px;font-size:11px}
        }
      `}</style>

      <header className="teHeader">
        <div className="headerInner">
          <div className="logoWrap">
            <div className="logoChip">TURBO ENERGY</div>
          </div>

          <div className="titleBlock">
            <h1>Turbo-Energy Machine Availability</h1>
            <div className="sub">
              Live fleet dashboard shell connected to Supabase
            </div>
          </div>

          <div className="topBtns">
            <button className="btn small secondary">Upload File</button>
            <button className="btn small secondary">Units Below 85%</button>
            <button className="btn small">Bottom Register</button>
          </div>
        </div>
      </header>

      <div className="wrap">
        {error && (
          <div className="errorBox">
            Database error: {error.message}
          </div>
        )}

        <div className="row row4">
          <div className="card kpi">
            <div className="label">TOTAL MACHINES</div>
            <div className="value">{total}</div>
            <div className="help">All units currently in the register</div>
          </div>

          <div className="card kpi">
            <div className="label">AVAILABLE</div>
            <div className="value">{available}</div>
            <div className="help">Units marked available</div>
          </div>

          <div className="card kpi">
            <div className="label">REPAIRS / DOWN</div>
            <div className="value">{repairs}</div>
            <div className="help">Units needing attention</div>
          </div>

          <div className="card kpi">
            <div className="label">LOCATIONS</div>
            <div className="value">{locations}</div>
            <div className="help">Distinct operating locations</div>
          </div>
        </div>

        <div className="row row2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="sectionTitle">Availability Trend / Summary Chart</div>
            <div className="muted">
              Shell section ready. We’ll wire the real chart next.
            </div>
            <div className="chartBox" style={{ marginTop: 12 }}>
              <div className="chartPlaceholder">Chart area</div>
            </div>
          </div>

          <div className="card">
            <div className="sectionTitle">Notes / Summary Panel</div>
            <div className="muted">
              Same right-hand dashboard panel style as your design shell.
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="noteItem">
                <strong>Live data connected</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  The dashboard is now reading machines from Supabase.
                </div>
              </div>

              <div className="noteItem">
                <strong>Next step</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  We can now style filters, charts, and admin actions.
                </div>
              </div>

              <div className="banner" style={{ marginTop: 10 }}>
                This is the shell pass first: header, KPI row, chart panel,
                notes panel, summary table, and bottom register.
              </div>
            </div>
          </div>
        </div>

        <div className="row row2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="sectionTitle">Top Machine Summary</div>
            <div className="muted">
              Quick summary table in the same dashboard style.
            </div>

            <div className="tableWrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Fleet Number</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No machines yet</td>
                    </tr>
                  ) : (
                    machines.slice(0, 8).map((m) => (
                      <tr key={m.id}>
                        <td>{m.name}</td>
                        <td>{m.model}</td>
                        <td>
                          <span className={`badge ${statusClass(m.status)}`}>
                            {m.status || 'Unknown'}
                          </span>
                        </td>
                        <td>{m.location || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="sectionTitle">Bottom Machine-by-Machine Register</div>
            <div className="muted">
              This keeps the shell section you asked to bring back.
            </div>

            <div className="banner" style={{ marginTop: 12 }}>
              Scroll down to the full bottom register. This top summary mirrors
              the live dataset with machine visibility.
            </div>

            <div className="tableWrap" style={{ marginTop: 12, maxHeight: 390 }}>
              <table>
                <thead>
                  <tr>
                    <th>Fleet Number</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No machines yet</td>
                    </tr>
                  ) : (
                    machines.map((m) => (
                      <tr key={`mini-${m.id}`}>
                        <td>{m.name}</td>
                        <td>{m.model}</td>
                        <td>
                          <span className={`badge ${statusClass(m.status)}`}>
                            {m.status || 'Unknown'}
                          </span>
                        </td>
                        <td>{m.location || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="sectionTitle">Bottom Machine Detail Register</div>
          <div className="muted">
            Every machine, active or major repairs, with current location and status.
          </div>

          <div
            className="row"
            style={{ gridTemplateColumns: '220px 220px 1fr', marginTop: 12 }}
          >
            <div>
              <label className="muted">Show</label>
              <select defaultValue="all">
                <option value="active">Active fleet only</option>
                <option value="repairs">Long term rebuild and repairs only</option>
                <option value="all">All machines</option>
              </select>
            </div>

            <div>
              <label className="muted">Quick machine search</label>
              <input placeholder="Type fleet number or type" />
            </div>

            <div className="banner" style={{ alignSelf: 'end' }}>
              Next pass: wire filters, search, popups, and chart behavior.
            </div>
          </div>

          <div className="tableWrap" style={{ marginTop: 14, maxHeight: 560 }}>
            <table>
              <thead>
                <tr>
                  <th>Fleet Number</th>
                  <th>Machine Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {machines.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No machines yet</td>
                  </tr>
                ) : (
                  machines.map((m) => (
                    <tr key={`full-${m.id}`}>
                      <td><strong>{m.name}</strong></td>
                      <td>{m.model}</td>
                      <td>
                        <span className={`badge ${statusClass(m.status)}`}>
                          {m.status || 'Unknown'}
                        </span>
                      </td>
                      <td>{m.location || '-'}</td>
                      <td>
                        {m.created_at
                          ? new Date(m.created_at).toLocaleDateString()
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
