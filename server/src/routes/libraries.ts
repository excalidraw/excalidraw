import { ObjectId } from "mongodb";
import { z } from "zod";

import { HttpError, requireUser, requireWorkspacePermission } from "../http";
import { writeAudit } from "../repos/audit";
import { hasUnsafeKeys, SAFE_KEYS_MESSAGE } from "../security/objectKeys";

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database, LibraryItemDoc } from "../db";

export const MAX_LIBRARY_ITEMS = 1000;
const MAX_ITEM_ELEMENTS = 2000;
const MAX_LIBRARY_BYTES = 12 * 1024 * 1024;
const UNSAFE_URL = /^\s*(javascript|vbscript|data):/i;

const itemSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.enum(["published", "unpublished"]).default("unpublished"),
  created: z
    .number()
    .finite()
    .default(() => Date.now()),
  name: z.string().trim().max(100).nullish(),
  elements: z
    .array(
      z
        .object({
          id: z.string().min(1).max(128),
          type: z.string().min(1).max(32),
        })
        .passthrough()
        .refine((el) => !hasUnsafeKeys(el), SAFE_KEYS_MESSAGE),
    )
    .min(1)
    .max(MAX_ITEM_ELEMENTS),
});

const itemsBody = z.object({
  items: z.array(itemSchema).max(MAX_LIBRARY_ITEMS),
});

const clean = (elements: Record<string, any>[]) =>
  elements.map((e) =>
    typeof e.link === "string" && UNSAFE_URL.test(e.link)
      ? { ...e, link: null }
      : e,
  );

const toPublic = (i: LibraryItemDoc) => ({
  id: i.itemId,
  status: i.status,
  created: i.created,
  name: i.name ?? undefined,
  elements: i.elements,
});

const getOrCreateLibrary = async (
  database: Database,
  kind: "personal" | "workspace",
  ownerId: ObjectId,
) => {
  const now = new Date();
  const res = await database.c.libraries.findOneAndUpdate(
    { kind, ownerId },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        kind,
        ownerId,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return res!;
};

const listItems = async (database: Database, libraryId: ObjectId) =>
  (
    await database.c.libraryItems
      .find({ libraryId })
      .sort({ position: 1 })
      .toArray()
  ).map(toPublic);

/**
 * Personal and workspace libraries share one implementation:
 *   GET     -> items                        PUT   -> replace (Excalidraw's onLibraryChange sends the full list)
 *   POST /import -> merge by item id        DELETE -> empty the library
 */
export const libraryRoutes = async (app: FastifyInstance) => {
  const { database } = app;
  const guard = { preHandler: app.requireAuth };
  const big = { bodyLimit: MAX_LIBRARY_BYTES + 256 * 1024 };

  onWorkspaceCleanup(app);

  const register = (
    base: string,
    resolve: (
      req: FastifyRequest,
      write: boolean,
    ) => Promise<{
      kind: "personal" | "workspace";
      ownerId: ObjectId;
      workspaceId?: ObjectId;
    }>,
  ) => {
    app.get(base, guard, async (req) => {
      const { kind, ownerId } = await resolve(req, false);
      const lib = await getOrCreateLibrary(database, kind, ownerId);
      return { items: await listItems(database, lib._id) };
    });

    app.put(base, { ...guard, ...big }, async (req) => {
      const { kind, ownerId, workspaceId } = await resolve(req, true);
      const body = itemsBody.parse(req.body);
      const lib = await getOrCreateLibrary(database, kind, ownerId);
      const seen = new Set<string>();
      const docs: LibraryItemDoc[] = [];
      let total = 0;
      for (const [position, item] of body.items.entries()) {
        if (seen.has(item.id)) {
          continue; // ignore duplicates in one payload
        }
        seen.add(item.id);
        const elements = clean(item.elements);
        const sizeBytes = Buffer.byteLength(JSON.stringify(elements));
        total += sizeBytes;
        docs.push({
          _id: new ObjectId(),
          libraryId: lib._id,
          itemId: item.id,
          status: item.status,
          name: item.name ?? null,
          elements,
          created: item.created,
          position,
          sizeBytes,
          updatedAt: new Date(),
        });
      }
      if (total > MAX_LIBRARY_BYTES) {
        throw new HttpError(413, "library_too_large");
      }
      // upsert current items in order, then drop the ones that disappeared
      if (docs.length) {
        await database.c.libraryItems.bulkWrite(
          docs.map(({ _id, ...d }) => ({
            updateOne: {
              filter: { libraryId: lib._id, itemId: d.itemId },
              update: { $set: d, $setOnInsert: { _id } },
              upsert: true,
            },
          })),
        );
      }
      await database.c.libraryItems.deleteMany({
        libraryId: lib._id,
        itemId: { $nin: [...seen] },
      });
      await database.c.libraries.updateOne(
        { _id: lib._id },
        { $set: { updatedAt: new Date() } },
      );
      if (workspaceId) {
        await writeAudit(database, {
          action: "LIBRARY_UPDATED",
          actorId: requireUser(req)._id,
          workspaceId,
          meta: { items: docs.length },
          ip: req.ip,
        });
      }
      return { items: await listItems(database, lib._id) };
    });

    app.post(`${base}/import`, { ...guard, ...big }, async (req) => {
      const { kind, ownerId, workspaceId } = await resolve(req, true);
      const body = itemsBody.parse(req.body);
      const lib = await getOrCreateLibrary(database, kind, ownerId);
      const existing = await database.c.libraryItems
        .find(
          { libraryId: lib._id },
          { projection: { itemId: 1, position: 1, sizeBytes: 1 } },
        )
        .toArray();
      if (existing.length + body.items.length > MAX_LIBRARY_ITEMS) {
        throw new HttpError(
          413,
          "library_full",
          `a library holds at most ${MAX_LIBRARY_ITEMS} items`,
        );
      }
      const known = new Set(existing.map((e) => e.itemId));
      let position = existing.reduce((m, e) => Math.max(m, e.position), -1) + 1;
      let bytes = existing.reduce((n, e) => n + e.sizeBytes, 0);
      const fresh: LibraryItemDoc[] = [];
      for (const item of body.items) {
        if (known.has(item.id)) {
          continue; // merge: existing items win
        }
        known.add(item.id);
        const elements = clean(item.elements);
        const sizeBytes = Buffer.byteLength(JSON.stringify(elements));
        bytes += sizeBytes;
        fresh.push({
          _id: new ObjectId(),
          libraryId: lib._id,
          itemId: item.id,
          status: item.status,
          name: item.name ?? null,
          elements,
          created: item.created,
          position: position++,
          sizeBytes,
          updatedAt: new Date(),
        });
      }
      if (bytes > MAX_LIBRARY_BYTES) {
        throw new HttpError(413, "library_too_large");
      }
      if (fresh.length) {
        await database.c.libraryItems.insertMany(fresh);
      }
      if (workspaceId) {
        await writeAudit(database, {
          action: "LIBRARY_IMPORTED",
          actorId: requireUser(req)._id,
          workspaceId,
          meta: { added: fresh.length },
          ip: req.ip,
        });
      }
      return { added: fresh.length, items: await listItems(database, lib._id) };
    });

    app.delete(base, guard, async (req, reply) => {
      const { kind, ownerId, workspaceId } = await resolve(req, true);
      const lib = await database.c.libraries.findOne({ kind, ownerId });
      if (lib) {
        await database.c.libraryItems.deleteMany({ libraryId: lib._id });
        await database.c.libraries.updateOne(
          { _id: lib._id },
          { $set: { updatedAt: new Date() } },
        );
      }
      if (workspaceId) {
        await writeAudit(database, {
          action: "LIBRARY_CLEARED",
          actorId: requireUser(req)._id,
          workspaceId,
          ip: req.ip,
        });
      }
      return reply.code(204).send();
    });
  };

  register("/libraries/personal", async (req) => ({
    kind: "personal",
    ownerId: requireUser(req)._id,
  }));
  register("/workspaces/:id/library", async (req, write) => {
    const { workspaceId } = await requireWorkspacePermission(
      req,
      (req.params as any).id,
      write ? "library:manage" : "workspace:read",
    );
    return { kind: "workspace", ownerId: workspaceId, workspaceId };
  });
};

/** Libraries disappear with their owner workspace. */
const onWorkspaceCleanup = (app: FastifyInstance) => {
  app.onWorkspaceDelete(async (workspaceId) => {
    const libs = await app.database.c.libraries
      .find({ kind: "workspace", ownerId: workspaceId })
      .toArray();
    await app.database.c.libraryItems.deleteMany({
      libraryId: { $in: libs.map((l) => l._id) },
    });
    await app.database.c.libraries.deleteMany({
      kind: "workspace",
      ownerId: workspaceId,
    });
  });
};
