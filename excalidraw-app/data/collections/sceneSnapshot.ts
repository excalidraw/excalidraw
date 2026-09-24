import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const computeSceneSnapshot = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): string => {
  const elementPart = elements
    .map((el) => `${el.id}:${el.version}:${el.versionNonce}`)
    .join("|");
  const filePart = Object.keys(files).sort().join(",");
  return `${elementPart}::${filePart}`;
};
