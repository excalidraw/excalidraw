import type { ObjectId } from "mongodb";

import type { Database, SceneDoc } from "../db";
import type { StorageProvider } from "../storage";

export const toPublicScene = (
  s: Omit<SceneDoc, "data" | "textContent"> & Partial<Pick<SceneDoc, "data">>,
  extra: {
    access?: string;
    ownerName?: string;
    folderName?: string | null;
  } = {},
) => ({
  id: s._id.toHexString(),
  workspaceId: s.workspaceId.toHexString(),
  ownerId: s.ownerId.toHexString(),
  folderId: s.folderId?.toHexString() ?? null,
  name: s.name,
  visibility: s.visibility,
  hasThumbnail: !!s.thumbnail,
  sizeBytes: s.sizeBytes,
  version: s.version,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
  deletedAt: s.deletedAt?.toISOString() ?? null,
  ...(s.data ? { data: s.data } : {}),
  ...extra,
});

export const sceneFileKey = (sceneId: ObjectId | string, fileId: string) =>
  `scenes/${sceneId.toString()}/${fileId}`;

/** Removes a scene and everything that references it (irreversible). */
export const purgeScenes = async (
  database: Database,
  storage: StorageProvider,
  sceneIds: ObjectId[],
) => {
  for (const id of sceneIds) {
    await storage.deletePrefix(`scenes/${id.toHexString()}`);
  }
  if (sceneIds.length === 0) {
    return;
  }
  await Promise.all([
    database.c.scenePermissions.deleteMany({ sceneId: { $in: sceneIds } }),
    database.c.shareLinks.deleteMany({ sceneId: { $in: sceneIds } }),
    database.c.scenes.deleteMany({ _id: { $in: sceneIds } }),
  ]);
  for (const hook of purgeHooks) {
    await hook(sceneIds);
  }
};

const purgeHooks: Array<(ids: ObjectId[]) => Promise<void>> = [];
/** Later features (comments...) register their own cleanup. */
export const onScenesPurged = (hook: (ids: ObjectId[]) => Promise<void>) => {
  purgeHooks.push(hook);
};

export const purgeExpiredTrash = async (
  database: Database,
  storage: StorageProvider,
  retentionMs: number,
) => {
  const cutoff = new Date(Date.now() - retentionMs);
  const expired = await database.c.scenes
    .find({ deletedAt: { $ne: null, $lt: cutoff } }, { projection: { _id: 1 } })
    .toArray();
  await purgeScenes(
    database,
    storage,
    expired.map((s) => s._id),
  );
  return expired.length;
};

export const escapeRegex = (s: string) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
