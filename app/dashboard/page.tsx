export default function DashboardPage() {
  const stats = [
    { label: "Open Jobs", value: "18", change: "+4 this week" },
    { label: "Machines Active", value: "126", change: "+9 today" },
    { label: "Fuel Used", value: "4,820L", change: "-3.2% vs last week" },
    { label: "Downtime Alerts", value: "7", change: "2 critical" },
  ];

  const recentActivity = [
    { title: "SL60 Loader service completed", time: "10 mins ago", status: "Done" },
    { title: "Fuel log added for Truck 24", time: "32 mins ago", status: "Logged" },
    { title: "Hydraulic fault on Excavator EX07", time: "1 hr ago", status: "Attention" },
    { title: "Workshop stock updated", time: "2 hrs ago", status: "Updated" },
  ];

  return (
    <div className="dashboard-page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Workshop Control Center</p>
          <h1>Welcome back</h1>
          <p className="hero-text">
            Monitor machines, fuel logs, service jobs, alerts, and workshop
            performance from one place.
          </p>
        </div>

        <div className="hero-actions">
          <button className="primary-btn">+ New Entry</button>
          <button className="secondary-btn">View Reports</button>
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((item) => (
          <div className="stat-card" key={item.label}>
            <span className="stat-label">{item.label}</span>
            <strong className="stat-value">{item.value}</strong>
            <span className="stat-change">{item.change}</span>
          </div>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel-card">
          <div className="panel-header">
            <h2>Recent Activity</h2>
            <a href="#">See all</a>
          </div>

          <div className="activity-list">
            {recentActivity.map((item) => (
              <div className="activity-item" key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.time}</p>
                </div>
                <span className="status-pill">{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h2>Quick Actions</h2>
          </div>

          <div className="quick-actions">
            <button>Add Fuel Log</button>
            <button>Create Job Card</button>
            <button>Record Breakdown</button>
            <button>Update Stock</button>
          </div>
        </div>
      </section>
    </div>
  );
}
