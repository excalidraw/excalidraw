import { ObjectId } from "mongodb";
import { z } from "zod";

import {
  HttpError,
  parseId,
  requireUser,
  requireWorkspacePermission,
} from "../http";
import { writeAudit } from "../repos/audit";
import { findUserByEmail } from "../repos/users";
import {
  createWorkspace,
  toPublicMember,
  toPublicWorkspace,
} from "../repos/workspaces";
import { ROLE_RANK } from "../security/rbac";

import type { FastifyInstance } from "fastify";

const name = z.string().trim().min(1).max(80);
const assignableRole = z.enum(["ADMIN", "MEMBER"]);

export const workspaceRoutes = async (app: FastifyInstance) => {
  const { database } = app;
  const guard = { preHandler: app.requireAuth };
  /** ENABLE_WORKSPACES=false = single-user mode: each account keeps only its personal workspace. */
  const multiUserOnly = () => {
    if (!app.config.flags.workspaces) {
      throw new HttpError(
        404,
        "feature_disabled",
        "Shared workspaces are disabled on this server.",
      );
    }
  };

  app.post("/workspaces", guard, async (req, reply) => {
    multiUserOnly();
    const user = requireUser(req);
    const body = z.object({ name }).parse(req.body);
    const ws = await createWorkspace(database, {
      name: body.name,
      ownerId: user._id,
    });
    await writeAudit(database, {
      action: "WORKSPACE_CREATED",
      actorId: user._id,
      workspaceId: ws._id,
      ip: req.ip,
    });
    return reply.code(201).send({ workspace: toPublicWorkspace(ws, "OWNER") });
  });

  app.get("/workspaces", guard, async (req) => {
    const user = requireUser(req);
    const memberships = await database.c.workspaceMembers
      .find({ userId: user._id })
      .toArray();
    const workspaces = await database.c.workspaces
      .find({ _id: { $in: memberships.map((m) => m.workspaceId) } })
      .sort({ createdAt: 1 })
      .toArray();
    const roleOf = new Map(
      memberships.map((m) => [m.workspaceId.toHexString(), m.role]),
    );
    return {
      workspaces: workspaces.map((w) =>
        toPublicWorkspace(w, roleOf.get(w._id.toHexString())),
      ),
    };
  });

  app.get("/workspaces/:id", guard, async (req) => {
    const { workspaceId, role } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "workspace:read",
    );
    const ws = await database.c.workspaces.findOne({ _id: workspaceId });
    return { workspace: toPublicWorkspace(ws!, role) };
  });

  app.patch("/workspaces/:id", guard, async (req) => {
    const { workspaceId, role, user } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "workspace:update",
    );
    const body = z.object({ name }).parse(req.body);
    const ws = await database.c.workspaces.findOneAndUpdate(
      { _id: workspaceId },
      { $set: { name: body.name, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    await writeAudit(database, {
      action: "WORKSPACE_UPDATED",
      actorId: user._id,
      workspaceId,
      ip: req.ip,
    });
    return { workspace: toPublicWorkspace(ws!, role) };
  });

  app.delete("/workspaces/:id", guard, async (req, reply) => {
    const { workspaceId, user } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "workspace:delete",
    );
    await app.cascadeDeleteWorkspace(workspaceId);
    await writeAudit(database, {
      action: "WORKSPACE_DELETED",
      actorId: user._id,
      workspaceId,
      ip: req.ip,
    });
    return reply.code(204).send();
  });

  // ---- members -------------------------------------------------------------

  const memberList = async (workspaceId: ObjectId) => {
    const members = await database.c.workspaceMembers
      .find({ workspaceId })
      .sort({ createdAt: 1 })
      .toArray();
    const users = await database.c.users
      .find({ _id: { $in: members.map((m) => m.userId) } })
      .toArray();
    const byId = new Map(users.map((u) => [u._id.toHexString(), u]));
    return members.flatMap((m) => {
      const u = byId.get(m.userId.toHexString());
      return u ? [toPublicMember(m, u)] : [];
    });
  };

  app.get("/workspaces/:id/members", guard, async (req) => {
    const { workspaceId } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "members:read",
    );
    return { members: await memberList(workspaceId) };
  });

  app.post("/workspaces/:id/members", guard, async (req, reply) => {
    multiUserOnly();
    const {
      workspaceId,
      user,
      role: actorRole,
    } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "members:manage",
    );
    const body = z
      .object({
        email: z.string().trim().email(),
        role: assignableRole.default("MEMBER"),
      })
      .parse(req.body);
    // Only the owner may mint admins.
    if (body.role === "ADMIN" && actorRole !== "OWNER") {
      throw new HttpError(403, "forbidden", "only the owner can add admins");
    }
    const target = await findUserByEmail(database, body.email);
    if (!target || target.status !== "active") {
      throw new HttpError(404, "user_not_found");
    }
    try {
      await database.c.workspaceMembers.insertOne({
        _id: new ObjectId(),
        workspaceId,
        userId: target._id,
        role: body.role,
        createdAt: new Date(),
      });
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new HttpError(409, "already_member");
      }
      throw e;
    }
    await writeAudit(database, {
      action: "USER_INVITED",
      actorId: user._id,
      workspaceId,
      targetType: "user",
      targetId: target._id.toHexString(),
      meta: { role: body.role },
      ip: req.ip,
    });
    return reply.code(201).send({ members: await memberList(workspaceId) });
  });

  app.patch("/workspaces/:id/members/:userId", guard, async (req) => {
    multiUserOnly();
    const {
      workspaceId,
      user,
      role: actorRole,
    } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "members:manage",
    );
    const targetId = parseId((req.params as any).userId, "member");
    const body = z.object({ role: assignableRole }).parse(req.body);
    const target = await database.c.workspaceMembers.findOne({
      workspaceId,
      userId: targetId,
    });
    if (!target) {
      throw new HttpError(404, "not_found", "member not found");
    }
    if (target.role === "OWNER") {
      throw new HttpError(
        403,
        "forbidden",
        "the owner's role cannot be changed",
      );
    }
    // Admins can't touch other admins, nor promote to admin.
    if (
      actorRole !== "OWNER" &&
      (ROLE_RANK[target.role] >= ROLE_RANK[actorRole] || body.role === "ADMIN")
    ) {
      throw new HttpError(403, "forbidden", "insufficient role");
    }
    await database.c.workspaceMembers.updateOne(
      { _id: target._id },
      { $set: { role: body.role } },
    );
    await writeAudit(database, {
      action: "ROLE_CHANGED",
      actorId: user._id,
      workspaceId,
      targetType: "user",
      targetId: targetId.toHexString(),
      meta: { from: target.role, to: body.role },
      ip: req.ip,
    });
    return { members: await memberList(workspaceId) };
  });

  app.delete("/workspaces/:id/members/:userId", guard, async (req, reply) => {
    multiUserOnly();
    const user = requireUser(req);
    const targetId = parseId((req.params as any).userId, "member");
    const isSelf = targetId.equals(user._id);
    // Leaving needs only membership; removing others needs members:manage.
    const { workspaceId, role: actorRole } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      isSelf ? "workspace:read" : "members:manage",
    );
    const target = await database.c.workspaceMembers.findOne({
      workspaceId,
      userId: targetId,
    });
    if (!target) {
      throw new HttpError(404, "not_found", "member not found");
    }
    if (target.role === "OWNER") {
      throw new HttpError(
        403,
        "forbidden",
        "the owner cannot be removed; delete the workspace instead",
      );
    }
    if (
      !isSelf &&
      actorRole !== "OWNER" &&
      ROLE_RANK[target.role] >= ROLE_RANK[actorRole]
    ) {
      throw new HttpError(403, "forbidden", "insufficient role");
    }
    await database.c.workspaceMembers.deleteOne({ _id: target._id });
    // removed members lose live access to the workspace's scenes right away
    const sceneIds = await database.c.scenes
      .find({ workspaceId }, { projection: { _id: 1 } })
      .toArray();
    for (const sc of sceneIds) {
      app.collab.kick(
        sc._id,
        4404,
        "removed from workspace",
        (c) => c.userId === targetId.toHexString(),
      );
    }
    await writeAudit(database, {
      action: "USER_REMOVED",
      actorId: user._id,
      workspaceId,
      targetType: "user",
      targetId: targetId.toHexString(),
      meta: { self: isSelf },
      ip: req.ip,
    });
    return reply.code(204).send();
  });

  // Audit log (admin+)
  app.get("/workspaces/:id/audit", guard, async (req) => {
    const { workspaceId } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "audit:read",
    );
    const logs = await database.c.auditLogs
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return {
      logs: logs.map((l) => ({
        id: l._id.toHexString(),
        action: l.action,
        actorId: l.actorId?.toHexString() ?? null,
        targetType: l.targetType,
        targetId: l.targetId,
        meta: l.meta,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  });
};
