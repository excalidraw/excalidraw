/**
 * Scene, library and realtime payloads are stored as-is in MongoDB. Field names starting with
 * `$` (operator syntax) or `__proto__` have no place in Excalidraw's format and are refused.
 */
export const hasUnsafeKeys = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }
  for (const k of Object.keys(value as object)) {
    if (k.startsWith("$") || k === "__proto__") {
      return true;
    }
  }
  return false;
};

export const SAFE_KEYS_MESSAGE = "field names may not start with '$'";
