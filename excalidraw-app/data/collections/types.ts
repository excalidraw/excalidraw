import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

export type Collection = {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
  /** Set after the collection is written to a folder on disk */
  savedToDisk?: boolean;
  lastSavedAt?: number;
  saveLocationLabel?: string;
  customFileHandle?: boolean;
  thumbnailUpdatedAt?: number;
};

export type CollectionsIndex = {
  collections: Collection[];
  hasDirectory: boolean;
  recentCollectionIds?: string[];
};

export type CollectionSceneData = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};
