import { HttpError, parseId, requireUser } from "./http";
import { roleHas } from "./security/rbac";

import type { FastifyRequest } from "fastify";
import type { ObjectId } from "mongodb";
import type { SceneDoc, SceneLevel } from "./db";

export type SceneAccess = "OWNER" | "EDIT" | "VIEW";

const rank: Record<SceneAccess, number> = { VIEW: 1, EDIT: 2, OWNER: 3 };

export type SceneAction =
  | "read"
  | "write" // change content
  | "rename" // metadata
  | "delete" // move to trash / restore
  | "purge" // permanent delete
  | "share"; // manage permissions & links

const REQUIRED: Record<SceneAction, SceneAccess> = {
  read: "VIEW",
  write: "EDIT",
  rename: "EDIT",
  delete: "OWNER",
  purge: "OWNER",
  share: "OWNER",
};

/**
 * Central scene authorization. Access is the max of:
 *  - scene owner                                 -> OWNER
 *  - workspace member (visibility=workspace)     -> EDIT
 *  - explicit per-user grant (scene_permissions) -> VIEW | EDIT
 * Workspace ADMIN+ may delete/purge/share any *workspace-visible* scene.
 * Every route must go through this — never trust client-side checks.
 */
export const resolveSceneAccess = async (
  req: FastifyRequest,
  scene: SceneDoc,
  userId: ObjectId,
): Promise<SceneAccess | null> => {
  const { database } = req.server;
  if (scene.ownerId.equals(userId)) {
    return "OWNER";
  }
  let best: SceneAccess | null = null;
  const bump = (a: SceneAccess) => {
    if (!best || rank[a] > rank[best]) {
      best = a;
    }
  };
  const grant = await database.c.scenePermissions.findOne({
    sceneId: scene._id,
    userId,
  });
  if (grant) {
    bump(grant.level as SceneLevel);
  }
  if (scene.visibility === "workspace") {
    const member = await database.c.workspaceMembers.findOne({
      workspaceId: scene.workspaceId,
      userId,
    });
    if (member) {
      bump(roleHas(member.role, "scene:purge") ? "OWNER" : "EDIT");
    }
  }
  return best;
};

export const canDo = (access: SceneAccess | null, action: SceneAction) =>
  !!access && rank[access] >= rank[REQUIRED[action]];

/** Loads a scene and enforces an action. Unknown/inaccessible => 404. */
export const requireSceneAccess = async (
  req: FastifyRequest,
  sceneIdRaw: unknown,
  action: SceneAction,
  opts: { includeDeleted?: boolean; projection?: Record<string, 0 | 1> } = {},
) => {
  const user = requireUser(req);
  const sceneId = parseId(sceneIdRaw, "scene");
  const scene = await req.server.database.c.scenes.findOne(
    { _id: sceneId },
    opts.projection ? { projection: opts.projection } : undefined,
  );
  if (!scene || (scene.deletedAt && !opts.includeDeleted)) {
    throw new HttpError(404, "not_found", "scene not found");
  }
  const access = await resolveSceneAccess(req, scene, user._id);
  if (!access) {
    throw new HttpError(404, "not_found", "scene not found");
  }
  if (!canDo(access, action)) {
    throw new HttpError(403, "forbidden", `cannot ${action} this scene`);
  }
  return { user, scene, access };
};
