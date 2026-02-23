import React, { useState } from "react";

import { restoreElements } from "../data/restore";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { useApp } from "./App";

import "./TerraformImportDialog.scss";

const BACKEND_URL = "http://localhost:3000";

const TerraformImportModal = ({
  onCloseRequest,
}: {
  onCloseRequest: () => void;
}) => {
  const app = useApp();

  const [planFile, setPlanFile] = useState<File | null>(null);
  const [dotFile, setDotFile] = useState<File | null>(null);
  const [savedId, setSavedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExcalidrawScene = async (id: string | number) => {
    const res = await fetch(`${BACKEND_URL}/terraform/upload/${id}/excalidraw`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to load (HTTP ${res.status})`);
    }
    const scene = await res.json();
    const elements = restoreElements(scene.elements, null, {
      repairBindings: true,
    });
    app.scene.replaceAllElements(elements);
    app.scrollToContent();
    onCloseRequest();
  };

  const handleImport = async () => {
    if (!planFile || !dotFile) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("planFile", planFile);
      formData.append("dotFile", dotFile);
      const res = await fetch(`${BACKEND_URL}/terraform/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      await loadExcalidrawScene(data.id);
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!savedId.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loadExcalidrawScene(savedId.trim());
    } catch (err) {
      console.error("Open error:", err);
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="TerraformImportModal">
      <h3>Import Terraform</h3>

      <div className="TerraformImportModal__section">
        <h4>Upload new plan</h4>
        <div className="TerraformImportModal__settings__inputs">
          <label>
            Plan file (.json)
            <input
              type="file"
              accept=".json"
              onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Graph file (.dot)
            <input
              type="file"
              accept=".dot"
              onChange={(e) => setDotFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="TerraformImportModal__settings__buttons">
          <FilledButton
            onClick={handleImport}
            disabled={!planFile || !dotFile || loading}
          >
            {loading ? "Importing..." : "Import & Open"}
          </FilledButton>
        </div>
      </div>

      <div className="TerraformImportModal__divider" />

      <div className="TerraformImportModal__section">
        <h4>Open saved graph</h4>
        <div className="TerraformImportModal__settings__inputs">
          <label>
            Upload ID
            <input
              type="text"
              placeholder="e.g. 1"
              value={savedId}
              onChange={(e) => setSavedId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleOpen();
                }
              }}
            />
          </label>
        </div>
        <div className="TerraformImportModal__settings__buttons">
          <FilledButton
            onClick={handleOpen}
            disabled={!savedId.trim() || loading}
          >
            {loading ? "Loading..." : "Open"}
          </FilledButton>
        </div>
      </div>

      {error && (
        <div className="TerraformImportModal__error">{error}</div>
      )}
    </div>
  );
};

export const TerraformImportDialog = ({
  onCloseRequest,
}: {
  onCloseRequest: () => void;
}) => {
  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <TerraformImportModal onCloseRequest={onCloseRequest} />
    </Dialog>
  );
};
