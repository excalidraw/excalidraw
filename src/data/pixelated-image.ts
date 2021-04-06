import { ExcalidrawGenericElement, NonDeleted } from "../element/types";
import { newElement } from "../element";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "../constants";
import { randomId } from "../random";

const loadImage = async (url: string): Promise<HTMLImageElement> => {
  const image = new Image();
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = (err) =>
      reject(
        new Error(
          `Failed to load image: ${err ? err.toString : "unknown error"}`,
        ),
      );
    image.onabort = () =>
      reject(new Error(`Failed to load image: image load aborted`));
    image.src = url;
  });
};

const commonProps = {
  fillStyle: "solid",
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  opacity: 100,
  roughness: 1,
  strokeColor: "transparent",
  strokeSharpness: "sharp",
  strokeStyle: "solid",
  strokeWidth: 1,
  verticalAlign: "middle",
} as const;

export const pixelateImage = async (
  blob: Blob,
  cellSize: number,
  suggestedMaxShapeCount: number,
  x: number,
  y: number,
) => {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);

    // initialize canvas for pixelation
    const { width, height } = image;
    let canvasWidth = Math.floor(width / cellSize);
    let canvasHeight = Math.floor(height / cellSize);
    const shapeCount = canvasHeight * canvasWidth;
    if (shapeCount > suggestedMaxShapeCount) {
      canvasWidth = Math.floor(
        canvasWidth * (suggestedMaxShapeCount / shapeCount),
      );
      canvasHeight = Math.floor(
        canvasHeight * (suggestedMaxShapeCount / shapeCount),
      );
    }
    const xOffset = x - (canvasWidth * cellSize) / 2;
    const yOffset = y - (canvasHeight * cellSize) / 2;

    const canvas =
      "OffscreenCanvas" in window
        ? new OffscreenCanvas(canvasWidth, canvasHeight)
        : document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw image on canvas
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, width, height, 0, 0, canvasWidth, canvasHeight);
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const buffer = imageData.data;

    const groupId = randomId();
    const shapes: NonDeleted<ExcalidrawGenericElement>[] = [];

    for (let row = 0; row < canvasHeight; row++) {
      for (let col = 0; col < canvasWidth; col++) {
        const offset = row * canvasWidth * 4 + col * 4;
        const r = buffer[offset];
        const g = buffer[offset + 1];
        const b = buffer[offset + 2];
        const alpha = buffer[offset + 3];
        if (alpha) {
          const color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          const rectangle = newElement({
            backgroundColor: color,
            groupIds: [groupId],
            ...commonProps,
            type: "rectangle",
            x: xOffset + col * cellSize,
            y: yOffset + row * cellSize,
            width: cellSize,
            height: cellSize,
          });
          shapes.push(rectangle);
        }
      }
    }

    return shapes;
  } finally {
    URL.revokeObjectURL(url);
  }
};
