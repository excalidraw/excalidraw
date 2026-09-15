import { createAnimatedImagePlayer, isAnimatedImage } from "@excalidraw/utils";

import type {
  FileId,
  InitializedExcalidrawImageElement,
} from "@excalidraw/element/types";

import { dataURLToFile } from "../data/blob";

import type { BinaryFiles, DataURL } from "../types";
import type App from "./App";

export class AppAnimated {
  private animatedImageDecodes = new Set<FileId>();

  constructor(private app: App) {
    this.app = app;
  }

  /** decodes animated images into frames stored on the imageCache entry,
   * letting the renderer draw the current frame straight onto the canvas.
   */
  public decodeAnimatedImages = (
    imageElements: readonly InitializedExcalidrawImageElement[],
    files: BinaryFiles,
  ) => {
    for (const element of imageElements) {
      const fileId = element.fileId;
      if (this.animatedImageDecodes.has(fileId)) {
        continue;
      }
      const cacheEntry = this.app.imageCache.get(fileId);
      const fileData = files[fileId];
      if (!cacheEntry || cacheEntry.animation || !fileData) {
        continue;
      }

      this.animatedImageDecodes.add(fileId);
      void this.decodeAnimatedImage(fileId, fileData.dataURL);
    }
  };

  public decodeAnimatedImage = async (fileId: FileId, dataURL: DataURL) => {
    const file = dataURLToFile(dataURL, fileId);

    // cheap header sniff before reading & decoding the whole file
    if (!(await isAnimatedImage(file))) {
      return;
    }

    // decodes the animation metadata and the first frame; subsequent frames
    // are decoded just-in-time during playback
    const player = await createAnimatedImagePlayer(file);

    if (player) {
      const entry = this.app.imageCache.get(fileId);
      if (entry) {
        player.startTime = performance.now();
        this.app.imageCache.set(fileId, { ...entry, animation: player });
        this.animatedImageDecodes.delete(fileId);
        this.app.scene.triggerUpdate();
      }
    }
  };
}
