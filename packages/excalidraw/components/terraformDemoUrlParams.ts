import {
  isDeBandLevel,
  isRcllLayoutProfile,
  type DeBandLevel,
  type RcllLayoutProfile,
} from "./terraformPipelineLayoutProfiles";

import {
  TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
  type TerraformRuntimePerformanceSettings,
} from "./terraformRuntimePerformance";

import type {
  PipelineLayoutVariant,
  TerraformView,
} from "./terraformImportDialogUtils";
import type { ModulePackingMode } from "./terraformModuleLayoutOptions";
import type { TerraformLodPreset } from "./terraformLod";

/** Edge-layer visibility pins (mirrors `AppState["terraformEdgeLayerPins"]`). */
export type TerraformEdgeLayerPins = {
  dependency: boolean;
  dataFlow: boolean;
  declaredDataFlow: boolean;
  networking: boolean;
  topologyFrameFlow: boolean;
};

/** Stable short codes for each edge layer in the `layers=` param (order = emit order). */
const EDGE_LAYER_CODES: ReadonlyArray<[keyof TerraformEdgeLayerPins, string]> =
  [
    ["dependency", "dep"],
    ["networking", "net"],
    ["dataFlow", "dataflow"],
    ["declaredDataFlow", "declared"],
    ["topologyFrameFlow", "topo"],
  ];

/** The boolean experiment keys of {@link TerraformRuntimePerformanceSettings} (excludes the
 * numeric `lowZoomThreshold`), so `settings[key] = true` stays type-correct. */
type TerraformPerfBooleanKey =
  | "hideAwsIconGlyphsBelowZoom"
  | "suppressHoverFocusBelowZoom"
  | "debounceHoverFocus"
  | "suppressFrameClippingBelowZoom"
  | "skipBindingRepairDuringFocus";

/** Short codes for each boolean canvas-performance experiment in the `canvasPerf=` param. */
const RUNTIME_PERF_CODES: ReadonlyArray<[TerraformPerfBooleanKey, string]> = [
  ["hideAwsIconGlyphsBelowZoom", "hideicons"],
  ["suppressHoverFocusBelowZoom", "nohover"],
  ["debounceHoverFocus", "debouncehover"],
  ["suppressFrameClippingBelowZoom", "noclip"],
  ["skipBindingRepairDuringFocus", "nobindrepair"],
];

const VALID_LOD_PRESETS = new Set<TerraformLodPreset>([
  "performance",
  "balanced",
  "detailed",
]);

export type TerraformDemoUrlParams = {
  presetId: string;
  view?: TerraformView;
  pack?: ModulePackingMode;
  compact?: boolean;
  pipelineVariant?: PipelineLayoutVariant;
  packed?: boolean;
  packedPullLeft?: boolean;
  ancillary?: boolean;
  semanticPlace?: boolean;
  /** Accepts the clear alias `laneRise` as well as the milestone name `swimlaneRise`. */
  swimlaneRise?: boolean;
  reorder?: boolean;
  /** RCLL M6c: container-aware crossing minimization (hierarchical superset of reorder). */
  crossingMin?: boolean;
  /** RCLL de-band depth: `none | subnet | vpc | region | account | provider`. */
  deBandLevel?: DeBandLevel;
  /** Back-compat alias for `deBandLevel=subnet` (the original subnet-only probe). */
  subnetDeBand?: boolean;
  /** Accepts the clear alias `laneSplit` as well as the milestone name `rankSeparate`. */
  rankSeparate?: boolean;
  straighten?: boolean;
  deDensify?: boolean;
  /** RCLL "Column packing" tri-state: `spread` (M5b) / `none` / `compact` (M5c). */
  columnPacking?: "spread" | "none" | "compact";
  /** RCLL "Layout" profile — `readable | balanced | compact` (outcome-first preset). */
  profile?: RcllLayoutProfile;
  /** RCLL DEC-1 cycle-band rise; default on — only `=0` (false) is meaningful.
   * Accepts the clear alias `cycleRise` as well as the milestone name. */
  staircaseBandOverlap?: boolean;

  // ─── Runtime canvas view settings (applied after import, not layout inputs) ───
  /** Zoom LOD master switch (`lodEnabled=1/0`). */
  lodEnabled?: boolean;
  /** LOD detail preset (`lodPreset=performance|balanced|detailed`). */
  lodPreset?: TerraformLodPreset;
  /** Overview minimap visibility (`minimap=1/0`). */
  minimap?: boolean;
  /** Edge-layer visibility pins (`layers=dep,net,…` or `layers=none`). */
  edgeLayerPins?: TerraformEdgeLayerPins;
  /** Dev canvas-performance experiments (`canvasPerf=…` + `canvasPerfZoom=…`). */
  runtimePerformance?: TerraformRuntimePerformanceSettings;
};

const VALID_COLUMN_PACKING = new Set<"spread" | "none" | "compact">([
  "spread",
  "none",
  "compact",
]);

const PRESET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const VALID_VIEWS = new Set<TerraformView>([
  "module",
  "semantic",
  "pipeline",
  "rcll",
]);
const VALID_PIPELINE_VARIANTS = new Set<PipelineLayoutVariant>([
  "classic",
  "compound",
  "v2",
]);
const VALID_PACK_MODES = new Set<ModulePackingMode>([
  "default",
  "box",
  "rectpacking",
]);

export const isDemoPathname = (pathname: string): boolean =>
  pathname === "/demo" || pathname === "/demo/";

export const normalizePresetIdParam = (value: string): string | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !PRESET_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const parseTerraformDemoUrlParams = (
  search: string,
): TerraformDemoUrlParams | null => {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const presetRaw = params.get("preset");
  if (!presetRaw) {
    return null;
  }

  const presetId = normalizePresetIdParam(presetRaw);
  if (!presetId) {
    return null;
  }

  const viewRaw = params.get("view");
  let view: TerraformView | undefined;
  if (viewRaw != null && viewRaw.trim() !== "") {
    const normalizedView = viewRaw.trim().toLowerCase() as TerraformView;
    if (!VALID_VIEWS.has(normalizedView)) {
      return null;
    }
    view = normalizedView;
  }

  const packRaw = params.get("pack");
  let pack: ModulePackingMode | undefined;
  if (packRaw != null && packRaw.trim() !== "") {
    const normalizedPack = packRaw.trim().toLowerCase() as ModulePackingMode;
    if (!VALID_PACK_MODES.has(normalizedPack)) {
      return null;
    }
    pack = normalizedPack;
  }

  const pipelineVariantRaw = params.get("pipelineVariant");
  let pipelineVariant: PipelineLayoutVariant | undefined;
  if (pipelineVariantRaw != null && pipelineVariantRaw.trim() !== "") {
    const normalized = pipelineVariantRaw
      .trim()
      .toLowerCase() as PipelineLayoutVariant;
    if (!VALID_PIPELINE_VARIANTS.has(normalized)) {
      return null;
    }
    pipelineVariant = normalized;
  }

  const parseBooleanParam = (name: string): boolean | undefined | null => {
    const raw = params.get(name);
    if (raw == null || raw.trim() === "") {
      return undefined;
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") {
      return true;
    }
    if (normalized === "0" || normalized === "false") {
      return false;
    }
    return null;
  };

  // Milestone params accept a clearer alias (matching the menu vocabulary) as well as
  // the legacy name. The first param that is present wins; an invalid value hard-fails.
  const parseBooleanAlias = (
    ...names: string[]
  ): boolean | undefined | null => {
    for (const name of names) {
      const value = parseBooleanParam(name);
      if (value === null) {
        return null;
      }
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  };

  let packed = parseBooleanParam("packed");
  if (packed === null) {
    return null;
  }
  const packedPullLeft = parseBooleanParam("packedPullLeft");
  if (packedPullLeft === null) {
    return null;
  }
  // Pull-left only exists within packed mode, so the param implies it.
  if (packedPullLeft === true && packed !== false) {
    packed = true;
  }
  const compact = parseBooleanParam("compact");
  if (compact === null) {
    return null;
  }
  const ancillary = parseBooleanParam("ancillary");
  if (ancillary === null) {
    return null;
  }
  const semanticPlace = parseBooleanParam("semanticPlace");
  if (semanticPlace === null) {
    return null;
  }
  const swimlaneRise = parseBooleanAlias("laneRise", "swimlaneRise");
  if (swimlaneRise === null) {
    return null;
  }
  const reorder = parseBooleanParam("reorder");
  if (reorder === null) {
    return null;
  }
  const crossingMin = parseBooleanParam("crossingMin");
  if (crossingMin === null) {
    return null;
  }
  const subnetDeBand = parseBooleanParam("subnetDeBand");
  if (subnetDeBand === null) {
    return null;
  }
  // De-band depth enum. Hard-fail on an invalid value (same contract as columnPacking).
  // Back-compat: a legacy `subnetDeBand=1` (no explicit level) ⇒ `subnet`.
  const deBandLevelRaw = params.get("deBandLevel");
  let deBandLevel: DeBandLevel | undefined;
  if (deBandLevelRaw != null && deBandLevelRaw.trim() !== "") {
    const normalized = deBandLevelRaw.trim().toLowerCase();
    if (!isDeBandLevel(normalized)) {
      return null;
    }
    deBandLevel = normalized;
  } else if (subnetDeBand === true) {
    deBandLevel = "subnet";
  }
  const rankSeparate = parseBooleanAlias("laneSplit", "rankSeparate");
  if (rankSeparate === null) {
    return null;
  }
  const straighten = parseBooleanParam("straighten");
  if (straighten === null) {
    return null;
  }
  const deDensify = parseBooleanParam("deDensify");
  if (deDensify === null) {
    return null;
  }
  // "Column packing" tri-state. Hard-fail on an invalid value (same contract as the
  // booleans). Back-compat: a legacy `deDensify=1` (no explicit packing) ⇒ `spread`.
  const columnPackingRaw = params.get("columnPacking");
  let columnPacking: "spread" | "none" | "compact" | undefined;
  if (columnPackingRaw != null && columnPackingRaw.trim() !== "") {
    const normalized = columnPackingRaw.trim().toLowerCase() as
      | "spread"
      | "none"
      | "compact";
    if (!VALID_COLUMN_PACKING.has(normalized)) {
      return null;
    }
    columnPacking = normalized;
  } else if (deDensify === true) {
    columnPacking = "spread";
  }
  const staircaseBandOverlap = parseBooleanAlias(
    "cycleRise",
    "staircaseBandOverlap",
  );
  if (staircaseBandOverlap === null) {
    return null;
  }

  // "Layout" profile enum. Hard-fail on an invalid value (same contract as columnPacking).
  const profileRaw = params.get("profile");
  let profile: RcllLayoutProfile | undefined;
  if (profileRaw != null && profileRaw.trim() !== "") {
    const normalized = profileRaw.trim().toLowerCase();
    if (!isRcllLayoutProfile(normalized)) {
      return null;
    }
    profile = normalized;
  }

  // ─── Runtime canvas view settings ───
  const lodEnabled = parseBooleanParam("lodEnabled");
  if (lodEnabled === null) {
    return null;
  }
  const lodPresetRaw = params.get("lodPreset");
  let lodPreset: TerraformLodPreset | undefined;
  if (lodPresetRaw != null && lodPresetRaw.trim() !== "") {
    const normalized = lodPresetRaw.trim().toLowerCase() as TerraformLodPreset;
    if (!VALID_LOD_PRESETS.has(normalized)) {
      return null;
    }
    lodPreset = normalized;
  }
  const minimap = parseBooleanParam("minimap");
  if (minimap === null) {
    return null;
  }

  // `layers=dep,net,…` (or `none`) → the full pins object (unlisted layers = hidden).
  const layersRaw = params.get("layers");
  let edgeLayerPins: TerraformEdgeLayerPins | undefined;
  if (layersRaw != null && layersRaw.trim() !== "") {
    const codes = layersRaw
      .trim()
      .toLowerCase()
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code !== "" && code !== "none");
    const codeToKey = new Map<string, keyof TerraformEdgeLayerPins>(
      EDGE_LAYER_CODES.map(([key, code]) => [code, key] as const),
    );
    for (const code of codes) {
      if (!codeToKey.has(code)) {
        return null;
      }
    }
    edgeLayerPins = {
      dependency: false,
      dataFlow: false,
      declaredDataFlow: false,
      networking: false,
      topologyFrameFlow: false,
    };
    for (const code of codes) {
      edgeLayerPins[codeToKey.get(code)!] = true;
    }
  }

  // `canvasPerf=hideicons,…` (or `none`) + `canvasPerfZoom=0.2|0.3|0.4` → full perf settings.
  const canvasPerfRaw = params.get("canvasPerf");
  const canvasPerfZoomRaw = params.get("canvasPerfZoom");
  let runtimePerformance: TerraformRuntimePerformanceSettings | undefined;
  if (
    (canvasPerfRaw != null && canvasPerfRaw.trim() !== "") ||
    (canvasPerfZoomRaw != null && canvasPerfZoomRaw.trim() !== "")
  ) {
    const settings: TerraformRuntimePerformanceSettings = {
      ...TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
    };
    const codeToKey = new Map<string, TerraformPerfBooleanKey>(
      RUNTIME_PERF_CODES.map(([key, code]) => [code, key] as const),
    );
    const codes = (canvasPerfRaw ?? "")
      .trim()
      .toLowerCase()
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code !== "" && code !== "none");
    for (const code of codes) {
      if (!codeToKey.has(code)) {
        return null;
      }
      settings[codeToKey.get(code)!] = true;
    }
    if (canvasPerfZoomRaw != null && canvasPerfZoomRaw.trim() !== "") {
      const zoom = Number(canvasPerfZoomRaw.trim());
      if (zoom !== 0.2 && zoom !== 0.3 && zoom !== 0.4) {
        return null;
      }
      settings.lowZoomThreshold = zoom;
    }
    runtimePerformance = settings;
  }

  return {
    presetId,
    ...(view ? { view } : {}),
    ...(pack ? { pack } : {}),
    ...(compact != null ? { compact } : {}),
    ...(pipelineVariant ? { pipelineVariant } : {}),
    ...(packed != null ? { packed } : {}),
    ...(packedPullLeft != null ? { packedPullLeft } : {}),
    ...(ancillary != null ? { ancillary } : {}),
    ...(semanticPlace != null ? { semanticPlace } : {}),
    ...(swimlaneRise != null ? { swimlaneRise } : {}),
    ...(reorder != null ? { reorder } : {}),
    ...(crossingMin != null ? { crossingMin } : {}),
    ...(subnetDeBand != null ? { subnetDeBand } : {}),
    ...(deBandLevel != null ? { deBandLevel } : {}),
    ...(rankSeparate != null ? { rankSeparate } : {}),
    ...(straighten != null ? { straighten } : {}),
    ...(deDensify != null ? { deDensify } : {}),
    ...(columnPacking != null ? { columnPacking } : {}),
    ...(profile != null ? { profile } : {}),
    ...(staircaseBandOverlap != null ? { staircaseBandOverlap } : {}),
    ...(lodEnabled != null ? { lodEnabled } : {}),
    ...(lodPreset != null ? { lodPreset } : {}),
    ...(minimap != null ? { minimap } : {}),
    ...(edgeLayerPins != null ? { edgeLayerPins } : {}),
    ...(runtimePerformance != null ? { runtimePerformance } : {}),
  };
};

export const hasTerraformDemoAutoImportQuery = (search: string): boolean =>
  parseTerraformDemoUrlParams(search) != null;

/**
 * Serialize demo params back into a `/demo?…` URL — the inverse of
 * {@link parseTerraformDemoUrlParams}. Emits the canonical param names the parser
 * reads (booleans as `1`/`0`, enums verbatim), skipping any field left `undefined`,
 * so `parseTerraformDemoUrlParams(build(x)) === x` round-trips for any params `x`.
 */
export const buildTerraformDemoUrl = (
  params: TerraformDemoUrlParams,
  options?: { origin?: string; pathname?: string },
): string => {
  const sp = new URLSearchParams();
  sp.set("preset", params.presetId);
  const setBool = (name: string, value?: boolean): void => {
    if (value !== undefined) {
      sp.set(name, value ? "1" : "0");
    }
  };
  const setEnum = (name: string, value?: string): void => {
    if (value != null && value !== "") {
      sp.set(name, value);
    }
  };

  setEnum("view", params.view);
  setEnum("pack", params.pack);
  setBool("compact", params.compact);
  setEnum("pipelineVariant", params.pipelineVariant);
  setBool("packed", params.packed);
  setBool("packedPullLeft", params.packedPullLeft);
  setBool("ancillary", params.ancillary);
  setBool("semanticPlace", params.semanticPlace);
  setBool("swimlaneRise", params.swimlaneRise);
  setBool("reorder", params.reorder);
  setBool("crossingMin", params.crossingMin);
  setEnum("deBandLevel", params.deBandLevel);
  setBool("subnetDeBand", params.subnetDeBand);
  setBool("rankSeparate", params.rankSeparate);
  setBool("straighten", params.straighten);
  setBool("deDensify", params.deDensify);
  setEnum("columnPacking", params.columnPacking);
  setEnum("profile", params.profile);
  setBool("staircaseBandOverlap", params.staircaseBandOverlap);

  // ─── Runtime canvas view settings ───
  setBool("lodEnabled", params.lodEnabled);
  setEnum("lodPreset", params.lodPreset);
  setBool("minimap", params.minimap);
  if (params.edgeLayerPins) {
    const enabled = EDGE_LAYER_CODES.filter(
      ([key]) => params.edgeLayerPins![key],
    ).map(([, code]) => code);
    sp.set("layers", enabled.length > 0 ? enabled.join(",") : "none");
  }
  if (params.runtimePerformance) {
    const enabled = RUNTIME_PERF_CODES.filter(
      ([key]) => params.runtimePerformance![key],
    ).map(([, code]) => code);
    sp.set("canvasPerf", enabled.length > 0 ? enabled.join(",") : "none");
    sp.set(
      "canvasPerfZoom",
      String(params.runtimePerformance.lowZoomThreshold),
    );
  }

  const pathname = options?.pathname ?? "/demo";
  const origin = options?.origin ?? "";
  return `${origin}${pathname}?${sp.toString()}`;
};

/** The dialog/hook settings the demo URL captures (mirrors the import option threading). */
export type TerraformDemoSettingsSnapshot = {
  presetId: string;
  view: TerraformView;
  pipelineCompact: boolean;
  pipelineLayoutVariant: PipelineLayoutVariant;
  pipelinePacked: boolean;
  pipelinePackedPullLeft: boolean;
  pipelineIncludeAncillary: boolean;
  pipelineSemanticPlacement: boolean;
  pipelineSwimlaneLaneRise: boolean;
  pipelineReorder: boolean;
  pipelineCrossingMin: boolean;
  pipelineDeBandLevel: DeBandLevel;
  pipelineRankSeparate: boolean;
  pipelineStraighten: boolean;
  pipelineColumnPacking: "spread" | "none" | "compact";
  /** The primary RCLL Layout control — `"custom"` once any flag is touched directly. */
  pipelineLayoutProfile: RcllLayoutProfile | "custom";
  pipelineStaircaseBandOverlap: boolean;
  moduleLayoutMode: ModulePackingMode;
};

/**
 * Collect the demo params for the *currently relevant* settings, scoped by view so the URL
 * stays clean: the Semantic view carries none, Module carries `pack`, and Pipeline/RCLL carry
 * their own controls. For RCLL a named Layout profile serializes as `profile=…` (the import
 * fans it back into the flags); only a `"custom"` profile spells out the eight RCLL flags,
 * since explicit flags win over the profile downstream.
 */
export const collectTerraformDemoParams = (
  snapshot: TerraformDemoSettingsSnapshot,
): TerraformDemoUrlParams => {
  const base: TerraformDemoUrlParams = {
    presetId: snapshot.presetId,
    view: snapshot.view,
  };

  if (snapshot.view === "module") {
    return {
      ...base,
      ...(snapshot.moduleLayoutMode !== "default"
        ? { pack: snapshot.moduleLayoutMode }
        : {}),
    };
  }

  if (snapshot.view === "pipeline") {
    return {
      ...base,
      compact: snapshot.pipelineCompact,
      pipelineVariant: snapshot.pipelineLayoutVariant,
      packed: snapshot.pipelinePacked,
      ...(snapshot.pipelinePackedPullLeft ? { packedPullLeft: true } : {}),
      ancillary: snapshot.pipelineIncludeAncillary,
      semanticPlace: snapshot.pipelineSemanticPlacement,
    };
  }

  if (snapshot.view === "rcll") {
    // `compact` + `ancillary` are independent of the Layout profile, so always emit them.
    const rcll: TerraformDemoUrlParams = {
      ...base,
      compact: snapshot.pipelineCompact,
      ancillary: snapshot.pipelineIncludeAncillary,
    };
    if (snapshot.pipelineLayoutProfile !== "custom") {
      return { ...rcll, profile: snapshot.pipelineLayoutProfile };
    }
    return {
      ...rcll,
      swimlaneRise: snapshot.pipelineSwimlaneLaneRise,
      rankSeparate: snapshot.pipelineRankSeparate,
      deBandLevel: snapshot.pipelineDeBandLevel,
      staircaseBandOverlap: snapshot.pipelineStaircaseBandOverlap,
      reorder: snapshot.pipelineReorder,
      crossingMin: snapshot.pipelineCrossingMin,
      straighten: snapshot.pipelineStraighten,
      columnPacking: snapshot.pipelineColumnPacking,
    };
  }

  // Semantic view carries no extra layout controls.
  return base;
};

/** Convenience: collect + serialize a settings snapshot into a shareable `/demo?…` URL. */
export const buildTerraformDemoUrlFromSettings = (
  snapshot: TerraformDemoSettingsSnapshot,
  options?: { origin?: string; pathname?: string },
): string =>
  buildTerraformDemoUrl(collectTerraformDemoParams(snapshot), options);
