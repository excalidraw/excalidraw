/**
 * Modal to upload plan JSON + graph DOT (optional raw state), or raw Terraform state alone,
 * and replace the canvas with the locally generated Excalidraw scene.
 */
import React, { useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { useApp, useExcalidrawSetAppState } from "./App";
import { terraformPlanParsing } from "./terraformPlanParsing";

import "./TerraformImportDialog.scss";

import type { BinaryFileData } from "../types";

type TerraformView = "module" | "semantic";

const VIEW_OPTIONS: ReadonlyArray<{
  value: TerraformView;
  label: string;
  description: string;
}> = [
  {
    value: "semantic",
    label: "Semantic view",
    description: "Account, region, VPC, and subnet topology.",
  },
  {
    value: "module",
    label: "Module view",
    description: "Module-framed infrastructure graph.",
  },
];

/** Exported for tests; dialog shell is {@link TerraformImportDialog}. */
export const TerraformImportModal = ({
  onCloseRequest,
  onImportSuccess,
  onImportFail,
}: {
  onCloseRequest: () => void;
  onImportSuccess?: () => void;
  onImportFail?: () => void;
}) => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const [planFile, setPlanFile] = useState<File | null>(null);
  const [dotFile, setDotFile] = useState<File | null>(null);
  const [stateFile, setStateFile] = useState<File | null>(null);
  const [linksFile, setLinksFile] = useState<File | null>(null);
  const [view, setView] = useState<TerraformView>("semantic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Applies an Excalidraw v2 scene payload (e.g. from GET …/excalidraw or local parse). */
  const replaceEditorWithExcalidrawScene = (
    scene: {
      elements?: unknown;
      files?: Record<string, BinaryFileData>;
    },
    options?: { enableDeclaredDataFlow?: boolean },
  ) => {
    const files = scene.files;
    if (files && typeof files === "object") {
      const list = Object.values(files).filter(
        (entry): entry is BinaryFileData =>
          Boolean(
            entry &&
              typeof entry === "object" &&
              typeof (entry as BinaryFileData).id === "string" &&
              typeof (entry as BinaryFileData).dataURL === "string",
          ),
      );
      if (list.length > 0) {
        app.addFiles(list);
      }
    }
    const elements = restoreElements(
      scene.elements as readonly ExcalidrawElement[] | null | undefined,
      null,
      {
        repairBindings: true,
      },
    );
    app.scene.replaceAllElements(elements);
    setAppState({
      terraformEdgeLayerPins: {
        dependency: false,
        dataFlow: false,
        declaredDataFlow: Boolean(options?.enableDeclaredDataFlow),
        networking: false,
      },
      terraformEdgeHoverPeekKey: null,
    });
    app.scrollToContent();
    onCloseRequest();
  };

  const hasPlanAndDot = Boolean(planFile && dotFile);
  const stateOnly = Boolean(stateFile && !planFile && !dotFile);
  const canImport = hasPlanAndDot || stateOnly;
  const canUseSemanticView = hasPlanAndDot || stateOnly;
  const semanticViewDisabled = loading || !canUseSemanticView;

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
      const linksText = linksFile ? await linksFile.text() : undefined;
      const res = await terraformPlanParsing(
        hasPlanAndDot ? planFile : null,
        hasPlanAndDot ? dotFile : null,
        stateFile,
        {
          semanticLayout: view === "semantic" && canUseSemanticView,
          dataflowLinks: linksText,
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
      replaceEditorWithExcalidrawScene(scene, {
        enableDeclaredDataFlow: Boolean(linksText?.trim()),
      });
      onImportSuccess?.();
    } catch (err) {
      console.error("Import error:", err);
      onImportFail?.();
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="TerraformImportModal">
      <h3>Import Terraform</h3>

      <details className="TerraformImportModal__instructions">
        <summary className="TerraformImportModal__instructionsSummary">
          How to generate import files
        </summary>
        <div className="TerraformImportModal__instructionsBody">
          <p className="TerraformImportModal__instructionsLead">
            From the same Terraform or OpenTofu working directory you can import
            plan JSON + graph DOT together (semantic or module view), optionally
            add raw state to enrich existing resources, optionally add a{" "}
            <code>.tfd</code> dataflow links file, or import state alone for
            module or semantic (current infrastructure) views.
          </p>
          <ol className="TerraformImportModal__instructionsSteps">
            <li>
              <strong>Plan JSON</strong> (required with graph DOT)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`# Terraform
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# OpenTofu
tofu plan -out=tfplan
tofu show -json tfplan > plan.json`}</code>
              </pre>
            </li>
            <li>
              <strong>Graph DOT</strong> (required with plan JSON)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`# Terraform
terraform graph -type=plan > graph.dot

# OpenTofu
tofu graph -type=plan > graph.dot`}</code>
              </pre>
            </li>
            <li>
              <strong>State JSON</strong> (optional with plan+dot, or alone)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`# Raw state (top-level "resources" array)
terraform state pull > state.json

# Or use a local .tfstate file`}</code>
              </pre>
            </li>
            <li>
              <strong>Dataflow links</strong> (optional, <code>.tfd</code>)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`# Example: packages/backend/terraform/allplanmodules.tfd
bind writer = module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]
writer -> bucket
writer -> queue`}</code>
              </pre>
            </li>
          </ol>
          <p className="TerraformImportModal__instructionsFoot">
            Plan JSON must come from <code>terraform show -json</code> /{" "}
            <code>tofu show -json</code>; DOT from <code>graph -type=plan</code>
            . State-only semantic view shows deployed resources (no
            planned-change diffs). Plan-based semantic view requires plan JSON +
            DOT.
          </p>
        </div>
      </details>

      <div className="TerraformImportModal__section">
        <h4>Upload files</h4>
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
              Optional with plan+dot to enrich nodes; or upload alone for module
              or semantic views (raw state with a top-level{" "}
              <code>resources</code> array).
            </span>
            <input
              type="file"
              accept=".tfstate,.json"
              onChange={(e) => setStateFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label htmlFor="terraform-import-links">
            Dataflow links (.tfd)
            <span className="TerraformImportModal__muted">
              Optional arrow-only dataflow overlay (writer → bucket → queue,
              etc.). Separate layer from IAM-inferred data flow.
            </span>
            <input
              id="terraform-import-links"
              type="file"
              accept=".tfd,.txt"
              onChange={(e) => setLinksFile(e.target.files?.[0] ?? null)}
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
                  option.value === "semantic" && !canUseSemanticView
                    ? "Semantic view requires plan JSON + graph DOT, or a state file alone."
                    : option.value === "semantic" && stateOnly
                    ? "Shows current infrastructure from state (no planned changes)."
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
  onImportSuccess,
  onImportFail,
}: {
  onCloseRequest: () => void;
  onImportSuccess?: () => void;
  onImportFail?: () => void;
}) => {
  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <TerraformImportModal
        onCloseRequest={onCloseRequest}
        onImportSuccess={onImportSuccess}
        onImportFail={onImportFail}
      />
    </Dialog>
  );
};
