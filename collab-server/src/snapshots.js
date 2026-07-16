import { createHash } from "node:crypto";

import { config } from "./config.js";
import { pool } from "./db.js";
import { listLatestScenes } from "./redis.js";

const getSceneContentHash = ({ encryptedData, iv }) =>
  createHash("sha256")
    .update(encryptedData)
    .update(":")
    .update(iv)
    .digest("hex");

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
  source = "history",
}) => {
  const contentHash = getSceneContentHash({ encryptedData, iv });
  const latestSnapshotHash = await getLatestSnapshotHash(roomId);

  if (latestSnapshotHash === contentHash) {
    return false;
  }

  await pool.execute(
    `INSERT INTO room_scene_snapshots (room_id, encrypted_data, iv, content_hash, source)
     VALUES (:roomId, :encryptedData, :iv, :contentHash, :source)`,
    {
      roomId,
      encryptedData: Buffer.from(encryptedData, "base64"),
      iv: Buffer.from(iv, "base64"),
      contentHash,
      source,
    },
  );

  return true;
};

export const saveLatestSceneSnapshot = async ({ roomId, encryptedData, iv }) => {
  const nextEncryptedData = Buffer.from(encryptedData, "base64");
  const nextIv = Buffer.from(iv, "base64");
  const [latestRows] = await pool.execute(
    `SELECT room_id, encrypted_data, iv
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
      source: "before-small-overwrite",
    });
  }

  await pool.execute(
    `INSERT INTO room_scene_latest (room_id, encrypted_data, iv)
     VALUES (:roomId, :encryptedData, :iv)
     ON DUPLICATE KEY UPDATE
       encrypted_data = VALUES(encrypted_data),
       iv = VALUES(iv),
       updated_at = CURRENT_TIMESTAMP`,
    {
      roomId,
      encryptedData: nextEncryptedData,
      iv: nextIv,
    },
  );
};

export const saveHistorySnapshotsFromRedis = async () => {
  const latestScenes = (await listLatestScenes()).filter(isRecentlyUpdated);
  let savedCount = 0;
  let skippedCount = 0;

  for (const scene of latestScenes) {
    const saved = await saveSceneSnapshot({
      roomId: scene.roomId,
      encryptedData: scene.encryptedData,
      iv: scene.iv,
      source: "history",
    });

    if (saved) {
      savedCount++;
    } else {
      skippedCount++;
    }
  }

  if (savedCount > 0 || skippedCount > 0) {
    console.log(
      `Saved ${savedCount} history scene snapshot(s), skipped ${skippedCount} unchanged snapshot(s)`,
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
    updatedAt: snapshot.updated_at || snapshot.created_at,
  };
};

export const getLatestSceneFromMysql = async (roomId) => {
  const [latestRows] = await pool.execute(
    `SELECT room_id, encrypted_data, iv, updated_at
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
    `SELECT room_id, encrypted_data, iv, created_at
       FROM room_scene_snapshots
      WHERE room_id = :roomId
   ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    { roomId },
  );

  const snapshot = rows[0];

  return formatSnapshot(snapshot);
};
