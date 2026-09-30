import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { CSRF_HEADER, CSRF_VALUE, SESSION_COOKIE } from "./constants";
import { bearerOf } from "./apiKeys";
import { scrubUrl } from "./security/logScrub";
import { HttpError } from "./http";
import { authRoutes } from "./routes/auth";
import { CollabHub } from "./collab/hub";
import { aiRoutes } from "./routes/ai";
import { collabRoutes } from "./routes/collab";
import { apiKeyRoutes } from "./routes/apiKeys";
import { commentRoutes } from "./routes/comments";
import { folderRoutes } from "./routes/folders";
import { libraryRoutes } from "./routes/libraries";
import { mcpRoutes } from "./routes/mcp";
import { publicApiRoutes } from "./routes/publicApi";
import { sceneRoutes } from "./routes/scenes";
import { shareRoutes } from "./routes/shares";
import { telemetryRoutes } from "./routes/telemetry";
import { workspaceRoutes } from "./routes/workspaces";
import { createStorage } from "./storage";
import { resolveSession } from "./repos/sessions";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by the module augmentation below
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ObjectId } from "mongodb";
import type { StorageProvider } from "./storage";
import type { Config } from "./config";
import type { Database, SessionDoc, UserDoc } from "./db";

declare module "fastify" {
  interface FastifyRequest {
    auth: { user: UserDoc; session: SessionDoc } | null;
  }
  interface FastifyInstance {
    config: Config;
    routeTable: Array<{ method: string; url: string }>;
    storage: StorageProvider;
    collab: CollabHub;
    /** fetch used for AI providers (swappable in tests) */
    aiFetch: typeof fetch;
    database: Database;
    /** Deletes a workspace and everything that hangs off it. */
    cascadeDeleteWorkspace: (workspaceId: ObjectId) => Promise<void>;
    /** Feature modules register cleanup here (scenes, folders, ...). */
    onWorkspaceDelete: (hook: (workspaceId: ObjectId) => Promise<void>) => void;
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const buildApp = async (
  config: Config,
  database: Database,
  storage: StorageProvider = createStorage(config),
  deps: { aiFetch?: typeof fetch } = {},
): Promise<FastifyInstance> => {
  const app = Fastify({
    logger:
      config.env === "test"
        ? false
        : {
            level: "info",
            serializers: {
              // share tokens live in URL paths: keep them out of the logs
              req: (req: FastifyRequest) => ({
                method: req.method,
                url: scrubUrl(req.url),
                host: req.headers.host,
                remoteAddress: req.ip,
              }),
            },
            // Never log credentials.
            redact: [
              "req.headers.cookie",
              "req.headers.authorization",
              'res.headers["set-cookie"]',
            ],
          },
    // Fastify accepts a hop count at runtime; its type declarations just don't list it
    trustProxy: config.trustProxy as boolean,
    bodyLimit: 1024 * 1024,
  });

  // route inventory (used by the test-suite to prove no route is reachable without auth)
  const routeTable: Array<{ method: string; url: string }> = [];
  app.addHook("onRoute", (r) => {
    for (const method of Array.isArray(r.method) ? r.method : [r.method]) {
      routeTable.push({ method, url: r.url });
    }
  });
  app.decorate("routeTable", routeTable);
  app.decorate("config", config);
  app.decorate("database", database);
  app.decorate("storage", storage);
  app.decorate("aiFetch", deps.aiFetch ?? fetch);
  const hub = new CollabHub(database, app.log as any, {
    flushIntervalMs: config.env === "test" ? 30_000 : 5_000,
  });
  app.decorate("collab", hub);
  app.addHook("onClose", async () => hub.shutdown());
  app.decorateRequest("auth", null);

  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });

  // Security headers + CORS for the configured web origins only.
  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "same-origin");
    reply.header("cross-origin-resource-policy", "same-site");
    if (config.cookieSecure) {
      reply.header(
        "strict-transport-security",
        "max-age=31536000; includeSubDomains",
      );
    }
    reply.header("cache-control", "no-store");
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      reply
        .header("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE")
        .header("access-control-allow-headers", `content-type,${CSRF_HEADER}`)
        .code(204)
        .send();
      return reply;
    }
  });

  // CSRF: SameSite=Lax cookie + Origin allowlist + custom header.
  app.addHook("onRequest", async (req, reply) => {
    if (SAFE_METHODS.has(req.method)) {
      return;
    }
    // Bearer API keys are not ambient credentials (browsers never attach them on their own),
    // so cookie-less key requests are immune to CSRF and skip the check.
    if (bearerOf(req) && !req.cookies[SESSION_COOKIE]) {
      return;
    }
    // The public API and MCP endpoint authenticate by bearer key only and ignore cookies
    // entirely, so there is no ambient credential for a cross-site request to abuse.
    if (req.url.startsWith("/public/") || req.url === "/mcp") {
      return;
    }
    const origin = req.headers.origin;
    if (origin && !config.allowedOrigins.includes(origin)) {
      return reply.code(403).send({ error: "forbidden_origin" });
    }
    if (req.headers[CSRF_HEADER] !== CSRF_VALUE) {
      return reply.code(403).send({ error: "csrf_header_required" });
    }
  });

  // Attach the session (if any) to every request.
  app.addHook("onRequest", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) {
      return;
    }
    req.auth = await resolveSession(database, token, config.sessionSecret);
  });

  app.decorate("requireAuth", async (req, reply) => {
    if (!req.auth) {
      return reply.code(401).send({ error: "unauthenticated" });
    }
  });

  const deleteHooks: Array<(id: ObjectId) => Promise<void>> = [];
  app.decorate("onWorkspaceDelete", (hook) => {
    deleteHooks.push(hook);
  });
  app.decorate("cascadeDeleteWorkspace", async (workspaceId) => {
    for (const hook of deleteHooks) {
      await hook(workspaceId);
    }
    await database.c.workspaceMembers.deleteMany({ workspaceId });
    await database.c.workspaces.deleteOne({ _id: workspaceId });
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err?.name === "ZodError") {
      return reply.code(400).send({
        error: "validation_error",
        issues: err.issues.map((i: any) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    // HttpError is thrown on purpose (validation, auth, upstream failures such as
    // a 502 from an AI provider), so its status is trusted even when it is >= 500.
    if (err instanceof HttpError) {
      if (err.statusCode >= 500) {
        req.log.warn({ code: err.code, status: err.statusCode }, err.message);
      }
      return reply.code(err.statusCode).send({
        error: err.code,
        message: err.message,
        ...((err as any).extra ?? {}),
      });
    }
    if (err?.statusCode && err.statusCode < 500) {
      return reply
        .code(err.statusCode)
        .send({ error: err.code ?? "bad_request", message: err.message });
    }
    req.log.error(
      { err: { message: err?.message, stack: err?.stack } },
      "unhandled",
    );
    return reply.code(500).send({ error: "internal_error" });
  });

  app.get("/health", async () => ({ ok: true }));
  app.get("/api/v1/config", async () => ({ features: config.flags }));

  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(workspaceRoutes, { prefix: "/api/v1" });
  await app.register(folderRoutes, { prefix: "/api/v1" });
  await app.register(sceneRoutes, { prefix: "/api/v1" });
  await app.register(shareRoutes, { prefix: "/api/v1" });
  await app.register(collabRoutes, { prefix: "/api/v1" });
  await app.register(commentRoutes, { prefix: "/api/v1" });
  await app.register(libraryRoutes, { prefix: "/api/v1" });
  await app.register(aiRoutes, { prefix: "/api/v1" });
  await app.register(apiKeyRoutes, { prefix: "/api/v1" });
  await app.register(publicApiRoutes, { prefix: "/public/v1" });
  await app.register(mcpRoutes);
  await app.register(telemetryRoutes, { prefix: "/api/v1" });

  return app;
};
