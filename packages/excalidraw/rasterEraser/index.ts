import type { BinaryFiles, DataURL } from "../types";
import type { ExcalidrawImageElement, FileId } from "@excalidraw/element/types";
import type { AppClassProperties } from "../types";

type AffectedElement = {
  element: ExcalidrawImageElement;
  eraserPoints: { localX: number; localY: number }[];
};

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
};

const blobToDataURL = (blob: Blob): Promise<DataURL> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as DataURL);
    reader.readAsDataURL(blob);
  });
};

export type EraserPreviewPoint = { x: number; y: number };

export class RasterPixelEraser {
  private affectedElements: Map<FileId, AffectedElement> = new Map();
  private previewPoints: EraserPreviewPoint[] = [];
  private eraserRadius = 10;
  private active = false;

  isActive(): boolean {
    return this.active;
  }

  getPreviewPoints(): readonly EraserPreviewPoint[] {
    return this.previewPoints;
  }

  getRadius(): number {
    return this.eraserRadius;
  }

  startErase(eraserRadius: number): void {
    this.cancelErase();
    this.eraserRadius = eraserRadius;
    this.active = true;
  }

  addPoint(
    sceneX: number,
    sceneY: number,
    intersectedImages: ExcalidrawImageElement[],
  ): void {
    this.previewPoints.push({ x: sceneX, y: sceneY });

    // Deduplicate: skip if same point as last added for each element
    for (const element of intersectedImages) {
      if (!element.fileId) {
        continue;
      }

      let affected = this.affectedElements.get(element.fileId);
      if (!affected) {
        affected = { element, eraserPoints: [] };
        this.affectedElements.set(element.fileId, affected);
      }

      const localX = sceneX - element.x;
      const localY = sceneY - element.y;

      // Drop duplicate consecutive points (pointer didn't move enough)
      const prev = affected.eraserPoints[affected.eraserPoints.length - 1];
      if (prev && prev.localX === localX && prev.localY === localY) {
        continue;
      }

      affected.eraserPoints.push({ localX, localY });
    }
  }

  async commitErase(
    files: BinaryFiles,
    imageCache: AppClassProperties["imageCache"],
  ): Promise<{ fileId: FileId; dataURL: DataURL; elementId: string }[]> {
    const results: {
      fileId: FileId;
      dataURL: DataURL;
      elementId: string;
    }[] = [];

    for (const [fileId, affected] of this.affectedElements) {
      const fileData = files[fileId as string];
      if (!fileData) {
        continue;
      }

      const cacheEntry = imageCache.get(fileId);
      const cachedImg =
        cacheEntry && !(cacheEntry.image instanceof Promise)
          ? cacheEntry.image
          : null;

      if (!cachedImg || cachedImg instanceof Promise) {
        continue;
      }

      const naturalWidth = cachedImg.naturalWidth || affected.element.width;
      const naturalHeight = cachedImg.naturalHeight || affected.element.height;

      const canvas = document.createElement("canvas");
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(cachedImg, 0, 0, naturalWidth, naturalHeight);

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";

      const scaleX = naturalWidth / affected.element.width;
      const scaleY = naturalHeight / affected.element.height;

      for (const p of affected.eraserPoints) {
        const px = p.localX * scaleX;
        const py = p.localY * scaleY;
        ctx.beginPath();
        ctx.arc(px, py, this.eraserRadius / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      imageCache.delete(fileId);

      const blob = await toBlob(canvas);
      if (!blob) {
        continue;
      }

      const dataURL = await blobToDataURL(blob);
      results.push({
        fileId,
        dataURL,
        elementId: affected.element.id,
      });
    }

    this.cancelErase();
    return results;
  }

  cancelErase(): void {
    this.affectedElements.clear();
    this.previewPoints = [];
    this.active = false;
  }
}
