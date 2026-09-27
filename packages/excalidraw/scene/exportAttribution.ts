import {
  FONT_FAMILY,
  SVG_NS,
  applyDarkModeFilter,
  getFontFamilyString,
  getFontString,
  isColorDark,
  isTransparent,
} from "@excalidraw/common";

import { getLineWidth, newTextElement } from "@excalidraw/element";

import type { FontString } from "@excalidraw/element/types";

/**
 * "excalidraw.com" badge (logo + address) that can be added to image exports
 * (PNG, SVG, clipboard). It sits below the drawing, in the bottom-right
 * corner, and never covers any element. In SVG it is a real link.
 */

export const EXPORT_ATTRIBUTION_TEXT = "excalidraw.com";

export type ExportAttributionFormat = "png" | "svg" | "clipboard";

export const getExportAttributionUrl = (format: ExportAttributionFormat) =>
  `https://excalidraw.com/?utm_source=excalidraw&utm_medium=export&utm_content=${format}`;

/** Excalidraw logo mark (pencil), drawn in a 40×40 box */
export const EXCALIDRAW_LOGO_ICON_VIEWBOX = 40;
export const EXCALIDRAW_LOGO_ICON_PATH =
  "M39.9 32.889a.326.326 0 0 0-.279-.056c-2.094-3.083-4.774-6-7.343-8.833l-.419-.472a.212.212 0 0 0-.056-.139.586.586 0 0 0-.167-.111l-.084-.083-.056-.056c-.084-.167-.28-.278-.475-.167-.782.39-1.507.973-2.206 1.528-.92.722-1.842 1.445-2.708 2.25a8.405 8.405 0 0 0-.977 1.028c-.14.194-.028.361.14.444-.615.611-1.23 1.223-1.843 1.861a.315.315 0 0 0-.084.223c0 .083.056.166.111.194l1.09.833v.028c1.535 1.528 4.244 3.611 7.12 5.861.418.334.865.667 1.284 1 .195.223.39.473.558.695.084.11.28.139.391.055.056.056.14.111.196.167a.398.398 0 0 0 .167.056.255.255 0 0 0 .224-.111.394.394 0 0 0 .055-.167c.029 0 .028.028.056.028a.318.318 0 0 0 .224-.084l5.082-5.528a.309.309 0 0 0 0-.444Zm-14.63-1.917a.485.485 0 0 0 .111.14c.586.5 1.2 1 1.843 1.555l-2.569-1.945-.251-.166c-.056-.028-.112-.084-.168-.111l-.195-.167.056-.056.055-.055.112-.111c.866-.861 2.346-2.306 3.1-3.028-.81.805-2.43 3.167-2.095 3.944Zm8.767 6.89-2.122-1.612a44.713 44.713 0 0 0-2.625-2.5c1.145.861 2.122 1.611 2.262 1.75 1.117.972 1.06.806 1.815 1.445l.921.666a1.06 1.06 0 0 1-.251.25Zm.558.416-.056-.028c.084-.055.168-.111.252-.194l-.196.222ZM1.089 5.75c.055.361.14.722.195 1.056.335 1.833.67 3.5 1.284 4.75l.252.944c.084.361.223.806.363.917 1.424 1.25 3.602 3.11 5.947 4.889a.295.295 0 0 0 .363 0s0 .027.028.027a.254.254 0 0 0 .196.084.318.318 0 0 0 .223-.084c2.988-3.305 5.221-6.027 6.813-8.305.112-.111.14-.278.14-.417.111-.111.195-.25.307-.333.111-.111.111-.306 0-.39l-.028-.027c0-.055-.028-.139-.084-.167-.698-.666-1.2-1.138-1.731-1.638-.922-.862-1.871-1.75-3.881-3.75l-.028-.028c-.028-.028-.056-.056-.112-.056-.558-.194-1.703-.389-3.127-.639C6.087 2.223 3.21 1.723.614.944c0 0-.168 0-.196.028l-.083.084c-.028.027-.056.055-.224.11h.056-.056c.028.167.028.278.084.473 0 .055.112.5.112.555l.782 3.556Zm15.496 3.278-.335-.334c.084.112.196.195.335.334Zm-3.546 4.666-.056.056c0-.028.028-.056.056-.056Zm-2.038-10c.168.167.866.834 1.033.973-.726-.334-2.54-1.167-3.379-1.445.838.167 1.983.334 2.346.472ZM1.424 2.306c.419.722.754 3.222 1.089 5.666-.196-.778-.335-1.555-.503-2.278-.251-1.277-.503-2.416-.838-3.416.056 0 .14 0 .252.028Zm-.168-.584c-.112 0-.223-.028-.307-.028 0-.027 0-.055-.028-.055.14 0 .223.028.335.083Zm-1.089.222c0-.027 0-.027 0 0ZM39.453 1.333c.028-.11-.558-.61-.363-.639.42-.027.42-.666 0-.666-.558.028-1.144.166-1.675.25-.977.194-1.982.389-2.96.61-2.205.473-4.383.973-6.561 1.557-.67.194-1.424.333-2.066.666-.224.111-.196.333-.084.472-.056.028-.084.028-.14.056-.195.028-.363.056-.558.083-.168.028-.252.167-.224.334 0 .027.028.083.028.11-1.173 1.556-2.485 3.195-3.909 4.945-1.396 1.611-2.876 3.306-4.356 5.056-4.719 5.5-10.052 11.75-15.943 17.25a.268.268 0 0 0 0 .389c.028.027.056.055.084.055-.084.084-.168.14-.252.222-.056.056-.084.111-.084.167a.605.605 0 0 0-.111.139c-.112.111-.112.305.028.389.111.11.307.11.39-.028.029-.028.029-.056.056-.056a.44.44 0 0 1 .615 0c.335.362.67.723.977 1.028l-.698-.583c-.112-.111-.307-.083-.39.028-.113.11-.085.305.027.389l7.427 6.194c.056.056.112.056.196.056s.14-.028.195-.084l.168-.166c.028.027.083.027.111.027.084 0 .14-.027.196-.083 10.052-10.055 18.15-17.639 27.42-24.417.083-.055.111-.166.111-.25.112 0 .196-.083.251-.194 1.704-5.194 2.039-9.806 2.15-12.083v-.028c0-.028.028-.056.028-.083.028-.056.028-.084.028-.084a1.626 1.626 0 0 0-.111-1.028ZM21.472 9.5c.446-.5.893-1.028 1.34-1.5-2.876 3.778-7.65 9.583-14.408 16.5 4.607-5.083 9.242-10.333 13.068-15ZM5.193 35.778h.084-.084Zm3.462 3.194c-.027-.028-.027-.028 0-.028v.028Zm4.16-3.583c.224-.25.448-.472.699-.722 0 0 0 .027.028.027-.252.223-.475.445-.726.695Zm1.146-1.111c.14-.14.279-.334.446-.5l.028-.028c1.648-1.694 3.351-3.389 5.082-5.111l.028-.028c.419-.333.921-.694 1.368-1.028a379.003 379.003 0 0 0-6.952 6.695ZM24.794 6.472c-.921 1.195-1.954 2.778-2.82 4.028-2.736 3.944-11.532 13.583-11.727 13.75a1976.983 1976.983 0 0 1-8.042 7.639l-.167.167c-.14-.167-.14-.417.028-.556C14.49 19.861 22.03 10.167 25.074 5.917c-.084.194-.14.36-.28.555Zm4.83 5.695c-1.116-.64-1.646-1.64-1.34-2.611l.084-.334c.028-.083.084-.194.14-.277.307-.5.754-.917 1.257-1.167.027 0 .055 0 .083-.028-.028-.056-.028-.139-.028-.222.028-.167.14-.278.335-.278.335 0 1.369.306 1.76.639.111.083.223.194.335.305.14.167.363.445.474.667.056.028.112.306.196.445.056.222.111.472.084.694-.028.028 0 .194-.028.194a2.668 2.668 0 0 1-.363 1.028c-.028.028-.028.056-.056.084l-.028.027c-.14.223-.335.417-.53.556-.643.444-1.369.583-2.095.389 0 0-.195-.084-.28-.111Zm8.154-.834a39.098 39.098 0 0 1-.893 3.167c0 .028-.028.083 0 .111-.056 0-.084.028-.14.056-2.206 1.61-4.356 3.305-6.506 5.028 1.843-1.64 3.686-3.306 5.613-4.945.558-.5.949-1.139 1.06-1.861l.28-1.667v-.055c.14-.334.67-.195.586.166Z";

const TEXT_COLOR = "#46464f";
const LOGO_COLOR = "#6965db";
const FONT_FAMILY_ID = FONT_FAMILY.Excalifont;

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 32;
/**
 * badge text grows with big diagrams so it stays readable when shrunk, but
 * stays small next to the drawing (testers found the first size too loud)
 */
const FONT_SIZE_TO_CONTENT_RATIO = 0.015;

export type ExportAttributionLayout = {
  /** export width/height including the badge */
  width: number;
  height: number;
  /** top-left corner of the badge */
  x: number;
  y: number;
  badgeWidth: number;
  badgeHeight: number;
  fontSize: number;
  font: FontString;
  logoSize: number;
};

export const getExportAttributionFontSize = (
  contentWidth: number,
  contentHeight: number,
) => {
  const size = Math.round(
    Math.max(contentWidth, contentHeight) * FONT_SIZE_TO_CONTENT_RATIO,
  );
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
};

/** text element used only to load and inline the badge font */
export const getExportAttributionFontElement = (fontSize: number) =>
  newTextElement({
    text: EXPORT_ATTRIBUTION_TEXT,
    fontFamily: FONT_FAMILY_ID,
    fontSize,
    x: 0,
    y: 0,
  });

/**
 * Takes the export size without the badge and returns the size with the
 * badge added below the content, plus where to draw the badge.
 */
export const layoutExportAttribution = ({
  width,
  height,
  exportPadding,
}: {
  width: number;
  height: number;
  exportPadding: number;
}): ExportAttributionLayout => {
  const fontSize = getExportAttributionFontSize(
    width - exportPadding * 2,
    height - exportPadding * 2,
  );
  const font = getFontString({ fontFamily: FONT_FAMILY_ID, fontSize });
  const textWidth = getLineWidth(EXPORT_ATTRIBUTION_TEXT, font);
  const logoSize = fontSize;
  const logoGap = Math.round(fontSize * 0.35);

  const badgeWidth = logoSize + logoGap + textWidth;
  const badgeHeight = logoSize;
  // keep the badge off the image edge even when exporting a frame (padding 0)
  const margin = Math.max(exportPadding, 8);
  const spacing = Math.round(fontSize * 0.35);

  const y = height - exportPadding + spacing;
  const nextWidth = Math.max(width, badgeWidth + margin * 2);
  const nextHeight = y + badgeHeight + margin;

  return {
    width: nextWidth,
    height: nextHeight,
    x: nextWidth - margin - badgeWidth,
    y,
    badgeWidth,
    badgeHeight,
    fontSize,
    font,
    logoSize,
  };
};

type AttributionColorOptions = {
  exportWithDarkMode: boolean;
  exportBackground: boolean;
  /** canvas background; the badge contrasts with it when it is exported */
  viewBackgroundColor: string | null;
};

const getAttributionColors = ({
  exportWithDarkMode,
  exportBackground,
  viewBackgroundColor,
}: AttributionColorOptions) => {
  if (
    !exportBackground ||
    !viewBackgroundColor ||
    isTransparent(viewBackgroundColor)
  ) {
    return {
      text: applyDarkModeFilter(TEXT_COLOR, exportWithDarkMode),
      logo: applyDarkModeFilter(LOGO_COLOR, exportWithDarkMode),
      // transparent exports can land on any page colour, so give the badge a
      // thin contrasting outline to keep it readable on light and dark pages
      halo: exportWithDarkMode
        ? "rgba(18, 18, 18, 0.85)"
        : "rgba(255, 255, 255, 0.85)",
    };
  }
  // follow the colour the background is actually painted with, so a dark
  // custom background (or a light one in dark mode) still gets a readable badge
  const onDarkBackground = isColorDark(
    applyDarkModeFilter(viewBackgroundColor, exportWithDarkMode),
  );
  return {
    text: applyDarkModeFilter(TEXT_COLOR, onDarkBackground),
    logo: applyDarkModeFilter(LOGO_COLOR, onDarkBackground),
    halo: null,
  };
};

/** text is right-aligned to the badge edge so it never overflows the image */
const getTextAnchor = (layout: ExportAttributionLayout) => ({
  x: layout.x + layout.badgeWidth,
  // approximate optical centre of the text next to the logo
  y: layout.y + layout.badgeHeight / 2 + layout.fontSize * 0.35,
});

export const renderExportAttributionToCanvas = (
  canvas: HTMLCanvasElement,
  layout: ExportAttributionLayout,
  opts: AttributionColorOptions & {
    scale: number;
  },
) => {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const colors = getAttributionColors(opts);
  const haloWidth = layout.fontSize * 0.3;

  context.save();
  context.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);

  if (typeof Path2D !== "undefined") {
    const logoScale = layout.logoSize / EXCALIDRAW_LOGO_ICON_VIEWBOX;
    const logo = new Path2D(EXCALIDRAW_LOGO_ICON_PATH);
    context.save();
    context.translate(layout.x, layout.y);
    context.scale(logoScale, logoScale);
    if (colors.halo) {
      context.lineJoin = "round";
      context.lineWidth = haloWidth / logoScale;
      context.strokeStyle = colors.halo;
      context.stroke(logo);
    }
    context.fillStyle = colors.logo;
    context.fill(logo);
    context.restore();
  }

  const anchor = getTextAnchor(layout);
  context.font = layout.font;
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  if (colors.halo) {
    context.lineJoin = "round";
    context.lineWidth = haloWidth;
    context.strokeStyle = colors.halo;
    context.strokeText(EXPORT_ATTRIBUTION_TEXT, anchor.x, anchor.y);
  }
  context.fillStyle = colors.text;
  context.fillText(EXPORT_ATTRIBUTION_TEXT, anchor.x, anchor.y);

  context.restore();
};

export const renderExportAttributionToSvg = (
  svgRoot: SVGSVGElement,
  layout: ExportAttributionLayout,
  opts: AttributionColorOptions & {
    format: ExportAttributionFormat;
  },
) => {
  const doc = svgRoot.ownerDocument;
  const colors = getAttributionColors(opts);
  const haloWidth = layout.fontSize * 0.3;

  const link = doc.createElementNS(SVG_NS, "a");
  link.setAttribute("class", "excalidraw-attribution");
  link.setAttribute("href", getExportAttributionUrl(opts.format));
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener noreferrer");

  const title = doc.createElementNS(SVG_NS, "title");
  title.textContent = "Open excalidraw.com";
  link.appendChild(title);

  const logoScale = layout.logoSize / EXCALIDRAW_LOGO_ICON_VIEWBOX;
  const logo = doc.createElementNS(SVG_NS, "path");
  logo.setAttribute("d", EXCALIDRAW_LOGO_ICON_PATH);
  logo.setAttribute(
    "transform",
    `translate(${layout.x} ${layout.y}) scale(${logoScale})`,
  );
  logo.setAttribute("fill", colors.logo);
  if (colors.halo) {
    logo.setAttribute("stroke", colors.halo);
    logo.setAttribute("stroke-width", `${haloWidth / logoScale}`);
    logo.setAttribute("stroke-linejoin", "round");
    logo.setAttribute("paint-order", "stroke");
  }
  link.appendChild(logo);

  const anchor = getTextAnchor(layout);
  const text = doc.createElementNS(SVG_NS, "text");
  text.setAttribute("x", `${anchor.x}`);
  text.setAttribute("y", `${anchor.y}`);
  text.setAttribute("text-anchor", "end");
  text.setAttribute(
    "font-family",
    getFontFamilyString({ fontFamily: FONT_FAMILY_ID }),
  );
  text.setAttribute("font-size", `${layout.fontSize}px`);
  text.setAttribute("fill", colors.text);
  if (colors.halo) {
    text.setAttribute("stroke", colors.halo);
    text.setAttribute("stroke-width", `${haloWidth}`);
    text.setAttribute("stroke-linejoin", "round");
    text.setAttribute("paint-order", "stroke");
  }
  text.textContent = EXPORT_ATTRIBUTION_TEXT;
  link.appendChild(text);

  svgRoot.appendChild(link);
};
