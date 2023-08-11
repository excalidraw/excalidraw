import { FANCY_BG_BORDER_RADIUS, FANCY_BG_PADDING, SVG_NS } from "../constants";
import { loadHTMLImageElement, loadSVGElement } from "../element/image";
import { roundRect } from "../renderer/roundRect";
import { AppState, DataURL } from "../types";

type Dimensions = { w: number; h: number };

const getScaleToFill = (contentSize: Dimensions, containerSize: Dimensions) => {
  const scale = Math.max(
    containerSize.w / contentSize.w,
    containerSize.h / contentSize.h,
  );

  return scale;
};

const addImageBackground = (
  context: CanvasRenderingContext2D,
  canvasDimensions: Dimensions,
  fancyBackgroundImage: HTMLImageElement,
) => {
  context.save();
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(
      0,
      0,
      canvasDimensions.w,
      canvasDimensions.h,
      FANCY_BG_BORDER_RADIUS,
    );
  } else {
    roundRect(
      context,
      0,
      0,
      canvasDimensions.w,
      canvasDimensions.h,
      FANCY_BG_BORDER_RADIUS,
    );
  }
  const scale = getScaleToFill(
    { w: fancyBackgroundImage.width, h: fancyBackgroundImage.height },
    { w: canvasDimensions.w, h: canvasDimensions.h },
  );
  const x = (canvasDimensions.w - fancyBackgroundImage.width * scale) / 2;
  const y = (canvasDimensions.h - fancyBackgroundImage.height * scale) / 2;
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
    context.shadowBlur = shadow.blur;
    context.shadowOffsetX = shadow.offsetX;
    context.shadowOffsetY = shadow.offsetY;

    if (context.roundRect) {
      context.roundRect(
        FANCY_BG_PADDING * exportScale,
        FANCY_BG_PADDING * exportScale,
        normalizedDimensions.w - FANCY_BG_PADDING * 2 * exportScale,
        normalizedDimensions.h - FANCY_BG_PADDING * 2 * exportScale,
        FANCY_BG_BORDER_RADIUS * exportScale,
      );
    } else {
      roundRect(
        context,
        FANCY_BG_PADDING * exportScale,
        FANCY_BG_PADDING * exportScale,
        normalizedDimensions.w - FANCY_BG_PADDING * 2 * exportScale,
        normalizedDimensions.h - FANCY_BG_PADDING * 2 * exportScale,
        FANCY_BG_BORDER_RADIUS * exportScale,
      );
    }

    if (index === shadows.length - 1) {
      context.fillStyle = contentBackgroundColor;
      context.fill();
    }
    context.closePath();
    context.restore();
  });
};

export const applyFancyBackgroundOnCanvas = async ({
  canvas,
  fancyBackgroundImageUrl,
  backgroundColor,
  exportScale,
}: {
  canvas: HTMLCanvasElement;
  fancyBackgroundImageUrl: DataURL;
  backgroundColor: string;
  exportScale: AppState["exportScale"];
}) => {
  const context = canvas.getContext("2d")!;

  const fancyBackgroundImage = await loadHTMLImageElement(
    fancyBackgroundImageUrl,
  );

  const canvasDimensions: Dimensions = { w: canvas.width, h: canvas.height };

  addImageBackground(context, canvasDimensions, fancyBackgroundImage);

  addContentBackground(context, canvasDimensions, backgroundColor, exportScale);
};

export const applyFancyBackgroundOnSvg = async ({
  svgRoot,
  fancyBackgroundImageUrl,
  backgroundColor,
  dimensions,
  exportScale,
}: {
  svgRoot: SVGSVGElement;
  fancyBackgroundImageUrl: DataURL;
  backgroundColor: string;
  dimensions: Dimensions;
  exportScale: AppState["exportScale"];
}) => {
  const fancyBackgroundImage = await loadSVGElement(
    `${fancyBackgroundImageUrl}`,
  );

  fancyBackgroundImage.setAttribute("x", "0");
  fancyBackgroundImage.setAttribute("y", "0");
  fancyBackgroundImage.setAttribute("width", `${dimensions.w}`);
  fancyBackgroundImage.setAttribute("height", `${dimensions.h}`);
  fancyBackgroundImage.setAttribute("preserveAspectRatio", "none");

  svgRoot.appendChild(fancyBackgroundImage);

  const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute("y", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute(
    "width",
    `${dimensions.w - FANCY_BG_PADDING * 2 * exportScale}`,
  );
  rect.setAttribute(
    "height",
    `${dimensions.h - FANCY_BG_PADDING * 2 * exportScale}`,
  );
  rect.setAttribute("rx", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute("ry", (FANCY_BG_PADDING * exportScale).toString());
  rect.setAttribute("fill", backgroundColor);
  svgRoot.appendChild(rect);
};
