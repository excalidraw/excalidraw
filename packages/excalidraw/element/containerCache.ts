import type { ExcalidrawTextContainer } from "./types";

export const originalContainerCache: {
  [id: ExcalidrawTextContainer["id"]]:
    | {
        height: ExcalidrawTextContainer["height"];
      }
    | undefined;
} = {};

export const updateOriginalContainerCache = (
  id: ExcalidrawTextContainer["id"],
  height: ExcalidrawTextContainer["height"],
) => {
  const data =
    originalContainerCache[id] || (originalContainerCache[id] = { height });
  data.height = height;
  return data;
};

export const resetOriginalContainerCache = (
  id: ExcalidrawTextContainer["id"],
) => {
  if (originalContainerCache[id]) {
    delete originalContainerCache[id];
  }
};

export const getOriginalContainerHeightFromCache = (
  id: ExcalidrawTextContainer["id"],
) => {
  return originalContainerCache[id]?.height ?? null;
};
