import { ObjectId } from "mongodb";
import { z } from "zod";

import { HttpError, parseId, requireWorkspacePermission } from "../http";
import { writeAudit } from "../repos/audit";

import type { FastifyInstance } from "fastify";
import type { FolderDoc } from "../db";

const MAX_DEPTH = 8;
const name = z.string().trim().min(1).max(80);

const toPublic = (f: FolderDoc) => ({
  id: f._id.toHexString(),
  workspaceId: f.workspaceId.toHexString(),
  parentId: f.parentId?.toHexString() ?? null,
  name: f.name,
  createdAt: f.createdAt.toISOString(),
  updatedAt: f.updatedAt.toISOString(),
});

export const folderRoutes = async (app: FastifyInstance) => {
  const { database } = app;
  const guard = { preHandler: app.requireAuth };

  const depthOf = async (workspaceId: ObjectId, folderId: ObjectId | null) => {
    let depth = 0;
    let cur = folderId;
    while (cur) {
      const f = await database.c.folders.findOne({ _id: cur, workspaceId });
      if (!f) {
        throw new HttpError(404, "not_found", "parent folder not found");
      }
      depth++;
      if (depth > MAX_DEPTH + 1) {
        break;
      }
      cur = f.parentId;
    }
    return depth;
  };

  const dupGuard = (e: any) => {
    if (e?.code === 11000) {
      throw new HttpError(
        409,
        "folder_exists",
        "a folder with that name already exists here",
      );
    }
    throw e;
  };

  app.get("/workspaces/:id/folders", guard, async (req) => {
    const { workspaceId } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "workspace:read",
    );
    const folders = await database.c.folders
      .find({ workspaceId })
      .sort({ nameLower: 1 })
      .toArray();
    return { folders: folders.map(toPublic) };
  });

  app.post("/workspaces/:id/folders", guard, async (req, reply) => {
    const { workspaceId, user } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      "folder:manage",
    );
    const body = z
      .object({ name, parentId: z.string().nullable().optional() })
      .parse(req.body);
    const parentId = body.parentId ? parseId(body.parentId, "folder") : null;
    if ((await depthOf(workspaceId, parentId)) >= MAX_DEPTH) {
      throw new HttpError(
        400,
        "too_deep",
        `folders can nest at most ${MAX_DEPTH} levels`,
      );
    }
    const now = new Date();
    const doc: FolderDoc = {
      _id: new ObjectId(),
      workspaceId,
      parentId,
      name: body.name,
      nameLower: body.name.toLowerCase(),
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    };
    await database.c.folders.insertOne(doc).catch(dupGuard);
    return reply.code(201).send({ folder: toPublic(doc) });
  });

  const loadFolder = async (req: any, permission: "folder:manage") => {
    const folderId = parseId(req.params.id, "folder");
    const folder = await database.c.folders.findOne({ _id: folderId });
    if (!folder) {
      throw new HttpError(404, "not_found", "folder not found");
    }
    const ctx = await requireWorkspacePermission(
      req,
      folder.workspaceId.toHexString(),
      permission,
    );
    return { folder, ...ctx };
  };

  app.patch("/folders/:id", guard, async (req) => {
    const { folder, workspaceId } = await loadFolder(req, "folder:manage");
    const body = z
      .object({
        name: name.optional(),
        parentId: z.string().nullable().optional(),
      })
      .refine((b) => b.name !== undefined || b.parentId !== undefined)
      .parse(req.body);
    const set: Partial<FolderDoc> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      set.name = body.name;
      set.nameLower = body.name.toLowerCase();
    }
    if (body.parentId !== undefined) {
      const newParent = body.parentId ? parseId(body.parentId, "folder") : null;
      if (newParent) {
        // Reject moving a folder into itself or its own descendants.
        let cur: ObjectId | null = newParent;
        while (cur) {
          if (cur.equals(folder._id)) {
            throw new HttpError(
              400,
              "cycle",
              "cannot move a folder into itself",
            );
          }
          const p: FolderDoc | null = await database.c.folders.findOne({
            _id: cur,
            workspaceId,
          });
          if (!p) {
            throw new HttpError(404, "not_found", "parent folder not found");
          }
          cur = p.parentId;
        }
        // subtree height + new depth must fit
        let height = 1;
        let level = [folder._id];
        while (level.length) {
          const kids = await database.c.folders
            .find({ parentId: { $in: level } })
            .toArray();
          level = kids.map((k) => k._id);
          if (kids.length) {
            height++;
          }
        }
        if ((await depthOf(workspaceId, newParent)) + height > MAX_DEPTH) {
          throw new HttpError(
            400,
            "too_deep",
            `folders can nest at most ${MAX_DEPTH} levels`,
          );
        }
      }
      set.parentId = newParent;
    }
    const updated = await database.c.folders
      .findOneAndUpdate(
        { _id: folder._id },
        { $set: set },
        { returnDocument: "after" },
      )
      .catch(dupGuard);
    return { folder: toPublic(updated!) };
  });

  // Deleting a folder never destroys content: children move up one level.
  app.delete("/folders/:id", guard, async (req, reply) => {
    const { folder, user, workspaceId } = await loadFolder(
      req,
      "folder:manage",
    );
    const parentId = folder.parentId;
    const kids = await database.c.folders
      .find({ parentId: folder._id })
      .toArray();
    for (const k of kids) {
      let name = k.name;
      // avoid unique-name collisions in the destination
      for (
        let i = 2;
        await database.c.folders.findOne({
          workspaceId,
          parentId,
          nameLower: name.toLowerCase(),
        });
        i++
      ) {
        name = `${k.name} (${i})`;
      }
      await database.c.folders.updateOne(
        { _id: k._id },
        {
          $set: {
            parentId,
            name,
            nameLower: name.toLowerCase(),
            updatedAt: new Date(),
          },
        },
      );
    }
    await database.c.scenes.updateMany(
      { folderId: folder._id },
      { $set: { folderId: parentId } },
    );
    await database.c.folders.deleteOne({ _id: folder._id });
    await writeAudit(database, {
      action: "FOLDER_DELETED",
      actorId: user._id,
      workspaceId,
      targetType: "folder",
      targetId: folder._id.toHexString(),
      ip: req.ip,
    });
    return reply.code(204).send();
  });
};
