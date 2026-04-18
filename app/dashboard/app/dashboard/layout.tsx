import type { ReactNode } from "react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Fuel Logs", href: "/dashboard/fuel" },
    { name: "Machines", href: "/dashboard/machines" },
    { name: "Workshop", href: "/dashboard/workshop" },
    { name: "Reports", href: "/dashboard/reports" },
    { name: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-logo">R</div>
          <div>
            <h2>Rith</h2>
            <p>Workshop System</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link key={item.name} href={item.href} className="nav-link">
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Manage your operation in one view</p>
          </div>

          <div className="topbar-right">
            <input
              className="search-box"
              type="text"
              placeholder="Search..."
            />
            <div className="user-badge">JH</div>
          </div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
