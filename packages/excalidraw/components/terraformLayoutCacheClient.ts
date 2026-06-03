import type { TerraformModuleLayoutOptions } from "./terraformModuleLayoutOptions";
import type { TerraformExcalidrawScenePayload } from "./terraformSceneApply";
import type { TerraformView } from "./terraformImportDialogUtils";

const LAYOUT_CACHE_API = "/api/terraform-import-layout-cache";

export function getTerraformLayoutCacheVersion(): string {
  const raw =
    typeof import.meta.env.VITE_TERRAFORM_LAYOUT_CACHE_VERSION === "string"
      ? import.meta.env.VITE_TERRAFORM_LAYOUT_CACHE_VERSION.trim()
      : "";
  return raw.slice(0, 12);
}

export function buildPresetLayoutCacheUrl(
  presetId: string,
  view: TerraformView,
  moduleLayoutOptions?: TerraformModuleLayoutOptions,
): string | null {
  const version = getTerraformLayoutCacheVersion();
  if (!version) {
    return null;
  }
  const params = new URLSearchParams({
    v: version,
    preset: presetId,
    view,
  });
  if (view === "module") {
    params.set("pack", moduleLayoutOptions?.mode ?? "default");
  }
  return `${LAYOUT_CACHE_API}?${params.toString()}`;
}

export async function fetchPresetLayoutCache(
  presetId: string,
  view: TerraformView,
  moduleLayoutOptions?: TerraformModuleLayoutOptions,
  init?: RequestInit,
): Promise<TerraformExcalidrawScenePayload | null> {
  const url = buildPresetLayoutCacheUrl(presetId, view, moduleLayoutOptions);
  if (!url) {
    return null;
  }
  const res = await fetch(url, init);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as {
    scene?: TerraformExcalidrawScenePayload;
  };
  if (!body.scene || typeof body.scene !== "object") {
    return null;
  }
  return body.scene;
}
