import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const envFiles = [
  join(repoRoot, ".env.development"),
  join(repoRoot, "collab-server/.env"),
  join(repoRoot, "admin-server/.env"),
];

export const loadedEnvFiles = envFiles.filter((path) => {
  if (!existsSync(path)) {
    return false;
  }

  loadEnv({ path, override: false });
  return true;
});

export const config = {
  port: Number(process.env.ADMIN_PORT || process.env.PORT || 3003),
  sessionSecret:
    process.env.ADMIN_SESSION_SECRET || "local-admin-session-secret",
  auth: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
    cookieSecure: process.env.ADMIN_COOKIE_SECURE === "true",
    sessionTtlSeconds: Number(
      process.env.ADMIN_SESSION_TTL_SECONDS || 8 * 60 * 60,
    ),
  },
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "shangban_app",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "shangban",
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 1500),
  },
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export const configSource = {
  mysql:
    process.env.MYSQL_HOST || process.env.MYSQL_USER || process.env.MYSQL_PASSWORD
      ? "process.env"
      : "defaults",
  redis: process.env.REDIS_URL ? "process.env" : "defaults",
  admin:
    process.env.ADMIN_USERNAME || process.env.ADMIN_PASSWORD
      ? "process.env"
      : "defaults",
};
