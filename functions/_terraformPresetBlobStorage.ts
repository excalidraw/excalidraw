import {
  decompressPresetText,
  GZIP_PREFIX,
} from "./_terraformPresetCompression";

export const INLINE_BLOB_MAX_CHARS = 48_000;

export async function loadPresetBlobText(
  db: D1Database,
  presetId: string,
  blobKind: string,
  blobKey: string,
  inlineValue: string | null,
): Promise<string | null> {
  if (inlineValue === null || inlineValue === undefined) {
    return null;
  }

  if (!inlineValue.startsWith(`${GZIP_PREFIX}chunks:`)) {
    return decompressPresetText(inlineValue);
  }

  const chunkRows = await db
    .prepare(
      `SELECT chunk_index, data
       FROM terraform_import_preset_blob_chunks
       WHERE preset_id = ? AND blob_kind = ? AND blob_key = ?
       ORDER BY chunk_index ASC`,
    )
    .bind(presetId, blobKind, blobKey)
    .all<{ chunk_index: number; data: string }>();

  const joined = (chunkRows.results ?? []).map((row) => row.data).join("");
  if (!joined) {
    return null;
  }
  return decompressPresetText(joined);
}
