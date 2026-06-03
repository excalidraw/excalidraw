import fs from "node:fs";

import Database from "better-sqlite3";

import { loadPresetBlobTextSqlite } from "./loadPresetBlobTextSqlite.mjs";
import { chunkPresetBlob } from "./terraformPresetBlobStorage.mjs";

function measureInlineAndChunks(packed) {
  if (!packed?.inline) {
    return 0;
  }
  return (
    packed.inline.length +
    packed.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  );
}

function plainTextFromStored(db, presetId, blobKind, blobKey, inlineValue) {
  if (inlineValue === null || inlineValue === undefined) {
    return null;
  }
  return loadPresetBlobTextSqlite(db, presetId, blobKind, blobKey, inlineValue);
}

/**
 * Strip duplicate artifact/composition rows, gzip-compress stack and TFD blobs
 * (with chunk overflow), and VACUUM the database file.
 *
 * @param {import("better-sqlite3").Database | string} dbOrPath
 */
export function compactTerraformImportPresetDb(dbOrPath) {
  const owned = typeof dbOrPath === "string";
  const dbPath = owned ? dbOrPath : null;
  const db =
    typeof dbOrPath === "string" ? new Database(dbOrPath) : dbOrPath;

  const artifactRowsDeleted = db
    .prepare(`SELECT COUNT(*) AS count FROM terraform_import_artifacts`)
    .get().count;
  const compositionRowsDeleted = db
    .prepare(`SELECT COUNT(*) AS count FROM terraform_import_compositions`)
    .get().count;

  const stacks = db
    .prepare(
      `SELECT preset_id AS presetId, sort_order AS sortOrder, stack_id AS stackId,
              plan_text AS planText, dot_text AS dotText, state_text AS stateText
       FROM terraform_import_preset_stacks
       ORDER BY preset_id ASC, sort_order ASC`,
    )
    .all();

  const tfdRows = db
    .prepare(
      `SELECT preset_id AS presetId, sort_order AS sortOrder, path, content
       FROM terraform_import_preset_tfd
       ORDER BY preset_id ASC, sort_order ASC`,
    )
    .all();

  const stackPlain = stacks.map((row) => ({
    presetId: row.presetId,
    sortOrder: row.sortOrder,
    stackId: row.stackId,
    planText: plainTextFromStored(
      db,
      row.presetId,
      "plan",
      row.stackId,
      row.planText,
    ),
    dotText: plainTextFromStored(
      db,
      row.presetId,
      "dot",
      row.stackId,
      row.dotText,
    ),
    stateText: plainTextFromStored(
      db,
      row.presetId,
      "state",
      row.stackId,
      row.stateText,
    ),
  }));

  const tfdPlain = tfdRows.map((row) => ({
    presetId: row.presetId,
    sortOrder: row.sortOrder,
    path: row.path,
    content: plainTextFromStored(db, row.presetId, "tfd", row.path, row.content),
  }));

  db.prepare(`DELETE FROM terraform_import_artifacts`).run();
  db.prepare(`DELETE FROM terraform_import_compositions`).run();
  db.prepare(`DELETE FROM terraform_import_preset_blob_chunks`).run();

  const updateStack = db.prepare(
    `UPDATE terraform_import_preset_stacks
     SET plan_text = ?, dot_text = ?, state_text = ?
     WHERE preset_id = ? AND sort_order = ?`,
  );

  const insertChunk = db.prepare(
    `INSERT INTO terraform_import_preset_blob_chunks
     (preset_id, blob_kind, blob_key, chunk_index, data)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const updateTfd = db.prepare(
    `UPDATE terraform_import_preset_tfd SET content = ? WHERE preset_id = ? AND sort_order = ?`,
  );

  let stacksRawBytes = 0;
  let stacksCompressedBytes = 0;
  let chunkCount = 0;

  const writePackedBlobs = (presetId, blobKind, blobKey, plainText) => {
    if (plainText === null || plainText === undefined) {
      return null;
    }
    stacksRawBytes += plainText.length;
    const packed = chunkPresetBlob(plainText);
    stacksCompressedBytes += measureInlineAndChunks(packed);
    packed.chunks.forEach((data, chunkIndex) => {
      insertChunk.run(presetId, blobKind, blobKey, chunkIndex, data);
      chunkCount += 1;
    });
    return packed.inline;
  };

  for (const row of stackPlain) {
    const planInline = writePackedBlobs(
      row.presetId,
      "plan",
      row.stackId,
      row.planText,
    );
    const dotInline = writePackedBlobs(
      row.presetId,
      "dot",
      row.stackId,
      row.dotText,
    );
    const stateInline = writePackedBlobs(
      row.presetId,
      "state",
      row.stackId,
      row.stateText,
    );
    updateStack.run(
      planInline,
      dotInline,
      stateInline,
      row.presetId,
      row.sortOrder,
    );
  }

  for (const row of tfdPlain) {
    if (!row.content) {
      continue;
    }
    stacksRawBytes += row.content.length;
    const packed = chunkPresetBlob(row.content);
    stacksCompressedBytes += measureInlineAndChunks(packed);
    packed.chunks.forEach((data, chunkIndex) => {
      insertChunk.run(row.presetId, "tfd", row.path, chunkIndex, data);
      chunkCount += 1;
    });
    updateTfd.run(packed.inline, row.presetId, row.sortOrder);
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec("VACUUM");

  if (owned) {
    db.close();
  }

  const fileBytes =
    dbPath && fs.existsSync(dbPath) ? fs.statSync(dbPath).size : null;

  return {
    fileBytes,
    stacksRawBytes,
    stacksCompressedBytes,
    chunkCount,
    artifactRowsDeleted,
    compositionRowsDeleted,
  };
}

export function formatCompactStats(stats) {
  const mb = (bytes) =>
    bytes == null ? "?" : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return [
    `file ${mb(stats.fileBytes)}`,
    `stacks ${mb(stats.stacksRawBytes)} raw → ${mb(stats.stacksCompressedBytes)} compressed`,
    `${stats.chunkCount} blob chunk(s)`,
    `removed ${stats.artifactRowsDeleted} artifact + ${stats.compositionRowsDeleted} composition row(s)`,
  ].join(", ");
}
