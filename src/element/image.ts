// -----------------------------------------------------------------------------
// ExcalidrawImageElement & related helpers
// -----------------------------------------------------------------------------

import { MIME_TYPES, SVG_NS } from "../constants";
import { getDataURL } from "../data/blob";
import { t } from "../i18n";
import { AppClassProperties, DataURL, BinaryFiles } from "../types";
import { isInitializedImageElement } from "./typeChecks";
import {
  ExcalidrawElement,
  FileId,
  InitializedExcalidrawImageElement,
} from "./types";

export const loadHTMLImageElement = (dataURL: DataURL) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = (error) => {
      reject(error);
    };
    image.src = dataURL;
  });
};

/** NOTE: updates cache even if already populated with given image. Thus,
 * you should filter out the images upstream if you want to optimize this. */
export const updateImageCache = async ({
  fileIds,
  files,
  imageCache,
}: {
  fileIds: FileId[];
  files: BinaryFiles;
  imageCache: AppClassProperties["imageCache"];
}) => {
  const updatedFiles = new Map<FileId, true>();
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    fileIds.reduce((promises, fileId) => {
      const fileData = files[fileId as string];
      if (fileData && !updatedFiles.has(fileId)) {
        updatedFiles.set(fileId, true);
        return promises.concat(
          (async () => {
            try {
              if (fileData.mimeType === MIME_TYPES.binary) {
                throw new Error("Only images can be added to ImageCache");
              }

              const imagePromise = loadHTMLImageElement(fileData.dataURL);
              const data = {
                image: imagePromise,
                mimeType: fileData.mimeType,
              } as const;
              // store the promise immediately to indicate there's an in-progress
              // initialization
              imageCache.set(fileId, data);

              const image = await imagePromise;

              imageCache.set(fileId, { ...data, image });
            } catch (error: any) {
              erroredFiles.set(fileId, true);
            }
          })(),
        );
      }
      return promises;
    }, [] as Promise<any>[]),
  );

  return {
    imageCache,
    /** includes errored files because they cache was updated nonetheless */
    updatedFiles,
    /** files that failed when creating HTMLImageElement */
    erroredFiles,
  };
};

export const getInitializedImageElements = (
  elements: readonly ExcalidrawElement[],
) =>
  elements.filter((element) =>
    isInitializedImageElement(element),
  ) as InitializedExcalidrawImageElement[];

export const isHTMLSVGElement = (node: Node | null): node is SVGElement => {
  // lower-casing due to XML/HTML convention differences
  // https://johnresig.com/blog/nodename-case-sensitivity
  return node?.nodeName.toLowerCase() === "svg";
};

export const normalizeSVG = async (SVGString: string) => {
  const doc = new DOMParser().parseFromString(SVGString, MIME_TYPES.svg);
  const svg = doc.querySelector("svg");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode || !isHTMLSVGElement(svg)) {
    throw new Error(t("errors.invalidSVGString"));
  } else {
    if (!svg.hasAttribute("xmlns")) {
      svg.setAttribute("xmlns", SVG_NS);
    }

    return svg.outerHTML;
  }
};

/**
 * To improve perf, uses `createImageBitmap` is available. But there are
 * quality issues across browsers, so don't use this API where quality matters.
 */
export const speedyImageToCanvas = async (imageFile: Blob | File) => {
  let imageSrc: HTMLImageElement | ImageBitmap;
  if (
    // Math.random() > 1 &&
    typeof ImageBitmap !== "undefined" &&
    ImageBitmap.prototype &&
    ImageBitmap.prototype.close &&
    window.createImageBitmap
  ) {
    imageSrc = await window.createImageBitmap(imageFile);
  } else {
    imageSrc = await loadHTMLImageElement(await getDataURL(imageFile));
  }
  const { width, height } = imageSrc;

  const canvas = document.createElement("canvas");
  canvas.height = height;
  canvas.width = width;
  const context = canvas.getContext("2d")!;
  context.drawImage(imageSrc, 0, 0, width, height);

  if (typeof ImageBitmap !== "undefined" && imageSrc instanceof ImageBitmap) {
    imageSrc.close();
  }

  return { canvas, context, width, height };
};

/**
 * Does its best at figuring out if an image (PNG) has any (semi)transparent
 * pixels. If not PNG, always returns false.
 */
export const hasTransparentPixels = async (imageFile: Blob | File) => {
  if (imageFile.type !== MIME_TYPES.png) {
    return false;
  }

  const { findPngChunk, extractPngChunks } = await import("../data/image");

  const buffer = await imageFile.arrayBuffer();
  const chunks = extractPngChunks(new Uint8Array(buffer));

  // early exit if tRNS not found and IHDR states no support for alpha
  // -----------------------------------------------------------------------

  const IHDR = findPngChunk(chunks, "IHDR");

  if (
    IHDR &&
    IHDR.data[9] !== 4 &&
    IHDR.data[9] !== 6 &&
    !findPngChunk(chunks, "tRNS")
  ) {
    return false;
  }

  // otherwise loop through pixels to check if there's any actually
  // (semi)transparent pixel
  // -----------------------------------------------------------------------

  const { width, height, context } = await speedyImageToCanvas(imageFile);
  {
    const { data } = context.getImageData(0, 0, width, height);
    const len = data.byteLength;
    let i = 3;
    while (i <= len) {
      if (data[i] !== 255) {
        return true;
      }
      i += 4;
    }
  }
  return false;
};
