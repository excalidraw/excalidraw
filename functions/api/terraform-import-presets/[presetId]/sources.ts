import {
  getTerraformImportPresetSourcesFromD1,
  PRESET_CACHE_HEADERS,
} from "../../../_terraformPresets";
import { errorResponse, handleOptions, jsonResponse } from "../../../_shared";

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env, params } = context;
  const presetId = params.presetId;
  if (!presetId || Array.isArray(presetId)) {
    return errorResponse(request, "Invalid preset id.", 400);
  }
  if (!env.PRESETS_DB) {
    return errorResponse(request, "Presets database not configured.", 503);
  }
  try {
    const sources = await getTerraformImportPresetSourcesFromD1(
      env.PRESETS_DB,
      presetId,
    );
    if (!sources) {
      return errorResponse(request, "Preset not found.", 404);
    }
    return jsonResponse(request, { sources }, 200, PRESET_CACHE_HEADERS);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sources unavailable.";
    console.error("get terraform import preset sources failed", err);
    return errorResponse(request, message, 400);
  }
};

export const onRequestOptions: PagesFunction = async (context) =>
  handleOptions(context.request, "GET, OPTIONS");
