import {
  decompressPresetText,
  GZIP_PREFIX,
} from "./terraformPresetCompression.mjs";

/**
 * Resolve preset blob text from SQLite (inline gzip or chunked), matching D1
 * `loadPresetBlobText` in functions/_terraformPresetBlobStorage.ts.
 */
export function loadPresetBlobTextSqlite(
  db,
  presetId,
  blobKind,
  blobKey,
  inlineValue,
) {
  if (inlineValue === null || inlineValue === undefined) {
    return null;
  }

  const raw = String(inlineValue);
  if (!raw.startsWith(`${GZIP_PREFIX}chunks:`)) {
    return decompressPresetText(raw);
  }

  const table = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = 'terraform_import_preset_blob_chunks'`,
    )
    .get();
  if (!table) {
    return null;
  }

  const rows = db
    .prepare(
      `SELECT data
       FROM terraform_import_preset_blob_chunks
       WHERE preset_id = ? AND blob_kind = ? AND blob_key = ?
       ORDER BY chunk_index ASC`,
    )
    .all(presetId, blobKind, blobKey);

  const joined = rows.map((row) => row.data).join("");
  if (!joined) {
    return null;
  }
  return decompressPresetText(joined);
}
