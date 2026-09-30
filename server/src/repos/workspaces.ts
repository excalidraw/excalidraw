import { MongoServerError, ObjectId } from "mongodb";

import type { Database, Role, WorkspaceDoc, WorkspaceMemberDoc } from "../db";

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";

export const createWorkspace = async (
  database: Database,
  input: { name: string; ownerId: ObjectId },
) => {
  const base = slugify(input.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix =
      attempt === 0
        ? ""
        : `-${Math.random()
            .toString(36)
            .slice(2, 6 + attempt)}`;
    const now = new Date();
    const ws: WorkspaceDoc = {
      _id: new ObjectId(),
      name: input.name,
      slug: `${base}${suffix}`,
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await database.c.workspaces.insertOne(ws);
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        continue; // slug collision -> retry with a random suffix
      }
      throw e;
    }
    await database.c.workspaceMembers.insertOne({
      _id: new ObjectId(),
      workspaceId: ws._id,
      userId: input.ownerId,
      role: "OWNER",
      createdAt: now,
    });
    return ws;
  }
  throw new Error("could not allocate a unique workspace slug");
};

export const toPublicWorkspace = (ws: WorkspaceDoc, role?: Role) => ({
  id: ws._id.toHexString(),
  name: ws.name,
  slug: ws.slug,
  ownerId: ws.ownerId.toHexString(),
  createdAt: ws.createdAt.toISOString(),
  updatedAt: ws.updatedAt.toISOString(),
  ...(role ? { role } : {}),
});

export const toPublicMember = (
  m: WorkspaceMemberDoc,
  user: { email: string; displayName: string; avatarUrl: string | null },
) => ({
  userId: m.userId.toHexString(),
  role: m.role,
  joinedAt: m.createdAt.toISOString(),
  email: user.email,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
});
