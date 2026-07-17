import {
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createServer } from "node:http";

import mysql from "mysql2/promise";
import { createClient } from "redis";

import { config, configSource, loadedEnvFiles } from "./config.js";

const LATEST_SCENE_KEY_PREFIX = "room:scene:latest:";
const sessions = new Map();

const pool = mysql.createPool({
  ...config.mysql,
  waitForConnections: true,
  namedPlaceholders: true,
});

const redis = createClient({
  url: config.redisUrl,
  socket: {
    connectTimeout: 1500,
    reconnectStrategy: false,
  },
});

redis.on("error", (error) => {
  console.warn("Admin Redis client error", error.message);
});

const sign = (value) =>
  createHmac("sha256", config.sessionSecret).update(value).digest("hex");

const parseCookies = (header = "") =>
  Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [name, ...value] = cookie.split("=");
        return [name, decodeURIComponent(value.join("="))];
      }),
  );

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const getSessionId = (req) => {
  const raw = parseCookies(req.headers.cookie).admin_session;

  if (!raw) {
    return null;
  }

  const [sessionId, signature] = raw.split(".");

  if (!sessionId || !signature || !safeEqual(sign(sessionId), signature)) {
    return null;
  }

  const session = sessions.get(sessionId);

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return sessionId;
};

const isAuthenticated = (req) => Boolean(getSessionId(req));

const cookieOptions = () => [
  "Path=/",
  "HttpOnly",
  "SameSite=Lax",
  `Max-Age=${config.auth.sessionTtlSeconds}`,
  config.auth.cookieSecure ? "Secure" : "",
]
  .filter(Boolean)
  .join("; ");

const send = (res, statusCode, body, headers = {}) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const json = (res, statusCode, body, headers = {}) =>
  send(res, statusCode, JSON.stringify(body), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });

const readJson = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
};

const requireAuth = (req, res) => {
  if (isAuthenticated(req)) {
    return true;
  }

  json(res, 401, { error: "unauthorized" });
  return false;
};

const connectRedis = async () => {
  if (!redis.isOpen && !redis.isReady) {
    await redis.connect();
  }
};

const getRedisStatus = async () => {
  const startedAt = Date.now();

  try {
    await connectRedis();
    const pong = await redis.ping();
    const warnings = [];
    let version = "unavailable";
    let latestKeys = 0;

    try {
      const info = await redis.info();
      version = info.match(/^redis_version:(.+)$/m)?.[1] || "unknown";
    } catch (error) {
      warnings.push({
        scope: "redis.info",
        code: error.code || "REDIS_INFO_ERROR",
        message: error.message,
      });
    }

    try {
      latestKeys = await countRedisKeys(`${LATEST_SCENE_KEY_PREFIX}*`);
    } catch (error) {
      warnings.push({
        scope: "redis.scan",
        code: error.code || "REDIS_SCAN_ERROR",
        message: error.message,
      });
    }

    return {
      ok: pong === "PONG",
      latencyMs: Date.now() - startedAt,
      latestScenes: latestKeys,
      version,
      warnings,
    };
  } catch (error) {
    if (redis.isOpen) {
      await redis.disconnect().catch(() => {});
    }

    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error.message,
      code: error.code || "REDIS_ERROR",
      target: config.redisUrl.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@"),
      latestScenes: 0,
      version: "unavailable",
    };
  }
};

const countRedisKeys = async (match) => {
  let count = 0;

  for await (const item of redis.scanIterator({ MATCH: match, COUNT: 100 })) {
    count += Array.isArray(item) ? item.length : 1;
  }

  return count;
};

const getMysqlStatus = async () => {
  const startedAt = Date.now();

  try {
    const [pingRows] = await pool.query("SELECT 1 AS ok");
    const warnings = [];
    const runCount = async (scope, sql, fallback) => {
      try {
        const [[row]] = await pool.query(sql);
        return row;
      } catch (error) {
        warnings.push({
          scope,
          code: error.code || "MYSQL_QUERY_ERROR",
          message: error.message,
        });
        return fallback;
      }
    };
    const latest = await runCount(
      "room_scene_latest",
      "SELECT COUNT(*) AS count, MAX(updated_at) AS newest FROM room_scene_latest",
      { count: 0, newest: null },
    );
    const snapshots = await runCount(
      "room_scene_snapshots",
      "SELECT COUNT(*) AS count, MAX(created_at) AS newest FROM room_scene_snapshots",
      { count: 0, newest: null },
    );
    const aliases = await runCount(
      "room_aliases",
      "SELECT COUNT(*) AS count FROM room_aliases",
      { count: 0 },
    );
    const users = await runCount("users", "SELECT COUNT(*) AS count FROM users", {
      count: 0,
    });

    return {
      ok: pingRows[0]?.ok === 1,
      latencyMs: Date.now() - startedAt,
      latestScenes: Number(latest.count),
      latestUpdatedAt: latest.newest,
      snapshots: Number(snapshots.count),
      latestSnapshotAt: snapshots.newest,
      aliases: Number(aliases.count),
      users: Number(users.count),
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error.message,
      code: error.code || "MYSQL_ERROR",
      host: config.mysql.host,
      port: config.mysql.port,
      database: config.mysql.database,
      user: config.mysql.user,
      latestScenes: 0,
      snapshots: 0,
      aliases: 0,
      users: 0,
    };
  }
};

const getRecentRooms = async () => {
  const [rows] = await pool.query(
    `SELECT l.room_id, a.alias, l.updated_at, OCTET_LENGTH(l.encrypted_data) AS bytes,
            COUNT(s.id) AS snapshot_count, MAX(s.created_at) AS latest_snapshot_at
       FROM room_scene_latest l
  LEFT JOIN room_aliases a ON a.room_id = l.room_id
  LEFT JOIN room_scene_snapshots s ON s.room_id = l.room_id
   GROUP BY l.room_id, a.alias, l.updated_at, bytes
   ORDER BY l.updated_at DESC
      LIMIT 20`,
  );

  return rows.map((room) => ({
    roomId: room.room_id,
    alias: room.alias,
    updatedAt: room.updated_at,
    bytes: Number(room.bytes),
    snapshotCount: Number(room.snapshot_count),
    latestSnapshotAt: room.latest_snapshot_at,
  }));
};

const assertDateAlias = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("date must be formatted as YYYY-MM-DD");
    error.statusCode = 400;
    throw error;
  }
};

const getDateRoom = async (date) => {
  assertDateAlias(date);

  const [aliases] = await pool.execute(
    `SELECT alias, room_id AS roomId, room_key AS roomKey, created_at AS createdAt, updated_at AS updatedAt
       FROM room_aliases
      WHERE alias = :date
      LIMIT 1`,
    { date },
  );
  const alias = aliases[0] || null;

  if (!alias) {
    return {
      date,
      alias: null,
      latest: null,
      archive: null,
      liveSnapshots: [],
      summary: {
        hasRoom: false,
        latestBytes: 0,
        archiveCount: 0,
        liveSnapshotCount: 0,
      },
    };
  }

  const [latestRows] = await pool.execute(
    `SELECT room_id AS roomId, updated_at AS updatedAt,
            OCTET_LENGTH(encrypted_data) AS bytes
       FROM room_scene_latest
      WHERE room_id = :roomId
      LIMIT 1`,
    { roomId: alias.roomId },
  );
  const [archive, liveSnapshots] = await Promise.all([
    getDailyArchiveSnapshot(alias.roomId),
    getRoomSnapshots(alias.roomId, {
      sources: ["history", "before-small-overwrite"],
      localDate: date,
    }),
  ]);

  return {
    date,
    alias,
    latest: latestRows[0]
      ? {
          roomId: latestRows[0].roomId,
          updatedAt: latestRows[0].updatedAt,
          bytes: Number(latestRows[0].bytes),
        }
      : null,
    archive,
    liveSnapshots,
    summary: {
      hasRoom: true,
      latestBytes: Number(latestRows[0]?.bytes || 0),
      archiveCount: archive ? 1 : 0,
      liveSnapshotCount: liveSnapshots.length,
    },
  };
};

const getStats = async () => {
  const [mysqlStatus, redisStatus] = await Promise.all([
    getMysqlStatus(),
    getRedisStatus(),
  ]);

  let recentRooms = [];

  if (mysqlStatus.ok) {
    recentRooms = await getRecentRooms();
  }

  return {
    generatedAt: new Date().toISOString(),
    config: {
      loadedEnvFiles,
      source: configSource,
      mysqlHost: config.mysql.host,
      mysqlPort: config.mysql.port,
      mysqlDatabase: config.mysql.database,
      mysqlUser: config.mysql.user,
      redisUrl: config.redisUrl.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@"),
    },
    mysql: mysqlStatus,
    redis: redisStatus,
    rooms: recentRooms,
  };
};

const getRoomSnapshots = async (roomId, { sources, localDate } = {}) => {
  const sourceFilter = sources?.length
    ? `AND source IN (${sources.map((_, index) => `:source${index}`).join(", ")})`
    : "";
  const localDateFilter = localDate
    ? "AND DATE(DATE_ADD(created_at, INTERVAL 8 HOUR)) = :localDate"
    : "";
  const params = { roomId };

  sources?.forEach((source, index) => {
    params[`source${index}`] = source;
  });

  if (localDate) {
    params.localDate = localDate;
  }

  const [rows] = await pool.execute(
    `SELECT id, room_id, source, content_hash, created_at,
            OCTET_LENGTH(encrypted_data) AS bytes
       FROM room_scene_snapshots
      WHERE room_id = :roomId
        ${sourceFilter}
        ${localDateFilter}
   ORDER BY created_at DESC, id DESC
      LIMIT 50`,
    params,
  );

  return rows.map((snapshot) => ({
    id: Number(snapshot.id),
    roomId: snapshot.room_id,
    source: snapshot.source,
    contentHash: snapshot.content_hash,
    createdAt: snapshot.created_at,
    bytes: Number(snapshot.bytes),
  }));
};

const getDailyArchiveSnapshot = async (roomId) => {
  const [rows] = await pool.execute(
    `SELECT id, room_id, source, content_hash, created_at,
            OCTET_LENGTH(encrypted_data) AS bytes
       FROM room_scene_snapshots
      WHERE room_id = :roomId
        AND source = 'archive-final'
   ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    { roomId },
  );
  const snapshot = rows[0];

  if (!snapshot) {
    return null;
  }

  return {
    id: Number(snapshot.id),
    roomId: snapshot.room_id,
    source: snapshot.source,
    contentHash: snapshot.content_hash,
    createdAt: snapshot.created_at,
    bytes: Number(snapshot.bytes),
  };
};

const getDailyArchives = async () => {
  const [rows] = await pool.query(
    `SELECT a.alias, a.room_id AS roomId, a.room_key AS roomKey,
            COALESCE(ar.id, latest_fallback.id) AS snapshotId,
            COALESCE(ar.source, latest_fallback.source) AS source,
            COALESCE(ar.content_hash, latest_fallback.content_hash) AS contentHash,
            COALESCE(ar.created_at, latest_fallback.created_at) AS createdAt,
            COALESCE(OCTET_LENGTH(ar.encrypted_data), OCTET_LENGTH(latest_fallback.encrypted_data), OCTET_LENGTH(l.encrypted_data)) AS bytes,
            l.updated_at AS latestUpdatedAt
       FROM room_aliases a
  LEFT JOIN room_scene_latest l ON l.room_id = a.room_id
  LEFT JOIN room_scene_snapshots ar
         ON ar.id = (
              SELECT s.id
                FROM room_scene_snapshots s
               WHERE s.room_id = a.room_id
                 AND s.source = 'archive-final'
            ORDER BY s.created_at DESC, s.id DESC
               LIMIT 1
            )
  LEFT JOIN room_scene_snapshots latest_fallback
         ON latest_fallback.id = (
              SELECT s.id
                FROM room_scene_snapshots s
               WHERE s.room_id = a.room_id
            ORDER BY s.created_at DESC, s.id DESC
               LIMIT 1
            )
   ORDER BY a.alias DESC
      LIMIT 90`,
  );

  return rows.map((row) => ({
    alias: row.alias,
    roomId: row.roomId,
    roomKey: row.roomKey,
    snapshotId: row.snapshotId ? Number(row.snapshotId) : null,
    source: row.source || (row.latestUpdatedAt ? "latest" : null),
    contentHash: row.contentHash,
    createdAt: row.createdAt || row.latestUpdatedAt,
    latestUpdatedAt: row.latestUpdatedAt,
    bytes: Number(row.bytes || 0),
  }));
};

const decryptSnapshotPayload = ({ encryptedData, iv, roomKey }) => {
  const encrypted = Buffer.from(encryptedData);
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const key = Buffer.from(roomKey, "base64url");
  const decipher = createDecipheriv("aes-128-gcm", key, Buffer.from(iv));

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

const getSnapshotScene = async (snapshotId) => {
  const [rows] = await pool.execute(
    `SELECT s.id, s.room_id, s.source, s.content_hash, s.created_at,
            s.encrypted_data, s.iv, a.alias, a.room_key
       FROM room_scene_snapshots s
  LEFT JOIN room_aliases a ON a.room_id = s.room_id
      WHERE s.id = :snapshotId
      LIMIT 1`,
    { snapshotId },
  );
  const snapshot = rows[0];

  if (!snapshot) {
    return null;
  }

  if (!snapshot.room_key) {
    const error = new Error("room key not found for snapshot");
    error.statusCode = 404;
    throw error;
  }

  const raw = decryptSnapshotPayload({
    encryptedData: snapshot.encrypted_data,
    iv: snapshot.iv,
    roomKey: snapshot.room_key,
  });
  const data = JSON.parse(raw);
  const elements = data?.payload?.elements || data?.elements || [];

  return {
    id: Number(snapshot.id),
    roomId: snapshot.room_id,
    alias: snapshot.alias,
    source: snapshot.source,
    contentHash: snapshot.content_hash,
    createdAt: snapshot.created_at,
    elements,
  };
};

const getUsers = async () => {
  try {
    const [rows] = await pool.query(
      `SELECT id, qq_openid AS qqOpenid, nickname, avatar_url AS avatarUrl,
              created_at AS createdAt, updated_at AS updatedAt
         FROM users
     ORDER BY updated_at DESC, id DESC
        LIMIT 100`,
    );

    return {
      ok: true,
      users: rows.map((user) => ({
        id: Number(user.id),
        qqOpenid: user.qqOpenid,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      users: [],
      error: error.message,
      code: error.code || "MYSQL_USERS_ERROR",
    };
  }
};

const restoreSnapshot = async (snapshotId) => {
  const [rows] = await pool.execute(
    `SELECT id, room_id, encrypted_data, iv
       FROM room_scene_snapshots
      WHERE id = :snapshotId
      LIMIT 1`,
    { snapshotId },
  );
  const snapshot = rows[0];

  if (!snapshot) {
    return null;
  }

  await pool.execute(
    `INSERT INTO room_scene_latest (room_id, encrypted_data, iv)
     VALUES (:roomId, :encryptedData, :iv)
     ON DUPLICATE KEY UPDATE
       encrypted_data = VALUES(encrypted_data),
       iv = VALUES(iv),
       updated_at = CURRENT_TIMESTAMP`,
    {
      roomId: snapshot.room_id,
      encryptedData: snapshot.encrypted_data,
      iv: snapshot.iv,
    },
  );

  try {
    await connectRedis();
    await redis.set(
      `${LATEST_SCENE_KEY_PREFIX}${snapshot.room_id}`,
      JSON.stringify({
        roomId: snapshot.room_id,
        encryptedData: Buffer.from(snapshot.encrypted_data).toString("base64"),
        iv: Buffer.from(snapshot.iv).toString("base64"),
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("Failed to warm restored scene in Redis", error.message);
  }

  return {
    snapshotId: Number(snapshot.id),
    roomId: snapshot.room_id,
  };
};

const html = String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Excalidraw Admin</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f8fa;
        --panel: #ffffff;
        --panel-soft: #f9fafb;
        --text: #24292f;
        --muted: #57606a;
        --line: #d0d7de;
        --accent: #0969da;
        --accent-strong: #0550ae;
        --ok: #1a7f37;
        --warn: #9a6700;
        --danger: #cf222e;
        --shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button,
      input {
        font: inherit;
      }

      button {
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--panel);
        color: var(--text);
        cursor: pointer;
        padding: 8px 12px;
        transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
      }

      button:hover {
        background: #f3f4f6;
      }

      button:active {
        transform: translateY(1px);
      }

      button.primary {
        border-color: var(--accent);
        background: var(--accent);
        color: #ffffff;
      }

      button.primary:hover {
        background: var(--accent-strong);
      }

      button.danger {
        border-color: rgba(207, 34, 46, 0.35);
        color: var(--danger);
      }

      input {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--panel);
        padding: 10px 12px;
        color: var(--text);
      }

      input:focus,
      button:focus-visible {
        outline: 2px solid rgba(9, 105, 218, 0.35);
        outline-offset: 2px;
      }

      .login-shell,
      .app-shell {
        min-height: 100vh;
      }

      .login-shell {
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .login-panel {
        width: min(420px, 100%);
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        box-shadow: var(--shadow);
        padding: 28px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 22px;
      }

      .mark {
        display: grid;
        width: 34px;
        height: 34px;
        place-items: center;
        border-radius: 8px;
        background: #24292f;
        color: #ffffff;
        font-weight: 700;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        font-size: 20px;
        line-height: 1.2;
      }

      h2 {
        font-size: 18px;
      }

      h3 {
        font-size: 14px;
      }

      .muted {
        color: var(--muted);
      }

      .form {
        display: grid;
        gap: 14px;
      }

      .field {
        display: grid;
        gap: 6px;
      }

      .error {
        min-height: 20px;
        color: var(--danger);
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .detail-card {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 14px;
      }

      .detail-card.fail {
        border-color: rgba(207, 34, 46, 0.35);
        background: #fff8f7;
      }

      .detail-list {
        display: grid;
        gap: 6px;
        margin-top: 10px;
      }

      .detail-line {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        gap: 8px;
      }

      code {
        overflow-wrap: anywhere;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }

      .app-shell {
        display: grid;
        grid-template-columns: 248px minmax(0, 1fr);
      }

      .sidebar {
        border-right: 1px solid var(--line);
        background: #ffffff;
        padding: 20px;
      }

      .sidebar .brand {
        margin-bottom: 24px;
      }

      .nav {
        display: grid;
        gap: 8px;
      }

      .nav button {
        justify-content: flex-start;
        text-align: left;
      }

      .nav button.active {
        border-color: rgba(9, 105, 218, 0.45);
        background: #ddf4ff;
        color: var(--accent-strong);
      }

      .main {
        min-width: 0;
        padding: 24px;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 20px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .card,
      .table-wrap,
      .tool-panel {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }

      .card {
        padding: 16px;
      }

      .metric {
        margin-top: 8px;
        font-size: 26px;
        font-weight: 650;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 12px;
        font-weight: 600;
      }

      .status.ok {
        background: #dafbe1;
        color: var(--ok);
      }

      .status.fail {
        background: #ffebe9;
        color: var(--danger);
      }

      .section {
        margin-top: 18px;
      }

      .page {
        display: none;
      }

      .page.active {
        display: block;
      }

      .table-wrap {
        overflow: hidden;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 10px 12px;
        text-align: left;
        vertical-align: middle;
        white-space: nowrap;
      }

      th {
        background: var(--panel-soft);
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .room-id {
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }

      .tool-panel {
        display: grid;
        gap: 12px;
        padding: 16px;
      }

      .tool-row {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) auto;
        gap: 10px;
      }

      .tabs {
        display: flex;
        gap: 8px;
        border-bottom: 1px solid var(--line);
        padding-bottom: 8px;
      }

      .tabs button.active {
        border-color: rgba(9, 105, 218, 0.45);
        background: #ddf4ff;
        color: var(--accent-strong);
      }

      .snapshots {
        display: grid;
        gap: 8px;
      }

      .snapshot {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 12px;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px 12px;
        background: var(--panel-soft);
      }

      .modal {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: grid;
        place-items: center;
        background: rgba(31, 35, 40, 0.48);
        padding: 20px;
      }

      .modal.hidden {
        display: none;
      }

      .preview-panel {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        width: min(1180px, 100%);
        height: min(760px, 92vh);
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }

      .preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid var(--line);
        padding: 12px 14px;
      }

      .preview-canvas {
        overflow: auto;
        background: #f6f8fa;
        padding: 16px;
      }

      .preview-canvas svg {
        display: block;
        min-width: 100%;
        min-height: 100%;
        background: #ffffff;
        border: 1px solid var(--line);
        border-radius: 6px;
      }

      .hidden {
        display: none;
      }

      @media (max-width: 900px) {
        .app-shell {
          grid-template-columns: 1fr;
        }

        .sidebar {
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }

        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 560px) {
        .main {
          padding: 16px;
        }

        .topbar,
        .tool-row,
        .snapshot {
          grid-template-columns: 1fr;
          align-items: stretch;
        }

        .grid {
          grid-template-columns: 1fr;
        }

        .detail-grid {
          grid-template-columns: 1fr;
        }

        .table-wrap {
          overflow-x: auto;
        }
      }
    </style>
  </head>
  <body>
    <div id="login" class="login-shell hidden">
      <form class="login-panel form" id="loginForm">
        <div class="brand">
          <div class="mark">A</div>
          <div>
            <h1>Excalidraw Admin</h1>
            <p class="muted">检测、统计、恢复副本</p>
          </div>
        </div>
        <label class="field">
          <span>账号</span>
          <input id="username" autocomplete="username" required />
        </label>
        <label class="field">
          <span>密码</span>
          <input id="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="primary" type="submit">登录</button>
        <div class="error" id="loginError"></div>
      </form>
    </div>

    <div id="app" class="app-shell hidden">
      <aside class="sidebar">
        <div class="brand">
          <div class="mark">A</div>
          <div>
            <h1>Admin</h1>
            <p class="muted">localhost:3003</p>
          </div>
        </div>
        <div class="nav">
          <button class="active" data-page-link="dashboard">仪表盘</button>
          <button data-page-link="users">用户</button>
          <button data-page-link="snapshots">历史副本</button>
          <button id="logout">退出登录</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div>
            <h2 id="pageTitle">仪表盘</h2>
            <p class="muted" id="generatedAt">等待刷新</p>
          </div>
          <button class="primary" id="refreshPage">刷新</button>
        </div>

        <section class="page active" id="page-dashboard">
          <section class="grid" id="metrics"></section>
          <section class="section detail-grid" id="details"></section>
          <section class="section">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>房间</th>
                    <th>最新保存</th>
                    <th>大小</th>
                    <th>副本数</th>
                    <th>最近副本</th>
                  </tr>
                </thead>
                <tbody id="rooms"></tbody>
              </table>
            </div>
          </section>
        </section>

        <section class="page" id="page-users">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>昵称</th>
                  <th>QQ OpenID</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody id="users"></tbody>
            </table>
          </div>
        </section>

        <section class="page" id="page-snapshots">
          <div class="tool-panel" id="restorePanel">
            <div>
              <h2>历史副本</h2>
              <p class="muted">每日归档是只读记录；当天 snapshots 才用于当天误操作回滚。</p>
            </div>
            <div id="dateSummary"></div>
            <div class="tabs">
              <button class="active" data-snapshot-tab="archive">每日归档</button>
              <button data-snapshot-tab="live">当天 snapshots</button>
            </div>
            <div id="archiveSnapshots" class="table-wrap"></div>
            <div class="snapshots" id="snapshots"></div>
          </div>
        </section>
      </main>
    </div>

    <div id="previewModal" class="modal hidden">
      <div class="preview-panel">
        <div class="preview-head">
          <div>
            <h2 id="previewTitle">预览</h2>
            <p class="muted" id="previewMeta"></p>
          </div>
          <button id="closePreview">关闭</button>
        </div>
        <div class="preview-canvas" id="previewCanvas"></div>
      </div>
    </div>

    <script>
      const $ = (selector) => document.querySelector(selector);
      const login = $("#login");
      const app = $("#app");
      const metrics = $("#metrics");
      const details = $("#details");
      const rooms = $("#rooms");
      const snapshots = $("#snapshots");
      const archiveSnapshots = $("#archiveSnapshots");
      const users = $("#users");
      const previewModal = $("#previewModal");
      const previewCanvas = $("#previewCanvas");
      let currentPage = "dashboard";
      let currentSnapshotTab = "archive";
      let currentDateData = null;

      const request = async (url, options = {}) => {
        const response = await fetch(url, {
          headers: { "Content-Type": "application/json", ...(options.headers || {}) },
          ...options,
        });

        if (response.status === 401) {
          showLogin();
          throw new Error("unauthorized");
        }

        const data = await response.json();

        if (!response.ok) {
          const error = new Error(data.error || "request failed");
          error.code = data.code;
          throw error;
        }

        return data;
      };

      const showLogin = () => {
        login.classList.remove("hidden");
        app.classList.add("hidden");
      };

      const showApp = () => {
        login.classList.add("hidden");
        app.classList.remove("hidden");
      };

      const fmtDate = (value) => value ? new Date(value).toLocaleString() : "-";
      const fmtBytes = (value) => {
        if (!Number.isFinite(value)) return "-";
        if (value < 1024) return value + " B";
        if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
        return (value / 1024 / 1024).toFixed(1) + " MB";
      };

      const status = (ok) => '<span class="status ' + (ok ? "ok" : "fail") + '">' + (ok ? "正常" : "异常") + "</span>";
      const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char]));

      const renderMetrics = (stats) => {
        const cards = [
          ["MySQL", status(stats.mysql.ok), stats.mysql.latencyMs + "ms"],
          ["Redis", status(stats.redis.ok), stats.redis.latencyMs + "ms"],
          ["最新场景", stats.mysql.latestScenes, "MySQL / Redis " + stats.redis.latestScenes],
          ["历史副本", stats.mysql.snapshots, "用户 " + stats.mysql.users + " / 别名 " + stats.mysql.aliases],
        ];

        metrics.innerHTML = cards.map(([label, value, note]) =>
          '<article class="card"><h3 class="muted">' + label + '</h3><div class="metric">' + value + '</div><p class="muted">' + note + '</p></article>'
        ).join("");
      };

      const renderDetails = (stats) => {
        const renderWarnings = (warnings = []) =>
          warnings.length
            ? warnings.map((warning) =>
              '<div class="detail-line"><span class="muted">' + escapeHtml(warning.scope) + '</span><code>' + escapeHtml((warning.code || "-") + " " + warning.message) + '</code></div>'
            ).join("")
            : '<div class="detail-line"><span class="muted">warnings</span><code>-</code></div>';
        const blocks = [
          {
            title: "MySQL 详情",
            data: {
              状态: stats.mysql.ok ? "正常" : "异常",
              错误码: stats.mysql.code || "-",
              异常内容: stats.mysql.error || "-",
              地址: (stats.mysql.host || "-") + ":" + (stats.mysql.port || "-"),
              数据库: stats.mysql.database || "-",
              用户: stats.mysql.user || "-",
              最新保存: fmtDate(stats.mysql.latestUpdatedAt),
              最近副本: fmtDate(stats.mysql.latestSnapshotAt),
            },
            warnings: stats.mysql.warnings,
            ok: stats.mysql.ok,
          },
          {
            title: "Redis 详情",
            data: {
              状态: stats.redis.ok ? "正常" : "异常",
              错误码: stats.redis.code || "-",
              异常内容: stats.redis.error || "-",
              地址: stats.redis.target || "-",
              版本: stats.redis.version || "-",
              latestKey数量: stats.redis.latestScenes,
            },
            warnings: stats.redis.warnings,
            ok: stats.redis.ok,
          },
          {
            title: "配置来源",
            data: {
              MySQL来源: stats.config.source.mysql,
              Redis来源: stats.config.source.redis,
              Admin来源: stats.config.source.admin,
              加载的env文件: stats.config.loadedEnvFiles.length ? stats.config.loadedEnvFiles.join(" | ") : "没有加载到 env 文件",
              MySQL: stats.config.mysqlHost + ":" + stats.config.mysqlPort,
              数据库: stats.config.mysqlDatabase,
              用户: stats.config.mysqlUser,
              Redis: stats.config.redisUrl,
            },
            ok: stats.mysql.ok && stats.redis.ok,
          },
        ];

        details.innerHTML = blocks.map((block) =>
          '<article class="detail-card ' + (block.ok ? "" : "fail") + '"><h3>' + block.title + ' ' + status(block.ok) + '</h3><div class="detail-list">' +
          Object.entries(block.data).map(([label, value]) =>
            '<div class="detail-line"><span class="muted">' + label + '</span><code>' + escapeHtml(value) + '</code></div>'
          ).join("") +
          (block.warnings ? renderWarnings(block.warnings) : "") +
          '</div></article>'
        ).join("");
      };

      const renderRooms = (items) => {
        rooms.innerHTML = items.map((room) =>
          '<tr><td>' + (room.alias ? '<button data-date="' + room.alias + '">' + room.alias + '</button>' : '-') + '</td><td class="room-id" title="' + room.roomId + '">' + room.roomId + '</td><td>' + fmtDate(room.updatedAt) + '</td><td>' + fmtBytes(room.bytes) + '</td><td>' + room.snapshotCount + '</td><td>' + fmtDate(room.latestSnapshotAt) + '</td></tr>'
        ).join("");

        rooms.querySelectorAll("[data-date]").forEach((button) => {
          button.addEventListener("click", () => {
            showPage("snapshots", false);
            showSnapshotTab("archive");
          });
        });
      };

      const refresh = async () => {
        const stats = await request("/api/stats");
        showApp();
        $("#generatedAt").textContent = "更新时间 " + fmtDate(stats.generatedAt);
        renderMetrics(stats);
        renderDetails(stats);
        renderRooms(stats.rooms);
      };

      const renderUsers = (data) => {
        if (!data.ok) {
          users.innerHTML = '<tr><td colspan="5"><div class="detail-card fail"><h3>用户数据不可用 ' + status(false) + '</h3><div class="detail-list"><div class="detail-line"><span class="muted">错误码</span><code>' + escapeHtml(data.code || "-") + '</code></div><div class="detail-line"><span class="muted">异常内容</span><code>' + escapeHtml(data.error || "-") + '</code></div></div></div></td></tr>';
          return;
        }

        users.innerHTML = data.users.length ? data.users.map((user) =>
          '<tr><td>' + user.id + '</td><td>' + escapeHtml(user.nickname || "-") + '</td><td class="room-id" title="' + escapeHtml(user.qqOpenid || "-") + '">' + escapeHtml(user.qqOpenid || "-") + '</td><td>' + fmtDate(user.createdAt) + '</td><td>' + fmtDate(user.updatedAt) + '</td></tr>'
        ).join("") : '<tr><td colspan="5">暂无用户</td></tr>';
      };

      const loadUsers = async () => {
        users.innerHTML = '<tr><td colspan="5">加载中...</td></tr>';
        renderUsers(await request("/api/users"));
        $("#generatedAt").textContent = "更新时间 " + fmtDate(new Date().toISOString());
      };

      const showPage = (page, shouldLoad = true) => {
        currentPage = page;
        document.querySelectorAll(".page").forEach((section) => {
          section.classList.toggle("active", section.id === "page-" + page);
        });
        document.querySelectorAll("[data-page-link]").forEach((button) => {
          button.classList.toggle("active", button.dataset.pageLink === page);
        });
        $("#pageTitle").textContent = {
          dashboard: "仪表盘",
          users: "用户",
          snapshots: "历史副本",
        }[page];

        if (!shouldLoad) {
          return;
        }

        if (page === "dashboard") {
          refresh();
        } else if (page === "users") {
          loadUsers();
        } else if (page === "snapshots") {
          $("#generatedAt").textContent = "查看历史副本";
          showSnapshotTab("archive");
        }
      };

      const refreshCurrentPage = () => {
        if (currentPage === "dashboard") {
          return refresh();
        }

        if (currentPage === "users") {
          return loadUsers();
        }

        return currentSnapshotTab === "archive" ? loadDailyArchives() : loadTodaySnapshots();
      };

      const showSnapshotTab = (tab) => {
        currentSnapshotTab = tab;
        document.querySelectorAll("[data-snapshot-tab]").forEach((button) => {
          button.classList.toggle("active", button.dataset.snapshotTab === tab);
        });
        archiveSnapshots.classList.toggle("hidden", tab !== "archive");
        snapshots.classList.toggle("hidden", tab !== "live");

        if (tab === "archive") {
          loadDailyArchives();
        } else {
          loadTodaySnapshots();
        }
      };

      const renderSnapshots = (items, { allowRestore = true } = {}) => {
        snapshots.innerHTML = items.length ? items.map((snapshot) =>
          '<div class="snapshot"><div><strong>#' + snapshot.id + '</strong> <span class="muted">' + escapeHtml(snapshot.source) + ' · ' + fmtDate(snapshot.createdAt) + ' · ' + fmtBytes(snapshot.bytes) + '</span><p class="muted">' + escapeHtml(snapshot.contentHash || "-") + '</p></div><button data-preview="' + snapshot.id + '">预览</button>' + (allowRestore ? '<button class="danger" data-restore="' + snapshot.id + '">恢复</button>' : '<span class="status ok">已归档</span>') + '</div>'
        ).join("") : '<p class="muted">没有找到副本</p>';

        snapshots.querySelectorAll("[data-preview]").forEach((button) => {
          button.addEventListener("click", () => openPreview(button.dataset.preview));
        });

        snapshots.querySelectorAll("[data-restore]").forEach((button) => {
          button.addEventListener("click", async () => {
            if (!confirm("确认恢复这个副本？当前最新场景会被覆盖。")) return;
            button.disabled = true;
            await request("/api/snapshots/" + button.dataset.restore + "/restore", { method: "POST" });
            await loadTodaySnapshots();
          });
        });
      };

      const renderArchive = (archive) => {
        archiveSnapshots.innerHTML = archive
          ? '<div class="snapshot"><div><strong>#' + archive.id + '</strong> <span class="muted">' + escapeHtml(archive.source) + ' · ' + fmtDate(archive.createdAt) + ' · ' + fmtBytes(archive.bytes) + '</span><p class="muted">' + escapeHtml(archive.contentHash || "-") + '</p></div><span class="status ok">已读归档</span></div>'
          : '<p class="muted">这个日期还没有每日归档。当天通常还在 snapshots tab 里滚动保存。</p>';
      };

      const renderDailyArchives = (items) => {
        archiveSnapshots.innerHTML = items.length ? '<table><thead><tr><th>日期</th><th>来源</th><th>保存时间</th><th>大小</th><th>房间</th></tr></thead><tbody>' +
          items.map((item) =>
            '<tr><td>' + escapeHtml(item.alias) + '</td><td>' + escapeHtml(item.source || "-") + '</td><td>' + fmtDate(item.createdAt) + '</td><td>' + fmtBytes(item.bytes) + '</td><td class="room-id" title="' + escapeHtml(item.roomId) + '">' + escapeHtml(item.roomId) + '</td><td>' + (item.snapshotId ? '<button data-preview="' + item.snapshotId + '">预览</button>' : '-') + '</td></tr>'
          ).join("") +
          '</tbody></table>' : '<p class="muted">暂无每日归档</p>';

        archiveSnapshots.querySelectorAll("[data-preview]").forEach((button) => {
          button.addEventListener("click", () => openPreview(button.dataset.preview));
        });
      };

      const loadDailyArchives = async () => {
        $("#dateSummary").innerHTML = '<p class="muted">加载每日归档...</p>';
        archiveSnapshots.innerHTML = "";
        const data = await request("/api/archives/daily");
        $("#dateSummary").innerHTML = '<div class="detail-card"><h3>每日归档</h3><p class="muted">每个日期保留一份只读记录，不提供回滚操作。</p></div>';
        renderDailyArchives(data.archives);
      };

      const loadTodaySnapshots = async () => {
        const today = new Date().toISOString().slice(0, 10);
        await loadDate(today, { forceLiveTab: true });
      };

      const getElementBounds = (element) => {
        const xs = [element.x, element.x + (element.width || 0)];
        const ys = [element.y, element.y + (element.height || 0)];

        if (Array.isArray(element.points)) {
          element.points.forEach((point) => {
            xs.push(element.x + point[0]);
            ys.push(element.y + point[1]);
          });
        }

        return {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        };
      };

      const renderPreviewSvg = (elements) => {
        const visible = elements.filter((element) => !element.isDeleted);

        if (!visible.length) {
          return '<p class="muted">这个 snapshot 没有可见元素。</p>';
        }

        const bounds = visible.reduce((acc, element) => {
          const next = getElementBounds(element);
          return {
            minX: Math.min(acc.minX, next.minX),
            minY: Math.min(acc.minY, next.minY),
            maxX: Math.max(acc.maxX, next.maxX),
            maxY: Math.max(acc.maxY, next.maxY),
          };
        }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
        const pad = 80;
        const viewBox = [
          bounds.minX - pad,
          bounds.minY - pad,
          Math.max(800, bounds.maxX - bounds.minX + pad * 2),
          Math.max(520, bounds.maxY - bounds.minY + pad * 2),
        ];

        const lineStyle = (element) => {
          const stroke = element.strokeColor || "#1e1e1e";
          const fill = element.backgroundColor && element.backgroundColor !== "transparent" ? element.backgroundColor : "none";
          const strokeWidth = Math.max(1, element.strokeWidth || 1);
          return 'stroke="' + escapeHtml(stroke) + '" fill="' + escapeHtml(fill) + '" stroke-width="' + strokeWidth + '" opacity="' + ((element.opacity ?? 100) / 100) + '"';
        };
        const renderElement = (element) => {
          const x = Number(element.x || 0);
          const y = Number(element.y || 0);
          const w = Number(element.width || 0);
          const h = Number(element.height || 0);
          const transform = element.angle ? ' transform="rotate(' + (element.angle * 180 / Math.PI) + ' ' + (x + w / 2) + ' ' + (y + h / 2) + ')"' : "";

          if (element.type === "rectangle" || element.type === "frame" || element.type === "embeddable") {
            return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" ' + lineStyle(element) + transform + '/>';
          }

          if (element.type === "diamond") {
            const points = [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]].map((point) => point.join(",")).join(" ");
            return '<polygon points="' + points + '" ' + lineStyle(element) + transform + '/>';
          }

          if (element.type === "ellipse") {
            return '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + Math.abs(w / 2) + '" ry="' + Math.abs(h / 2) + '" ' + lineStyle(element) + transform + '/>';
          }

          if ((element.type === "line" || element.type === "arrow" || element.type === "freedraw") && Array.isArray(element.points)) {
            const points = element.points.map((point) => (x + point[0]) + "," + (y + point[1])).join(" ");
            return '<polyline points="' + points + '" fill="none" stroke="' + escapeHtml(element.strokeColor || "#1e1e1e") + '" stroke-width="' + Math.max(1, element.strokeWidth || 1) + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + ((element.opacity ?? 100) / 100) + '"' + transform + '/>';
          }

          if (element.type === "text") {
            const fontSize = Number(element.fontSize || 20);
            const lines = String(element.text || "").split("\\n");
            return '<text x="' + x + '" y="' + (y + fontSize) + '" fill="' + escapeHtml(element.strokeColor || "#1e1e1e") + '" font-size="' + fontSize + '" font-family="Virgil, Comic Sans MS, sans-serif" opacity="' + ((element.opacity ?? 100) / 100) + '"' + transform + '>' +
              lines.map((line, index) => '<tspan x="' + x + '" dy="' + (index === 0 ? 0 : fontSize * 1.2) + '">' + escapeHtml(line) + '</tspan>').join("") +
              '</text>';
          }

          return '<rect x="' + x + '" y="' + y + '" width="' + Math.max(8, w) + '" height="' + Math.max(8, h) + '" ' + lineStyle(element) + transform + '/>';
        };

        return '<svg viewBox="' + viewBox.join(" ") + '" xmlns="http://www.w3.org/2000/svg">' +
          '<defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eef1f4" stroke-width="1"/></pattern></defs>' +
          '<rect x="' + viewBox[0] + '" y="' + viewBox[1] + '" width="' + viewBox[2] + '" height="' + viewBox[3] + '" fill="url(#grid)"/>' +
          visible.map(renderElement).join("") +
          '</svg>';
      };

      const openPreview = async (snapshotId) => {
        previewModal.classList.remove("hidden");
        $("#previewTitle").textContent = "Snapshot #" + snapshotId;
        $("#previewMeta").textContent = "加载中...";
        previewCanvas.innerHTML = '<p class="muted">正在解密并生成预览...</p>';

        try {
          const scene = await request("/api/snapshots/" + snapshotId + "/scene");
          $("#previewTitle").textContent = "Snapshot #" + scene.id;
          $("#previewMeta").textContent = (scene.alias || scene.roomId) + " · " + escapeHtml(scene.source) + " · " + fmtDate(scene.createdAt) + " · 元素 " + scene.elements.length;
          previewCanvas.innerHTML = renderPreviewSvg(scene.elements);
        } catch (error) {
          $("#previewMeta").textContent = "预览失败";
          previewCanvas.innerHTML = '<div class="detail-card fail"><h3>预览失败 ' + status(false) + '</h3><div class="detail-list"><div class="detail-line"><span class="muted">错误码</span><code>' + escapeHtml(error.code || "-") + '</code></div><div class="detail-line"><span class="muted">异常内容</span><code>' + escapeHtml(error.message) + '</code></div></div></div>';
        }
      };

      const loadSnapshotsByRoom = async (roomId) => {
        if (!roomId) return;

        $("#dateSummary").innerHTML = '<p class="muted">按 roomId 查询：<code>' + escapeHtml(roomId) + '</code></p>';
        snapshots.innerHTML = '<p class="muted">查询中...</p>';
        try {
          const data = await request("/api/rooms/" + encodeURIComponent(roomId) + "/snapshots");
          renderSnapshots(data.snapshots);
        } catch (error) {
          $("#dateSummary").innerHTML = '<div class="detail-card fail"><h3>查询失败 ' + status(false) + '</h3><div class="detail-list"><div class="detail-line"><span class="muted">错误码</span><code>' + escapeHtml(error.code || "-") + '</code></div><div class="detail-line"><span class="muted">异常内容</span><code>' + escapeHtml(error.message) + '</code></div></div></div>';
          renderSnapshots([]);
        }
      };

      const loadDate = async (nextDate, { forceLiveTab = false } = {}) => {
        const date = nextDate || new Date().toISOString().slice(0, 10);
        if (!date) return;

        $("#dateSummary").innerHTML = '<p class="muted">查询中...</p>';
        archiveSnapshots.innerHTML = "";
        snapshots.innerHTML = "";
        let data;

        try {
          data = await request("/api/dates/" + encodeURIComponent(date));
        } catch (error) {
          $("#dateSummary").innerHTML = '<div class="detail-card fail"><h3>' + date + ' 查询失败 ' + status(false) + '</h3><div class="detail-list"><div class="detail-line"><span class="muted">错误码</span><code>' + escapeHtml(error.code || "-") + '</code></div><div class="detail-line"><span class="muted">异常内容</span><code>' + escapeHtml(error.message) + '</code></div></div></div>';
          renderArchive(null);
          renderSnapshots([]);
          return;
        }

        if (!data.alias) {
          $("#dateSummary").innerHTML = '<div class="detail-card fail"><h3>' + date + ' 没有房间记录</h3><p class="muted">room_aliases 里没有这个日期。可能当天没有创建房间，或 collab 使用了内存 fallback 没落库。</p></div>';
          renderArchive(null);
          renderSnapshots([]);
          return;
        }

        currentDateData = data;

        $("#dateSummary").innerHTML =
          '<div class="detail-card"><h3>' + date + ' ' + status(Boolean(data.latest)) + '</h3><div class="detail-list">' +
          '<div class="detail-line"><span class="muted">roomId</span><code>' + escapeHtml(data.alias.roomId) + '</code></div>' +
          '<div class="detail-line"><span class="muted">roomKey</span><code>' + escapeHtml(data.alias.roomKey) + '</code></div>' +
          '<div class="detail-line"><span class="muted">最新场景</span><code>' + (data.latest ? fmtDate(data.latest.updatedAt) + " / " + fmtBytes(data.latest.bytes) : "没有 latest 记录") + '</code></div>' +
          '<div class="detail-line"><span class="muted">每日归档</span><code>' + data.summary.archiveCount + '</code></div>' +
          '<div class="detail-line"><span class="muted">当天snapshot</span><code>' + data.summary.liveSnapshotCount + '</code></div>' +
          '</div></div>';

        renderArchive(data.archive);
        renderSnapshots(data.liveSnapshots);
        if (!forceLiveTab) {
          showSnapshotTab(date === new Date().toISOString().slice(0, 10) ? "live" : "archive");
        }
      };

      $("#loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        $("#loginError").textContent = "";

        try {
          await request("/api/login", {
            method: "POST",
            body: JSON.stringify({
              username: $("#username").value,
              password: $("#password").value,
            }),
          });
          await refresh();
        } catch (error) {
          $("#loginError").textContent = error.message === "unauthorized" ? "账号或密码不正确" : error.message;
        }
      });

      $("#logout").addEventListener("click", async () => {
        await request("/api/logout", { method: "POST" });
        showLogin();
      });
      $("#closePreview").addEventListener("click", () => previewModal.classList.add("hidden"));
      previewModal.addEventListener("click", (event) => {
        if (event.target === previewModal) {
          previewModal.classList.add("hidden");
        }
      });

      document.querySelectorAll("[data-snapshot-tab]").forEach((button) => {
        button.addEventListener("click", () => showSnapshotTab(button.dataset.snapshotTab));
      });
      $("#refreshPage").addEventListener("click", refreshCurrentPage);
      document.querySelectorAll("[data-page-link]").forEach((button) => {
        button.addEventListener("click", () => showPage(button.dataset.pageLink));
      });

      request("/api/me").then(refresh).catch(showLogin);
    </script>
  </body>
</html>`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, html, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      return isAuthenticated(req)
        ? json(res, 200, { ok: true, username: config.auth.username })
        : json(res, 401, { error: "unauthorized" });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readJson(req);

      if (
        !safeEqual(body.username || "", config.auth.username) ||
        !safeEqual(body.password || "", config.auth.password)
      ) {
        return json(res, 401, { error: "unauthorized" });
      }

      const sessionId = randomBytes(32).toString("hex");
      sessions.set(sessionId, {
        username: config.auth.username,
        expiresAt: Date.now() + config.auth.sessionTtlSeconds * 1000,
      });

      return json(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie": `admin_session=${sessionId}.${sign(sessionId)}; ${cookieOptions()}`,
        },
      );
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const sessionId = getSessionId(req);

      if (sessionId) {
        sessions.delete(sessionId);
      }

      return json(res, 200, { ok: true }, {
        "Set-Cookie": "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      });
    }

    if (!requireAuth(req, res)) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      return json(res, 200, await getStats());
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      return json(res, 200, await getUsers());
    }

    if (req.method === "GET" && url.pathname === "/api/archives/daily") {
      return json(res, 200, { archives: await getDailyArchives() });
    }

    const dateMatch = url.pathname.match(/^\/api\/dates\/(\d{4}-\d{2}-\d{2})$/);

    if (req.method === "GET" && dateMatch) {
      return json(res, 200, await getDateRoom(dateMatch[1]));
    }

    const snapshotsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/snapshots$/);

    if (req.method === "GET" && snapshotsMatch) {
      const roomId = decodeURIComponent(snapshotsMatch[1]);
      return json(res, 200, { snapshots: await getRoomSnapshots(roomId) });
    }

    const snapshotSceneMatch = url.pathname.match(/^\/api\/snapshots\/(\d+)\/scene$/);

    if (req.method === "GET" && snapshotSceneMatch) {
      const scene = await getSnapshotScene(Number(snapshotSceneMatch[1]));

      if (!scene) {
        return json(res, 404, { error: "snapshot not found" });
      }

      return json(res, 200, scene);
    }

    const restoreMatch = url.pathname.match(/^\/api\/snapshots\/(\d+)\/restore$/);

    if (req.method === "POST" && restoreMatch) {
      const restored = await restoreSnapshot(Number(restoreMatch[1]));

      if (!restored) {
        return json(res, 404, { error: "snapshot not found" });
      }

      return json(res, 200, { restored });
    }

    return json(res, 404, { error: "not found" });
  } catch (error) {
    console.error("Admin request failed", error);
    return json(res, error.statusCode || 500, {
      error: error.message || "internal error",
      code: error.code || "ADMIN_ERROR",
    });
  }
});

server.listen(config.port, () => {
  console.log(`Admin server listening on http://localhost:${config.port}`);
  console.log(`Admin login: ${config.auth.username}`);
});
