import { renderSVG } from "uqr";

import {
  EXCALIDRAW_BRAND_COLOR,
  EXCALIDRAW_LOGO_PATH_D,
  EXCALIDRAW_LOGO_VIEWBOX,
} from "@excalidraw/common";

/** Pixel size of each QR code module, in SVG user units. */
const QR_PIXEL_SIZE = 8;

/**
 * Fraction (of the QR code's total width) used for the white "quiet zone"
 * badge behind the centered logo. Error correction level "H" tolerates up
 * to ~30% data loss, so a badge covering ~(0.26)^2 ≈ 6.8% of the code's
 * area leaves generous headroom for reliable scanning across screen
 * resolutions and mobile camera apps.
 */
const LOGO_BADGE_SIZE_RATIO = 0.26;

/** Fraction of the badge occupied by the logo mark itself (rest is margin). */
const LOGO_ICON_SIZE_RATIO = 0.64;

const VIEW_BOX_PATTERN = /viewBox="0 0 ([\d.]+) ([\d.]+)"/;

/**
 * Overlays the official Excalidraw logo, centered, on top of a generated
 * QR code SVG string, by inserting a white rounded-rect "badge" plus the
 * logo icon just before the closing `</svg>` tag.
 */
const withCenteredExcalidrawLogo = (svg: string): string => {
  const match = svg.match(VIEW_BOX_PATTERN);
  if (!match) {
    // unexpected SVG shape — fail safe and return the plain QR code
    return svg;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  const badgeSize = Math.min(width, height) * LOGO_BADGE_SIZE_RATIO;
  const badgeX = (width - badgeSize) / 2;
  const badgeY = (height - badgeSize) / 2;
  const badgeCornerRadius = badgeSize * 0.2;

  const iconSize = badgeSize * LOGO_ICON_SIZE_RATIO;
  const iconX = (width - iconSize) / 2;
  const iconY = (height - iconSize) / 2;

  const logoOverlay =
    `<rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" ` +
    `rx="${badgeCornerRadius}" ry="${badgeCornerRadius}" fill="#fff" />` +
    `<svg x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" ` +
    `viewBox="${EXCALIDRAW_LOGO_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${EXCALIDRAW_LOGO_PATH_D}" fill="${EXCALIDRAW_BRAND_COLOR}" /></svg>`;

  const closingTagIndex = svg.lastIndexOf("</svg>");
  if (closingTagIndex === -1) {
    return svg;
  }

  return (
    svg.slice(0, closingTagIndex) + logoOverlay + svg.slice(closingTagIndex)
  );
};

/**
 * Generates a QR code SVG for the collaboration/share link, with the
 * official Excalidraw logo embedded in the center for brand recognition.
 *
 * Uses error correction level "H" (recovers up to ~30% data loss) so the
 * centered logo doesn't interfere with scannability.
 */
export const generateQRCodeSVG = (text: string): string => {
  const svg = renderSVG(text, {
    ecc: "H",
    pixelSize: QR_PIXEL_SIZE,
  });

  return withCenteredExcalidrawLogo(svg);
};
