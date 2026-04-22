"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setErrorMessage("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.ok) {
      window.location.href = "/";
      return;
    }

    setErrorMessage("Wrong username or password");
  }

  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="logoBox">
          <div className="logoText">TURBO ENERGY</div>
        </div>

        <h1>Login</h1>
        <p className="subText">Sign in to access the machine availability dashboard.</p>

        <div className="formGroup">
          <label>Username</label>
          <input
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="formGroup">
          <label>Password</label>
          <input
            placeholder="Enter password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />
        </div>

        {errorMessage ? <div className="errorBox">{errorMessage}</div> : null}

        <button className="loginButton" onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>

      <style jsx>{`
        .loginPage {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(90, 130, 255, 0.18), transparent 24%),
            radial-gradient(circle at top right, rgba(242, 154, 31, 0.14), transparent 22%),
            linear-gradient(180deg, #091c43 0%, #081733 100%);
          font-family: Arial, Helvetica, sans-serif;
        }

        .loginCard {
          width: 100%;
          max-width: 430px;
          background: linear-gradient(180deg, rgba(17, 42, 87, 0.95), rgba(10, 29, 63, 0.96));
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
          color: #f3f7ff;
        }

        .logoBox {
          background: rgba(255, 255, 255, 0.92);
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          margin-bottom: 18px;
        }

        .logoText {
          color: #8a9abb;
          font-size: 30px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 1px;
        }

        h1 {
          margin: 0 0 8px;
          font-size: 26px;
        }

        .subText {
          margin: 0 0 18px;
          color: #c8d4ea;
          font-size: 14px;
        }

        .formGroup {
          margin-bottom: 14px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #cfdbf4;
        }

        input {
          width: 100%;
          border: none;
          outline: none;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 700;
          color: #17325f;
          background: white;
          box-sizing: border-box;
        }

        .errorBox {
          border: 1px solid rgba(255, 123, 147, 0.3);
          background: rgba(201, 72, 96, 0.18);
          color: #ffb7c3;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 14px;
        }

        .loginButton {
          width: 100%;
          border: none;
          border-radius: 14px;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          background: linear-gradient(180deg, #ffb24c, #f29a1f);
          color: white;
        }

        .loginButton:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
