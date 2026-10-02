import { randomInt } from "node:crypto";

import { ObjectId } from "mongodb";

import { resolveSceneAccess } from "./access";
import { HttpError, parseId } from "./http";
import { writeAudit } from "./repos/audit";
import { escapeRegex, sceneFileKey, toPublicScene } from "./repos/scenes";
import { commitSceneData } from "./sceneOps";
import {
  buildSceneFields,
  MAX_SCENE_BYTES,
  sceneDataSchema,
} from "./sceneData";
import {
  mermaidToElements,
  MermaidSyntaxError,
  UnsupportedDiagramError,
} from "./diagram/mermaid";
import { roleHas } from "./security/rbac";

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Filter } from "mongodb";
import type { ApiPrincipal } from "./apiKeys";
import type { ApiScope, SceneDoc } from "./db";

/**
 * Operations shared by the public REST API and the MCP server. Every function takes the
 * authenticated principal and re-checks scope, workspace confinement and scene access, so
 * neither transport can accidentally skip authorization.
 */

export const requireScope = (p: ApiPrincipal, scope: ApiScope) => {
  if (!p.scopes.has(scope)) {
    throw new HttpError(
      403,
      "insufficient_scope",
      `This API key lacks the "${scope}" scope.`,
    );
  }
};

/** Which workspace a call operates on. A key can never reach outside its own workspace. */
export const resolveWorkspace = async (
  app: FastifyInstance,
  p: ApiPrincipal,
  requested?: string | null,
) => {
  if (p.workspaceId) {
    if (requested && requested !== p.workspaceId.toHexString()) {
      throw new HttpError(
        403,
        "workspace_mismatch",
        "This API key is restricted to a different workspace.",
      );
    }
    return p.workspaceId;
  }
  if (!requested) {
    throw new HttpError(
      400,
      "workspace_required",
      "Pass workspaceId: this key can act in several workspaces.",
    );
  }
  const workspaceId = parseId(requested, "workspace");
  const member = await app.database.c.workspaceMembers.findOne({
    workspaceId,
    userId: p.userId,
  });
  if (!member) {
    throw new HttpError(404, "not_found", "workspace not found");
  }
  return workspaceId;
};

const memberRole = async (
  app: FastifyInstance,
  workspaceId: ObjectId,
  userId: ObjectId,
) =>
  (await app.database.c.workspaceMembers.findOne({ workspaceId, userId }))
    ?.role ?? null;

type Need = "read" | "write" | "delete";
const LEVEL: Record<string, number> = { VIEW: 1, EDIT: 2, OWNER: 3 };

/** Loads a scene the principal may access at the required level; anything else is a uniform 404. */
export const loadScene = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  idRaw: unknown,
  need: Need,
  opts: { projection?: Record<string, 0 | 1> } = {},
) => {
  const scene = await app.database.c.scenes.findOne(
    { _id: parseId(idRaw, "scene") },
    opts.projection ? { projection: opts.projection } : undefined,
  );
  const notFound = () => new HttpError(404, "not_found", "scene not found");
  if (!scene || scene.deletedAt) {
    throw notFound();
  }
  if (p.workspaceId && !p.workspaceId.equals(scene.workspaceId)) {
    throw notFound();
  }
  let level: number;
  if (p.key.kind === "workspace") {
    // service principals only see what the whole workspace can see
    if (scene.visibility !== "workspace") {
      throw notFound();
    }
    level = LEVEL.EDIT!;
  } else {
    const access = await resolveSceneAccess(req, scene, p.userId);
    if (!access) {
      throw notFound();
    }
    level = LEVEL[access]!;
  }
  const required = need === "read" ? 1 : need === "write" ? 2 : 3;
  if (level < required) {
    throw new HttpError(
      403,
      "forbidden",
      `The key's owner cannot ${need} this scene.`,
    );
  }
  return scene;
};

const audit = (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  action: string,
  scene: { _id: ObjectId; workspaceId: ObjectId },
  meta: Record<string, unknown> = {},
) =>
  writeAudit(app.database, {
    action,
    actorId: p.userId,
    workspaceId: scene.workspaceId,
    targetType: "scene",
    targetId: scene._id.toHexString(),
    // (field names containing "key" would be redacted by the audit sanitizer, so the prefix rides in the value)
    meta: { via: `api_key:ewk_${p.key.prefix}`, ...meta },
    ip: req.ip,
  });

// ------------------------------------------------------------------------------ operations

export const getWorkspace = async (
  app: FastifyInstance,
  p: ApiPrincipal,
  requested?: string | null,
) => {
  requireScope(p, "workspace:read");
  const workspaceId = await resolveWorkspace(app, p, requested);
  const [ws, folders] = await Promise.all([
    app.database.c.workspaces.findOne({ _id: workspaceId }),
    app.database.c.folders
      .find({ workspaceId })
      .sort({ nameLower: 1 })
      .toArray(),
  ]);
  return {
    workspace: {
      id: workspaceId.toHexString(),
      name: ws!.name,
      slug: ws!.slug,
    },
    folders: folders.map((f) => ({
      id: f._id.toHexString(),
      name: f.name,
      parentId: f.parentId?.toHexString() ?? null,
    })),
  };
};

export const listScenes = async (
  app: FastifyInstance,
  p: ApiPrincipal,
  q: {
    workspaceId?: string | null;
    q?: string;
    folderId?: string;
    limit?: number;
    offset?: number;
  },
) => {
  requireScope(p, "scene:read");
  const workspaceId = await resolveWorkspace(app, p, q.workspaceId);
  const limit = Math.min(Math.max(q.limit ?? 30, 1), 100);
  const offset = Math.max(q.offset ?? 0, 0);
  const visible: Filter<SceneDoc>[] = [{ visibility: "workspace" }];
  if (p.key.kind === "personal") {
    const grants = await app.database.c.scenePermissions
      .find({ userId: p.userId }, { projection: { sceneId: 1 } })
      .toArray();
    visible.push(
      { ownerId: p.userId },
      { _id: { $in: grants.map((g) => g.sceneId) } },
    );
  }
  const and: Filter<SceneDoc>[] = [{ $or: visible }, { deletedAt: null }];
  if (q.folderId) {
    and.push({
      folderId: q.folderId === "root" ? null : parseId(q.folderId, "folder"),
    });
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q.slice(0, 100)), "i");
    and.push({ $or: [{ name: rx }, { textContent: rx }] });
  }
  const rows = await app.database.c.scenes
    .find(
      { workspaceId, $and: and },
      { projection: { data: 0, textContent: 0 } },
    )
    .sort({ updatedAt: -1, _id: -1 })
    .skip(offset)
    .limit(limit + 1)
    .toArray();
  return {
    scenes: rows.slice(0, limit).map((s) => toPublicScene(s as SceneDoc)),
    hasMore: rows.length > limit,
  };
};

export const getScene = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  id: unknown,
) => {
  requireScope(p, "scene:read");
  const scene = await loadScene(app, req, p, id, "read", {
    projection: { textContent: 0 },
  });
  return { scene: toPublicScene(scene) };
};

export const createScene = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  input: {
    workspaceId?: string | null;
    name?: string;
    folderId?: string | null;
    data?: unknown;
  },
) => {
  requireScope(p, "scene:create");
  const workspaceId = await resolveWorkspace(app, p, input.workspaceId);
  const role = await memberRole(app, workspaceId, p.userId);
  if (!role || !roleHas(role, "scene:create")) {
    throw new HttpError(
      403,
      "forbidden",
      "The key's owner cannot create scenes here.",
    );
  }
  let folderId: ObjectId | null = null;
  if (input.folderId) {
    folderId = parseId(input.folderId, "folder");
    if (
      !(await app.database.c.folders.findOne({ _id: folderId, workspaceId }))
    ) {
      throw new HttpError(404, "not_found", "folder not found");
    }
  }
  const data = sceneDataSchema.parse(
    input.data ?? { elements: [], appState: {} },
  );
  const fields = buildSceneFields(data);
  if (fields.sizeBytes > MAX_SCENE_BYTES) {
    throw new HttpError(413, "scene_too_large");
  }
  const now = new Date();
  const scene: SceneDoc = {
    _id: new ObjectId(),
    workspaceId,
    ownerId: p.userId,
    folderId,
    name: (input.name?.trim() || "Untitled").slice(0, 200),
    visibility: "workspace",
    ...fields,
    thumbnail: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: p.userId,
    deletedAt: null,
    deletedBy: null,
  };
  await app.database.c.scenes.insertOne(scene);
  await audit(app, req, p, "SCENE_CREATED", scene);
  return { scene: toPublicScene(scene) };
};

const newNonce = () => randomInt(1, 2 ** 31 - 1);

/** Marks every live element missing from `incoming` as deleted so replaces sync to collaborators. */
export const tombstoneMissing = (existing: any[], incoming: any[]) => {
  const keep = new Set(incoming.map((e) => e.id));
  const now = Date.now();
  return existing
    .filter((e) => !e.isDeleted && !keep.has(e.id))
    .map((e) => ({
      ...e,
      isDeleted: true,
      version: (e.version ?? 0) + 1,
      versionNonce: newNonce(),
      updated: now,
    }));
};

export const replaceSceneData = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  id: unknown,
  input: {
    baseVersion: number;
    elements: any[];
    appState?: Record<string, unknown>;
  },
) => {
  requireScope(p, "scene:write");
  const scene = await loadScene(app, req, p, id, "write", {
    projection: { textContent: 0 },
  });
  const parsed = sceneDataSchema.parse({
    elements: input.elements,
    appState: input.appState ?? scene.data.appState,
  });
  // keep collaborators consistent: elements dropped by this replace become tombstones
  const removed = tombstoneMissing(
    scene.data.elements as any[],
    parsed.elements as any[],
  );
  const elements = [...parsed.elements, ...removed];
  const result = await commitSceneData(
    app,
    scene._id,
    {
      baseVersion: input.baseVersion,
      elements: elements as any,
      appState: parsed.appState,
    },
    p.userId,
  );
  if (!result.ok) {
    throw Object.assign(
      new HttpError(
        409,
        "version_conflict",
        "The scene changed; re-read it and retry.",
      ),
      { extra: { version: result.version } },
    );
  }
  app.collab.applyExternal(scene._id, elements as any);
  await audit(app, req, p, "SCENE_UPDATED", scene, {
    elements: parsed.elements.length,
  });
  return { version: result.version, updatedAt: result.updatedAt };
};

/** Adds or updates elements without needing the caller to hold the latest version. */
export const appendElements = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  id: unknown,
  incoming: any[],
) => {
  requireScope(p, "scene:write");
  const parsed = sceneDataSchema.shape.elements.parse(incoming);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (attempt > 0) {
      // jittered backoff so concurrent writers stop colliding in lockstep
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 15 * attempt));
    }
    const scene = await loadScene(app, req, p, id, "write", {
      projection: { textContent: 0 },
    });
    const byId = new Map((scene.data.elements as any[]).map((e) => [e.id, e]));
    for (const el of parsed as any[]) {
      const cur = byId.get(el.id);
      if (!cur || (el.version ?? 0) > (cur.version ?? 0)) {
        byId.set(el.id, el);
      }
    }
    const result = await commitSceneData(
      app,
      scene._id,
      {
        baseVersion: scene.version,
        elements: [...byId.values()] as any,
        appState: scene.data.appState,
      },
      p.userId,
    );
    if (result.ok) {
      app.collab.applyExternal(scene._id, parsed as any);
      await audit(app, req, p, "SCENE_UPDATED", scene, {
        appended: parsed.length,
      });
      return {
        version: result.version,
        updatedAt: result.updatedAt,
        added: parsed.length,
      };
    }
  }
  throw new HttpError(
    409,
    "version_conflict",
    "The scene is being edited heavily right now; retry shortly.",
  );
};

const bottomLeft = (elements: any[]) => {
  const live = elements.filter((e) => !e.isDeleted);
  if (live.length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.min(...live.map((e) => e.x)),
    y: Math.max(...live.map((e) => e.y + (e.height ?? 0))) + 80,
  };
};

/** Converts Mermaid (no AI) and places it below whatever is already on the canvas. */
export const addDiagramToScene = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  id: unknown,
  mermaid: string,
) => {
  requireScope(p, "diagram:create");
  requireScope(p, "scene:write");
  const scene = await loadScene(app, req, p, id, "write", {
    projection: { textContent: 0 },
  });
  let converted: ReturnType<typeof mermaidToElements>;
  try {
    converted = mermaidToElements(mermaid, {
      origin: bottomLeft(scene.data.elements as any[]),
      idPrefix: `d${Date.now().toString(36)}${randomInt(1000, 9999)}`,
      indexStart: 0,
    });
  } catch (e) {
    if (e instanceof UnsupportedDiagramError) {
      throw new HttpError(422, "unsupported_diagram", e.message);
    }
    if (e instanceof MermaidSyntaxError) {
      throw new HttpError(400, "mermaid_syntax", e.message);
    }
    throw e;
  }
  // Let the editor's own reconciler order the new elements: they carry no index yet.
  const els = converted.elements.map(({ index: _i, ...rest }) => rest);
  const out = await appendElements(app, req, p, id, els);
  return {
    ...out,
    elementIds: els.map((e) => e.id),
    bounds: converted.bounds,
    nodeCount: converted.nodeCount,
    edgeCount: converted.edgeCount,
  };
};

export const convertMermaid = (p: ApiPrincipal, source: string) => {
  requireScope(p, "diagram:create");
  try {
    const { elements, bounds, nodeCount, edgeCount } = mermaidToElements(
      source,
      { idPrefix: `mm${Date.now().toString(36)}` },
    );
    return { elements, bounds, nodeCount, edgeCount };
  } catch (e) {
    if (e instanceof UnsupportedDiagramError) {
      throw new HttpError(422, "unsupported_diagram", e.message);
    }
    if (e instanceof MermaidSyntaxError) {
      throw new HttpError(400, "mermaid_syntax", e.message);
    }
    throw e;
  }
};

const MAX_EXPORT_FILE_BYTES = 8 * 1024 * 1024;

/** Native `.excalidraw` document (same format the editor saves/loads), optionally with embedded images. */
export const exportScene = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  id: unknown,
  opts: { includeFiles?: boolean } = {},
) => {
  requireScope(p, "scene:export");
  const scene = await loadScene(app, req, p, id, "read", {
    projection: { textContent: 0 },
  });
  const files: Record<string, unknown> = {};
  if (opts.includeFiles) {
    let total = 0;
    for (const fileId of scene.fileIds) {
      const f = await app.storage.get(sceneFileKey(scene._id, fileId));
      if (f) {
        total += f.data.length;
        if (total > MAX_EXPORT_FILE_BYTES) {
          throw new HttpError(
            413,
            "export_too_large",
            "Images are too large to inline; export without includeFiles.",
          );
        }
        files[fileId] = {
          id: fileId,
          mimeType: f.contentType,
          dataURL: `data:${f.contentType};base64,${f.data.toString("base64")}`,
          created: scene.updatedAt.getTime(),
        };
      }
    }
  }
  await audit(app, req, p, "SCENE_EXPORTED", scene, {
    includeFiles: !!opts.includeFiles,
  });
  return {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-workspace",
    elements: scene.data.elements,
    appState: { viewBackgroundColor: "#ffffff", ...scene.data.appState },
    files,
  };
};

export const trashScene = async (
  app: FastifyInstance,
  req: FastifyRequest,
  p: ApiPrincipal,
  id: unknown,
) => {
  requireScope(p, "scene:delete");
  const scene = await loadScene(
    app,
    req,
    p,
    id,
    p.key.kind === "workspace" ? "write" : "delete",
  );
  await app.database.c.scenes.updateOne(
    { _id: scene._id },
    { $set: { deletedAt: new Date(), deletedBy: p.userId } },
  );
  app.collab.kick(scene._id, 4404, "scene deleted");
  await audit(app, req, p, "SCENE_DELETED", scene);
  return { ok: true };
};
