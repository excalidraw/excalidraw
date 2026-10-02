import { ObjectId } from "mongodb";
import { z } from "zod";

import { requireSceneAccess } from "../access";
import { HttpError, parseId } from "../http";
import { writeAudit } from "../repos/audit";
import { findUserByEmail } from "../repos/users";
import {
  commitSceneData,
  FILE_BODY_LIMIT,
  saveBodySchema,
  sendSceneFile,
  storeSceneFile,
} from "../sceneOps";
import { decryptSecret, encryptSecret } from "../security/crypto";
import { generateToken, hashToken } from "../security/tokens";

import type { FastifyInstance } from "fastify";
import type { ShareLinkDoc } from "../db";

const level = z.enum(["VIEW", "EDIT"]);
const PURPOSE = "share-link";
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const BIG = 10 * 1024 * 1024 + 512 * 1024;

export const shareRoutes = async (app: FastifyInstance) => {
  const { database, config } = app;
  const guard = { preHandler: app.requireAuth };

  const linkView = (l: ShareLinkDoc) => ({
    id: l._id.toHexString(),
    level: l.level,
    token: decryptSecret(l.tokenEnc, config.sessionSecret, PURPOSE),
    createdAt: l.createdAt.toISOString(),
    expiresAt: l.expiresAt?.toISOString() ?? null,
    revokedAt: l.revokedAt?.toISOString() ?? null,
    lastUsedAt: l.lastUsedAt?.toISOString() ?? null,
  });

  const listShares = async (sceneId: ObjectId) => {
    const [perms, links] = await Promise.all([
      database.c.scenePermissions
        .find({ sceneId })
        .sort({ createdAt: 1 })
        .toArray(),
      database.c.shareLinks
        .find({ sceneId, revokedAt: null })
        .sort({ createdAt: 1 })
        .toArray(),
    ]);
    const users = await database.c.users
      .find({ _id: { $in: perms.map((p) => p.userId) } })
      .toArray();
    const byId = new Map(users.map((u) => [u._id.toHexString(), u]));
    return {
      permissions: perms.flatMap((p) => {
        const u = byId.get(p.userId.toHexString());
        return u
          ? [
              {
                userId: p.userId.toHexString(),
                email: u.email,
                displayName: u.displayName,
                level: p.level,
              },
            ]
          : [];
      }),
      links: links.map(linkView),
    };
  };

  // ---- owner-managed sharing -----------------------------------------------------

  app.get("/scenes/:id/shares", guard, async (req) => {
    const { scene } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "share",
    );
    return listShares(scene._id);
  });

  app.put("/scenes/:id/permissions", guard, async (req) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "share",
    );
    const body = z
      .object({ email: z.string().trim().email(), level })
      .parse(req.body);
    const target = await findUserByEmail(database, body.email);
    if (!target || target.status !== "active") {
      throw new HttpError(404, "user_not_found");
    }
    if (target._id.equals(scene.ownerId)) {
      throw new HttpError(400, "is_owner", "the owner already has full access");
    }
    const existing = await database.c.scenePermissions.findOne({
      sceneId: scene._id,
      userId: target._id,
    });
    await database.c.scenePermissions.updateOne(
      { sceneId: scene._id, userId: target._id },
      {
        $set: { level: body.level, grantedBy: user._id },
        $setOnInsert: { _id: new ObjectId(), createdAt: new Date() },
      },
      { upsert: true },
    );
    // level changes take effect immediately: drop live sessions so they re-authorize
    app.collab.kick(
      scene._id,
      4403,
      "permission changed",
      (c) => c.userId === target._id.toHexString(),
    );
    await writeAudit(database, {
      action: "SCENE_SHARED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: scene._id.toHexString(),
      meta: {
        userId: target._id.toHexString(),
        level: body.level,
        previous: existing?.level ?? null,
      },
      ip: req.ip,
    });
    return listShares(scene._id);
  });

  app.delete("/scenes/:id/permissions/:userId", guard, async (req) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "share",
    );
    const targetId = parseId((req.params as any).userId, "user");
    const res = await database.c.scenePermissions.deleteOne({
      sceneId: scene._id,
      userId: targetId,
    });
    if (!res.deletedCount) {
      throw new HttpError(404, "not_found", "permission not found");
    }
    app.collab.kick(
      scene._id,
      4403,
      "access revoked",
      (c) => c.userId === targetId.toHexString(),
    );
    await writeAudit(database, {
      action: "SCENE_UNSHARED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: scene._id.toHexString(),
      meta: { userId: targetId.toHexString() },
      ip: req.ip,
    });
    return listShares(scene._id);
  });

  app.post("/scenes/:id/links", guard, async (req, reply) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "share",
    );
    const body = z
      .object({
        level: level.default("VIEW"),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(req.body ?? {});
    const token = generateToken(32); // 256 bits -> 43 base64url chars
    const link: ShareLinkDoc = {
      _id: new ObjectId(),
      sceneId: scene._id,
      tokenHash: hashToken(token, config.sessionSecret),
      tokenEnc: encryptSecret(token, config.sessionSecret, PURPOSE),
      level: body.level,
      createdBy: user._id,
      createdAt: new Date(),
      expiresAt: body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86_400_000)
        : null,
      revokedAt: null,
      lastUsedAt: null,
    };
    await database.c.shareLinks.insertOne(link);
    await writeAudit(database, {
      action: "SHARE_LINK_CREATED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: scene._id.toHexString(),
      meta: { level: body.level, linkId: link._id.toHexString() },
      ip: req.ip,
    });
    return reply.code(201).send({ link: linkView(link) });
  });

  app.delete("/scenes/:id/links/:linkId", guard, async (req, reply) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "share",
    );
    const linkId = parseId((req.params as any).linkId, "link");
    const res = await database.c.shareLinks.updateOne(
      { _id: linkId, sceneId: scene._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    if (!res.matchedCount) {
      throw new HttpError(404, "not_found", "link not found");
    }
    // guests (link users) have no user id; drop them all, valid links reconnect
    app.collab.kick(scene._id, 4404, "link revoked", (c) => c.userId === null);
    await writeAudit(database, {
      action: "SHARE_LINK_REVOKED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: scene._id.toHexString(),
      meta: { linkId: linkId.toHexString() },
      ip: req.ip,
    });
    return reply.code(204).send();
  });

  // ---- public token access (no session) -------------------------------------------

  const limit = { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } };

  /** Resolves a token to a live scene + level or throws a uniform 404. */
  const resolveLink = async (tokenRaw: unknown, need: "VIEW" | "EDIT") => {
    const token = typeof tokenRaw === "string" ? tokenRaw : "";
    if (!TOKEN_SHAPE.test(token)) {
      throw new HttpError(404, "not_found");
    }
    const link = await database.c.shareLinks.findOne({
      tokenHash: hashToken(token, config.sessionSecret),
    });
    const dead =
      !link ||
      link.revokedAt ||
      (link.expiresAt && link.expiresAt.getTime() <= Date.now());
    if (!link || dead || (need === "EDIT" && link.level !== "EDIT")) {
      throw new HttpError(
        need === "EDIT" && link && !dead ? 403 : 404,
        need === "EDIT" && link && !dead ? "forbidden" : "not_found",
      );
    }
    const scene = await database.c.scenes.findOne({ _id: link.sceneId });
    if (!scene || scene.deletedAt) {
      throw new HttpError(404, "not_found");
    }
    void database.c.shareLinks
      .updateOne({ _id: link._id }, { $set: { lastUsedAt: new Date() } })
      .catch(() => {});
    return { link, scene };
  };

  app.get("/share/:token", limit, async (req) => {
    const { link, scene } = await resolveLink(
      (req.params as any).token,
      "VIEW",
    );
    return {
      scene: {
        name: scene.name,
        version: scene.version,
        updatedAt: scene.updatedAt.toISOString(),
        data: scene.data,
      },
      level: link.level,
    };
  });

  app.get("/share/:token/files/:fileId", limit, async (req, reply) => {
    const { scene } = await resolveLink((req.params as any).token, "VIEW");
    // Only files the scene actually references are reachable through the link.
    return sendSceneFile(
      app,
      scene._id,
      (req.params as any).fileId,
      reply,
      "private, max-age=300",
    );
  });

  app.put(
    "/share/:token/data",
    { ...limit, bodyLimit: BIG },
    async (req, reply) => {
      const { link, scene } = await resolveLink(
        (req.params as any).token,
        "EDIT",
      );
      const body = saveBodySchema.parse(req.body);
      const result = await commitSceneData(
        app,
        scene._id,
        body,
        link.createdBy,
      );
      if (!result.ok) {
        return reply.code(409).send({
          error: "version_conflict",
          version: result.version,
          data: result.data,
        });
      }
      return { version: result.version, updatedAt: result.updatedAt };
    },
  );

  app.put(
    "/share/:token/files/:fileId",
    { ...limit, bodyLimit: FILE_BODY_LIMIT },
    async (req, reply) => {
      const { scene } = await resolveLink((req.params as any).token, "EDIT");
      await storeSceneFile(
        app,
        scene._id,
        (req.params as any).fileId,
        req.body,
      );
      return reply.code(204).send();
    },
  );
};
