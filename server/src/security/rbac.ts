import type { Role } from "../db";

/**
 * Permission-based RBAC. Roles are just named permission sets, so adding a
 * role (e.g. VIEWER, BILLING) only means adding an entry here.
 */
export type Permission =
  | "workspace:read"
  | "workspace:update"
  | "workspace:delete"
  | "members:read"
  | "members:manage"
  | "scene:create"
  | "scene:read"
  | "scene:update"
  | "scene:delete"
  | "scene:purge"
  | "folder:manage"
  | "library:manage"
  | "comment:create"
  | "ai:use"
  | "ai:configure"
  | "apikey:manage"
  | "audit:read";

const MEMBER: Permission[] = [
  "workspace:read",
  "members:read",
  "scene:create",
  "scene:read",
  "scene:update",
  "scene:delete",
  "folder:manage",
  "library:manage",
  "comment:create",
  "ai:use",
];

const ADMIN: Permission[] = [
  ...MEMBER,
  "workspace:update",
  "members:manage",
  "scene:purge",
  "ai:configure",
  "apikey:manage",
  "audit:read",
];

const OWNER: Permission[] = [...ADMIN, "workspace:delete"];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(OWNER),
  ADMIN: new Set(ADMIN),
  MEMBER: new Set(MEMBER),
};

export const roleHas = (role: Role, permission: Permission) =>
  ROLE_PERMISSIONS[role].has(permission);

/** Rank used for "can actor manage target" comparisons. */
export const ROLE_RANK: Record<Role, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};
