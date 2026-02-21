import React, { useState, useEffect } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import { STORAGE_KEYS } from "../app_constants";
import { reinitializeSupabase, testSupabaseConnection } from "../data/supabase";

import "./SettingsDialog.scss";

type ConnectionStatus = "unknown" | "testing" | "connected" | "error";

export const SettingsDialog: React.FC<{
  onCloseRequest: () => void;
}> = ({ onCloseRequest }) => {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const savedUrl =
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_URL) ||
      import.meta.env.VITE_APP_SUPABASE_URL ||
      "";
    const savedKey =
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_ANON_KEY) ||
      import.meta.env.VITE_APP_SUPABASE_ANON_KEY ||
      "";
    setSupabaseUrl(savedUrl);
    setSupabaseAnonKey(savedKey);
  }, []);

  const handleTestConnection = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setConnectionStatus("error");
      setStatusMessage("URL and key are required");
      return;
    }
    setConnectionStatus("testing");
    setStatusMessage("Testing...");
    const result = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    if (result.success) {
      setConnectionStatus("connected");
      setStatusMessage("Connected");
    } else {
      setConnectionStatus("error");
      setStatusMessage(result.error || "Connection failed");
    }
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_URL, supabaseUrl);
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_ANON_KEY,
      supabaseAnonKey,
    );
    if (supabaseUrl && supabaseAnonKey) {
      reinitializeSupabase(supabaseUrl, supabaseAnonKey);
    }
    onCloseRequest();
  };

  const statusColor =
    connectionStatus === "connected"
      ? "var(--color-success)"
      : connectionStatus === "error"
      ? "var(--color-danger)"
      : connectionStatus === "testing"
      ? "var(--color-warning)"
      : "var(--color-text-secondary)";

  return (
    <Dialog onCloseRequest={onCloseRequest} title="Settings" size="small">
      <div className="settings-dialog">
        <div className="settings-dialog__section">
          <h3 className="settings-dialog__heading">Supabase Connection</h3>

          <label className="settings-dialog__label">
            Supabase URL
            <input
              type="text"
              className="settings-dialog__input"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
            />
          </label>

          <label className="settings-dialog__label">
            Supabase Anon Key
            <input
              type="password"
              className="settings-dialog__input"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="your-anon-key"
            />
          </label>

          <div className="settings-dialog__status">
            <span
              className="settings-dialog__status-dot"
              style={{ backgroundColor: statusColor }}
            />
            <span className="settings-dialog__status-text">
              {statusMessage || "Not tested"}
            </span>
          </div>
        </div>

        <div className="settings-dialog__actions">
          <button
            className="settings-dialog__btn settings-dialog__btn--secondary"
            onClick={handleTestConnection}
            disabled={connectionStatus === "testing"}
          >
            Test Connection
          </button>
          <button
            className="settings-dialog__btn settings-dialog__btn--primary"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </Dialog>
  );
};
