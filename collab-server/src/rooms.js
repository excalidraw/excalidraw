import { randomBytes } from "node:crypto";

import { config } from "./config.js";
import { pool } from "./db.js";

const createRoomLinkData = () => ({
  roomId: randomBytes(10).toString("hex"),
  roomKey: randomBytes(16).toString("base64url"),
});

const memoryRoomAliases = new Map();

const resolveMemoryRoomAlias = (alias) => {
  const existing = memoryRoomAliases.get(alias);

  if (existing) {
    return existing;
  }

  const roomAlias = { alias, ...createRoomLinkData() };
  memoryRoomAliases.set(alias, roomAlias);
  console.warn(
    `Using in-memory room alias fallback for "${alias}". Room aliases will reset when the collab server restarts.`,
  );

  return roomAlias;
};

const findRoomAlias = async (alias) => {
  const [rows] = await pool.execute(
    `SELECT alias, room_id AS roomId, room_key AS roomKey
     FROM room_aliases
     WHERE alias = :alias
     LIMIT 1`,
    { alias },
  );

  return rows[0] || null;
};

export const resolveRoomAlias = async (alias) => {
  let existing;

  try {
    existing = await findRoomAlias(alias);
  } catch (error) {
    console.error("Failed to read room alias from MySQL", error);
    if (!config.allowMemoryRoomAliasFallback) {
      throw error;
    }
    return resolveMemoryRoomAlias(alias);
  }

  if (existing) {
    return existing;
  }

  const roomLinkData = createRoomLinkData();

  try {
    await pool.execute(
      `INSERT INTO room_aliases (alias, room_id, room_key)
       VALUES (:alias, :roomId, :roomKey)`,
      {
        alias,
        roomId: roomLinkData.roomId,
        roomKey: roomLinkData.roomKey,
      },
    );

    return { alias, ...roomLinkData };
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") {
      console.error("Failed to persist room alias to MySQL", error);
      if (!config.allowMemoryRoomAliasFallback) {
        throw error;
      }
      return resolveMemoryRoomAlias(alias);
    }

    const raced = await findRoomAlias(alias);

    if (raced) {
      return raced;
    }

    throw error;
  }
};
