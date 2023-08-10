import { FANCY_BG_BORDER_RADIUS, FANCY_BG_PADDING } from "../constants";
import { loadHTMLImageElement } from "../element/image";
import { roundRect } from "../renderer/roundRect";
import { DataURL } from "../types";

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
  canvasWidth: number,
  canvasHeight: number,
  fancyBackgroundImage: HTMLImageElement,
) => {
  context.save();
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(0, 0, canvasWidth, canvasHeight, FANCY_BG_BORDER_RADIUS);
  } else {
    roundRect(context, 0, 0, canvasWidth, canvasHeight, FANCY_BG_BORDER_RADIUS);
  }
  const scale = getScaleToFill(
    { w: fancyBackgroundImage.width, h: fancyBackgroundImage.height },
    { w: canvasWidth, h: canvasHeight },
  );
  const x = (canvasWidth - fancyBackgroundImage.width * scale) / 2;
  const y = (canvasHeight - fancyBackgroundImage.height * scale) / 2;
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
  canvasWidth: number,
  canvasHeight: number,
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
        canvasWidth - FANCY_BG_PADDING * 2,
        canvasHeight - FANCY_BG_PADDING * 2,
        FANCY_BG_BORDER_RADIUS,
      );
    } else {
      roundRect(
        context,
        FANCY_BG_PADDING,
        FANCY_BG_PADDING,
        canvasWidth - FANCY_BG_PADDING * 2,
        canvasHeight - FANCY_BG_PADDING * 2,
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

export const applyFancyBackground = async (
  canvas: HTMLCanvasElement,
  fancyBackgroundImageUrl: DataURL,
  backgroundColor: string,
) => {
  const context = canvas.getContext("2d")!;

  const fancyBackgroundImage = await loadHTMLImageElement(
    fancyBackgroundImageUrl,
  );

  addImageBackground(
    context,
    canvas.width,
    canvas.height,
    fancyBackgroundImage,
  );

  addContentBackground(context, canvas.width, canvas.height, backgroundColor);
};
