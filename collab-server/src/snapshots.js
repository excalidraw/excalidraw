import { pool } from "./db.js";
import { listLatestScenes } from "./redis.js";

export const saveSceneSnapshot = async ({
  roomId,
  encryptedData,
  iv,
  source = "hourly",
}) => {
  await pool.execute(
    `INSERT INTO room_scene_snapshots (room_id, encrypted_data, iv, source)
     VALUES (:roomId, :encryptedData, :iv, :source)`,
    {
      roomId,
      encryptedData: Buffer.from(encryptedData, "base64"),
      iv: Buffer.from(iv, "base64"),
      source,
    },
  );
};

export const saveLatestSceneSnapshot = async ({ roomId, encryptedData, iv }) => {
  await pool.execute(
    `INSERT INTO room_scene_latest (room_id, encrypted_data, iv)
     VALUES (:roomId, :encryptedData, :iv)
     ON DUPLICATE KEY UPDATE
       encrypted_data = VALUES(encrypted_data),
       iv = VALUES(iv),
       updated_at = CURRENT_TIMESTAMP`,
    {
      roomId,
      encryptedData: Buffer.from(encryptedData, "base64"),
      iv: Buffer.from(iv, "base64"),
    },
  );
};

export const saveHourlySnapshotsFromRedis = async () => {
  const latestScenes = await listLatestScenes();

  for (const scene of latestScenes) {
    await saveSceneSnapshot({
      roomId: scene.roomId,
      encryptedData: scene.encryptedData,
      iv: scene.iv,
      source: "hourly",
    });
  }

  if (latestScenes.length > 0) {
    console.log(`Saved ${latestScenes.length} hourly scene snapshot(s)`);
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
