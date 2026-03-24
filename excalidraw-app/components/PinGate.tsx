import React, { useState, useCallback } from "react";

const SESSION_KEY = "consultidraw-auth";

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PinGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      const expectedHash = import.meta.env.VITE_APP_PIN_HASH;
      if (!expectedHash) {
        // No PIN configured — allow access
        sessionStorage.setItem(SESSION_KEY, "true");
        setIsAuthenticated(true);
        return;
      }

      const inputHash = await hashPin(pinInput);
      if (inputHash === expectedHash) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setIsAuthenticated(true);
      } else {
        setError("Incorrect PIN. Please try again.");
        setPinInput("");
      }
    },
    [pinInput],
  );

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--color-surface-low, #f5f5f5)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "white",
          padding: "2rem",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          minWidth: "300px",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            marginBottom: "0.5rem",
            color: "#333",
          }}
        >
          ConsultiDraw
        </h1>
        <p
          style={{
            fontSize: "0.9rem",
            color: "#666",
            marginBottom: "1.5rem",
          }}
        >
          Enter your PIN to continue
        </p>
        <input
          type="password"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder="Enter PIN"
          autoFocus
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1.25rem",
            textAlign: "center",
            border: `2px solid ${error ? "#e53e3e" : "#ddd"}`,
            borderRadius: "8px",
            outline: "none",
            boxSizing: "border-box",
            letterSpacing: "0.3em",
          }}
        />
        {error && (
          <p
            style={{
              color: "#e53e3e",
              fontSize: "0.85rem",
              marginTop: "0.5rem",
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          style={{
            marginTop: "1rem",
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            background: "#6965db",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Unlock
        </button>
      </form>
    </div>
  );
};
