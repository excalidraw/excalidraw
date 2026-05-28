import {
  compressPresetText,
  GZIP_PREFIX,
} from "./terraformPresetCompression.mjs";

/** D1 rejects very long SQL statements; keep chunk payloads under this size. */
export const D1_BLOB_CHUNK_SIZE = 48_000;

export const INLINE_BLOB_MAX_CHARS = 48_000;

export function chunkPresetBlob(text) {
  if (text === null || text === undefined) {
    return { inline: null, chunks: [] };
  }
  const compressed = compressPresetText(text);
  if (compressed.length <= INLINE_BLOB_MAX_CHARS) {
    return { inline: compressed, chunks: [] };
  }
  const chunks = [];
  for (let index = 0; index < compressed.length; index += D1_BLOB_CHUNK_SIZE) {
    chunks.push(compressed.slice(index, index + D1_BLOB_CHUNK_SIZE));
  }
  return { inline: `${GZIP_PREFIX}chunks:${chunks.length}`, chunks };
}

export function joinPresetBlobChunks(chunks) {
  return chunks.join("");
}
