export interface ExcalidrawScene {
  type: string;
  version: number;
  source?: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SceneListItem {
  name: string;
  path: string;
  size: number;
  mtime: string;
}

export interface SceneStats {
  elements: number;
  files: number;
  updatedAt: string | null;
}
