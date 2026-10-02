import { ObjectId } from "mongodb";

import { generateToken, hashToken } from "../security/tokens";

import type { Database } from "../db";

export const createSession = async (
  database: Database,
  opts: {
    userId: ObjectId;
    secret: string;
    ttlMs: number;
    userAgent?: string | null;
    ip?: string | null;
  },
) => {
  const token = generateToken();
  const now = new Date();
  await database.c.sessions.insertOne({
    _id: new ObjectId(),
    tokenHash: hashToken(token, opts.secret),
    userId: opts.userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + opts.ttlMs),
    userAgent: opts.userAgent?.slice(0, 300) ?? null,
    ip: opts.ip ?? null,
  });
  return { token, expiresAt: new Date(now.getTime() + opts.ttlMs) };
};

/** Resolves a raw cookie token to an active session + user, else null. */
export const resolveSession = async (
  database: Database,
  token: string,
  secret: string,
) => {
  const session = await database.c.sessions.findOne({
    tokenHash: hashToken(token, secret),
  });
  // TTL reaping runs ~every 60s, so always re-check expiry ourselves.
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const user = await database.c.users.findOne({ _id: session.userId });
  if (!user || user.status !== "active") {
    return null;
  }
  return { session, user };
};

export const deleteSessionByToken = (
  database: Database,
  token: string,
  secret: string,
) => database.c.sessions.deleteOne({ tokenHash: hashToken(token, secret) });

export const deleteOtherSessions = (
  database: Database,
  userId: ObjectId,
  keepId: ObjectId,
) => database.c.sessions.deleteMany({ userId, _id: { $ne: keepId } });
