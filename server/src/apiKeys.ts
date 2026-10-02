import { timingSafeEqual } from "node:crypto";

import { generateToken, hashToken } from "./security/tokens";

import type { ObjectId } from "mongodb";

import type { FastifyRequest } from "fastify";
import type { ApiKeyDoc, ApiScope, Database } from "./db";

export const KEY_PREFIX = "ewk";
const KEY_SHAPE = /^ewk_([A-Za-z0-9_-]{10})_([A-Za-z0-9_-]{43})$/;

/** ewk_<10 public chars>_<256-bit secret>. The prefix is only an index; the secret authenticates. */
export const generateApiKey = () => {
  const prefix = generateToken(8).slice(0, 10);
  const secret = generateToken(32);
  return { prefix, secret, full: `${KEY_PREFIX}_${prefix}_${secret}` };
};

export const parseApiKey = (raw: string) => {
  const m = KEY_SHAPE.exec(raw.trim());
  return m ? { prefix: m[1]!, secret: m[2]! } : null;
};

export const hashSecret = (secret: string, pepper: string) =>
  hashToken(secret, `apikey:${pepper}`);

export const bearerOf = (req: FastifyRequest) => {
  const h = req.headers.authorization;
  return typeof h === "string" && /^Bearer\s+ewk_/i.test(h)
    ? h.replace(/^Bearer\s+/i, "")
    : null;
};

export interface ApiPrincipal {
  key: ApiKeyDoc;
  userId: ObjectId;
  /** null = personal key with no workspace restriction */
  workspaceId: ObjectId | null;
  scopes: ReadonlySet<ApiScope>;
}

const LAST_USED_EVERY_MS = 60_000;

/** Resolves a bearer key to a live principal, or null (uniform failure: no oracle on why). */
export const authenticateApiKey = async (
  database: Database,
  raw: string,
  pepper: string,
): Promise<ApiPrincipal | null> => {
  const parsed = parseApiKey(raw);
  if (!parsed) {
    return null;
  }
  const key = await database.c.apiKeys.findOne({ prefix: parsed.prefix });
  if (!key) {
    return null;
  }
  const a = Buffer.from(hashSecret(parsed.secret, pepper), "hex");
  const b = Buffer.from(key.secretHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  if (
    key.revokedAt ||
    (key.expiresAt && key.expiresAt.getTime() <= Date.now())
  ) {
    return null;
  }
  // The key is only as powerful as its owner: a disabled user's keys stop working.
  const user = await database.c.users.findOne(
    { _id: key.userId },
    { projection: { status: 1 } },
  );
  if (!user || user.status !== "active") {
    return null;
  }
  if (key.workspaceId) {
    // …and a workspace key dies with its creator's membership.
    const member = await database.c.workspaceMembers.findOne({
      workspaceId: key.workspaceId,
      userId: key.userId,
    });
    if (!member) {
      return null;
    }
  }
  if (
    !key.lastUsedAt ||
    Date.now() - key.lastUsedAt.getTime() > LAST_USED_EVERY_MS
  ) {
    void database.c.apiKeys
      .updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return {
    key,
    userId: key.userId,
    workspaceId: key.workspaceId,
    scopes: new Set(key.scopes),
  };
};

export const toPublicKey = (k: ApiKeyDoc) => ({
  id: k._id.toHexString(),
  kind: k.kind,
  name: k.name,
  workspaceId: k.workspaceId?.toHexString() ?? null,
  prefix: `${KEY_PREFIX}_${k.prefix}`,
  scopes: k.scopes,
  createdAt: k.createdAt.toISOString(),
  expiresAt: k.expiresAt?.toISOString() ?? null,
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  revokedAt: k.revokedAt?.toISOString() ?? null,
});
