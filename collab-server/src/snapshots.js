import { createHash } from "node:crypto";

import { config } from "./config.js";
import { pool } from "./db.js";
import { listLatestScenes } from "./redis.js";
import { findRoomAliasByRoomId } from "./rooms.js";

const formatRoomDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.roomAlias.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

const getSceneContentHash = ({ encryptedData, iv }) =>
  createHash("sha256")
    .update(encryptedData)
    .update(":")
    .update(iv)
    .digest("hex");

const getSnapshotContentHash = ({ encryptedData, iv, contentHash }) =>
  contentHash || getSceneContentHash({ encryptedData, iv });

const isRecentlyUpdated = (scene) => {
  if (!scene.updatedAt) {
    return true;
  }

  const updatedAt = Date.parse(scene.updatedAt);

  if (!Number.isFinite(updatedAt)) {
    return true;
  }

  return (
    Date.now() - updatedAt <=
    config.scene.historySnapshotIntervalMs + 60_000
  );
};

const getRoomArchiveState = async (roomId) => {
  const roomAlias = await findRoomAliasByRoomId(roomId);

  if (!roomAlias?.alias) {
    return "unknown";
  }

  return roomAlias.alias === formatRoomDate(new Date()) ? "current" : "archive";
};

const hasArchiveFinalSnapshot = async (roomId) => {
  const [rows] = await pool.execute(
    `SELECT id
       FROM room_scene_snapshots
      WHERE room_id = :roomId
        AND source = 'archive-final'
      LIMIT 1`,
    { roomId },
  );

  return !!rows[0];
};

const deleteHistorySnapshots = async (roomId) => {
  const [result] = await pool.execute(
    `DELETE FROM room_scene_snapshots
      WHERE room_id = :roomId
        AND source = 'history'`,
    { roomId },
  );

  return result.affectedRows || 0;
};

const getLatestSnapshotHash = async (roomId) => {
  const [rows] = await pool.execute(
    `SELECT content_hash
       FROM room_scene_snapshots
      WHERE room_id = :roomId
   ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    { roomId },
  );

  return rows[0]?.content_hash || null;
};

export const saveSceneSnapshot = async ({
  roomId,
  encryptedData,
  iv,
  contentHash,
  source = "history",
  skipUnchanged = true,
}) => {
  const snapshotContentHash = getSnapshotContentHash({
    encryptedData,
    iv,
    contentHash,
  });
  const latestSnapshotHash = skipUnchanged
    ? await getLatestSnapshotHash(roomId)
    : null;

  if (latestSnapshotHash === snapshotContentHash) {
    return false;
  }

  await pool.execute(
    `INSERT INTO room_scene_snapshots (room_id, encrypted_data, iv, content_hash, source)
     VALUES (:roomId, :encryptedData, :iv, :contentHash, :source)`,
    {
      roomId,
      encryptedData: Buffer.from(encryptedData, "base64"),
      iv: Buffer.from(iv, "base64"),
      contentHash: snapshotContentHash,
      source,
    },
  );

  return true;
};

const saveArchiveFinalSnapshot = async ({
  roomId,
  encryptedData,
  iv,
  contentHash,
}) => {
  const saved = await saveSceneSnapshot({
    roomId,
    encryptedData,
    iv,
    contentHash,
    source: "archive-final",
    skipUnchanged: false,
  });
  const deletedHistoryCount = await deleteHistorySnapshots(roomId);

  return { saved, deletedHistoryCount };
};

export const saveLatestSceneSnapshot = async ({
  roomId,
  encryptedData,
  iv,
  contentHash,
}) => {
  const nextEncryptedData = Buffer.from(encryptedData, "base64");
  const nextIv = Buffer.from(iv, "base64");
  const nextContentHash = getSnapshotContentHash({
    encryptedData,
    iv,
    contentHash,
  });
  const [latestRows] = await pool.execute(
    `SELECT room_id, encrypted_data, iv, content_hash
       FROM room_scene_latest
      WHERE room_id = :roomId
      LIMIT 1`,
    { roomId },
  );
  const latestScene = latestRows[0];

  if (
    latestScene &&
    nextEncryptedData.length <= 128 &&
    latestScene.encrypted_data.length > 1024
  ) {
    await saveSceneSnapshot({
      roomId,
      encryptedData: Buffer.from(latestScene.encrypted_data).toString("base64"),
      iv: Buffer.from(latestScene.iv).toString("base64"),
      contentHash: latestScene.content_hash,
      source: "before-small-overwrite",
    });
  }

  await pool.execute(
    `INSERT INTO room_scene_latest (room_id, encrypted_data, iv, content_hash)
     VALUES (:roomId, :encryptedData, :iv, :contentHash)
     ON DUPLICATE KEY UPDATE
       encrypted_data = VALUES(encrypted_data),
       iv = VALUES(iv),
       content_hash = VALUES(content_hash),
       updated_at = CURRENT_TIMESTAMP`,
    {
      roomId,
      encryptedData: nextEncryptedData,
      iv: nextIv,
      contentHash: nextContentHash,
    },
  );
};

export const saveHistorySnapshotsFromRedis = async () => {
  const latestScenes = await listLatestScenes();
  let savedCount = 0;
  let skippedCount = 0;
  let archiveFinalCount = 0;
  let deletedHistoryCount = 0;
  let readOnlyCount = 0;

  for (const scene of latestScenes) {
    const roomArchiveState = await getRoomArchiveState(scene.roomId);

    if (roomArchiveState === "archive") {
      if (await hasArchiveFinalSnapshot(scene.roomId)) {
        deletedHistoryCount += await deleteHistorySnapshots(scene.roomId);
        readOnlyCount++;
        continue;
      }

      const archiveFinal = await saveArchiveFinalSnapshot({
        roomId: scene.roomId,
        encryptedData: scene.encryptedData,
        iv: scene.iv,
        contentHash: scene.contentHash,
      });
      deletedHistoryCount += archiveFinal.deletedHistoryCount;

      if (archiveFinal.saved) {
        archiveFinalCount++;
      } else {
        skippedCount++;
      }

      continue;
    }

    if (roomArchiveState !== "current") {
      readOnlyCount++;
      continue;
    }

    if (!isRecentlyUpdated(scene)) {
      skippedCount++;
      continue;
    }

    const saved = await saveSceneSnapshot({
      roomId: scene.roomId,
      encryptedData: scene.encryptedData,
      iv: scene.iv,
      contentHash: scene.contentHash,
      source: "history",
    });

    if (saved) {
      savedCount++;
    } else {
      skippedCount++;
    }
  }

  if (
    savedCount > 0 ||
    archiveFinalCount > 0 ||
    skippedCount > 0 ||
    deletedHistoryCount > 0
  ) {
    console.log(
      `Saved ${savedCount} history scene snapshot(s), saved ${archiveFinalCount} archive-final snapshot(s), deleted ${deletedHistoryCount} archived history snapshot(s), skipped ${skippedCount} unchanged snapshot(s), skipped ${readOnlyCount} read-only room(s)`,
    );
  }
};

const formatSnapshot = (snapshot) => {
  if (!snapshot) {
    return null;
  }

  return {
    roomId: snapshot.room_id,
    encryptedData: Buffer.from(snapshot.encrypted_data).toString("base64"),
    iv: Buffer.from(snapshot.iv).toString("base64"),
    contentHash: snapshot.content_hash || null,
    updatedAt: snapshot.updated_at || snapshot.created_at,
  };
};

export const getLatestSceneFromMysql = async (roomId) => {
  const [latestRows] = await pool.execute(
    `SELECT room_id, encrypted_data, iv, content_hash, updated_at
       FROM room_scene_latest
      WHERE room_id = :roomId
      LIMIT 1`,
    { roomId },
  );

  if (latestRows[0]) {
    return formatSnapshot(latestRows[0]);
  }

  return getLatestSceneSnapshot(roomId);
};

export const getLatestSceneSnapshot = async (roomId) => {
  const [rows] = await pool.execute(
    `SELECT room_id, encrypted_data, iv, content_hash, created_at
       FROM room_scene_snapshots
      WHERE room_id = :roomId
   ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    { roomId },
  );

  const snapshot = rows[0];

  return formatSnapshot(snapshot);
};
