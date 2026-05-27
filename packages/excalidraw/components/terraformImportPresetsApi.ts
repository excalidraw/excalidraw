import type { TerraformImportPreset } from "./terraformImportPresetsTypes";
import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

const API_BASE = "/api/terraform-import-presets";

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // ignore parse errors
  }
  return `Request failed (${response.status})`;
}

export async function fetchTerraformImportPresetsFromApi(): Promise<
  TerraformImportPreset[]
> {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { presets?: TerraformImportPreset[] };
  return Array.isArray(body.presets) ? body.presets : [];
}

export async function createTerraformImportPresetViaApi(
  preset: TerraformImportPreset,
): Promise<TerraformImportPreset> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { preset: TerraformImportPreset };
  return body.preset;
}

export async function updateTerraformImportPresetViaApi(
  presetId: string,
  preset: TerraformImportPreset,
): Promise<TerraformImportPreset> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(presetId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { preset: TerraformImportPreset };
  return body.preset;
}

export async function deleteTerraformImportPresetViaApi(
  presetId: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(presetId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function fetchTerraformImportPresetSourcesFromApi(
  presetId: string,
): Promise<TerraformImportPresetSources> {
  const response = await fetch(
    `${API_BASE}/${encodeURIComponent(presetId)}/sources`,
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as {
    sources?: TerraformImportPresetSources;
  };
  if (!body.sources) {
    throw new Error("Preset sources response was empty.");
  }
  return body.sources;
}

export async function fetchTerraformImportPresetFromApi(
  presetId: string,
  options: { includeContent?: boolean } = {},
): Promise<TerraformImportPreset> {
  const query = options.includeContent ? "?includeContent=1" : "";
  const response = await fetch(
    `${API_BASE}/${encodeURIComponent(presetId)}${query}`,
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { preset: TerraformImportPreset };
  return body.preset;
}

export async function syncTerraformImportPresetFromDiskViaApi(
  presetId: string,
): Promise<TerraformImportPreset> {
  const response = await fetch(
    `${API_BASE}/${encodeURIComponent(presetId)}/sync-from-disk`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { preset: TerraformImportPreset };
  return body.preset;
}
