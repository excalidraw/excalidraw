import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp, useExcalidrawSetAppState } from "./App";
import {
  type TerraformImportWarning,
  type TerraformPlanParsingSources,
  type TerraformPlanDotBundle,
} from "./terraformPlanParsing";
import { parseRawStateJson } from "./terraformImportMerge";
import {
  runTerraformImportWithView,
  runTerraformPresetImport,
} from "./terraformPresetImport";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";
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
  type TerraformImportPresetWarning,
} from "./terraformImportPresetLoader";
import {
  fetchTerraformImportArtifactsFromApi,
  fetchTerraformImportPresetFromApi,
  saveTerraformImportArtifactViaApi,
  saveTerraformImportCompositionViaApi,
  syncTerraformImportPresetFromDiskViaApi,
} from "./terraformImportPresetsApi";
import {
  inferStackIdFromFileName,
  MAX_PLAN_BUNDLES,
  newBundleRow,
  readFileText,
  toPresetId,
  type PlanDotBundleRow,
  type PipelineLayoutVariant,
  type TerraformView,
} from "./terraformImportDialogUtils";

import type {
  TerraformImportArtifact,
  TerraformImportArtifactKind,
} from "./terraformImportPresetsTypes";

type UseTerraformImportDialogProps = {
  onCloseRequest: () => void;
  onImportSuccess?: () => void;
  onImportFail?: () => void;
};

export const useTerraformImportDialog = ({
  onCloseRequest,
  onImportSuccess,
  onImportFail,
}: UseTerraformImportDialogProps) => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const [bundles, setBundles] = useState<PlanDotBundleRow[]>(() => [
    newBundleRow(),
  ]);
  const [stateFiles, setStateFiles] = useState<File[]>([]);
  const [tfdFiles, setTfdFiles] = useState<File[]>([]);
  const [view, setView] = useState<TerraformView>("semantic");
  const [pipelineCompact, setPipelineCompact] = useState(true);
  const [pipelineLayoutVariant, setPipelineLayoutVariant] =
    useState<PipelineLayoutVariant>("classic");
  const [moduleLayoutOptions, setModuleLayoutOptions] = useState(
    DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  );
  const [loading, setLoading] = useState(false);
  const [layoutProgress, setLayoutProgress] = useState<string | null>(null);
  const layoutAbortRef = useRef<AbortController | null>(null);
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
  const [artifacts, setArtifacts] = useState<TerraformImportArtifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactRepoName, setArtifactRepoName] = useState("my-infra");
  const [artifactRelativePath, setArtifactRelativePath] = useState("");
  const [artifactKind, setArtifactKind] =
    useState<TerraformImportArtifactKind>("plan");
  const [artifactUploadFile, setArtifactUploadFile] = useState<File | null>(
    null,
  );

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

  const refreshArtifacts = useCallback(async () => {
    if (!import.meta.env.DEV) {
      return;
    }
    setArtifactsLoading(true);
    try {
      setArtifacts(await fetchTerraformImportArtifactsFromApi());
    } catch {
      // Artifact library is optional outside dev API.
    } finally {
      setArtifactsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshArtifacts();
  }, [refreshArtifacts]);

  useEffect(() => {
    return () => {
      layoutAbortRef.current?.abort();
    };
  }, []);

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
  const semanticViewDisabled = loading || !canUseSemanticView;
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

  const completeImport = (
    warnings: TerraformImportWarning[] | undefined,
    extraWarnings: TerraformImportPresetWarning[] = [],
  ) => {
    onImportSuccess?.();
    setImportDone(true);
    setPresetWarnings(extraWarnings);
    if (warnings?.length) {
      setImportWarnings(warnings);
    } else if (extraWarnings.length === 0) {
      onCloseRequest();
    }
  };

  const runImportFromSources = async (
    sources: TerraformPlanParsingSources,
    opts: {
      importedTfdTexts?: string[];
      extraWarnings?: TerraformImportPresetWarning[];
      preset?: TerraformImportPreset | null;
    } = {},
  ) => {
    const { importWarnings: warnings } = await runTerraformImportWithView({
      app,
      setAppState,
      sources,
      view,
      moduleLayoutOptions,
      pipelineCompact,
      pipelineLayoutVariant,
      importedTfdTexts: opts.importedTfdTexts,
      preset: opts.preset ?? null,
      signal: layoutAbortRef.current?.signal,
      onLayoutProgress: (p) => {
        const label =
          p.total > 0 ? `${p.phase} (${p.done}/${p.total})` : p.phase;
        setLayoutProgress(label);
      },
    });
    completeImport(warnings, opts.extraWarnings ?? []);
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
    layoutAbortRef.current?.abort();
    layoutAbortRef.current = new AbortController();
    setLoading(true);
    setLayoutProgress(null);
    setError(null);
    setImportWarnings(null);
    setPresetWarnings([]);
    setImportDone(false);
    try {
      if (activePreset) {
        const { importWarnings: warnings, presetSources } =
          await runTerraformPresetImport(app, setAppState, activePreset, {
            view,
            moduleLayoutOptions,
            pipelineCompact,
            pipelineLayoutVariant,
            signal: layoutAbortRef.current?.signal,
            onLayoutProgress: (p) => {
              const label =
                p.total > 0 ? `${p.phase} (${p.done}/${p.total})` : p.phase;
              setLayoutProgress(label);
            },
          });
        completeImport(warnings, presetSources.warnings);
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
      setLayoutProgress(null);
      layoutAbortRef.current = null;
    }
  };

  const handleLoadPresetAndImport = async () => {
    const preset = selectedPreset ?? activePreset;
    if (!preset) {
      return;
    }
    layoutAbortRef.current?.abort();
    layoutAbortRef.current = new AbortController();
    setLoading(true);
    setLayoutProgress(null);
    setError(null);
    setImportWarnings(null);
    setPresetWarnings([]);
    setImportDone(false);
    try {
      const { importWarnings: warnings, presetSources } =
        await runTerraformPresetImport(app, setAppState, preset, {
          view,
          moduleLayoutOptions,
          pipelineCompact,
          pipelineLayoutVariant,
          signal: layoutAbortRef.current?.signal,
          onLayoutProgress: (p) => {
            const label =
              p.total > 0 ? `${p.phase} (${p.done}/${p.total})` : p.phase;
            setLayoutProgress(label);
          },
        });
      completeImport(warnings, presetSources.warnings);
    } catch (err) {
      console.error("Preset import error:", err);
      onImportFail?.();
      setError(err instanceof Error ? err.message : "Preset import failed");
    } finally {
      setLoading(false);
      setLayoutProgress(null);
      layoutAbortRef.current = null;
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

  const handleRegisterArtifact = async () => {
    if (!artifactUploadFile || !artifactRelativePath.trim()) {
      setError(
        "Choose a file and enter repoName/relativePath for the artifact.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await saveTerraformImportArtifactViaApi({
        repoName: artifactRepoName.trim() || "my-infra",
        relativePath: artifactRelativePath.trim(),
        kind: artifactKind,
        content: await readFileText(artifactUploadFile),
      });
      setArtifactUploadFile(null);
      setArtifactRelativePath("");
      await refreshArtifacts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register artifact.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveComposition = async () => {
    const nameInput = window.prompt("Composition name");
    if (!nameInput?.trim()) {
      return;
    }
    if (tfdFiles.length === 0) {
      setError("Upload at least one .tfd file to save as a composition.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tfdContent = await readFileText(tfdFiles[0]!);
      await saveTerraformImportCompositionViaApi({
        id: toPresetId(nameInput),
        name: nameInput.trim(),
        defaultView: view,
        tfdContent,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save composition.",
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    bundles,
    stateFiles,
    tfdFiles,
    view,
    pipelineCompact,
    pipelineLayoutVariant,
    moduleLayoutOptions,
    loading,
    layoutProgress,
    error,
    importWarnings,
    importDone,
    selectedPresetId,
    presetWarnings,
    availablePresets,
    presetsLoading,
    activePreset,
    artifacts,
    artifactsLoading,
    artifactRepoName,
    artifactRelativePath,
    artifactKind,
    artifactUploadFile,
    selectedPreset,
    canImport,
    canUseSemanticView,
    semanticViewDisabled,
    usingPresetManifest,
    stateOnly,
    setStateFiles,
    setTfdFiles,
    setView,
    setPipelineCompact,
    setPipelineLayoutVariant,
    setModuleLayoutOptions,
    setSelectedPresetId,
    setArtifactRepoName,
    setArtifactRelativePath,
    setArtifactKind,
    setArtifactUploadFile,
    updateBundle,
    addBundle,
    removeBundle,
    handleImport,
    handleLoadPresetAndImport,
    handleSaveAsPreset,
    handleUpdatePreset,
    handleDeletePreset,
    handleUsePresetManifest,
    handleClearPresetManifest,
    handleSyncPresetFromDisk,
    handleChoosePresetFolder,
    handleRegisterArtifact,
    handleSaveComposition,
  };
};
