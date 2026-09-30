import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildApp } from "../src/app";
import { loadConfig } from "../src/config";
import { CSRF_HEADER, CSRF_VALUE, SESSION_COOKIE } from "../src/constants";
import { connectDatabase } from "../src/db";

export const makeTestApp = async (
  extraEnv: Record<string, string> = {},
  deps: { aiFetch?: typeof fetch } = {},
) => {
  const storagePath = await mkdtemp(path.join(os.tmpdir(), "ew-store-"));
  const config = loadConfig({
    NODE_ENV: "test",
    SESSION_SECRET: "test-secret-test-secret-test-secret-1234",
    MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
    MONGODB_DB: `ew_test_${randomBytes(6).toString("hex")}`,
    AUTH_RATE_LIMIT_MAX: "1000",
    STORAGE_PATH: storagePath,
    ...extraEnv,
  });
  const database = await connectDatabase(config.mongoUri, config.mongoDb);
  const app = await buildApp(config, database, undefined, deps);
  return {
    app,
    database,
    config,
    async close() {
      await app.close();
      await rm(storagePath, { recursive: true, force: true });
      await database.db.dropDatabase();
      await database.close();
    },
  };
};

export type TestApp = Awaited<ReturnType<typeof makeTestApp>>;

export const csrfHeaders = { [CSRF_HEADER]: CSRF_VALUE };

export const cookieFrom = (res: {
  cookies: { name: string; value: string }[];
}) => res.cookies.find((c) => c.name === SESSION_COOKIE)?.value;

let counter = 0;
export const uniqueEmail = () => `user${Date.now()}${counter++}@example.com`;

export const register = async (
  t: TestApp,
  over: Partial<{ email: string; password: string; displayName: string }> = {},
) => {
  const body = {
    email: uniqueEmail(),
    password: "correct horse battery",
    displayName: "Tester",
    ...over,
  };
  const res = await t.app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: csrfHeaders,
    payload: body,
  });
  return { res, body, cookie: cookieFrom(res as any) };
};

export const authed = (cookie: string | undefined) => ({
  ...csrfHeaders,
  cookie: `${SESSION_COOKIE}=${cookie}`,
});
