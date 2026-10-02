import { z } from "zod";

import { hasUnsafeKeys, SAFE_KEYS_MESSAGE } from "./security/objectKeys";

export const MAX_ELEMENTS = 50_000;
export const MAX_SCENE_BYTES = 10 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 150 * 1024;
export const MAX_TEXT_INDEX = 20_000;

const element = z
  .object({
    id: z.string().min(1).max(128),
    type: z.string().min(1).max(32),
    version: z.number().optional(),
  })
  .passthrough()
  .refine((el) => !hasUnsafeKeys(el), SAFE_KEYS_MESSAGE);

/** Only document-level settings persist; viewport/tool state stays per-user. */
const APP_STATE_KEYS = [
  "viewBackgroundColor",
  "gridSize",
  "gridStep",
  "gridModeEnabled",
  "frameRendering",
] as const;

export const sceneDataSchema = z.object({
  elements: z.array(element).max(MAX_ELEMENTS),
  appState: z.record(z.unknown()).default({}),
});

const UNSAFE_URL = /^\s*(javascript|vbscript|data):/i;

export const sanitizeSceneData = (input: z.infer<typeof sceneDataSchema>) => {
  const elements = input.elements.map((el) => {
    const link = (el as any).link;
    return typeof link === "string" && UNSAFE_URL.test(link)
      ? { ...el, link: null }
      : el;
  });
  const appState: Record<string, unknown> = {};
  for (const k of APP_STATE_KEYS) {
    if (k in input.appState) {
      appState[k] = input.appState[k];
    }
  }
  return { elements, appState };
};

export const extractText = (elements: Record<string, any>[]) => {
  const parts: string[] = [];
  let len = 0;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    const t =
      el.type === "text"
        ? el.text
        : el.type === "frame" || el.type === "magicframe"
        ? el.name
        : null;
    if (typeof t === "string" && t) {
      parts.push(t);
      len += t.length;
      if (len > MAX_TEXT_INDEX) {
        break;
      }
    }
  }
  return parts.join("\n").slice(0, MAX_TEXT_INDEX);
};

export const extractFileIds = (elements: Record<string, any>[]) => {
  const ids = new Set<string>();
  for (const el of elements) {
    if (!el.isDeleted && el.type === "image" && typeof el.fileId === "string") {
      ids.add(el.fileId);
    }
  }
  return [...ids];
};

export const thumbnailSchema = z
  .string()
  .max(MAX_THUMBNAIL_BYTES)
  .regex(
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
    "invalid thumbnail",
  );

export const buildSceneFields = (raw: z.infer<typeof sceneDataSchema>) => {
  const data = sanitizeSceneData(raw);
  const sizeBytes = Buffer.byteLength(JSON.stringify(data));
  return {
    data,
    sizeBytes,
    textContent: extractText(data.elements as any),
    fileIds: extractFileIds(data.elements as any),
  };
};
