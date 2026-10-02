import { MongoServerError, ObjectId } from "mongodb";

import { roleHas } from "../security/rbac";
import { decryptSecret } from "../security/crypto";

import { PROVIDERS } from "./providers";

import type { Config } from "../config";
import type { AiSettingsDoc, Database, Role } from "../db";
import type { ProviderConfig, ProviderId } from "./providers";

const KEY_PURPOSE = "ai-provider-key";
export const aiKeyPurpose = KEY_PURPOSE;

export interface EffectiveAi {
  source: "workspace" | "instance";
  enabled: boolean;
  provider: ProviderId;
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
  keySource: "workspace" | "instance" | "none";
  limits: { workspace: number; user: number }; // 0 = unlimited
  allowedMembers: "all" | ObjectId[];
}

/**
 * Effective AI configuration for a workspace: its own settings, else the instance
 * defaults from the environment. An instance key is never sent to a *different*
 * provider than the one it was issued for.
 */
export const resolveAi = async (
  database: Database,
  config: Config,
  workspaceId: ObjectId,
): Promise<EffectiveAi | null> => {
  const doc = await database.c.aiSettings.findOne({ workspaceId });
  const inst = config.ai;
  if (doc) {
    let apiKey: string | null = null;
    let keySource: EffectiveAi["keySource"] = "none";
    if (doc.apiKeyEnc) {
      apiKey = decryptSecret(doc.apiKeyEnc, config.encryptionKey, KEY_PURPOSE);
      keySource = "workspace";
    } else if (inst.apiKey && inst.provider === doc.provider) {
      apiKey = inst.apiKey;
      keySource = "instance";
    }
    return {
      source: "workspace",
      enabled: doc.enabled,
      provider: doc.provider,
      model: doc.model,
      baseUrl: doc.baseUrl,
      apiKey,
      keySource,
      limits: {
        workspace: doc.workspaceDailyLimit ?? inst.defaultWorkspaceLimit,
        user: doc.userDailyLimit ?? inst.defaultUserLimit,
      },
      allowedMembers: doc.allowedMembers,
    };
  }
  if (inst.provider) {
    return {
      source: "instance",
      enabled: true,
      provider: inst.provider,
      model: inst.model ?? PROVIDERS[inst.provider].defaultModel,
      baseUrl: inst.baseUrl ?? null,
      apiKey: inst.apiKey ?? null,
      keySource: inst.apiKey ? "instance" : "none",
      limits: {
        workspace: inst.defaultWorkspaceLimit,
        user: inst.defaultUserLimit,
      },
      allowedMembers: "all",
    };
  }
  return null;
};

export const isConfigured = (e: EffectiveAi | null): e is EffectiveAi =>
  !!e && (!PROVIDERS[e.provider].needsKey || !!e.apiKey);

export const memberMayUse = (e: EffectiveAi, userId: ObjectId, role: Role) =>
  roleHas(role, "ai:configure") || // owners/admins are always allowed
  (roleHas(role, "ai:use") &&
    (e.allowedMembers === "all" ||
      e.allowedMembers.some((id) => id.equals(userId))));

export const toProviderConfig = (
  e: EffectiveAi,
  fetchImpl?: typeof fetch,
): ProviderConfig => ({
  provider: e.provider,
  apiKey: e.apiKey,
  baseUrl: e.baseUrl,
  fetchImpl,
});

// ------------------------------------------------------------------------------- usage

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

export class LimitReachedError extends Error {
  constructor(public scope: "workspace" | "user", public limit: number) {
    super(
      scope === "workspace"
        ? "The workspace has used all of today's AI requests"
        : "You have used all of your AI requests for today",
    );
  }
}

const bump = async (
  database: Database,
  key: {
    workspaceId: ObjectId;
    scope: "workspace" | "user";
    userId: ObjectId | null;
  },
  limit: number,
) => {
  const day = utcDay();
  const filter: any = { ...key, day };
  if (limit > 0) {
    filter.count = { $lt: limit };
  }
  try {
    const res = await database.c.aiUsage.findOneAndUpdate(
      filter,
      {
        $inc: { count: 1 },
        $setOnInsert: {
          _id: new ObjectId(),
          expiresAt: new Date(Date.now() + 3 * 86_400_000),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    return res!.count;
  } catch (e) {
    // a full counter no longer matches the filter, so the upsert collides with the unique index
    if (e instanceof MongoServerError && e.code === 11000) {
      return null;
    }
    throw e;
  }
};

const unbump = (
  database: Database,
  key: {
    workspaceId: ObjectId;
    scope: "workspace" | "user";
    userId: ObjectId | null;
  },
) =>
  database.c.aiUsage.updateOne(
    { ...key, day: utcDay(), count: { $gt: 0 } },
    { $inc: { count: -1 } },
  );

export interface Reservation {
  remaining: number | null; // null = unlimited
  limit: number | null;
  refund: () => Promise<void>;
}

/** Atomically consumes one request from both the workspace and the user budget. */
export const reserveRequest = async (
  database: Database,
  workspaceId: ObjectId,
  userId: ObjectId,
  limits: { workspace: number; user: number },
): Promise<Reservation> => {
  const wsKey = { workspaceId, scope: "workspace" as const, userId: null };
  const usKey = { workspaceId, scope: "user" as const, userId };
  const wsCount = await bump(database, wsKey, limits.workspace);
  if (wsCount === null) {
    throw new LimitReachedError("workspace", limits.workspace);
  }
  const usCount = await bump(database, usKey, limits.user);
  if (usCount === null) {
    await unbump(database, wsKey);
    throw new LimitReachedError("user", limits.user);
  }
  const rem = [
    limits.workspace > 0 ? limits.workspace - wsCount : Infinity,
    limits.user > 0 ? limits.user - usCount : Infinity,
  ];
  const remaining = Math.min(...rem);
  const lim = [
    limits.workspace > 0 ? limits.workspace : Infinity,
    limits.user > 0 ? limits.user : Infinity,
  ];
  const limit = Math.min(...lim);
  let refunded = false;
  return {
    remaining: Number.isFinite(remaining) ? remaining : null,
    limit: Number.isFinite(limit) ? limit : null,
    refund: async () => {
      if (!refunded) {
        refunded = true;
        await Promise.all([unbump(database, wsKey), unbump(database, usKey)]);
      }
    },
  };
};

export const usageToday = async (database: Database, workspaceId: ObjectId) => {
  const rows = await database.c.aiUsage
    .find({ workspaceId, day: utcDay() })
    .toArray();
  return {
    workspace: rows.find((r) => r.scope === "workspace")?.count ?? 0,
    perUser: rows
      .filter((r) => r.scope === "user")
      .map((r) => ({ userId: r.userId!.toHexString(), count: r.count })),
  };
};

export type { AiSettingsDoc };
