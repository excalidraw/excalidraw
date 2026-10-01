import { getNonDeletedElements } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

type SavedAppState = Pick<
  AppState,
  "zoom" | "scrollX" | "scrollY" | "theme" | "viewBackgroundColor"
>;

const SCENE_KEY = "excalidraw-playground-scene";

export const loadScene = (storage: Storage): ImportedDataState | null => {
  const saved = storage.getItem(SCENE_KEY);
  if (!saved) {
    return null;
  }
  return JSON.parse(saved);
};

export const saveScene = (
  storage: Storage,
  elements: readonly ExcalidrawElement[],
  { zoom, scrollX, scrollY, theme, viewBackgroundColor }: SavedAppState,
  files: BinaryFiles,
) =>
  storage.setItem(
    SCENE_KEY,
    JSON.stringify({
      elements: getNonDeletedElements(elements),
      appState: { zoom, scrollX, scrollY, theme, viewBackgroundColor },
      files,
    }),
  );
