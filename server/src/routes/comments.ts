import { ObjectId } from "mongodb";
import { z } from "zod";

import { canDo, requireSceneAccess } from "../access";
import { HttpError, parseId } from "../http";
import { writeAudit } from "../repos/audit";
import { onScenesPurged } from "../repos/scenes";

import type { FastifyInstance } from "fastify";
import type { CommentDoc, Database } from "../db";

const text = z.string().trim().min(1).max(4000);
const coord = z.number().finite().min(-1e7).max(1e7);

const view = async (database: Database, docs: CommentDoc[]) => {
  const users = await database.c.users
    .find({
      _id: {
        $in: [
          ...new Set(
            docs.flatMap(
              (d) => [d.userId, d.resolvedBy].filter(Boolean) as ObjectId[],
            ),
          ),
        ],
      },
    })
    .toArray();
  const byId = new Map(users.map((u) => [u._id.toHexString(), u]));
  return docs.map((d) => {
    const author = byId.get(d.userId.toHexString());
    return {
      id: d._id.toHexString(),
      sceneId: d.sceneId.toHexString(),
      userId: d.userId.toHexString(),
      authorName: author?.displayName ?? "Deleted user",
      authorAvatarUrl: author?.avatarUrl ?? null,
      parentId: d.parentId?.toHexString() ?? null,
      text: d.text,
      x: d.positionX,
      y: d.positionY,
      elementId: d.elementId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      resolvedAt: d.resolvedAt?.toISOString() ?? null,
      resolvedByName: d.resolvedBy
        ? byId.get(d.resolvedBy.toHexString())?.displayName ?? null
        : null,
    };
  });
};

/** Comments are a feature-flagged module: with ENABLE_COMMENTS=false none of these routes exist. */
export const commentRoutes = async (app: FastifyInstance) => {
  const { database, config } = app;
  if (!config.flags.comments) {
    return;
  }
  const guard = { preHandler: app.requireAuth };

  onScenesPurged(async (ids) => {
    await database.c.comments.deleteMany({ sceneId: { $in: ids } });
  });

  const emit = async (
    sceneId: ObjectId,
    op: string,
    docs: CommentDoc[],
    extra: object = {},
  ) => {
    const comments = await view(database, docs);
    app.collab.emit(sceneId, { t: "comment", op, comments, ...extra });
    return comments;
  };

  app.get("/scenes/:id/comments", guard, async (req) => {
    const { scene } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "read",
      { projection: { data: 0, thumbnail: 0 } },
    );
    const docs = await database.c.comments
      .find({ sceneId: scene._id })
      .sort({ createdAt: 1 })
      .limit(2000)
      .toArray();
    return { comments: await view(database, docs) };
  });

  app.post("/scenes/:id/comments", guard, async (req, reply) => {
    // Anyone who can open the scene (even view-only) may comment; nobody else can.
    const { scene, user } = await requireSceneAccess(
      req,
      (req.params as any).id,
      "read",
      { projection: { data: 0, thumbnail: 0 } },
    );
    const body = z
      .object({
        text,
        x: coord.optional(),
        y: coord.optional(),
        elementId: z.string().max(128).nullable().optional(),
        parentId: z.string().optional(),
      })
      .parse(req.body);

    let root: CommentDoc | null = null;
    if (body.parentId) {
      const parent = await database.c.comments.findOne({
        _id: parseId(body.parentId, "comment"),
        sceneId: scene._id,
      });
      if (!parent) {
        throw new HttpError(404, "not_found", "comment not found");
      }
      // replies always attach to the thread root
      root = parent.parentId
        ? await database.c.comments.findOne({
            _id: parent.parentId,
            sceneId: scene._id,
          })
        : parent;
      if (!root) {
        throw new HttpError(404, "not_found", "comment not found");
      }
    } else if (body.x === undefined || body.y === undefined) {
      throw new HttpError(
        400,
        "position_required",
        "a new thread needs a canvas position",
      );
    }
    const now = new Date();
    const doc: CommentDoc = {
      _id: new ObjectId(),
      sceneId: scene._id,
      userId: user._id,
      parentId: root?._id ?? null,
      text: body.text,
      positionX: root ? root.positionX : body.x!,
      positionY: root ? root.positionY : body.y!,
      elementId: root ? root.elementId : body.elementId ?? null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolvedBy: null,
    };
    await database.c.comments.insertOne(doc);
    // a reply on a resolved thread reopens it
    if (root?.resolvedAt) {
      await database.c.comments.updateOne(
        { _id: root._id },
        { $set: { resolvedAt: null, resolvedBy: null } },
      );
    }
    const out = await emit(
      scene._id,
      "created",
      root?.resolvedAt
        ? [doc, { ...root, resolvedAt: null, resolvedBy: null }]
        : [doc],
    );
    return reply.code(201).send({ comment: out[0] });
  });

  const loadComment = async (req: any) => {
    const comment = await database.c.comments.findOne({
      _id: parseId(req.params.id, "comment"),
    });
    if (!comment) {
      throw new HttpError(404, "not_found", "comment not found");
    }
    const ctx = await requireSceneAccess(
      req,
      comment.sceneId.toHexString(),
      "read",
      { projection: { data: 0, thumbnail: 0 } },
    );
    return { comment, ...ctx };
  };

  app.patch("/comments/:id", guard, async (req) => {
    const { comment, user, scene, access } = await loadComment(req);
    const body = z
      .object({ text: text.optional(), resolved: z.boolean().optional() })
      .refine((b) => b.text !== undefined || b.resolved !== undefined)
      .parse(req.body);
    const set: Partial<CommentDoc> = {};
    if (body.text !== undefined) {
      if (!comment.userId.equals(user._id)) {
        throw new HttpError(
          403,
          "forbidden",
          "only the author can edit a comment",
        );
      }
      set.text = body.text;
      set.updatedAt = new Date();
    }
    if (body.resolved !== undefined) {
      if (comment.parentId) {
        throw new HttpError(
          400,
          "not_a_thread",
          "resolve the thread, not a reply",
        );
      }
      // authors, and anyone who can edit the scene, may resolve/reopen
      if (!comment.userId.equals(user._id) && !canDo(access, "write")) {
        throw new HttpError(403, "forbidden", "you cannot resolve this thread");
      }
      set.resolvedAt = body.resolved ? new Date() : null;
      set.resolvedBy = body.resolved ? user._id : null;
    }
    const updated = await database.c.comments.findOneAndUpdate(
      { _id: comment._id },
      { $set: set },
      { returnDocument: "after" },
    );
    const out = await emit(scene._id, "updated", [updated!]);
    return { comment: out[0] };
  });

  app.delete("/comments/:id", guard, async (req, reply) => {
    const { comment, user, scene, access } = await loadComment(req);
    // authors delete their own; the scene owner can moderate
    if (!comment.userId.equals(user._id) && !canDo(access, "share")) {
      throw new HttpError(
        403,
        "forbidden",
        "you can only delete your own comments",
      );
    }
    const ids = [comment._id];
    if (!comment.parentId) {
      const replies = await database.c.comments
        .find({ parentId: comment._id }, { projection: { _id: 1 } })
        .toArray();
      ids.push(...replies.map((r) => r._id));
    }
    await database.c.comments.deleteMany({ _id: { $in: ids } });
    app.collab.emit(scene._id, {
      t: "comment",
      op: "deleted",
      ids: ids.map((i) => i.toHexString()),
    });
    await writeAudit(database, {
      action: "COMMENT_DELETED",
      actorId: user._id,
      workspaceId: scene.workspaceId,
      targetType: "comment",
      targetId: comment._id.toHexString(),
      ip: req.ip,
    });
    return reply.code(204).send();
  });
};
