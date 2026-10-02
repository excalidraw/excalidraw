import { createHash } from "node:crypto";

import { ObjectId } from "mongodb";

import { SESSION_COOKIE } from "./constants";

import { roleHas } from "./security/rbac";

import type { FastifyRequest } from "fastify";
import type { Role } from "./db";
import type { Permission } from "./security/rbac";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Parses a path/body id. Malformed ids are treated as "not found". */
export const parseId = (value: unknown, what = "resource") => {
  if (
    typeof value !== "string" ||
    !ObjectId.isValid(value) ||
    value.length !== 24
  ) {
    throw new HttpError(404, "not_found", `${what} not found`);
  }
  return new ObjectId(value);
};

export const requireUser = (req: FastifyRequest) => {
  if (!req.auth) {
    throw new HttpError(401, "unauthenticated");
  }
  return req.auth.user;
};

/**
 * Loads the caller's membership in a workspace and checks a permission.
 * Non-members get 404 (not 403) so workspace existence isn't leaked.
 */
export const requireWorkspacePermission = async (
  req: FastifyRequest,
  workspaceIdRaw: unknown,
  permission: Permission,
) => {
  const user = requireUser(req);
  const workspaceId = parseId(workspaceIdRaw, "workspace");
  const member = await req.server.database.c.workspaceMembers.findOne({
    workspaceId,
    userId: user._id,
  });
  if (!member) {
    throw new HttpError(404, "not_found", "workspace not found");
  }
  if (!roleHas(member.role, permission)) {
    throw new HttpError(403, "forbidden", `missing permission ${permission}`);
  }
  return { user, workspaceId, member, role: member.role as Role };
};

/**
 * Rate-limit bucket for expensive routes: per signed-in session (so users behind one
 * NAT don't share a quota), falling back to the client IP for anonymous callers.
 */
export const sessionRateKey = (req: FastifyRequest) => {
  const token = req.cookies?.[SESSION_COOKIE];
  return token
    ? `s:${createHash("sha256").update(token).digest("hex").slice(0, 24)}`
    : `ip:${req.ip}`;
};
