import { GZIP_PREFIX } from "./_terraformPresetCompression";

/** Minimal KV surface for layout cache (Pages `LAYOUT_CACHE` binding). */
export type LayoutCacheKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { cursor?: string; limit?: number }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
};

export type TerraformLayoutCacheView = "semantic" | "module" | "pipeline";

export type ModuleLayoutPack = "default" | "box" | "rectpacking";

export const MODULE_LAYOUT_PACKS: readonly ModuleLayoutPack[] = [
  "default",
  "box",
  "rectpacking",
];

export const LAYOUT_CACHE_MAX_VALUE_BYTES = 20 * 1024 * 1024;

export const LAYOUT_CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "public, max-age=31536000, immutable",
};

export type TerraformLayoutCacheScene = {
  elements?: unknown;
  files?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export function normalizeLayoutCacheVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) {
    throw new Error("Layout cache version is required.");
  }
  const short = trimmed.slice(0, 12);
  if (!/^[a-zA-Z0-9._-]+$/.test(short)) {
    throw new Error("Invalid layout cache version.");
  }
  return short;
}

export function buildLayoutCacheKey(
  version: string,
  presetId: string,
  view: TerraformLayoutCacheView,
  pack?: ModuleLayoutPack,
): string {
  const v = normalizeLayoutCacheVersion(version);
  const safePreset = presetId.trim();
  if (!safePreset || /[/\s]/.test(safePreset)) {
    throw new Error("Invalid preset id for layout cache key.");
  }
  if (view === "module") {
    const p = pack ?? "default";
    if (!MODULE_LAYOUT_PACKS.includes(p)) {
      throw new Error(`Invalid module pack: ${p}`);
    }
    return `v${v}/${safePreset}/${view}/${p}`;
  }
  return `v${v}/${safePreset}/${view}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(payload: string): Uint8Array {
  return Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
}

function canUseWebStreamsCompression(): boolean {
  return (
    typeof CompressionStream !== "undefined" &&
    typeof DecompressionStream !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof Blob.prototype.stream === "function"
  );
}

async function gzipUtf8(json: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(json);
  if (canUseWebStreamsCompression()) {
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { gzipSync } = await import("node:zlib");
  return gzipSync(bytes);
}

async function gunzipUtf8(compressed: Uint8Array): Promise<string> {
  if (canUseWebStreamsCompression()) {
    const stream = new Blob([new Uint8Array(compressed)])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }
  const { gunzipSync } = await import("node:zlib");
  return new TextDecoder().decode(gunzipSync(compressed));
}

export async function compressLayoutCacheScene(
  scene: TerraformLayoutCacheScene,
): Promise<string> {
  const json = JSON.stringify(scene);
  const compressed = await gzipUtf8(json);
  return `${GZIP_PREFIX}${bytesToBase64(compressed)}`;
}

export async function decompressLayoutCacheScene(
  stored: string,
): Promise<TerraformLayoutCacheScene | null> {
  if (!stored.startsWith(GZIP_PREFIX)) {
    return null;
  }
  const payload = stored.slice(GZIP_PREFIX.length);
  const json = await gunzipUtf8(base64ToBytes(payload));
  return JSON.parse(json) as TerraformLayoutCacheScene;
}

export async function getLayoutCache(
  kv: LayoutCacheKv,
  key: string,
): Promise<TerraformLayoutCacheScene | null> {
  const stored = await kv.get(key);
  if (!stored) {
    return null;
  }
  return decompressLayoutCacheScene(stored);
}

export async function putLayoutCache(
  kv: LayoutCacheKv,
  key: string,
  scene: TerraformLayoutCacheScene,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const stored = await compressLayoutCacheScene(scene);
  if (stored.length > LAYOUT_CACHE_MAX_VALUE_BYTES) {
    return {
      ok: false,
      reason: `Compressed scene exceeds ${LAYOUT_CACHE_MAX_VALUE_BYTES} bytes (${stored.length}).`,
    };
  }
  await kv.put(key, stored);
  return { ok: true };
}

/** List and delete all keys in the layout cache namespace (master deploy purge). */
export async function purgeLayoutCacheNamespace(kv: LayoutCacheKv): Promise<{
  deleted: number;
}> {
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await kv.list({ cursor, limit: 1000 });
    if (page.keys.length > 0) {
      await Promise.all(
        page.keys.map((entry: { name: string }) => kv.delete(entry.name)),
      );
      deleted += page.keys.length;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { deleted };
}

export function parseLayoutCacheQuery(url: URL): {
  version: string;
  presetId: string;
  view: TerraformLayoutCacheView;
  pack?: ModuleLayoutPack;
} | null {
  const version = url.searchParams.get("v")?.trim() ?? "";
  const presetId = url.searchParams.get("preset")?.trim() ?? "";
  const view = url.searchParams.get("view")?.trim() as
    | TerraformLayoutCacheView
    | undefined;
  if (!version || !presetId || !view) {
    return null;
  }
  if (view !== "semantic" && view !== "module" && view !== "pipeline") {
    return null;
  }
  const packRaw = url.searchParams.get("pack")?.trim();
  if (view === "module") {
    const pack = (packRaw || "default") as ModuleLayoutPack;
    if (!MODULE_LAYOUT_PACKS.includes(pack)) {
      return null;
    }
    return { version, presetId, view, pack };
  }
  if (packRaw) {
    return null;
  }
  return { version, presetId, view };
}
