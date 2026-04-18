"use client";

import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="machine-app-shell">
      <style>{`
        :root {
          --machine-blue: #173f78;
          --machine-blue-dark: #102f5a;
          --machine-text: #ffffff;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background:
            radial-gradient(circle at top, rgba(32, 72, 128, 0.28), transparent 30%),
            linear-gradient(180deg, #0d2344 0%, #0f2e58 100%);
          font-family: Arial, Helvetica, sans-serif;
        }

        .machine-app-shell {
          min-height: 100vh;
          color: var(--machine-text);
        }

        .machine-top-header {
          position: sticky;
          top: 0;
          z-index: 40;
          display: grid;
          grid-template-columns: 320px 1fr auto;
          align-items: center;
          gap: 18px;
          padding: 14px 18px;
          background: linear-gradient(180deg, #1d4a87 0%, #173f78 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
        }

        .machine-brand-card {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 68px;
          padding: 0 22px;
          border-radius: 18px;
          background: #f4f7fb;
          color: #8d99ae;
          font-weight: 800;
          font-size: 24px;
          letter-spacing: 0.5px;
          box-shadow: inset 0 0 0 1px rgba(23, 63, 120, 0.08);
          white-space: nowrap;
          overflow: visible;
        }

        .machine-brand-text {
          display: inline-block;
          line-height: 1;
        }

        .machine-header-center {
          text-align: center;
          min-width: 0;
        }

        .machine-header-center h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 800;
          color: #ffffff;
        }

        .machine-header-center p {
          margin: 6px auto 0;
          max-width: 760px;
          font-size: 13px;
          line-height: 1.3;
          color: #e3edf9;
        }

        .machine-header-nav {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .machine-header-nav button {
          border: none;
          border-radius: 999px;
          background: #f8fbff;
          color: #173f78;
          font-weight: 700;
          font-size: 14px;
          padding: 11px 18px;
          cursor: pointer;
        }

        .machine-page-body {
          width: 100%;
          max-width: 1680px;
          margin: 0 auto;
          padding: 16px 18px 28px;
        }

        @media (max-width: 1200px) {
          .machine-top-header {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .machine-brand-card {
            max-width: 360px;
            width: 100%;
            margin: 0 auto;
          }

          .machine-header-nav {
            justify-content: center;
          }
        }

        @media (max-width: 720px) {
          .machine-brand-card {
            font-size: 20px;
            min-height: 58px;
          }

          .machine-header-center h1 {
            font-size: 18px;
          }

          .machine-header-center p {
            font-size: 12px;
          }

          .machine-header-nav button {
            font-size: 13px;
            padding: 10px 14px;
          }

          .machine-page-body {
            padding: 14px 12px 22px;
          }
        }
      `}</style>

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
          <button type="button">Admin</button>
          <button type="button">Admin tools</button>
          <button type="button">Machine lookup</button>
          <button type="button">Departments</button>
          <button type="button">Bottom machine register</button>
          <button type="button">Log out</button>
        </nav>
      </header>

      <main className="machine-page-body">{children}</main>
    </div>
  );
}
