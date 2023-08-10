import {
  DEFAULT_EXPORT_PADDING,
  FANCY_BG_BORDER_RADIUS,
  FANCY_BG_PADDING,
} from "../constants";
import { loadHTMLImageElement } from "../element/image";
import { roundRect } from "../renderer/roundRect";
import { DataURL } from "../types";
import { RenderConfig } from "./types";

type Dimensions = { w: number; h: number };

const getScaleToFill = (contentSize: Dimensions, containerSize: Dimensions) => {
  const scale = Math.max(
    containerSize.w / contentSize.w,
    containerSize.h / contentSize.h,
  );

  return scale;
};

const getScaleToFit = (contentSize: Dimensions, containerSize: Dimensions) => {
  const scale = Math.min(
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
        FANCY_BG_PADDING,
        FANCY_BG_PADDING,
        normalizedDimensions.w - FANCY_BG_PADDING * 2,
        normalizedDimensions.h - FANCY_BG_PADDING * 2,
        FANCY_BG_BORDER_RADIUS,
      );
    } else {
      roundRect(
        context,
        FANCY_BG_PADDING,
        FANCY_BG_PADDING,
        normalizedDimensions.w - FANCY_BG_PADDING * 2,
        normalizedDimensions.h - FANCY_BG_PADDING * 2,
        FANCY_BG_BORDER_RADIUS,
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

const updateRenderConfig = (
  renderConfig: RenderConfig,
  canvasDimensions: Dimensions,
  contentDimesions: Dimensions,
): { scale: number; renderConfig: RenderConfig } => {
  const totalPadding =
    FANCY_BG_PADDING + FANCY_BG_BORDER_RADIUS + DEFAULT_EXPORT_PADDING;

  return {
    renderConfig: {
      ...renderConfig,
      scrollX: renderConfig.scrollX + totalPadding,
      scrollY: renderConfig.scrollY + totalPadding,
    },
    scale: getScaleToFit(contentDimesions, {
      w: canvasDimensions.w - totalPadding * 2,
      h: canvasDimensions.h - totalPadding * 2,
    }),
  };
};

export const applyFancyBackground = async ({
  canvas,
  fancyBackgroundImageUrl,
  backgroundColor,
  renderConfig,
  contentDimensions,
}: {
  canvas: HTMLCanvasElement;
  fancyBackgroundImageUrl: DataURL;
  backgroundColor: string;
  scale: number;
  renderConfig: RenderConfig;
  contentDimensions: Dimensions;
}) => {
  const context = canvas.getContext("2d")!;

  const fancyBackgroundImage = await loadHTMLImageElement(
    fancyBackgroundImageUrl,
  );

  const canvasDimensions: Dimensions = { w: canvas.width, h: canvas.height };

  // const normalizedDimensions: Dimensions = {
  //   w: canvas.width / scale,
  //   h: canvas.height / scale,
  // };

  addImageBackground(context, canvasDimensions, fancyBackgroundImage);

  addContentBackground(context, canvasDimensions, backgroundColor);

  return updateRenderConfig(renderConfig, canvasDimensions, contentDimensions);
};
