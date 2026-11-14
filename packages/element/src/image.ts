// -----------------------------------------------------------------------------
// ExcalidrawImageElement & related helpers
// -----------------------------------------------------------------------------

import { MIME_TYPES, SVG_NS } from "@excalidraw/common";

import type {
  AppClassProperties,
  DataURL,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { getRenderEnvironment } from "./renderEnvironment";
import { isInitializedImageElement } from "./typeChecks";

import type {
  ExcalidrawElement,
  FileId,
  InitializedExcalidrawImageElement,
} from "./types";

export const loadHTMLImageElement = (
  dataURL: DataURL,
  createImage: () => HTMLImageElement = () =>
    getRenderEnvironment().createImage(),
) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = createImage();
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
  createImage,
}: {
  fileIds: FileId[];
  files: BinaryFiles;
  imageCache: AppClassProperties["imageCache"];
  /** creates images in the owner window so cross-document scenes keep
   * runtime ownership of their HTMLImageElements */
  createImage?: () => HTMLImageElement;
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

              const imagePromise = loadHTMLImageElement(
                fileData.dataURL,
                createImage,
              );
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

/** attributes that may point to a resource that'd be fetched when the SVG is
 * rendered in the page */
const SVG_HREF_ATTRIBUTES = ["href", "xlink:href"];

/**
 * Measures the bounding box of the SVG content using the browser's layout
 * engine. Needed for SVGs that specify neither width/height nor viewBox (e.g.
 * those that only use absolute units like `mm` on child elements), as there's
 * otherwise no way to tell how large they are.
 *
 * The SVG needs to be attached to the document to be measured, so we do so on
 * a sanitized throwaway copy (no scripts, event handlers, foreignObject or
 * external resources) to ensure that measuring never executes or fetches
 * anything coming from the (untrusted) SVG.
 *
 * Returns `null` if the content couldn't be measured (e.g. no layout engine
 * or empty content).
 */
const measureSVGContent = (svg: SVGElement) => {
  if (typeof document === "undefined") {
    return null;
  }

  const clone = document.importNode(svg, true) as unknown as SVGSVGElement;

  clone.querySelectorAll("script, foreignObject").forEach((node) => {
    node.remove();
  });
  for (const node of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.toLowerCase().startsWith("on")) {
        node.removeAttribute(attr.name);
      }
    }
    // don't allow remote resources to be requested while measuring
    for (const name of SVG_HREF_ATTRIBUTES) {
      const value = node.getAttribute(name);
      if (value != null && !/^\s*(#|data:)/i.test(value)) {
        node.removeAttribute(name);
      }
    }
  }

  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-99999px;top:-99999px;width:0;height:0;" +
    "overflow:hidden;visibility:hidden;pointer-events:none;";
  container.appendChild(clone);

  try {
    document.body.appendChild(container);
    const box = clone.getBBox();
    if (
      Number.isFinite(box.x) &&
      Number.isFinite(box.y) &&
      Number.isFinite(box.width) &&
      Number.isFinite(box.height) &&
      box.width > 0 &&
      box.height > 0
    ) {
      return box;
    }
  } catch (error) {
    // getBBox is unavailable, or the SVG isn't rendered
  } finally {
    container.remove();
  }
  return null;
};

export const normalizeSVG = (SVGString: string) => {
  const doc = new DOMParser().parseFromString(SVGString, MIME_TYPES.svg);
  const svg = doc.querySelector("svg");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode || !isHTMLSVGElement(svg)) {
    throw new Error("Invalid SVG");
  } else {
    if (!svg.hasAttribute("xmlns")) {
      svg.setAttribute("xmlns", SVG_NS);
    }

    let width = svg.getAttribute("width");
    let height = svg.getAttribute("height");

    // Do not use % or auto values for width/height
    // to avoid scaling issues when rendering at different sizes/zoom levels
    if (width?.includes("%") || width === "auto") {
      width = null;
    }
    if (height?.includes("%") || height === "auto") {
      height = null;
    }

    let viewBox = svg.getAttribute("viewBox");

    // If the SVG doesn't specify any size at all, then the only way to know how
    // large it is, is to measure its content. Otherwise we'd default to a tiny
    // 50x50 viewport and crop most of the drawing.
    if (!width && !height && !viewBox) {
      const box = measureSVGContent(svg);
      if (box) {
        width = `${box.width}`;
        height = `${box.height}`;
        viewBox = `${box.x} ${box.y} ${box.width} ${box.height}`;
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);
        svg.setAttribute("viewBox", viewBox);
      }
    }

    if (!width || !height) {
      width = width || "50";
      height = height || "50";

      if (viewBox) {
        const match = viewBox.match(
          /\d+ +\d+ +(\d+(?:\.\d+)?) +(\d+(?:\.\d+)?)/,
        );
        if (match) {
          [, width, height] = match;
        }
      }

      svg.setAttribute("width", width);
      svg.setAttribute("height", height);
    }

    // Make sure viewBox is set
    if (!viewBox) {
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    return svg.outerHTML;
  }
};
