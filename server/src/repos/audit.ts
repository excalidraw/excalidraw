import { ObjectId } from "mongodb";

import type { Database } from "../db";

const SENSITIVE = /pass|secret|token|key|authorization|cookie|hash/i;

/** Strips anything that looks like a credential before it reaches the log. */
export const redact = (value: unknown, depth = 0): unknown => {
  if (depth > 4) {
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1),
      ]),
    );
  }
  return value;
};

export type AuditAction =
  | "USER_REGISTERED"
  | "USER_LOGIN"
  | "USER_LOGIN_FAILED"
  | "USER_LOGOUT"
  | "PASSWORD_CHANGED"
  | "PROFILE_UPDATED"
  | (string & {});

export const writeAudit = async (
  database: Database,
  entry: {
    action: AuditAction;
    actorId?: ObjectId | null;
    workspaceId?: ObjectId | null;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
    ip?: string | null;
  },
) => {
  await database.c.auditLogs.insertOne({
    _id: new ObjectId(),
    action: entry.action,
    actorId: entry.actorId ?? null,
    workspaceId: entry.workspaceId ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    meta: redact(entry.meta ?? {}) as Record<string, unknown>,
    ip: entry.ip ?? null,
    createdAt: new Date(),
  });
};
