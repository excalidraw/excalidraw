/**
 * Modal to upload plan JSON + graph DOT (optional raw state), or raw Terraform state alone,
 * and replace the canvas with the locally generated Excalidraw scene.
 */
import React, { useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { useApp } from "./App";
import { terraformPlanParsing } from "./terraformPlanParsing";

import "./TerraformImportDialog.scss";

type TerraformView = "module" | "semantic";

const VIEW_OPTIONS: ReadonlyArray<{
  value: TerraformView;
  label: string;
  description: string;
}> = [
  {
    value: "module",
    label: "Module view",
    description: "Module-framed infrastructure graph.",
  },
  {
    value: "semantic",
    label: "Semantic view",
    description: "Account, region, VPC, and subnet topology.",
  },
];

const TerraformImportModal = ({
  onCloseRequest,
}: {
  onCloseRequest: () => void;
}) => {
  const app = useApp();

  const [planFile, setPlanFile] = useState<File | null>(null);
  const [dotFile, setDotFile] = useState<File | null>(null);
  const [stateFile, setStateFile] = useState<File | null>(null);
  const [view, setView] = useState<TerraformView>("semantic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Applies an Excalidraw v2 scene payload (e.g. from GET …/excalidraw or local parse). */
  const replaceEditorWithExcalidrawScene = (scene: { elements?: unknown }) => {
    const elements = restoreElements(
      scene.elements as readonly ExcalidrawElement[] | null | undefined,
      null,
      {
        repairBindings: true,
      },
    );
    app.scene.replaceAllElements(elements);
    app.scrollToContent();
    onCloseRequest();
  };

  const hasPlanAndDot = Boolean(planFile && dotFile);
  const stateOnly = Boolean(stateFile && !planFile && !dotFile);
  const canImport = hasPlanAndDot || stateOnly;
  const semanticViewDisabled = loading || !hasPlanAndDot;

  const handleImport = async () => {
    if ((planFile && !dotFile) || (!planFile && dotFile)) {
      setError(
        "Plan JSON and graph DOT must be selected together, or clear both and upload a raw Terraform state file alone.",
      );
      return;
    }
    if (!canImport) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await terraformPlanParsing(
        hasPlanAndDot ? planFile : null,
        hasPlanAndDot ? dotFile : null,
        stateFile,
        {
          semanticLayout: view === "semantic" && hasPlanAndDot,
        },
      );
      const scene = await res.json();
      if (!res.ok) {
        const err =
          scene && typeof scene === "object" && "error" in scene
            ? String((scene as { error?: unknown }).error)
            : "";
        throw new Error(err || "Local parse failed");
      }
      replaceEditorWithExcalidrawScene(scene);
    } catch (err) {
      console.error("Import error:", err);
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
          <label>
            State file (.tfstate / state pull JSON)
            <span className="TerraformImportModal__muted">
              Optional with plan+dot to enrich nodes; or upload alone for a
              state-only graph (raw state with a top-level{" "}
              <code>resources</code> array).
            </span>
            <input
              type="file"
              accept=".tfstate,.json"
              onChange={(e) => setStateFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <div className="TerraformImportModal__divider" />

      <div
        className="TerraformImportModal__section TerraformImportModal__viewSelector"
        role="radiogroup"
        aria-label="View options"
      >
        <h4>View options</h4>
        <div className="TerraformImportModal__viewSelector__options">
          {VIEW_OPTIONS.map((option) => {
            const checked = view === option.value;
            const disabled =
              option.value === "semantic" && semanticViewDisabled;
            return (
              <label
                key={option.value}
                className={`TerraformImportModal__viewSelector__option${
                  checked
                    ? " TerraformImportModal__viewSelector__option--checked"
                    : ""
                }${
                  disabled
                    ? " TerraformImportModal__viewSelector__option--disabled"
                    : ""
                }`}
                title={
                  option.value === "semantic" && !hasPlanAndDot
                    ? "Semantic view requires plan JSON and graph DOT files."
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="terraform-view"
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => setView(option.value)}
                />
                <span className="TerraformImportModal__viewSelector__label">
                  {option.label}
                </span>
                <span className="TerraformImportModal__viewSelector__description">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="TerraformImportModal__settings__buttons">
        <FilledButton onClick={handleImport} disabled={!canImport || loading}>
          {loading ? "Importing..." : "Import & Open"}
        </FilledButton>
      </div>

      {error && <div className="TerraformImportModal__error">{error}</div>}
    </div>
  );
};

/** Dialog shell around `TerraformImportModal` (wide layout, no default title chrome). */
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
