import { distance2d } from "../math";
import Scene from "../scene/Scene";
import {
  ExcalidrawImageElement,
  InitializedExcalidrawImageElement,
} from "./types";

export type EditingImageElement = {
  editorType: "alpha";
  elementId: ExcalidrawImageElement["id"];
  origImageData: Readonly<ImageData>;
  imageData: ImageData;
  pointerDownState: {
    screenX: number;
    screenY: number;
    sampledPixel: readonly [number, number, number, number] | null;
  };
};

const getElement = (id: EditingImageElement["elementId"]) => {
  const element = Scene.getScene(id)?.getNonDeletedElement(id);
  if (element) {
    return element as InitializedExcalidrawImageElement;
  }
  return null;
};

export class ImageEditor {
  static handlePointerDown(
    editingElement: EditingImageElement,
    scenePointer: { x: number; y: number },
  ) {
    const imageElement = getElement(editingElement.elementId);

    if (imageElement) {
      if (
        scenePointer.x >= imageElement.x &&
        scenePointer.x <= imageElement.x + imageElement.width &&
        scenePointer.y >= imageElement.y &&
        scenePointer.y <= imageElement.y + imageElement.height
      ) {
        editingElement.pointerDownState.screenX = scenePointer.x;
        editingElement.pointerDownState.screenY = scenePointer.y;

        const { width, height, data } = editingElement.origImageData;

        const imageOffsetX = Math.round(
          (scenePointer.x - imageElement.x) * (width / imageElement.width),
        );
        const imageOffsetY = Math.round(
          (scenePointer.y - imageElement.y) * (height / imageElement.height),
        );

        const sampledPixel = [
          data[(imageOffsetY * width + imageOffsetX) * 4 + 0],
          data[(imageOffsetY * width + imageOffsetX) * 4 + 1],
          data[(imageOffsetY * width + imageOffsetX) * 4 + 2],
          data[(imageOffsetY * width + imageOffsetX) * 4 + 3],
        ] as const;

        editingElement.pointerDownState.sampledPixel = sampledPixel;
      }
    }
  }

  static handlePointerMove(
    editingElement: EditingImageElement,
    scenePointer: { x: number; y: number },
  ) {
    const { sampledPixel } = editingElement.pointerDownState;
    if (sampledPixel) {
      const { screenX, screenY } = editingElement.pointerDownState;
      const distance = distance2d(
        scenePointer.x,
        scenePointer.y,
        screenX,
        screenY,
      );

      const { width, height, data } = editingElement.origImageData;
      const newImageData = new ImageData(width, height);

      for (let x = 0; x < width; ++x) {
        for (let y = 0; y < height; ++y) {
          if (
            Math.abs(sampledPixel[0] - data[(y * width + x) * 4 + 0]) +
              Math.abs(sampledPixel[1] - data[(y * width + x) * 4 + 1]) +
              Math.abs(sampledPixel[2] - data[(y * width + x) * 4 + 2]) <
            distance
          ) {
            newImageData.data[(y * width + x) * 4 + 0] = 0;
            newImageData.data[(y * width + x) * 4 + 1] = 255;
            newImageData.data[(y * width + x) * 4 + 2] = 0;
            newImageData.data[(y * width + x) * 4 + 3] = 0;
          } else {
            for (let p = 0; p < 4; ++p) {
              newImageData.data[(y * width + x) * 4 + p] =
                data[(y * width + x) * 4 + p];
            }
          }
        }
      }

      return newImageData;
    }
  }

  static handlePointerUp(editingElement: EditingImageElement) {
    editingElement.pointerDownState.sampledPixel = null;
    editingElement.origImageData = editingElement.imageData;
  }
}
