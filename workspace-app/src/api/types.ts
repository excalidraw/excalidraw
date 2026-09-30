export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type SceneAccess = "OWNER" | "EDIT" | "VIEW";

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  userId: string;
  role: Role;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
}

export interface SceneSummary {
  id: string;
  workspaceId: string;
  ownerId: string;
  ownerName?: string;
  folderId: string | null;
  name: string;
  visibility: "workspace" | "private";
  hasThumbnail: boolean;
  sizeBytes: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  access?: SceneAccess;
}

export interface SceneData {
  elements: any[];
  appState: Record<string, any>;
}

export interface SceneFull extends SceneSummary {
  data: SceneData;
}

export interface ShareState {
  permissions: {
    userId: string;
    email: string;
    displayName: string;
    level: "VIEW" | "EDIT";
  }[];
  links: {
    id: string;
    level: "VIEW" | "EDIT";
    token: string;
    createdAt: string;
    expiresAt: string | null;
  }[];
}

export interface Features {
  workspaces: boolean;
  comments: boolean;
  presentations: boolean;
  ai: boolean;
  mcp: boolean;
  pptxExport: boolean;
}
