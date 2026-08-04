import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { exportToSvg } from "../../scene/export";

/**
 * Test-only helper: render the supplied elements to an SVG string for visual
 * debugging (e.g. to eyeball frame-membership / overlap geometry).
 *
 * Frames are drawn with their outline but are NOT clipped, and every element's
 * `frameId` is ignored, so elements that fall outside a frame stay visible and
 * within the exported viewBox instead of being clipped or cropped away.
 *
 * Pass `outFile` to also write the SVG to disk — open it in a browser to view.
 *
 * @example
 *   await exportElementsToSVG([frame, diamond], {
 *     outFile: "/tmp/frame-debug.svg",
 *   });
 */
export const exportElementsToSVG = async (
  elements: readonly ExcalidrawElement[],
  opts?: { outFile?: string; padding?: number; background?: string },
): Promise<string> => {
  // ignore frame membership so nothing gets clipped/cropped out of view
  const rootElements = elements.map(
    (element) => ({ ...element, frameId: null } as NonDeletedExcalidrawElement),
  );

  const svg = await exportToSvg(
    rootElements,
    {
      exportBackground: true,
      viewBackgroundColor: opts?.background ?? "#ffffff",
      exportPadding: opts?.padding ?? 24,
      frameRendering: { enabled: true, name: true, outline: true, clip: false },
    },
    null,
    { skipInliningFonts: true },
  );

  const svgString = svg.outerHTML;

  if (opts?.outFile) {
    const { writeFileSync } = await import("fs");
    writeFileSync(opts.outFile, svgString);
  }

  return svgString;
};
