import {
  listTerraformImportPresetsFromD1,
  PRESET_CACHE_HEADERS,
} from "../_terraformPresets";
import { errorResponse, handleOptions, jsonResponse } from "../_shared";

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env } = context;
  if (!env.PRESETS_DB) {
    return errorResponse(request, "Presets database not configured.", 503);
  }
  try {
    const presets = await listTerraformImportPresetsFromD1(env.PRESETS_DB);
    return jsonResponse(request, { presets }, 200, PRESET_CACHE_HEADERS);
  } catch (err) {
    console.error("list terraform import presets failed", err);
    return errorResponse(request, "Failed to list presets.", 500);
  }
};

export const onRequestOptions: PagesFunction = async (context) =>
  handleOptions(context.request, "GET, OPTIONS");
