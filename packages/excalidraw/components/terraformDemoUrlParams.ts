import {
  isDeBandLevel,
  isRcllLayoutProfile,
  type DeBandLevel,
  type RcllLayoutProfile,
} from "./terraformPipelineLayoutProfiles";

import type {
  PipelineLayoutVariant,
  TerraformView,
} from "./terraformImportDialogUtils";
import type { ModulePackingMode } from "./terraformModuleLayoutOptions";

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
    ...(subnetDeBand != null ? { subnetDeBand } : {}),
    ...(deBandLevel != null ? { deBandLevel } : {}),
    ...(rankSeparate != null ? { rankSeparate } : {}),
    ...(straighten != null ? { straighten } : {}),
    ...(deDensify != null ? { deDensify } : {}),
    ...(columnPacking != null ? { columnPacking } : {}),
    ...(profile != null ? { profile } : {}),
    ...(staircaseBandOverlap != null ? { staircaseBandOverlap } : {}),
  };
};

export const hasTerraformDemoAutoImportQuery = (search: string): boolean =>
  parseTerraformDemoUrlParams(search) != null;
