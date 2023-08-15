import {
  DEFAULT_EXPORT_PADDING,
  FANCY_BACKGROUND_IMAGES,
  FANCY_BG_BORDER_RADIUS,
  FANCY_BG_PADDING,
  IMAGE_INVERT_FILTER,
  SVG_NS,
  THEME,
  THEME_FILTER,
} from "../constants";
import { loadHTMLImageElement, loadSVGElement } from "../element/image";
import { getScaleToFill } from "../packages/utils";
import { roundRect } from "../renderer/roundRect";
import { AppState, Dimensions } from "../types";

export const getFancyBackgroundPadding = (
  exportPadding = DEFAULT_EXPORT_PADDING,
) => FANCY_BG_PADDING + FANCY_BG_BORDER_RADIUS + exportPadding;

const addImageBackground = (
  context: CanvasRenderingContext2D,
  canvasDimensions: Dimensions,
  fancyBackgroundImage: HTMLImageElement,
  exportScale: AppState["exportScale"],
) => {
  context.save();
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(
      0,
      0,
      canvasDimensions.width,
      canvasDimensions.height,
      FANCY_BG_BORDER_RADIUS * exportScale,
    );
  } else {
    roundRect(
      context,
      0,
      0,
      canvasDimensions.width,
      canvasDimensions.height,
      FANCY_BG_BORDER_RADIUS * exportScale,
    );
  }
  const scale = getScaleToFill(
    { width: fancyBackgroundImage.width, height: fancyBackgroundImage.height },
    { width: canvasDimensions.width, height: canvasDimensions.height },
  );
  const x = (canvasDimensions.width - fancyBackgroundImage.width * scale) / 2;
  const y = (canvasDimensions.height - fancyBackgroundImage.height * scale) / 2;
  context.clip();
  context.drawImage(
    fancyBackgroundImage,
    x,
    y,
    fancyBackgroundImage.width * scale,
    fancyBackgroundImage.height * scale,
  );
  context.closePath();
  context.restore();
};

const addContentBackground = (
  context: CanvasRenderingContext2D,
  normalizedDimensions: Dimensions,
  contentBackgroundColor: string,
  exportScale: AppState["exportScale"],
  theme: AppState["theme"],
) => {
  const shadows = [
    {
      offsetX: 0,
      offsetY: 0.7698959708213806,
      blur: 1.4945039749145508,
      alpha: 0.02,
    },
    {
      offsetX: 0,
      offsetY: 1.1299999952316284,
      blur: 4.1321120262146,
      alpha: 0.04,
    },
    {
      offsetX: 0,
      offsetY: 4.130000114440918,
      blur: 9.94853401184082,
      alpha: 0.05,
    },
    { offsetX: 0, offsetY: 13, blur: 33, alpha: 0.07 },
  ];

  shadows.forEach((shadow, index): void => {
    context.save();
    context.beginPath();
    context.shadowColor = `rgba(0, 0, 0, ${shadow.alpha})`;
    context.shadowBlur = shadow.blur * exportScale;
    context.shadowOffsetX = shadow.offsetX * exportScale;
    context.shadowOffsetY = shadow.offsetY * exportScale;

    if (context.roundRect) {
      context.roundRect(
        FANCY_BG_PADDING * exportScale,
        FANCY_BG_PADDING * exportScale,
        normalizedDimensions.width - FANCY_BG_PADDING * 2 * exportScale,
        normalizedDimensions.height - FANCY_BG_PADDING * 2 * exportScale,
        FANCY_BG_BORDER_RADIUS * exportScale,
      );
    } else {
      roundRect(
        context,
        FANCY_BG_PADDING * exportScale,
        FANCY_BG_PADDING * exportScale,
        normalizedDimensions.width - FANCY_BG_PADDING * 2 * exportScale,
        normalizedDimensions.height - FANCY_BG_PADDING * 2 * exportScale,
        FANCY_BG_BORDER_RADIUS * exportScale,
      );
    }

    if (index === shadows.length - 1) {
      if (theme === THEME.DARK) {
        context.filter = THEME_FILTER;
      }
      context.fillStyle = contentBackgroundColor;
      context.fill();
    }
    context.closePath();
    context.restore();
  });
};

export const applyFancyBackgroundOnCanvas = async ({
  canvas,
  fancyBackgroundImageKey,
  backgroundColor,
  exportScale,
  theme,
}: {
  canvas: HTMLCanvasElement;
  fancyBackgroundImageKey: Exclude<
    keyof typeof FANCY_BACKGROUND_IMAGES,
    "solid"
  >;
  backgroundColor: string;
  exportScale: AppState["exportScale"];
  theme: AppState["theme"];
}) => {
  const context = canvas.getContext("2d")!;

  const fancyBackgroundImageUrl =
    FANCY_BACKGROUND_IMAGES[fancyBackgroundImageKey][theme];

  const fancyBackgroundImage = await loadHTMLImageElement(
    fancyBackgroundImageUrl,
  );

  const canvasDimensions: Dimensions = {
    width: canvas.width,
    height: canvas.height,
  };

  addImageBackground(
    context,
    canvasDimensions,
    fancyBackgroundImage,
    exportScale,
  );

  addContentBackground(
    context,
    canvasDimensions,
    backgroundColor,
    exportScale,
    theme,
  );
};

export const applyFancyBackgroundOnSvg = async ({
  svgRoot,
  fancyBackgroundImageKey,
  backgroundColor,
  dimensions,
  exportScale,
  theme,
}: {
  svgRoot: SVGSVGElement;
  fancyBackgroundImageKey: Exclude<
    keyof typeof FANCY_BACKGROUND_IMAGES,
    "solid"
  >;
  backgroundColor: string;
  dimensions: Dimensions;
  exportScale: AppState["exportScale"];
  theme: AppState["theme"];
}) => {
  const fancyBackgroundImageUrl =
    FANCY_BACKGROUND_IMAGES[fancyBackgroundImageKey][theme];
  const fancyBackgroundImage = await loadSVGElement(fancyBackgroundImageUrl);

  fancyBackgroundImage.setAttribute("x", "0");
  fancyBackgroundImage.setAttribute("y", "0");
  fancyBackgroundImage.setAttribute("width", `${dimensions.width}`);
  fancyBackgroundImage.setAttribute("height", `${dimensions.height}`);
  fancyBackgroundImage.setAttribute("preserveAspectRatio", "none");
  if (theme === THEME.DARK) {
    fancyBackgroundImage.setAttribute("filter", IMAGE_INVERT_FILTER);
  }

  svgRoot.appendChild(fancyBackgroundImage);

  const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute("y", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute(
    "width",
    `${dimensions.width - FANCY_BG_PADDING * 2 * exportScale}`,
  );
  rect.setAttribute(
    "height",
    `${dimensions.height - FANCY_BG_PADDING * 2 * exportScale}`,
  );
  rect.setAttribute("rx", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute("ry", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute("fill", backgroundColor);
  svgRoot.appendChild(rect);
};
