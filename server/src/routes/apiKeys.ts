import { ObjectId } from "mongodb";
import { z } from "zod";

import { generateApiKey, hashSecret, toPublicKey } from "../apiKeys";
import { API_SCOPES } from "../db";
import {
  HttpError,
  parseId,
  requireUser,
  requireWorkspacePermission,
  sessionRateKey,
} from "../http";
import { writeAudit } from "../repos/audit";
import { roleHas } from "../security/rbac";

import type { FastifyInstance } from "fastify";
import type { ApiKeyDoc } from "../db";

const MAX_ACTIVE_KEYS = 25;

const createBody = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1).max(API_SCOPES.length),
  expiresInDays: z.number().int().min(1).max(730).optional(),
  /** personal keys only: confine the key to one workspace */
  workspaceId: z.string().length(24).optional(),
});

/** Key management (cookie session). The full secret is returned once, at creation/rotation. */
export const apiKeyRoutes = async (app: FastifyInstance) => {
  const { database, config } = app;
  const guard = { preHandler: app.requireAuth };
  // per signed-in session; generous enough for scripted setup, tight enough to stop abuse
  const strict = {
    config: {
      rateLimit: {
        max: 40,
        timeWindow: "1 minute",
        keyGenerator: sessionRateKey,
      },
    },
  };

  const activeCount = (filter: object) =>
    database.c.apiKeys.countDocuments({
      ...filter,
      revokedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

  const issue = async (
    req: import("fastify").FastifyRequest,
    base: Pick<ApiKeyDoc, "kind" | "workspaceId" | "userId">,
    body: z.infer<typeof createBody>,
    limitFilter: object,
  ) => {
    if ((await activeCount(limitFilter)) >= MAX_ACTIVE_KEYS) {
      throw new HttpError(
        409,
        "too_many_keys",
        `At most ${MAX_ACTIVE_KEYS} active keys are allowed; revoke one first.`,
      );
    }
    const { prefix, secret, full } = generateApiKey();
    const doc: ApiKeyDoc = {
      _id: new ObjectId(),
      ...base,
      name: body.name,
      prefix,
      secretHash: hashSecret(secret, config.encryptionKey),
      scopes: [...new Set(body.scopes)],
      createdAt: new Date(),
      expiresAt: body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86_400_000)
        : null,
      lastUsedAt: null,
      revokedAt: null,
    };
    await database.c.apiKeys.insertOne(doc);
    await writeAudit(database, {
      action: "API_KEY_CREATED",
      actorId: base.userId,
      workspaceId: base.workspaceId,
      targetType: "api_key",
      targetId: doc._id.toHexString(),
      // the secret and hash never reach the log
      meta: {
        name: doc.name,
        kind: doc.kind,
        scopes: doc.scopes,
        prefix: `ewk_${prefix}`,
      },
      ip: req.ip,
    });
    return { key: toPublicKey(doc), secret: full };
  };

  app.get("/me/api-keys", guard, async (req) => {
    const user = requireUser(req);
    const keys = await database.c.apiKeys
      .find({ userId: user._id, kind: "personal" })
      .sort({ createdAt: -1 })
      .toArray();
    return { keys: keys.map(toPublicKey) };
  });

  app.post("/me/api-keys", { ...guard, ...strict }, async (req, reply) => {
    const user = requireUser(req);
    const body = createBody.parse(req.body);
    let workspaceId: ObjectId | null = null;
    if (body.workspaceId) {
      workspaceId = parseId(body.workspaceId, "workspace");
      if (
        !(await database.c.workspaceMembers.findOne({
          workspaceId,
          userId: user._id,
        }))
      ) {
        throw new HttpError(404, "not_found", "workspace not found");
      }
    }
    const out = await issue(
      req,
      { kind: "personal", workspaceId, userId: user._id },
      body,
      { userId: user._id, kind: "personal" },
    );
    return reply.code(201).send(out);
  });

  app.get("/workspaces/:id/api-keys", guard, async (req) => {
    const { workspaceId } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "apikey:manage",
    );
    const keys = await database.c.apiKeys
      .find({ workspaceId, kind: "workspace" })
      .sort({ createdAt: -1 })
      .toArray();
    return { keys: keys.map(toPublicKey) };
  });

  app.post(
    "/workspaces/:id/api-keys",
    { ...guard, ...strict },
    async (req, reply) => {
      const { workspaceId, user } = await requireWorkspacePermission(
        req,
        (req.params as any).id,
        "apikey:manage",
      );
      const body = createBody.parse(req.body);
      const out = await issue(
        req,
        { kind: "workspace", workspaceId, userId: user._id },
        body,
        { workspaceId, kind: "workspace" },
      );
      return reply.code(201).send(out);
    },
  );

  /** Loads a key the caller may manage: their own personal key, or a workspace key as an admin. */
  const manageable = async (req: import("fastify").FastifyRequest) => {
    const user = requireUser(req);
    const key = await database.c.apiKeys.findOne({
      _id: parseId((req.params as any).id, "api key"),
    });
    const notFound = new HttpError(404, "not_found", "api key not found");
    if (!key) {
      throw notFound;
    }
    if (key.kind === "personal") {
      if (!key.userId.equals(user._id)) {
        throw notFound;
      }
    } else {
      const m = await database.c.workspaceMembers.findOne({
        workspaceId: key.workspaceId!,
        userId: user._id,
      });
      if (!m) {
        throw notFound;
      }
      if (!roleHas(m.role, "apikey:manage")) {
        throw new HttpError(
          403,
          "forbidden",
          "missing permission apikey:manage",
        );
      }
    }
    return { key, user };
  };

  app.post("/api-keys/:id/rotate", { ...guard, ...strict }, async (req) => {
    const { key, user } = await manageable(req);
    if (key.revokedAt) {
      throw new HttpError(
        409,
        "revoked",
        "This key has been revoked; create a new one.",
      );
    }
    const { prefix, secret, full } = generateApiKey();
    // same id, scopes and name; the old secret stops working immediately
    const updated = await database.c.apiKeys.findOneAndUpdate(
      { _id: key._id },
      {
        $set: {
          prefix,
          secretHash: hashSecret(secret, config.encryptionKey),
          lastUsedAt: null,
        },
      },
      { returnDocument: "after" },
    );
    await writeAudit(database, {
      action: "API_KEY_ROTATED",
      actorId: user._id,
      workspaceId: key.workspaceId,
      targetType: "api_key",
      targetId: key._id.toHexString(),
      meta: { prefix: `ewk_${prefix}` },
      ip: req.ip,
    });
    return { key: toPublicKey(updated!), secret: full };
  });

  app.delete("/api-keys/:id", guard, async (req, reply) => {
    const { key, user } = await manageable(req);
    if (!key.revokedAt) {
      await database.c.apiKeys.updateOne(
        { _id: key._id },
        { $set: { revokedAt: new Date() } },
      );
      await writeAudit(database, {
        action: "API_KEY_REVOKED",
        actorId: user._id,
        workspaceId: key.workspaceId,
        targetType: "api_key",
        targetId: key._id.toHexString(),
        meta: { prefix: `ewk_${key.prefix}` },
        ip: req.ip,
      });
    }
    return reply.code(204).send();
  });
};
