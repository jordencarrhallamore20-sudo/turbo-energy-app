"use client";

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
          <button onClick={() => alert("Admin section coming next")}>
            Admin
          </button>

          <button onClick={() => alert("Admin tools coming next")}>
            Admin tools
          </button>

          <button onClick={() => alert("Machine lookup coming next")}>
            Machine lookup
          </button>

          <button onClick={() => alert("Departments section coming next")}>
            Departments
          </button>

          <button
            onClick={() =>
              alert("Bottom machine register is already on this page")
            }
          >
            Bottom machine register
          </button>

          <button onClick={() => alert("Log out function coming next")}>
            Log out
          </button>
        </nav>
      </header>

      <main className="machine-main-content">{children}</main>
    </div>
  );
}
