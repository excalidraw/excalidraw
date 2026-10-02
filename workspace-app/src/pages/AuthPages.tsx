import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

import type { FormEvent } from "react";

const messages: Record<string, string> = {
  invalid_credentials: "Wrong email or password.",
  email_taken: "An account with that email already exists.",
  validation_error: "Please check the highlighted fields.",
  network_error: "Cannot reach the server. Is the backend running?",
};

export const AuthPage = ({ mode }: { mode: "login" | "register" }) => {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={loc.state?.from ?? "/"} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      nav(loc.state?.from ?? "/", { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      let msg = messages[code] ?? "Something went wrong.";
      if (err instanceof ApiError && code === "validation_error") {
        msg =
          err.body?.issues
            ?.map((i: any) => `${i.path}: ${i.message}`)
            .join(" · ") ?? msg;
      }
      if (err instanceof ApiError && err.status === 429) {
        msg = "Too many attempts. Please wait a minute.";
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        </div>
        <p className="muted">
          {mode === "login"
            ? "Sign in to your self-hosted workspace."
            : "Your drawings stay on your own server."}
        </p>
        {mode === "register" && (
          <label>
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={80}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 10 : 1}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
          {mode === "register" && (
            <small className="muted">At least 10 characters.</small>
          )}
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="btn primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
            ? "Sign in"
            : "Create account"}
        </button>
        <p className="muted center">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link to="/register" state={loc.state}>
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link to="/login" state={loc.state}>
                Sign in
              </Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
};
