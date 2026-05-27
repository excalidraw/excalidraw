import {
  BUILTIN_TERRAFORM_IMPORT_PRESETS,
  normalizeTerraformImportPreset,
} from "./terraformImportPresetsTypes";
import {
  createTerraformImportPresetViaApi,
  deleteTerraformImportPresetViaApi,
  fetchTerraformImportPresetsFromApi,
  updateTerraformImportPresetViaApi,
} from "./terraformImportPresetsApi";

export type {
  TerraformImportPreset,
  TerraformImportPresetStack,
  TerraformImportPresetView,
} from "./terraformImportPresetsTypes";

export { BUILTIN_TERRAFORM_IMPORT_PRESETS };

export async function listTerraformImportPresets(): Promise<
  import("./terraformImportPresetsTypes").TerraformImportPreset[]
> {
  return fetchTerraformImportPresetsFromApi();
}

export async function getTerraformImportPreset(
  presetId: string,
  presets?: import("./terraformImportPresetsTypes").TerraformImportPreset[],
): Promise<
  import("./terraformImportPresetsTypes").TerraformImportPreset | null
> {
  const list = presets ?? (await listTerraformImportPresets());
  return list.find((preset) => preset.id === presetId) ?? null;
}

export async function saveTerraformImportPreset(
  preset: import("./terraformImportPresetsTypes").TerraformImportPreset,
): Promise<import("./terraformImportPresetsTypes").TerraformImportPreset[]> {
  const normalized = normalizeTerraformImportPreset(preset);
  if (!normalized) {
    throw new Error("Preset is invalid.");
  }
  await createTerraformImportPresetViaApi(normalized);
  return listTerraformImportPresets();
}

export async function updateTerraformImportPreset(
  presetId: string,
  patch: import("./terraformImportPresetsTypes").TerraformImportPreset,
): Promise<import("./terraformImportPresetsTypes").TerraformImportPreset[]> {
  const normalized = normalizeTerraformImportPreset({ ...patch, id: presetId });
  if (!normalized) {
    throw new Error("Preset is invalid.");
  }
  await updateTerraformImportPresetViaApi(presetId, normalized);
  return listTerraformImportPresets();
}

export async function deleteTerraformImportPreset(
  presetId: string,
): Promise<import("./terraformImportPresetsTypes").TerraformImportPreset[]> {
  await deleteTerraformImportPresetViaApi(presetId);
  return listTerraformImportPresets();
}
