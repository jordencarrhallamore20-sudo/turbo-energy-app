export default function MachineAvailabilityPage() {
  const summaryCards = [
    {
      title: "Total Machines",
      value: "144",
      note: "Active fleet units only",
    },
    {
      title: "Average Fleet Availability",
      value: "85.36%",
      note: "Average across active listed machines",
    },
    {
      title: "Total Run Time Hours",
      value: "48,882.5",
      note: "Scheduled minus downtime hours",
    },
    {
      title: "Units Below 85%",
      value: "11",
      note: "Click to view lowest availability units",
    },
  ];

  const groupedAverages = [
    {
      type: "CARGO",
      units: 1,
      availability: "100.00%",
      runTime: "360.00",
      downtime: "0.00",
      status: "GREEN",
    },
    {
      type: "CH",
      units: 2,
      availability: "98.51%",
      runTime: "709.29",
      downtime: "10.71",
      status: "GREEN",
    },
    {
      type: "HT",
      units: 17,
      availability: "95.96%",
      runTime: "5,872.93",
      downtime: "247.07",
      status: "GREEN",
    },
    {
      type: "LIGHT VEHICLES",
      units: 118,
      availability: "82.87%",
      runTime: "39,834.47",
      downtime: "2,646.00",
      status: "RED",
    },
    {
      type: "TG",
      units: 2,
      availability: "100.00%",
      runTime: "720.00",
      downtime: "0.00",
      status: "GREEN",
    },
    {
      type: "TT",
      units: 1,
      availability: "100.00%",
      runTime: "360.00",
      downtime: "0.00",
      status: "GREEN",
    },
    {
      type: "WB",
      units: 3,
      availability: "94.98%",
      runTime: "1,025.84",
      downtime: "54.16",
      status: "GREEN",
    },
  ];

  const chartBars = [
    { label: "CARGO", value: "100.0%", height: "100%" },
    { label: "CH", value: "98.5%", height: "98%" },
    { label: "HT", value: "96.0%", height: "96%" },
    { label: "LIGHT VEHICLES", value: "82.9%", height: "83%" },
    { label: "TG", value: "100.0%", height: "100%" },
    { label: "TT", value: "100.0%", height: "100%" },
    { label: "WB", value: "95.0%", height: "95%" },
  ];

  return (
    <div className="availability-page">
      <section className="upload-panel">
        <div className="section-heading">
          <h2>Admin Upload and Save</h2>
        </div>

        <div className="upload-grid">
          <div className="upload-main">
            <label className="upload-label">Upload Excel workbook</label>
            <input className="upload-input" type="file" />
          </div>

          <div className="upload-actions">
            <button className="primary-btn">Upload and Save</button>
            <button className="secondary-btn">Reset to sample data</button>
          </div>
        </div>

        <div className="info-strip">
          Upload a normal workbook. The app will look across sheets for machine,
          downtime, scheduled, availability, and optional event data.
        </div>
      </section>

      <section className="availability-summary-grid">
        {summaryCards.map((card) => (
          <div className="availability-summary-card" key={card.title}>
            <span className="availability-card-title">{card.title}</span>
            <strong className="availability-card-value">{card.value}</strong>
            <p className="availability-card-note">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="availability-main-grid">
        <div className="availability-panel large-panel">
          <div className="panel-title-wrap">
            <h2>Grouped Machine Type Averages</h2>
            <p>
              Same machine types grouped together, including Light Vehicles.
              Major repair units are excluded.
            </p>
          </div>

          <div className="availability-table-wrap">
            <table className="availability-table">
              <thead>
                <tr>
                  <th>Machine Type</th>
                  <th>Units</th>
                  <th>Average Availability</th>
                  <th>Total Run Time</th>
                  <th>Total Downtime</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedAverages.map((row) => (
                  <tr key={row.type}>
                    <td>{row.type}</td>
                    <td>{row.units}</td>
                    <td>{row.availability}</td>
                    <td>{row.runTime}</td>
                    <td>{row.downtime}</td>
                    <td>
                      <span
                        className={
                          row.status === "GREEN"
                            ? "status-badge green"
                            : "status-badge red"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="availability-side-column">
          <div className="availability-panel">
            <div className="panel-title-wrap">
              <h2>Availability by Type</h2>
            </div>

            <div className="bar-chart">
              {chartBars.map((bar) => (
                <div className="bar-item" key={bar.label}>
                  <span className="bar-value">{bar.value}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ height: bar.height }}
                    />
                  </div>
                  <span className="bar-label">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="availability-panel">
            <div className="panel-title-wrap">
              <h2>PDF Report Generator</h2>
            </div>

            <div className="report-grid">
              <div className="report-field">
                <label>Report type</label>
                <select>
                  <option>Monthly</option>
                  <option>Weekly</option>
                  <option>Daily</option>
                </select>
              </div>

              <div className="report-field">
                <label>Report title / period</label>
                <input type="text" placeholder="e.g. April 2026" />
              </div>
            </div>

            <div className="report-actions">
              <button className="primary-btn">Generate report</button>
              <button className="secondary-btn">Download PDF</button>
            </div>
          </div>
        </div>
      </section>
      <section className="availability-panel bottom-register-panel">
  <div className="panel-title-wrap">
    <h2>Bottom Machine Register</h2>
    <p>
      Full machine list with department, status, location, and latest recorded
      availability.
    </p>
  </div>

  <div className="availability-table-wrap">
    <table className="availability-table">
      <thead>
        <tr>
          <th>Unit No</th>
          <th>Machine Type</th>
          <th>Department</th>
          <th>Status</th>
          <th>Location</th>
          <th>Availability</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>FEL10</td>
          <td>SL60</td>
          <td>Mining</td>
          <td>
            <span className="status-badge green">AVAILABLE</span>
          </td>
          <td>Hwange</td>
          <td>96.4%</td>
        </tr>
        <tr>
          <td>HT12</td>
          <td>Haul Truck</td>
          <td>Operations</td>
          <td>
            <span className="status-badge green">AVAILABLE</span>
          </td>
          <td>North Pit</td>
          <td>94.8%</td>
        </tr>
        <tr>
          <td>LV33</td>
          <td>Light Vehicle</td>
          <td>Admin</td>
          <td>
            <span className="status-badge red">DOWN</span>
          </td>
          <td>Main Yard</td>
          <td>78.2%</td>
        </tr>
        <tr>
          <td>WB05</td>
          <td>Water Bowser</td>
          <td>Support</td>
          <td>
            <span className="status-badge green">AVAILABLE</span>
          </td>
          <td>Plant Area</td>
          <td>95.0%</td>
        </tr>
        <tr>
          <td>TG02</td>
          <td>Generator</td>
          <td>Utilities</td>
          <td>
            <span className="status-badge green">AVAILABLE</span>
          </td>
          <td>South Section</td>
          <td>100.0%</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
    </div>
  );
}
