/**
 * Modal to upload plan JSON + graph DOT bundles (optional raw state, optional .tfd),
 * or raw Terraform state alone, and replace the canvas with the locally generated scene.
 */
import React, { useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { useApp, useExcalidrawSetAppState } from "./App";
import {
  terraformPlanParsingFromSources,
  type TerraformImportWarning,
  type TerraformPlanDotBundle,
} from "./terraformPlanParsing";
import { parseRawStateJson } from "./terraformImportMerge";
import { applyTerraformRelationshipFocus } from "./terraformRelationshipFocus";
import {
  buildTerraformReconcileOptionsForAppState,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";

import "./TerraformImportDialog.scss";

import type { BinaryFileData } from "../types";

type TerraformView = "module" | "semantic";

const MAX_PLAN_BUNDLES = 10;

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

type PlanDotBundleRow = {
  id: string;
  planFile: File | null;
  dotFile: File | null;
  label: string;
};

const VIEW_OPTIONS: ReadonlyArray<{
  value: TerraformView;
  label: string;
  description: string;
}> = [
  {
    value: "semantic",
    label: "Semantic view",
    description:
      "AWS account, region, VPC, and subnet topology plus provider boxes for other clouds.",
  },
  {
    value: "module",
    label: "Module view",
    description: "Module-framed infrastructure graph.",
  },
];

let bundleRowCounter = 0;
const newBundleRow = (): PlanDotBundleRow => ({
  id: `bundle-${++bundleRowCounter}`,
  planFile: null,
  dotFile: null,
  label: "",
});

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

  const [bundles, setBundles] = useState<PlanDotBundleRow[]>(() => [
    newBundleRow(),
  ]);
  const [stateFiles, setStateFiles] = useState<File[]>([]);
  const [tfdFiles, setTfdFiles] = useState<File[]>([]);
  const [view, setView] = useState<TerraformView>("semantic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<
    TerraformImportWarning[] | null
  >(null);
  const [importDone, setImportDone] = useState(false);

  const completeBundles = bundles.filter((b) => b.planFile && b.dotFile);
  const partialBundles = bundles.filter(
    (b) => (b.planFile && !b.dotFile) || (!b.planFile && b.dotFile),
  );
  const hasPlanMode = completeBundles.length > 0;
  const stateOnly =
    stateFiles.length > 0 &&
    completeBundles.length === 0 &&
    partialBundles.length === 0;
  const canImport = hasPlanMode || stateOnly;
  const canUseSemanticView = hasPlanMode || stateFiles.length > 0;
  const semanticViewDisabled = loading || !canUseSemanticView;

  const updateBundle = (id: string, patch: Partial<PlanDotBundleRow>) => {
    setBundles((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const addBundle = () => {
    if (bundles.length >= MAX_PLAN_BUNDLES) {
      return;
    }
    setBundles((rows) => [...rows, newBundleRow()]);
  };

  const removeBundle = (id: string) => {
    setBundles((rows) => {
      const next = rows.filter((row) => row.id !== id);
      return next.length > 0 ? next : [newBundleRow()];
    });
  };

  /** Applies an Excalidraw v2 scene payload (e.g. from GET …/excalidraw or local parse). */
  const replaceEditorWithExcalidrawScene = (
    scene: {
      elements?: unknown;
      files?: Record<string, BinaryFileData>;
      meta?: { importWarnings?: TerraformImportWarning[] };
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
    const focus = applyTerraformRelationshipFocus(
      elements,
      null,
      app.state.viewBackgroundColor ?? "#ffffff",
    );
    const pinReconcile = buildTerraformReconcileOptionsForAppState(
      {
        dependency: false,
        dataFlow: false,
        declaredDataFlow: Boolean(options?.enableDeclaredDataFlow),
        networking: false,
      },
      null,
    );
    let nextElements = focus.elements;
    if (pinReconcile) {
      nextElements = reconcileTerraformVisibility(
        focus.shouldRepairBindings
          ? repairTerraformEdgeBindings(nextElements)
          : nextElements,
        pinReconcile,
      );
    } else if (focus.shouldRepairBindings) {
      nextElements = repairTerraformEdgeBindings(nextElements);
    }
    app.scene.replaceAllElements(nextElements);
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
  };

  const handleImport = async () => {
    if (partialBundles.length > 0) {
      setError(
        "Each plan + graph row must have both files, or remove the row. You can also import state file(s) alone.",
      );
      return;
    }
    if (!canImport) {
      return;
    }
    setLoading(true);
    setError(null);
    setImportWarnings(null);
    setImportDone(false);
    try {
      const planDotBundles: TerraformPlanDotBundle[] = [];
      for (const row of completeBundles) {
        const [planText, dotText] = await Promise.all([
          readFileText(row.planFile!),
          readFileText(row.dotFile!),
        ]);
        try {
          planDotBundles.push({
            plan: JSON.parse(planText),
            dotText,
            label: row.label.trim() || row.planFile!.name,
          });
        } catch {
          throw new Error(
            `Plan file "${row.planFile!.name}" must be valid JSON.`,
          );
        }
      }

      const states: unknown[] = [];
      const stateLabels: string[] = [];
      for (const file of stateFiles) {
        const parsed = parseRawStateJson(await readFileText(file));
        if (!parsed.ok) {
          throw new Error(`${file.name}: ${parsed.error}`);
        }
        states.push(parsed.state);
        stateLabels.push(file.name);
      }

      const tfdTexts = await Promise.all(tfdFiles.map((f) => readFileText(f)));
      const tfdLabels = tfdFiles.map((f) => f.name);

      const res = await terraformPlanParsingFromSources(
        {
          planDotBundles,
          states,
          stateLabels,
          tfdTexts,
          tfdLabels,
        },
        {
          semanticLayout: view === "semantic" && canUseSemanticView,
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
      const warnings = (
        scene as { meta?: { importWarnings?: TerraformImportWarning[] } }
      ).meta?.importWarnings;
      replaceEditorWithExcalidrawScene(scene, {
        enableDeclaredDataFlow: tfdTexts.some((t) => t.trim()),
      });
      onImportSuccess?.();
      setImportDone(true);
      if (warnings?.length) {
        setImportWarnings(warnings);
      } else {
        onCloseRequest();
      }
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
            From each Terraform or OpenTofu working directory, export plan JSON
            and graph DOT as a pair. Add optional state files to enrich nodes,
            or import state alone. Attach one or more <code>.tfd</code> files
            for declared dataflow across the merged diagram.
          </p>
          <ol className="TerraformImportModal__instructionsSteps">
            <li>
              <strong>Plan JSON</strong> (required with graph DOT per stack)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`terraform plan -out=tfplan
terraform show -json tfplan > plan.json`}</code>
              </pre>
            </li>
            <li>
              <strong>Graph DOT</strong> (required with plan JSON per stack)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`terraform graph -type=plan > graph.dot`}</code>
              </pre>
            </li>
            <li>
              <strong>State JSON</strong> (optional, multiple allowed)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`terraform state pull > state.json`}</code>
              </pre>
            </li>
            <li>
              <strong>Dataflow links</strong> (optional, multiple{" "}
              <code>.tfd</code>)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`bind writer = module.foo.aws_lambda_function.this[0]
writer -> bucket`}</code>
              </pre>
            </li>
          </ol>
          <p className="TerraformImportModal__instructionsFoot">
            Duplicate resource addresses across imports: last file wins (see
            warnings after import). Cross-stack imports work best when module
            paths do not collide.
          </p>
        </div>
      </details>

      <div className="TerraformImportModal__section">
        <h4>Plan + graph bundles</h4>
        <p className="TerraformImportModal__muted">
          One row per Terraform root or workspace ({MAX_PLAN_BUNDLES} max).
        </p>
        <div className="TerraformImportModal__bundles">
          {bundles.map((row, index) => (
            <div key={row.id} className="TerraformImportModal__bundle">
              <div className="TerraformImportModal__bundleHeader">
                <span className="TerraformImportModal__bundleTitle">
                  Stack {index + 1}
                </span>
                {bundles.length > 1 && (
                  <button
                    type="button"
                    className="TerraformImportModal__bundleRemove"
                    onClick={() => removeBundle(row.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <label>
                Label (optional)
                <input
                  type="text"
                  placeholder="e.g. networking"
                  value={row.label}
                  onChange={(e) =>
                    updateBundle(row.id, { label: e.target.value })
                  }
                />
              </label>
              <label>
                Plan file (.json)
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) =>
                    updateBundle(row.id, {
                      planFile: e.target.files?.[0] ?? null,
                    })
                  }
                />
              </label>
              <label>
                Graph file (.dot)
                <input
                  type="file"
                  accept=".dot"
                  onChange={(e) =>
                    updateBundle(row.id, {
                      dotFile: e.target.files?.[0] ?? null,
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="TerraformImportModal__addBundle"
          disabled={bundles.length >= MAX_PLAN_BUNDLES}
          onClick={addBundle}
        >
          Add plan + graph
        </button>
      </div>

      <div className="TerraformImportModal__section">
        <h4>State files</h4>
        <label>
          State (.tfstate / state pull JSON)
          <span className="TerraformImportModal__muted">
            Optional with plan bundles to enrich nodes; or select one or more
            alone for module or semantic views.
          </span>
          <input
            type="file"
            multiple
            accept=".tfstate,.json"
            onChange={(e) => setStateFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {stateFiles.length > 0 && (
          <ul className="TerraformImportModal__fileList">
            {stateFiles.map((f) => (
              <li key={`${f.name}-${f.size}`}>{f.name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="TerraformImportModal__section">
        <h4>Dataflow links</h4>
        <label htmlFor="terraform-import-links">
          <span className="TerraformImportModal__muted">
            Optional arrow-only overlay; edges are applied in file order across
            all selected <code>.tfd</code> files.
          </span>
          <input
            id="terraform-import-links"
            type="file"
            multiple
            accept=".tfd,.txt"
            onChange={(e) => setTfdFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {tfdFiles.length > 0 && (
          <ul className="TerraformImportModal__fileList">
            {tfdFiles.map((f) => (
              <li key={`${f.name}-${f.size}`}>{f.name}</li>
            ))}
          </ul>
        )}
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
                    ? "Semantic view requires at least one plan+graph pair or a state file."
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
        {importDone ? (
          <FilledButton onClick={onCloseRequest}>Done</FilledButton>
        ) : (
          <FilledButton onClick={handleImport} disabled={!canImport || loading}>
            {loading ? "Importing..." : "Import & Open"}
          </FilledButton>
        )}
      </div>

      {error && <div className="TerraformImportModal__error">{error}</div>}

      {importWarnings && importWarnings.length > 0 && (
        <details className="TerraformImportModal__warnings" open>
          <summary>Import warnings ({importWarnings.length})</summary>
          <ul>
            {importWarnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}
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
