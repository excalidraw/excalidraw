export const config = {
  port: Number(process.env.PORT || 3002),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3001",
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "shangban_app",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "shangban",
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  },
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  allowMemoryRoomAliasFallback:
    process.env.ALLOW_MEMORY_ROOM_ALIAS_FALLBACK === "true",
  roomAlias: {
    timeZone: process.env.ROOM_ALIAS_TIME_ZONE || "Asia/Shanghai",
    maxPastDays: Number(process.env.ROOM_ALIAS_MAX_PAST_DAYS || 7),
  },
  scene: {
    latestSaveThrottleMs: Number(process.env.SCENE_LATEST_THROTTLE_MS || 5000),
    latestTtlSeconds: Number(
      process.env.SCENE_LATEST_TTL_SECONDS || 8 * 24 * 60 * 60,
    ),
    historySnapshotIntervalMs: Number(
      process.env.SCENE_HISTORY_INTERVAL_MS || 10 * 60 * 1000,
    ),
  },
};
