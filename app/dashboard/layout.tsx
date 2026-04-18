import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="machine-app-shell">
      <header className="machine-top-header">
        <div className="machine-brand-card">
          <span className="machine-brand-text">TURBO ENERGY</span>
        </div>

        <div className="machine-header-center">
          <h1>Turbo-Energy Machine Availability</h1>
          <p>
            Single-file local dashboard with admin movements, department
            availability, bottom machine register, and saved browser data
          </p>
        </div>

        <nav className="machine-header-nav">
          <button>Admin</button>
          <button>Admin tools</button>
          <button>Machine lookup</button>
          <button>Departments</button>
          <button>Bottom machine register</button>
          <button>Log out</button>
        </nav>
      </header>

      <main className="machine-main-content">{children}</main>
    </div>
  );
}
