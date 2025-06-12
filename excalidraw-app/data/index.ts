import { restore } from "@excalidraw/excalidraw/data/restore";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";

export const loadScene = async (
  // Supply local state even if importing from backend to ensure we restore
  // localStorage user settings which we do not persist on server.
  // Non-optional so we don't forget to pass it even if `undefined`.
  localDataState: ImportedDataState | undefined | null,
) => {
  const data = restore(localDataState || null, null, null, {
    repairBindings: true,
  });

  return {
    elements: data.elements,
    appState: data.appState,
    files: data.files,
  };
};
