import zlib from "node:zlib";

export const GZIP_PREFIX = "gz:b64:";

export function compressPresetText(text) {
  if (text === null || text === undefined) {
    return null;
  }
  const raw = String(text);
  const compressed = zlib.gzipSync(raw, { level: 9 });
  return `${GZIP_PREFIX}${compressed.toString("base64")}`;
}

export function decompressPresetText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = String(value);
  if (!raw.startsWith(GZIP_PREFIX)) {
    return raw;
  }
  const payload = raw.slice(GZIP_PREFIX.length);
  const buffer = Buffer.from(payload, "base64");
  return zlib.gunzipSync(buffer).toString("utf8");
}
