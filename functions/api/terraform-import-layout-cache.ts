import {
  buildLayoutCacheKey,
  getLayoutCache,
  LAYOUT_CACHE_HEADERS,
  parseLayoutCacheQuery,
} from "../_terraformLayoutCache";
import { errorResponse, handleOptions, jsonResponse } from "../_shared";

export const onRequestGet: PagesFunction = async (context) => {
  const { request, env } = context;
  const parsed = parseLayoutCacheQuery(new URL(request.url));
  if (!parsed) {
    return errorResponse(
      request,
      "Query params required: v, preset, view; optional pack when view=module.",
      400,
    );
  }
  if (!env.LAYOUT_CACHE) {
    return errorResponse(request, "Layout cache not configured.", 503);
  }
  try {
    const key = buildLayoutCacheKey(
      parsed.version,
      parsed.presetId,
      parsed.view,
      parsed.pack,
    );
    const scene = await getLayoutCache(env.LAYOUT_CACHE, key);
    if (!scene) {
      return errorResponse(request, "Layout cache miss.", 404);
    }
    return jsonResponse(request, { scene }, 200, LAYOUT_CACHE_HEADERS);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Layout cache unavailable.";
    console.error("get terraform layout cache failed", err);
    return errorResponse(request, message, 400);
  }
};

export const onRequestOptions: PagesFunction = async (context) =>
  handleOptions(context.request, "GET, OPTIONS");
