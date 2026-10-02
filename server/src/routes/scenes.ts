import { ObjectId } from "mongodb";
import { z } from "zod";

import { canDo, requireSceneAccess } from "../access";
import {
  HttpError,
  parseId,
  requireUser,
  requireWorkspacePermission,
} from "../http";
import { writeAudit } from "../repos/audit";
import {
  escapeRegex,
  purgeScenes,
  sceneFileKey,
  toPublicScene,
} from "../repos/scenes";
import { roleHas } from "../security/rbac";
import {
  buildSceneFields,
  MAX_SCENE_BYTES,
  sceneDataSchema,
} from "../sceneData";
import {
  commitSceneData,
  FILE_BODY_LIMIT,
  saveBodySchema,
  sendSceneFile,
  storeSceneFile,
} from "../sceneOps";

import type { FastifyInstance } from "fastify";
import type { Filter } from "mongodb";
import type { SceneDoc } from "../db";

const sceneName = z.string().trim().min(1).max(200);
const emptyData = { elements: [] as never[], appState: {} };
const LIST_PROJECTION = { data: 0, textContent: 0 } as const;

export const sceneRoutes = async (app: FastifyInstance) => {
  const { database, storage } = app;
  const guard = { preHandler: app.requireAuth };
  const bigBody = { bodyLimit: MAX_SCENE_BYTES + 512 * 1024 };

  app.onWorkspaceDelete(async (workspaceId) => {
    const ids = await database.c.scenes
      .find({ workspaceId }, { projection: { _id: 1 } })
      .toArray();
    await purgeScenes(
      database,
      storage,
      ids.map((s) => s._id),
    );
    await database.c.folders.deleteMany({ workspaceId });
  });

  // ---- create / list ----------------------------------------------------------

  app.post(
    "/workspaces/:id/scenes",
    { ...guard, ...bigBody },
    async (req, reply) => {
      const { workspaceId, user } = await requireWorkspacePermission(
        req,
        (req.params as any).id,
        "scene:create",
      );
      const body = z
        .object({
          name: sceneName.default("Untitled"),
          folderId: z.string().nullable().optional(),
          visibility: z.enum(["workspace", "private"]).default("workspace"),
          data: sceneDataSchema.optional(),
        })
        .parse(req.body ?? {});
      let folderId: ObjectId | null = null;
      if (body.folderId) {
        folderId = parseId(body.folderId, "folder");
        if (
          !(await database.c.folders.findOne({ _id: folderId, workspaceId }))
        ) {
          throw new HttpError(404, "not_found", "folder not found");
        }
      }
      const fields = buildSceneFields(body.data ?? emptyData);
      if (fields.sizeBytes > MAX_SCENE_BYTES) {
        throw new HttpError(413, "scene_too_large");
      }
      const now = new Date();
      const scene: SceneDoc = {
        _id: new ObjectId(),
        workspaceId,
        ownerId: user._id,
        folderId,
        name: body.name,
        visibility: body.visibility,
        ...fields,
        thumbnail: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: user._id,
        deletedAt: null,
        deletedBy: null,
      };
      await database.c.scenes.insertOne(scene);
      await writeAudit(database, {
        action: "SCENE_CREATED",
        actorId: user._id,
        workspaceId,
        targetType: "scene",
        targetId: scene._id.toHexString(),
        ip: req.ip,
      });
      return reply
        .code(201)
        .send({ scene: toPublicScene(scene, { access: "OWNER" }) });
    },
  );

  const listQuery = z.object({
    view: z.enum(["all", "recent", "mine", "trash"]).default("all"),
    folderId: z.string().optional(), // id | "root"
    q: z.string().trim().max(100).optional(),
    sort: z.enum(["updatedAt", "createdAt", "name"]).default("updatedAt"),
    dir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  });

  app.get("/workspaces/:id/scenes", guard, async (req) => {
    const { workspaceId, user, member } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "scene:read",
    );
    const query = listQuery.parse(req.query);
    const isAdmin = roleHas(member.role, "scene:purge");

    const grants = await database.c.scenePermissions
      .find({ userId: user._id }, { projection: { sceneId: 1 } })
      .toArray();
    const visible: Filter<SceneDoc>[] = [
      { visibility: "workspace" },
      { ownerId: user._id },
      { _id: { $in: grants.map((g) => g.sceneId) } },
    ];
    const filter: Filter<SceneDoc> = { workspaceId, $and: [{ $or: visible }] };
    const and = filter.$and!;

    if (query.view === "trash") {
      and.push({ deletedAt: { $ne: null } });
      // Only owners and workspace admins see (and can restore) trashed scenes.
      if (!isAdmin) {
        and.push({ ownerId: user._id });
      }
    } else {
      and.push({ deletedAt: null });
      if (query.view === "mine") {
        and.push({ ownerId: user._id });
      }
    }
    if (query.folderId !== undefined) {
      and.push({
        folderId:
          query.folderId === "root" ? null : parseId(query.folderId, "folder"),
      });
    }
    if (query.q) {
      const rx = new RegExp(escapeRegex(query.q), "i");
      const [owners, folders] = await Promise.all([
        database.c.users
          .find({ displayName: rx }, { projection: { _id: 1 } })
          .limit(50)
          .toArray(),
        database.c.folders
          .find({ workspaceId, name: rx }, { projection: { _id: 1 } })
          .limit(50)
          .toArray(),
      ]);
      and.push({
        $or: [
          { name: rx },
          { textContent: rx },
          { ownerId: { $in: owners.map((o) => o._id) } },
          { folderId: { $in: folders.map((f) => f._id) } },
        ],
      });
    }

    const sortKey = query.view === "recent" ? "updatedAt" : query.sort;
    const dir = query.view === "recent" ? -1 : query.dir === "asc" ? 1 : -1;
    const rows = await database.c.scenes
      .find(filter, { projection: LIST_PROJECTION })
      .collation({ locale: "en", strength: 2 })
      .sort({ [sortKey]: dir, _id: dir })
      .skip(query.offset)
      .limit(
        query.view === "recent"
          ? Math.min(query.limit, 20) + 1
          : query.limit + 1,
      )
      .toArray();
    const limit =
      query.view === "recent" ? Math.min(query.limit, 20) : query.limit;
    const page = rows.slice(0, limit);

    const owners = await database.c.users
      .find({
        _id: {
          $in: [...new Set(page.map((s) => s.ownerId.toHexString()))].map(
            (i) => new ObjectId(i),
          ),
        },
      })
      .toArray();
    const ownerName = new Map(
      owners.map((o) => [o._id.toHexString(), o.displayName]),
    );
    return {
      scenes: page.map((s) =>
        toPublicScene(s as SceneDoc, {
          ownerName: ownerName.get(s.ownerId.toHexString()) ?? "Unknown",
        }),
      ),
      hasMore: rows.length > limit,
    };
  });

  // Scenes other people shared with me (possibly from other workspaces).
  app.get("/scenes/shared", guard, async (req) => {
    const user = requireUser(req);
    const grants = await database.c.scenePermissions
      .find({ userId: user._id })
      .toArray();
    const level = new Map(
      grants.map((g) => [g.sceneId.toHexString(), g.level]),
    );
    const scenes = await database.c.scenes
      .find(
        { _id: { $in: grants.map((g) => g.sceneId) }, deletedAt: null },
        { projection: LIST_PROJECTION },
      )
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();
    return {
      scenes: scenes.map((s) =>
        toPublicScene(s as SceneDoc, {
          access: level.get(s._id.toHexString()),
        }),
      ),
    };
  });

  // ---- read / metadata -----------------------------------------------------------

  app.get("/scenes/:id", guard, async (req) => {
    const { scene, access } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "read",
    );
    return { scene: toPublicScene(scene, { access }) };
  });

  app.get("/scenes/:id/thumbnail", guard, async (req, reply) => {
    const { scene } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "read",
    );
    if (!scene.thumbnail) {
      throw new HttpError(404, "not_found", "no thumbnail");
    }
    const etag = `"t${scene.version}"`;
    reply
      .header("etag", etag)
      .header("cache-control", "private, max-age=0, must-revalidate");
    if (req.headers["if-none-match"] === etag) {
      return reply.code(304).send();
    }
    const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(scene.thumbnail)!;
    return reply.type(m[1]!).send(Buffer.from(m[2]!, "base64"));
  });

  app.patch("/scenes/:id", guard, async (req) => {
    const body = z
      .object({
        name: sceneName.optional(),
        folderId: z.string().nullable().optional(),
        visibility: z.enum(["workspace", "private"]).optional(),
      })
      .refine((b) => Object.keys(b).length > 0)
      .parse(req.body);
    const { scene, user, access } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "rename",
    );
    const set: Partial<SceneDoc> = {
      updatedAt: new Date(),
      updatedBy: user._id,
    };
    if (body.name !== undefined) {
      set.name = body.name;
    }
    if (body.visibility !== undefined) {
      if (!canDo(access, "share")) {
        throw new HttpError(
          403,
          "forbidden",
          "only the owner can change visibility",
        );
      }
      set.visibility = body.visibility;
    }
    if (body.folderId !== undefined) {
      if (body.folderId === null) {
        set.folderId = null;
      } else {
        const folderId = parseId(body.folderId, "folder");
        if (
          !(await database.c.folders.findOne({
            _id: folderId,
            workspaceId: scene.workspaceId,
          }))
        ) {
          throw new HttpError(404, "not_found", "folder not found");
        }
        set.folderId = folderId;
      }
    }
    if (set.visibility && set.visibility !== scene.visibility) {
      app.collab.kick(scene._id, 4403, "visibility changed");
    }
    const updated = await database.c.scenes.findOneAndUpdate(
      { _id: scene._id },
      { $set: set },
      { returnDocument: "after", projection: LIST_PROJECTION },
    );
    return { scene: toPublicScene(updated as SceneDoc, { access }) };
  });

  // ---- autosave -----------------------------------------------------------------

  app.put("/scenes/:id/data", { ...guard, ...bigBody }, async (req, reply) => {
    const body = saveBodySchema.parse(req.body);
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "write",
      {
        projection: { textContent: 0 },
      },
    );
    const result = await commitSceneData(app, scene._id, body, user._id);
    if (!result.ok) {
      // Hand back the server copy so the client can reconcile & retry.
      return reply.code(409).send({
        error: "version_conflict",
        version: result.version,
        data: result.data,
      });
    }
    return { version: result.version, updatedAt: result.updatedAt };
  });

  // ---- lifecycle ----------------------------------------------------------------

  app.post("/scenes/:id/duplicate", guard, async (req, reply) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "read",
    );
    // Duplicating needs create rights in the destination workspace.
    await requireWorkspacePermission(
      req,
      scene.workspaceId.toHexString(),
      "scene:create",
    );
    const now = new Date();
    const copy: SceneDoc = {
      ...scene,
      _id: new ObjectId(),
      ownerId: user._id,
      name: `${scene.name} (copy)`.slice(0, 200),
      version: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: user._id,
      deletedAt: null,
      deletedBy: null,
    };
    for (const fileId of scene.fileIds) {
      const file = await storage.get(sceneFileKey(scene._id, fileId));
      if (file) {
        await storage.put(
          sceneFileKey(copy._id, fileId),
          file.data,
          file.contentType,
        );
      }
    }
    await database.c.scenes.insertOne(copy);
    await writeAudit(database, {
      action: "SCENE_CREATED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: copy._id.toHexString(),
      meta: { duplicatedFrom: scene._id.toHexString() },
      ip: req.ip,
    });
    const { data: _d, textContent: _t, ...rest } = copy;
    return reply
      .code(201)
      .send({ scene: toPublicScene(rest, { access: "OWNER" }) });
  });

  app.delete("/scenes/:id", guard, async (req, reply) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "delete",
    );
    await database.c.scenes.updateOne(
      { _id: scene._id },
      { $set: { deletedAt: new Date(), deletedBy: user._id } },
    );
    app.collab.kick(scene._id, 4404, "scene deleted");
    await writeAudit(database, {
      action: "SCENE_DELETED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: scene._id.toHexString(),
      ip: req.ip,
    });
    return reply.code(204).send();
  });

  app.post("/scenes/:id/restore", guard, async (req) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "delete",
      {
        includeDeleted: true,
      },
    );
    if (!scene.deletedAt) {
      throw new HttpError(409, "not_deleted");
    }
    // If the folder vanished while trashed, restore to the root.
    const folderOk = scene.folderId
      ? await database.c.folders.findOne({ _id: scene.folderId })
      : true;
    await database.c.scenes.updateOne(
      { _id: scene._id },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
          folderId: folderOk ? scene.folderId : null,
          updatedAt: new Date(),
        },
      },
    );
    await writeAudit(database, {
      action: "SCENE_RESTORED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: scene._id.toHexString(),
      ip: req.ip,
    });
    return { ok: true };
  });

  app.delete("/scenes/:id/permanent", guard, async (req, reply) => {
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "purge",
      {
        includeDeleted: true,
      },
    );
    if (!scene.deletedAt) {
      throw new HttpError(409, "not_in_trash", "move the scene to trash first");
    }
    await purgeScenes(database, storage, [scene._id]);
    await writeAudit(database, {
      action: "SCENE_PURGED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "scene",
      targetId: scene._id.toHexString(),
      ip: req.ip,
    });
    return reply.code(204).send();
  });

  // ---- binary files (images) ----------------------------------------------------

  app.put(
    "/scenes/:id/files/:fileId",
    { ...guard, bodyLimit: FILE_BODY_LIMIT },
    async (req, reply) => {
      const { scene } = await requireSceneAccess(
        req,
        (req.params as any).id,
        "write",
      );
      await storeSceneFile(
        app,
        scene._id,
        (req.params as any).fileId,
        req.body,
      );
      return reply.code(204).send();
    },
  );

  app.get("/scenes/:id/files/:fileId", guard, async (req, reply) => {
    const { scene } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "read",
    );
    return sendSceneFile(app, scene._id, (req.params as any).fileId, reply);
  });
};
