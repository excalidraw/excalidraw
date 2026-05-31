/**
 * Modal to upload plan JSON + graph DOT bundles (optional raw state, optional .tfd),
 * or raw Terraform state alone, and replace the canvas with the locally generated scene.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { useApp, useExcalidrawSetAppState } from "./App";
import {
  type TerraformImportWarning,
  type TerraformPlanParsingSources,
  type TerraformPlanDotBundle,
} from "./terraformPlanParsing";
import { parseRawStateJson } from "./terraformImportMerge";
import { runTerraformImportFromSources } from "./terraformSceneApply";
import { TerraformModulePackingSettings } from "./TerraformModulePackingSettings";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";
import {
  DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE,
  DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE,
  type TerraformPipelineLayoutMode,
  type TerraformPipelineVerticalSolverMode,
} from "./terraformPipelineLayoutMode";
import {
  BUILTIN_TERRAFORM_IMPORT_PRESETS,
  deleteTerraformImportPreset,
  listTerraformImportPresets,
  saveTerraformImportPreset,
  type TerraformImportPreset,
  updateTerraformImportPreset,
} from "./terraformImportPresets";
import {
  chooseTerraformImportPresetRootDirectory,
  loadTerraformImportPresetSources,
  type TerraformImportPresetWarning,
} from "./terraformImportPresetLoader";
import {
  fetchTerraformImportPresetFromApi,
  syncTerraformImportPresetFromDiskViaApi,
} from "./terraformImportPresetsApi";

import "./TerraformImportDialog.scss";

type TerraformView = "module" | "semantic" | "pipeline";

const MAX_PLAN_BUNDLES = 10;

const joinPresetPath = (rootPath: string, relativePath: string) =>
  `${rootPath.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;

const toPresetId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inferStackIdFromFileName = (name: string, fallbackIndex: number) => {
  const trimmed = name.trim();
  const noExt = trimmed.includes(".")
    ? trimmed.slice(0, trimmed.lastIndexOf("."))
    : trimmed;
  return toPresetId(noExt) || `stack-${fallbackIndex + 1}`;
};

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
  {
    value: "pipeline",
    label: "Pipeline view",
    description:
      "TFD dataflow left-to-right with geographic frames (requires .tfd).",
  },
];

const PIPELINE_LAYOUT_MODE_OPTIONS: ReadonlyArray<{
  value: TerraformPipelineLayoutMode;
  label: string;
  description: string;
}> = [
  {
    value: "legacy",
    label: "Legacy",
    description: "Current TFD depth columns.",
  },
  {
    value: "local-shims",
    label: "Local shims",
    description: "Splits fragmented hierarchy runs near their TFD column.",
  },
  {
    value: "global-relayer",
    label: "Global relayer",
    description: "Re-layers columns with hierarchy grouping constraints.",
  },
];

const PIPELINE_VERTICAL_SOLVER_MODE_OPTIONS: ReadonlyArray<{
  value: TerraformPipelineVerticalSolverMode;
  label: string;
  description: string;
}> = [
  {
    value: "track-rows",
    label: "Track rows",
    description:
      "One horizontal row per API track; fan-out only inside a column.",
  },
  {
    value: "track-rows-cascade",
    label: "Track rows + cascade",
    description:
      "Per-API rows with tier handoffs merged onto upstream compute rows.",
  },
  {
    value: "track-rows-reorder",
    label: "Track rows + reorder",
    description: "Reorder column atoms for crossings, then assign track rows.",
  },
  {
    value: "straight-y",
    label: "Straight Y (legacy)",
    description: "Iterative column-forward Y solver (older).",
  },
  {
    value: "straight-reorder",
    label: "Straight + reorder (legacy)",
    description: "Legacy straight solver with column reorder.",
  },
  {
    value: "straight-relay",
    label: "Straight + relays (legacy)",
    description: "Legacy straight layout with relay arrow bends.",
  },
  {
    value: "none",
    label: "None",
    description: "Use column pack Y only (no vertical solver).",
  },
  {
    value: "constrained-ls",
    label: "Constrained LS",
    description: "Weighted global edge-length smoothing with column spacing.",
  },
  {
    value: "elk",
    label: "ELK",
    description: "Use ELK as a desired-Y generator, then keep fixed columns.",
  },
  {
    value: "exact-qp",
    label: "Exact QP",
    description: "Deterministic quadratic solver for global edge length.",
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
  const [moduleLayoutOptions, setModuleLayoutOptions] = useState(
    DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  );
  const [pipelineLayoutMode, setPipelineLayoutMode] =
    useState<TerraformPipelineLayoutMode>(
      DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE,
    );
  const [pipelineVerticalSolverMode, setPipelineVerticalSolverMode] =
    useState<TerraformPipelineVerticalSolverMode>(
      DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE,
    );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<
    TerraformImportWarning[] | null
  >(null);
  const [importDone, setImportDone] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(
    BUILTIN_TERRAFORM_IMPORT_PRESETS[0]?.id ?? "",
  );
  const [presetWarnings, setPresetWarnings] = useState<
    TerraformImportPresetWarning[]
  >([]);
  const [availablePresets, setAvailablePresets] = useState<
    TerraformImportPreset[]
  >([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [activePreset, setActivePreset] =
    useState<TerraformImportPreset | null>(null);

  const refreshPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const presets = await listTerraformImportPresets();
      setAvailablePresets(presets);
      setSelectedPresetId((current) => {
        if (
          presets.length > 0 &&
          !presets.some((preset) => preset.id === current)
        ) {
          return presets[0]!.id;
        }
        return current;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load import presets.",
      );
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);

  const selectedPreset = useMemo(() => {
    const fromApi = availablePresets.find(
      (preset) => preset.id === selectedPresetId,
    );
    if (fromApi) {
      return fromApi;
    }
    return (
      BUILTIN_TERRAFORM_IMPORT_PRESETS.find(
        (preset) => preset.id === selectedPresetId,
      ) ?? null
    );
  }, [availablePresets, selectedPresetId]);

  const importView: TerraformView = view;

  const completeBundles = bundles.filter((b) => b.planFile && b.dotFile);
  const partialBundles = bundles.filter(
    (b) => (b.planFile && !b.dotFile) || (!b.planFile && b.dotFile),
  );
  const hasPlanMode = completeBundles.length > 0;
  const stateOnly =
    stateFiles.length > 0 &&
    completeBundles.length === 0 &&
    partialBundles.length === 0;
  const canImport = hasPlanMode || stateOnly || activePreset != null;
  const canUseSemanticView =
    hasPlanMode || stateFiles.length > 0 || activePreset != null;
  const canUsePipelineView =
    canUseSemanticView &&
    (tfdFiles.length > 0 ||
      (activePreset?.tfdPaths?.length ?? 0) > 0 ||
      (activePreset?.tfdFiles?.length ?? 0) > 0);
  const semanticViewDisabled = loading || !canUseSemanticView;
  const pipelineViewDisabled = loading || !canUsePipelineView;
  const usingPresetManifest = activePreset != null;

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

  const runImportFromSources = async (
    sources: TerraformPlanParsingSources,
    opts: {
      importedTfdTexts?: string[];
      extraWarnings?: TerraformImportPresetWarning[];
      preset?: TerraformImportPreset | null;
    } = {},
  ) => {
    const canUseSemanticView =
      sources.planDotBundles.length > 0 || sources.states.length > 0;
    const hasTfd =
      (opts.importedTfdTexts?.some((t) => t.trim()) ?? false) ||
      sources.tfdTexts.some((t) => t.trim());
    const pipelineLayout =
      importView === "pipeline" && canUseSemanticView && hasTfd;
    const semanticLayout =
      importView === "semantic" && canUseSemanticView && !pipelineLayout;
    const { importWarnings: warnings } = await runTerraformImportFromSources(
      app,
      setAppState,
      sources,
      {
        semanticLayout,
        pipelineLayout,
        pipelineLayoutMode,
        pipelineVerticalSolverMode,
        moduleLayoutOptions:
          semanticLayout || pipelineLayout ? undefined : moduleLayoutOptions,
        importedTfdTexts: opts.importedTfdTexts,
        preset: opts.preset ?? null,
      },
    );
    onImportSuccess?.();
    setImportDone(true);
    setPresetWarnings(opts.extraWarnings ?? []);
    if (warnings?.length) {
      setImportWarnings(warnings);
    } else if ((opts.extraWarnings ?? []).length === 0) {
      onCloseRequest();
    }
  };

  const buildPresetPayload = async (
    presetId: string,
    presetName: string,
    rootPath: string,
  ): Promise<TerraformImportPreset> => {
    if (completeBundles.length > 0) {
      const stacks = await Promise.all(
        completeBundles.map(async (row, index) => {
          const label = row.label.trim() || `Stack ${index + 1}`;
          const inferredId = inferStackIdFromFileName(
            row.planFile?.name || label,
            index,
          );
          const planPath = `${inferredId}/${row.planFile?.name || "plan.json"}`;
          const dotPath = `${inferredId}/${row.dotFile?.name || "graph.dot"}`;
          const statePath = `${inferredId}/terraform.tfstate`;
          const matchingState = stateFiles.find((file) =>
            file.name.includes(inferredId),
          );
          return {
            id: inferredId,
            label,
            planPath,
            dotPath,
            statePath,
            planText: await readFileText(row.planFile!),
            dotText: await readFileText(row.dotFile!),
            ...(matchingState
              ? { stateText: await readFileText(matchingState) }
              : {}),
          };
        }),
      );
      const embeddedTfd =
        tfdFiles.length > 0
          ? await Promise.all(
              tfdFiles.map(async (file) => ({
                path: file.name,
                text: await readFileText(file),
              })),
            )
          : [];
      return {
        id: presetId,
        name: presetName,
        builtin: false,
        description: "User-defined Terraform import preset.",
        rootPath,
        view,
        stacks,
        tfdPaths:
          embeddedTfd.length > 0
            ? embeddedTfd.map((file) => file.path)
            : ["pipeline.tfd"],
        tfdFiles: embeddedTfd,
        hasContent: true,
      };
    }

    const sourcePreset = activePreset ?? selectedPreset;
    if (sourcePreset) {
      const withContent = await fetchTerraformImportPresetFromApi(
        sourcePreset.id,
        { includeContent: true },
      );
      return {
        ...withContent,
        id: presetId,
        name: presetName,
        builtin: false,
        rootPath,
        view,
        hasContent: true,
      };
    }

    throw new Error(
      "Add plan + graph files to store in the preset, or select a preset that already has DB content.",
    );
  };

  const handleImport = async () => {
    if (!usingPresetManifest && partialBundles.length > 0) {
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
    setPresetWarnings([]);
    setImportDone(false);
    try {
      if (activePreset) {
        const presetSources = await loadTerraformImportPresetSources(
          activePreset,
          { allowDirectoryHandleFallback: true },
        );
        await runImportFromSources(
          {
            planDotBundles: presetSources.planDotBundles,
            states: presetSources.states,
            stateLabels: presetSources.stateLabels,
            tfdTexts: presetSources.tfdTexts,
            tfdLabels: presetSources.tfdLabels,
          },
          {
            importedTfdTexts: presetSources.tfdTexts,
            extraWarnings: presetSources.warnings,
            preset: activePreset,
          },
        );
        return;
      }

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

      await runImportFromSources(
        {
          planDotBundles,
          states,
          stateLabels,
          tfdTexts,
          tfdLabels,
        },
        { importedTfdTexts: tfdTexts },
      );
    } catch (err) {
      console.error("Import error:", err);
      onImportFail?.();
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPresetAndImport = async () => {
    const preset = selectedPreset ?? activePreset;
    if (!preset) {
      return;
    }
    setLoading(true);
    setError(null);
    setImportWarnings(null);
    setPresetWarnings([]);
    setImportDone(false);
    try {
      const presetSources = await loadTerraformImportPresetSources(preset, {
        allowDirectoryHandleFallback: true,
      });
      await runImportFromSources(
        {
          planDotBundles: presetSources.planDotBundles,
          states: presetSources.states,
          stateLabels: presetSources.stateLabels,
          tfdTexts: presetSources.tfdTexts,
          tfdLabels: presetSources.tfdLabels,
        },
        {
          importedTfdTexts: presetSources.tfdTexts,
          extraWarnings: presetSources.warnings,
          preset,
        },
      );
    } catch (err) {
      console.error("Preset import error:", err);
      onImportFail?.();
      setError(err instanceof Error ? err.message : "Preset import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsPreset = async () => {
    const nameInput = window.prompt("Preset name");
    if (!nameInput) {
      return;
    }
    const presetName = nameInput.trim();
    if (!presetName) {
      return;
    }
    const rootPathInput = window.prompt(
      "Preset root path",
      selectedPreset?.rootPath ||
        "packages/backend/terraform/staging-multi-state",
    );
    if (!rootPathInput) {
      return;
    }
    const presetId = toPresetId(presetName);
    if (!presetId) {
      setError("Preset name must contain letters or numbers.");
      return;
    }
    try {
      const preset = await buildPresetPayload(
        presetId,
        presetName,
        rootPathInput.trim(),
      );
      await saveTerraformImportPreset(preset);
      setSelectedPresetId(preset.id);
      await refreshPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preset.");
    }
  };

  const handleUpdatePreset = async () => {
    if (!selectedPreset || selectedPreset.builtin) {
      return;
    }
    try {
      const updated = await buildPresetPayload(
        selectedPreset.id,
        selectedPreset.name,
        selectedPreset.rootPath,
      );
      await updateTerraformImportPreset(selectedPreset.id, updated);
      await refreshPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preset.");
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPreset || selectedPreset.builtin) {
      return;
    }
    const confirmed = window.confirm(`Delete preset "${selectedPreset.name}"?`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteTerraformImportPreset(selectedPreset.id);
      setSelectedPresetId(BUILTIN_TERRAFORM_IMPORT_PRESETS[0]?.id ?? "");
      setActivePreset(null);
      await refreshPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete preset.");
    }
  };

  const handleUsePresetManifest = () => {
    if (!selectedPreset) {
      return;
    }
    setActivePreset(selectedPreset);
    setView(selectedPreset.view);
    setError(null);
  };

  const handleClearPresetManifest = () => {
    setActivePreset(null);
  };

  const handleSyncPresetFromDisk = async () => {
    if (!selectedPreset) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await syncTerraformImportPresetFromDiskViaApi(selectedPreset.id);
      await refreshPresets();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sync preset from disk.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePresetFolder = async () => {
    try {
      await chooseTerraformImportPresetRootDirectory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to choose preset folder.",
      );
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
        <h4>Presets</h4>
        <label>
          Preset
          <select
            value={selectedPresetId}
            disabled={presetsLoading || loading}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            {availablePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
                {preset.builtin ? " (built-in)" : ""}
              </option>
            ))}
          </select>
        </label>
        {selectedPreset && (
          <div className="TerraformImportModal__presetSummary">
            <div>
              <strong>Stacks:</strong> {selectedPreset.stacks.length}
            </div>
            <div>
              <strong>TFD files:</strong> {selectedPreset.tfdPaths.length}
            </div>
            <div>
              <strong>View:</strong> {selectedPreset.view}
            </div>
            <div>
              <strong>Root:</strong> {selectedPreset.rootPath}
            </div>
            <div>
              <strong>Content:</strong>{" "}
              {selectedPreset.hasContent
                ? "stored in SQLite (portable)"
                : "paths only — sync from disk"}
            </div>
          </div>
        )}
        {presetsLoading && (
          <p className="TerraformImportModal__muted">
            Loading presets from SQLite…
          </p>
        )}
        <div className="TerraformImportModal__presetButtons">
          <button
            type="button"
            onClick={handleLoadPresetAndImport}
            disabled={loading || !selectedPreset}
          >
            Load & import
          </button>
          <button
            type="button"
            onClick={handleUsePresetManifest}
            disabled={loading || !selectedPreset}
          >
            Use preset manifest
          </button>
          {activePreset && (
            <button
              type="button"
              onClick={handleClearPresetManifest}
              disabled={loading}
            >
              Clear preset manifest
            </button>
          )}
          <button type="button" onClick={handleSaveAsPreset} disabled={loading}>
            Save as new
          </button>
          <button
            type="button"
            onClick={handleUpdatePreset}
            disabled={loading || !selectedPreset || selectedPreset.builtin}
          >
            Update selected
          </button>
          <button
            type="button"
            onClick={handleDeletePreset}
            disabled={loading || !selectedPreset || selectedPreset.builtin}
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={handleSyncPresetFromDisk}
            disabled={loading || !selectedPreset}
          >
            Sync from disk
          </button>
          <button
            type="button"
            onClick={handleChoosePresetFolder}
            disabled={loading}
          >
            Choose preset folder
          </button>
        </div>
      </div>

      {usingPresetManifest && activePreset ? (
        <div className="TerraformImportModal__section">
          <h4>Preset manifest</h4>
          <p className="TerraformImportModal__muted">
            Files are loaded from the preset database (plan, graph, state, and
            .tfd content). Use <strong>Load &amp; import</strong> or{" "}
            <strong>Import &amp; Open</strong> below. Copy{" "}
            <code>terraform-import-presets.db</code> to move presets between
            machines.
          </p>
          <div className="TerraformImportModal__presetManifest">
            <table>
              <thead>
                <tr>
                  <th>Stack</th>
                  <th>Plan</th>
                  <th>Graph</th>
                  <th>State (optional)</th>
                </tr>
              </thead>
              <tbody>
                {activePreset.stacks.map((stack) => (
                  <tr key={stack.id}>
                    <td>{stack.label}</td>
                    <td>
                      <code>
                        {joinPresetPath(activePreset.rootPath, stack.planPath)}
                      </code>
                    </td>
                    <td>
                      <code>
                        {joinPresetPath(activePreset.rootPath, stack.dotPath)}
                      </code>
                    </td>
                    <td>
                      {stack.statePath ? (
                        <code>
                          {joinPresetPath(
                            activePreset.rootPath,
                            stack.statePath,
                          )}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activePreset.tfdPaths.length > 0 && (
              <ul className="TerraformImportModal__fileList">
                {activePreset.tfdPaths.map((tfdPath) => (
                  <li key={tfdPath}>
                    <code>
                      {joinPresetPath(activePreset.rootPath, tfdPath)}
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <>
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
                Optional with plan bundles to enrich nodes; or select one or
                more alone for module or semantic views.
              </span>
              <input
                type="file"
                multiple
                accept=".tfstate,.json"
                onChange={(e) =>
                  setStateFiles(Array.from(e.target.files ?? []))
                }
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
                Optional arrow-only overlay; edges are applied in file order
                across all selected <code>.tfd</code> files.
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
        </>
      )}

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
              (option.value === "semantic" && semanticViewDisabled) ||
              (option.value === "pipeline" && pipelineViewDisabled);
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
                    : option.value === "pipeline" && !canUsePipelineView
                    ? "Pipeline view requires plan/state plus a .tfd dataflow file."
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

      {view === "module" ? (
        <TerraformModulePackingSettings
          options={moduleLayoutOptions}
          onChange={setModuleLayoutOptions}
        />
      ) : null}

      {view === "pipeline" ? (
        <div
          className="TerraformImportModal__section TerraformImportModal__viewSelector"
          role="radiogroup"
          aria-label="Pipeline layout"
        >
          <h4>Pipeline layout</h4>
          <div className="TerraformImportModal__viewSelector__options">
            {PIPELINE_LAYOUT_MODE_OPTIONS.map((option) => {
              const checked = pipelineLayoutMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`TerraformImportModal__viewSelector__option${
                    checked
                      ? " TerraformImportModal__viewSelector__option--checked"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="terraform-pipeline-layout-mode"
                    value={option.value}
                    checked={checked}
                    disabled={loading}
                    onChange={() => setPipelineLayoutMode(option.value)}
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
      ) : null}

      {view === "pipeline" ? (
        <div
          className="TerraformImportModal__section TerraformImportModal__viewSelector"
          role="radiogroup"
          aria-label="Pipeline vertical positioning"
        >
          <h4>Pipeline vertical positioning</h4>
          <div className="TerraformImportModal__viewSelector__options">
            {PIPELINE_VERTICAL_SOLVER_MODE_OPTIONS.map((option) => {
              const checked = pipelineVerticalSolverMode === option.value;
              return (
                <label
                  key={option.value}
                  className={`TerraformImportModal__viewSelector__option${
                    checked
                      ? " TerraformImportModal__viewSelector__option--checked"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="terraform-pipeline-vertical-solver-mode"
                    value={option.value}
                    checked={checked}
                    disabled={loading}
                    onChange={() => setPipelineVerticalSolverMode(option.value)}
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
      ) : null}

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
      {presetWarnings.length > 0 && (
        <details className="TerraformImportModal__warnings" open>
          <summary>Preset warnings ({presetWarnings.length})</summary>
          <ul>
            {presetWarnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
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
