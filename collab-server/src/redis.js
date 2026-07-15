import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

import { config } from "./config.js";

const PRESENCE_TTL_SECONDS = 45;
const LATEST_SCENE_KEY_PREFIX = "room:scene:latest:";

let redisClient = null;

const redactRedisUrl = (url) => {
  try {
    const parsed = new URL(url);

    if (parsed.password) {
      parsed.password = "***";
    }

    return parsed.toString();
  } catch {
    return "<invalid redis url>";
  }
};

const normalizeRedisKey = (key) => {
  if (typeof key === "string") {
    return key;
  }

  if (Buffer.isBuffer(key)) {
    return key.toString();
  }

  return String(key);
};

const canUseRedis = () => redisClient?.isReady;

export const setupRedis = async (io) => {
  const pubClient = createClient({
    url: config.redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (error) => {
    console.warn("Redis pub client error", error.message);
  });
  subClient.on("error", (error) => {
    console.warn("Redis sub client error", error.message);
  });

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    redisClient = pubClient;
    console.log(`Redis adapter connected: ${redactRedisUrl(config.redisUrl)}`);
  } catch (error) {
    console.warn(
      `Redis unavailable, continuing with single-instance Socket.IO: ${error.message}`,
    );
    for (const client of [pubClient, subClient]) {
      try {
        client.destroy();
      } catch {
        // The client may already be closed after a failed connect attempt.
      }
    }
  }
};

export const markSocketOnline = async ({ roomId, socketId }) => {
  if (!canUseRedis()) {
    return;
  }

  try {
    await redisClient
      .multi()
      .sAdd(`presence:room:${roomId}`, socketId)
      .set(`presence:socket:${socketId}`, roomId, { EX: PRESENCE_TTL_SECONDS })
      .expire(`presence:room:${roomId}`, PRESENCE_TTL_SECONDS)
      .exec();
  } catch (error) {
    console.warn("Failed to mark socket online in Redis", error.message);
  }
};

export const markSocketOffline = async ({ roomId, socketId }) => {
  if (!canUseRedis()) {
    return;
  }

  try {
    await redisClient
      .multi()
      .sRem(`presence:room:${roomId}`, socketId)
      .del(`presence:socket:${socketId}`)
      .exec();
  } catch (error) {
    console.warn("Failed to mark socket offline in Redis", error.message);
  }
};

export const getRoomPresence = async (roomId) => {
  if (!canUseRedis()) {
    return null;
  }

  try {
    return await redisClient.sMembers(`presence:room:${roomId}`);
  } catch (error) {
    console.warn("Failed to read room presence from Redis", error.message);
    return null;
  }
};

export const saveLatestScene = async ({ roomId, encryptedData, iv }) => {
  if (!canUseRedis()) {
    return false;
  }

  const value = JSON.stringify({
    roomId,
    encryptedData: Buffer.from(encryptedData).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    updatedAt: new Date().toISOString(),
  });
  const latestSceneKey = `${LATEST_SCENE_KEY_PREFIX}${roomId}`;

  if (config.scene.latestTtlSeconds > 0) {
    await redisClient.set(latestSceneKey, value, {
      EX: config.scene.latestTtlSeconds,
    });
    return true;
  }

  await redisClient.set(
    latestSceneKey,
    value,
  );

  return true;
};

export const getLatestScene = async (roomId) => {
  if (!canUseRedis()) {
    return null;
  }

  let raw;

  try {
    raw = await redisClient.get(`${LATEST_SCENE_KEY_PREFIX}${roomId}`);
  } catch (error) {
    console.warn("Failed to read latest scene from Redis", error.message);
    return null;
  }

  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
};

export const listLatestScenes = async () => {
  if (!canUseRedis()) {
    return [];
  }

  const scenes = [];

  try {
    for await (const item of redisClient.scanIterator({
      MATCH: `${LATEST_SCENE_KEY_PREFIX}*`,
      COUNT: 100,
    })) {
      const keys = Array.isArray(item) ? item : [item];

      for (const key of keys) {
        const raw = await redisClient.get(normalizeRedisKey(key));

        if (raw) {
          scenes.push(JSON.parse(raw));
        }
      }
    }
  } catch (error) {
    console.warn("Failed to list latest scenes from Redis", error.message);
  }

  return scenes;
};
