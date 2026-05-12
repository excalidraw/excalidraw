/**
 * Modal to upload plan JSON + graph DOT (optional raw state), or raw Terraform state alone,
 * to the Terraform backend and replace the canvas with the returned Excalidraw scene,
 * or reload a prior upload by numeric id.
 */
import React, { useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { useApp } from "./App";
import { terraformPlanParsing } from "./terraformPlanParsing";

import "./TerraformImportDialog.scss";

const TERRAFORM_BACKEND_URL =
  import.meta.env.VITE_TERRAFORM_BACKEND_URL || "http://localhost:3000";

type LayoutEngine = "elk" | "force";
type StructuralPruneMode = "module-only" | "global" | "off";

const LAYOUT_ENGINE_OPTIONS: ReadonlyArray<{
  value: LayoutEngine;
  label: string;
  description: string;
}> = [
  {
    value: "elk",
    label: "ELK layered",
    description: "Hierarchical, AWS-architecture style (recommended)",
  },
  {
    value: "force",
    label: "Force-directed",
    description: "Legacy d3-force simulation",
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
  const [savedId, setSavedId] = useState("");
  const [layoutEngine, setLayoutEngine] = useState<LayoutEngine>("elk");
  const [structuralPruneMode, setStructuralPruneMode] =
    useState<StructuralPruneMode>("module-only");
  const [vpcEndpointSnapping, setVpcEndpointSnapping] = useState(true);
  const [useBackend, setUseBackend] = useState(true);
  const [semanticLayout, setSemanticLayout] = useState(false);
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

  /** Fetches generated scene JSON from the backend and replaces the editor scene. */
  const loadExcalidrawScene = async (id: string | number) => {
    const sceneUrl = new URL(
      `${TERRAFORM_BACKEND_URL}/terraform/upload/${id}/excalidraw`,
    );
    sceneUrl.searchParams.set("layoutEngine", layoutEngine);
    sceneUrl.searchParams.set(
      "vpcEndpointSnapping",
      vpcEndpointSnapping ? "true" : "false",
    );
    const res = await fetch(sceneUrl.toString());
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to load (HTTP ${res.status})`);
    }
    const scene = await res.json();
    replaceEditorWithExcalidrawScene(scene);
  };

  const hasPlanAndDot = Boolean(planFile && dotFile);
  const stateOnly = Boolean(stateFile && !planFile && !dotFile);
  const canImport = hasPlanAndDot || stateOnly;

  /** POST multipart upload then opens the new upload’s Excalidraw document. */
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
      const formData = new FormData();
      if (hasPlanAndDot) {
        formData.append("planFile", planFile!);
        formData.append("dotFile", dotFile!);
      }
      if (stateFile) {
        formData.append("stateFile", stateFile);
      }
      formData.append("structuralPruneMode", structuralPruneMode);
      if (useBackend) {
        const res = await fetch(`${TERRAFORM_BACKEND_URL}/terraform/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }
        await loadExcalidrawScene(data.id);
      } else {
        const res = await terraformPlanParsing(
          hasPlanAndDot ? planFile : null,
          hasPlanAndDot ? dotFile : null,
          stateFile,
          {
            semanticLayout,
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
      }
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  /** Loads an existing upload row by id from SQLite via the backend. */
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

      <div
        className="TerraformImportModal__section TerraformImportModal__layoutEngine"
        role="radiogroup"
        aria-label="Layout engine"
      >
        <h4>Layout engine</h4>
        <div className="TerraformImportModal__layoutEngine__options">
          {LAYOUT_ENGINE_OPTIONS.map((option) => {
            const checked = layoutEngine === option.value;
            return (
              <label
                key={option.value}
                className={`TerraformImportModal__layoutEngine__option${
                  checked
                    ? " TerraformImportModal__layoutEngine__option--checked"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="terraform-layout-engine"
                  value={option.value}
                  checked={checked}
                  disabled={loading}
                  onChange={() => setLayoutEngine(option.value)}
                />
                <span className="TerraformImportModal__layoutEngine__label">
                  {option.label}
                </span>
                <span className="TerraformImportModal__layoutEngine__description">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="TerraformImportModal__divider" />

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
          <label>
            Structural prune mode
            <select
              value={structuralPruneMode}
              onChange={(e) =>
                setStructuralPruneMode(e.target.value as StructuralPruneMode)
              }
              disabled={loading}
            >
              <option value="module-only">Module only (default)</option>
              <option value="global">Global</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={vpcEndpointSnapping}
              disabled={loading}
              onChange={(e) => setVpcEndpointSnapping(e.target.checked)}
            />
            Enable VPC endpoint snapping
          </label>
          <label>
            <input
              type="checkbox"
              checked={useBackend}
              disabled={loading}
              onChange={(e) => setUseBackend(e.target.checked)}
            />
            use backend
          </label>
          <label
            title={
              useBackend
                ? "Semantic layout applies to local import only (uncheck use backend)."
                : hasPlanAndDot
                ? "Nested AWS account / region / VPC / subnet frames from the plan JSON."
                : "Semantic layout requires plan JSON with resource_changes. Select plan+dot or use ELK for state-only imports."
            }
          >
            <input
              type="checkbox"
              checked={semanticLayout}
              disabled={loading || useBackend || !hasPlanAndDot}
              onChange={(e) => setSemanticLayout(e.target.checked)}
            />
            Use semantic layout
          </label>
        </div>
        <div className="TerraformImportModal__settings__buttons">
          <FilledButton onClick={handleImport} disabled={!canImport || loading}>
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
