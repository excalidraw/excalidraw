import type { TerraformView } from "./terraformImportDialogUtils";
import type { ModulePackingMode } from "./terraformModuleLayoutOptions";

export type TerraformDemoUrlParams = {
  presetId: string;
  view?: TerraformView;
  pack?: ModulePackingMode;
};

const PRESET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const VALID_VIEWS = new Set<TerraformView>(["module", "semantic", "pipeline"]);
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

  return { presetId, ...(view ? { view } : {}), ...(pack ? { pack } : {}) };
};

export const hasTerraformDemoAutoImportQuery = (search: string): boolean =>
  parseTerraformDemoUrlParams(search) != null;
