import type {
  PipelineLayoutVariant,
  TerraformView,
} from "./terraformImportDialogUtils";
import type { ModulePackingMode } from "./terraformModuleLayoutOptions";

export type TerraformDemoUrlParams = {
  presetId: string;
  view?: TerraformView;
  pack?: ModulePackingMode;
  pipelineVariant?: PipelineLayoutVariant;
  packed?: boolean;
  packedPullLeft?: boolean;
  ancillary?: boolean;
  semanticPlace?: boolean;
};

const PRESET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const VALID_VIEWS = new Set<TerraformView>(["module", "semantic", "pipeline"]);
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
  const ancillary = parseBooleanParam("ancillary");
  if (ancillary === null) {
    return null;
  }
  const semanticPlace = parseBooleanParam("semanticPlace");
  if (semanticPlace === null) {
    return null;
  }

  return {
    presetId,
    ...(view ? { view } : {}),
    ...(pack ? { pack } : {}),
    ...(pipelineVariant ? { pipelineVariant } : {}),
    ...(packed != null ? { packed } : {}),
    ...(packedPullLeft != null ? { packedPullLeft } : {}),
    ...(ancillary != null ? { ancillary } : {}),
    ...(semanticPlace != null ? { semanticPlace } : {}),
  };
};

export const hasTerraformDemoAutoImportQuery = (search: string): boolean =>
  parseTerraformDemoUrlParams(search) != null;
