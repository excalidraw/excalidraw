import pica from "pica";
import {
  dataURLToBlob,
  blobToDataURL,
  getImageDimensions,
} from "../image/ImageOps";

export type ExtendRequest = {
  fileId: string;
  imageData: string;
  expand: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  prompt?: string;
  seed?: number;
  mode?: "outpaint";
};

export type UpscaleRequest = {
  fileId: string;
  imageData: string;
  scale: number;
};

export type ImageJobResult = {
  blob: Blob;
  width: number;
  height: number;
  source: "mock";
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image"));
    img.src = src;
  });

export const mockExtendImage = async (
  request: ExtendRequest,
): Promise<ImageJobResult> => {
  const blob = await dataURLToBlob(request.imageData);
  const { width, height } = await getImageDimensions(blob);

  const canvas = document.createElement("canvas");
  const nextWidth = width + request.expand.left + request.expand.right;
  const nextHeight = height + request.expand.top + request.expand.bottom;
  canvas.width = nextWidth;
  canvas.height = nextHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  context.fillStyle = "#f2f2f2";
  context.fillRect(0, 0, nextWidth, nextHeight);

  const image = await loadImage(await blobToDataURL(blob));
  context.drawImage(
    image,
    request.expand.left,
    request.expand.top,
    width,
    height,
  );

  context.strokeStyle = "#d1d1d1";
  context.lineWidth = 6;
  context.strokeRect(3, 3, nextWidth - 6, nextHeight - 6);

  const outBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((result) => resolve(result || blob), "image/png"),
  );

  return {
    blob: outBlob,
    width: nextWidth,
    height: nextHeight,
    source: "mock",
  };
};

export const mockUpscaleImage = async (
  request: UpscaleRequest,
): Promise<ImageJobResult> => {
  const blob = await dataURLToBlob(request.imageData);
  const { width, height } = await getImageDimensions(blob);

  const image = await loadImage(await blobToDataURL(blob));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Canvas context unavailable");
  }
  sourceContext.drawImage(image, 0, 0, width, height);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * request.scale);
  canvas.height = Math.round(height * request.scale);

  await pica().resize(sourceCanvas, canvas, {
    quality: 3,
    alpha: true,
  });

  const outBlob = await pica().toBlob(canvas, "image/png");

  return {
    blob: outBlob,
    width: canvas.width,
    height: canvas.height,
    source: "mock",
  };
};
