import { MongoClient, ObjectId } from "mongodb";

import type { Collection, Db } from "mongodb";

export type UserStatus = "active" | "disabled";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  emailLower: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface SessionDoc {
  _id: ObjectId;
  /** HMAC-SHA256 of the opaque cookie token; the raw token is never stored. */
  tokenHash: string;
  userId: ObjectId;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
}

export interface AuditLogDoc {
  _id: ObjectId;
  action: string;
  actorId: ObjectId | null;
  workspaceId: ObjectId | null;
  targetType: string | null;
  targetId: string | null;
  /** Never contains secrets; see repos/audit.ts for redaction. */
  meta: Record<string, unknown>;
  ip: string | null;
  createdAt: Date;
}

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface WorkspaceDoc {
  _id: ObjectId;
  name: string;
  slug: string;
  ownerId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  userId: ObjectId;
  role: Role;
  createdAt: Date;
}

export type Visibility = "workspace" | "private";
export type SceneLevel = "VIEW" | "EDIT";

export interface FolderDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  parentId: ObjectId | null;
  name: string;
  nameLower: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SceneDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  ownerId: ObjectId;
  folderId: ObjectId | null;
  name: string;
  visibility: Visibility;
  /** Native Excalidraw scene format (elements + trimmed appState). */
  data: {
    elements: Record<string, unknown>[];
    appState: Record<string, unknown>;
  };
  /** Small preview data URL, capped in size. Never returned by list queries' data path. */
  thumbnail: string | null;
  /** Extracted text used for content search. */
  textContent: string;
  /** Binary file ids (images) referenced by the scene. */
  fileIds: string[];
  sizeBytes: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: ObjectId;
  deletedAt: Date | null;
  deletedBy: ObjectId | null;
}

export interface ScenePermissionDoc {
  _id: ObjectId;
  sceneId: ObjectId;
  userId: ObjectId;
  level: SceneLevel;
  grantedBy: ObjectId;
  createdAt: Date;
}

export interface ShareLinkDoc {
  _id: ObjectId;
  sceneId: ObjectId;
  /** HMAC of the token: used for lookup. */
  tokenHash: string;
  /** AES-GCM encrypted token so owners can copy the link again later. */
  tokenEnc: string;
  level: SceneLevel;
  createdBy: ObjectId;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

export interface CommentDoc {
  _id: ObjectId;
  sceneId: ObjectId;
  userId: ObjectId;
  /** null for thread roots; replies always point at their root. */
  parentId: ObjectId | null;
  text: string;
  /** Scene (canvas) coordinates of the pin; replies inherit the root's. */
  positionX: number;
  positionY: number;
  /** Optional element the comment is attached to. */
  elementId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: ObjectId | null;
}

export interface LibraryDoc {
  _id: ObjectId;
  kind: "personal" | "workspace";
  /** userId for personal libraries, workspaceId for workspace libraries */
  ownerId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** One document per item, in Excalidraw's native library item shape. */
export interface LibraryItemDoc {
  _id: ObjectId;
  libraryId: ObjectId;
  /** client-side item id (stable across devices) */
  itemId: string;
  status: "published" | "unpublished";
  name: string | null;
  elements: Record<string, unknown>[];
  created: number;
  position: number;
  sizeBytes: number;
  updatedAt: Date;
}

export interface AiSettingsDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  enabled: boolean;
  provider: "openai" | "anthropic" | "gemini" | "openrouter" | "local";
  model: string;
  /** custom endpoint (local / openrouter / openai-compatible); null = provider default */
  baseUrl: string | null;
  /** AES-GCM encrypted provider key; null = use the instance key (AI_API_KEY) */
  apiKeyEnc: string | null;
  apiKeyLast4: string | null;
  /** null = inherit the instance default; 0 = unlimited */
  workspaceDailyLimit: number | null;
  userDailyLimit: number | null;
  /** "all" workspace members, or only the listed user ids */
  allowedMembers: "all" | ObjectId[];
  updatedAt: Date;
  updatedBy: ObjectId;
}

export interface AiUsageDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  scope: "workspace" | "user";
  userId: ObjectId | null;
  /** UTC day, YYYY-MM-DD */
  day: string;
  count: number;
  expiresAt: Date;
}

export const API_SCOPES = [
  "workspace:read",
  "scene:read",
  "scene:create",
  "scene:write",
  "scene:delete",
  "scene:export",
  "diagram:create",
] as const;
export type ApiScope = typeof API_SCOPES[number];

export interface ApiKeyDoc {
  _id: ObjectId;
  kind: "personal" | "workspace";
  /** Workspace keys: the only workspace they can touch. Personal keys: optional restriction. */
  workspaceId: ObjectId | null;
  /** The user the key acts as (personal) or was created by (workspace). */
  userId: ObjectId;
  name: string;
  /** public identifier embedded in the key (ewk_<prefix>_<secret>) */
  prefix: string;
  /** HMAC-SHA256 of the secret part; the secret itself is never stored */
  secretHash: string;
  scopes: ApiScope[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface Collections {
  apiKeys: Collection<ApiKeyDoc>;
  aiSettings: Collection<AiSettingsDoc>;
  aiUsage: Collection<AiUsageDoc>;
  libraries: Collection<LibraryDoc>;
  libraryItems: Collection<LibraryItemDoc>;
  comments: Collection<CommentDoc>;
  scenePermissions: Collection<ScenePermissionDoc>;
  shareLinks: Collection<ShareLinkDoc>;
  folders: Collection<FolderDoc>;
  scenes: Collection<SceneDoc>;
  workspaces: Collection<WorkspaceDoc>;
  workspaceMembers: Collection<WorkspaceMemberDoc>;
  users: Collection<UserDoc>;
  sessions: Collection<SessionDoc>;
  auditLogs: Collection<AuditLogDoc>;
}

export interface Database {
  client: MongoClient;
  db: Db;
  c: Collections;
  close(): Promise<void>;
}

const collectionsOf = (db: Db): Collections => ({
  apiKeys: db.collection<ApiKeyDoc>("api_keys"),
  aiSettings: db.collection<AiSettingsDoc>("ai_settings"),
  aiUsage: db.collection<AiUsageDoc>("ai_usage"),
  libraries: db.collection<LibraryDoc>("libraries"),
  libraryItems: db.collection<LibraryItemDoc>("library_items"),
  comments: db.collection<CommentDoc>("comments"),
  scenePermissions: db.collection<ScenePermissionDoc>("scene_permissions"),
  shareLinks: db.collection<ShareLinkDoc>("share_links"),
  folders: db.collection<FolderDoc>("folders"),
  scenes: db.collection<SceneDoc>("scenes"),
  workspaces: db.collection<WorkspaceDoc>("workspaces"),
  workspaceMembers: db.collection<WorkspaceMemberDoc>("workspace_members"),
  users: db.collection<UserDoc>("users"),
  sessions: db.collection<SessionDoc>("sessions"),
  auditLogs: db.collection<AuditLogDoc>("audit_logs"),
});

/** JSON-schema validators (validationAction=error, moderate so old docs survive). */
const validators: Record<string, object> = {
  users: {
    bsonType: "object",
    required: [
      "email",
      "emailLower",
      "passwordHash",
      "displayName",
      "status",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      email: { bsonType: "string", maxLength: 254 },
      emailLower: { bsonType: "string", maxLength: 254 },
      passwordHash: { bsonType: "string" },
      displayName: { bsonType: "string", minLength: 1, maxLength: 80 },
      avatarUrl: { bsonType: ["string", "null"], maxLength: 2048 },
      status: { enum: ["active", "disabled"] },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      lastLoginAt: { bsonType: ["date", "null"] },
    },
  },
  sessions: {
    bsonType: "object",
    required: ["tokenHash", "userId", "createdAt", "expiresAt"],
    properties: {
      tokenHash: { bsonType: "string" },
      userId: { bsonType: "objectId" },
      createdAt: { bsonType: "date" },
      expiresAt: { bsonType: "date" },
    },
  },
  workspaces: {
    bsonType: "object",
    required: ["name", "slug", "ownerId", "createdAt", "updatedAt"],
    properties: {
      name: { bsonType: "string", minLength: 1, maxLength: 80 },
      slug: { bsonType: "string", maxLength: 100 },
      ownerId: { bsonType: "objectId" },
    },
  },
  workspace_members: {
    bsonType: "object",
    required: ["workspaceId", "userId", "role", "createdAt"],
    properties: {
      workspaceId: { bsonType: "objectId" },
      userId: { bsonType: "objectId" },
      role: { enum: ["OWNER", "ADMIN", "MEMBER"] },
    },
  },
  folders: {
    bsonType: "object",
    required: ["workspaceId", "name", "nameLower", "createdBy", "createdAt"],
    properties: {
      workspaceId: { bsonType: "objectId" },
      parentId: { bsonType: ["objectId", "null"] },
      name: { bsonType: "string", minLength: 1, maxLength: 80 },
    },
  },
  scenes: {
    bsonType: "object",
    required: [
      "workspaceId",
      "ownerId",
      "name",
      "visibility",
      "data",
      "version",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      workspaceId: { bsonType: "objectId" },
      ownerId: { bsonType: "objectId" },
      folderId: { bsonType: ["objectId", "null"] },
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      visibility: { enum: ["workspace", "private"] },
      version: { bsonType: ["int", "long", "double"], minimum: 1 },
      deletedAt: { bsonType: ["date", "null"] },
    },
  },
  scene_permissions: {
    bsonType: "object",
    required: ["sceneId", "userId", "level", "grantedBy", "createdAt"],
    properties: {
      sceneId: { bsonType: "objectId" },
      userId: { bsonType: "objectId" },
      level: { enum: ["VIEW", "EDIT"] },
    },
  },
  share_links: {
    bsonType: "object",
    required: [
      "sceneId",
      "tokenHash",
      "tokenEnc",
      "level",
      "createdBy",
      "createdAt",
    ],
    properties: {
      sceneId: { bsonType: "objectId" },
      tokenHash: { bsonType: "string" },
      level: { enum: ["VIEW", "EDIT"] },
    },
  },
  comments: {
    bsonType: "object",
    required: [
      "sceneId",
      "userId",
      "text",
      "positionX",
      "positionY",
      "createdAt",
    ],
    properties: {
      sceneId: { bsonType: "objectId" },
      userId: { bsonType: "objectId" },
      parentId: { bsonType: ["objectId", "null"] },
      text: { bsonType: "string", minLength: 1, maxLength: 4000 },
      positionX: { bsonType: ["double", "int", "long"] },
      positionY: { bsonType: ["double", "int", "long"] },
      elementId: { bsonType: ["string", "null"], maxLength: 128 },
      resolvedAt: { bsonType: ["date", "null"] },
    },
  },
  libraries: {
    bsonType: "object",
    required: ["kind", "ownerId", "createdAt"],
    properties: {
      kind: { enum: ["personal", "workspace"] },
      ownerId: { bsonType: "objectId" },
    },
  },
  library_items: {
    bsonType: "object",
    required: ["libraryId", "itemId", "elements", "created"],
    properties: {
      libraryId: { bsonType: "objectId" },
      itemId: { bsonType: "string", maxLength: 128 },
      status: { enum: ["published", "unpublished"] },
      elements: { bsonType: "array" },
    },
  },
  ai_settings: {
    bsonType: "object",
    required: ["workspaceId", "enabled", "provider", "model", "updatedAt"],
    properties: {
      workspaceId: { bsonType: "objectId" },
      provider: {
        enum: ["openai", "anthropic", "gemini", "openrouter", "local"],
      },
      model: { bsonType: "string", minLength: 1, maxLength: 200 },
    },
  },
  ai_usage: {
    bsonType: "object",
    required: ["workspaceId", "scope", "day", "count", "expiresAt"],
    properties: {
      scope: { enum: ["workspace", "user"] },
      day: { bsonType: "string" },
      count: { bsonType: ["int", "long", "double"], minimum: 0 },
    },
  },
  api_keys: {
    bsonType: "object",
    required: [
      "kind",
      "userId",
      "name",
      "prefix",
      "secretHash",
      "scopes",
      "createdAt",
    ],
    properties: {
      kind: { enum: ["personal", "workspace"] },
      name: { bsonType: "string", minLength: 1, maxLength: 80 },
      prefix: { bsonType: "string" },
      secretHash: { bsonType: "string" },
      scopes: { bsonType: "array", minItems: 1 },
    },
  },
  audit_logs: {
    bsonType: "object",
    required: ["action", "createdAt", "meta"],
    properties: {
      action: { bsonType: "string" },
      createdAt: { bsonType: "date" },
      meta: { bsonType: "object" },
    },
  },
};

const ensureCollection = async (db: Db, name: string) => {
  const validator = { $jsonSchema: validators[name] };
  const exists = (await db.listCollections({ name }).toArray()).length > 0;
  if (!exists) {
    await db.createCollection(name, {
      validator,
      validationLevel: "moderate",
      validationAction: "error",
    });
  } else {
    await db.command({
      collMod: name,
      validator,
      validationLevel: "moderate",
      validationAction: "error",
    });
  }
};

/**
 * Idempotent: creates collections with validators and all indexes. Called on
 * every startup, so it doubles as the "migration" step for additive changes.
 */
export const initializeSchema = async (db: Db) => {
  for (const name of Object.keys(validators)) {
    await ensureCollection(db, name);
  }
  const c = collectionsOf(db);
  await c.users.createIndex({ emailLower: 1 }, { unique: true });
  await c.users.createIndex({ createdAt: -1 });
  await c.sessions.createIndex({ tokenHash: 1 }, { unique: true });
  await c.sessions.createIndex({ userId: 1 });
  // TTL: Mongo removes expired sessions automatically.
  await c.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await c.workspaces.createIndex({ slug: 1 }, { unique: true });
  await c.workspaces.createIndex({ ownerId: 1 });
  await c.workspaceMembers.createIndex(
    { workspaceId: 1, userId: 1 },
    { unique: true },
  );
  await c.workspaceMembers.createIndex({ userId: 1 });
  await c.folders.createIndex(
    { workspaceId: 1, parentId: 1, nameLower: 1 },
    { unique: true },
  );
  // Dashboard queries: list by workspace/folder/trash state, sorted.
  await c.scenes.createIndex({ workspaceId: 1, deletedAt: 1, updatedAt: -1 });
  await c.scenes.createIndex({ workspaceId: 1, folderId: 1, deletedAt: 1 });
  await c.scenes.createIndex({ workspaceId: 1, ownerId: 1, deletedAt: 1 });
  await c.scenes.createIndex({ deletedAt: 1 }, { sparse: true });
  await c.scenePermissions.createIndex(
    { sceneId: 1, userId: 1 },
    { unique: true },
  );
  await c.scenePermissions.createIndex({ userId: 1 });
  await c.shareLinks.createIndex({ tokenHash: 1 }, { unique: true });
  await c.shareLinks.createIndex({ sceneId: 1 });
  await c.comments.createIndex({ sceneId: 1, createdAt: 1 });
  await c.comments.createIndex({ parentId: 1 }, { sparse: true });
  await c.libraries.createIndex({ kind: 1, ownerId: 1 }, { unique: true });
  await c.libraryItems.createIndex(
    { libraryId: 1, itemId: 1 },
    { unique: true },
  );
  await c.libraryItems.createIndex({ libraryId: 1, position: 1 });
  await c.aiSettings.createIndex({ workspaceId: 1 }, { unique: true });
  await c.aiUsage.createIndex(
    { workspaceId: 1, scope: 1, userId: 1, day: 1 },
    { unique: true },
  );
  // usage rows clean themselves up
  await c.aiUsage.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await c.apiKeys.createIndex({ prefix: 1 }, { unique: true });
  await c.apiKeys.createIndex({ userId: 1, createdAt: -1 });
  await c.apiKeys.createIndex(
    { workspaceId: 1, createdAt: -1 },
    { sparse: true },
  );
  await c.auditLogs.createIndex({ createdAt: -1 });
  await c.auditLogs.createIndex({ workspaceId: 1, createdAt: -1 });
  await c.auditLogs.createIndex({ actorId: 1, createdAt: -1 });
};

export const connectDatabase = async (
  uri: string,
  dbName: string,
): Promise<Database> => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);
  await initializeSchema(db);
  return { client, db, c: collectionsOf(db), close: () => client.close() };
};

export { ObjectId };
