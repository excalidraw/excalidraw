import {
  IMAGE_INVERT_FILTER_HUE_ROTATE_AMOUNT,
  IMAGE_INVERT_FILTER_INVERT_AMOUNT,
  IMAGE_INVERT_FILTER_SATURATE_AMOUNT,
} from "./renderElement";

export function applyFiltersToImage(
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
) {
  const cached = cache.get(image);
  if (cached) {
    return cached;
  }

  const offscreen = new OffscreenCanvas(imageWidth, imageHeight);
  const offscreenCtx = offscreen.getContext("2d")!;
  offscreenCtx.drawImage(image, 0, 0, imageWidth, imageHeight);

  invert(offscreenCtx, IMAGE_INVERT_FILTER_INVERT_AMOUNT);
  hueRotate(offscreenCtx, IMAGE_INVERT_FILTER_HUE_ROTATE_AMOUNT);
  saturate(offscreenCtx, IMAGE_INVERT_FILTER_SATURATE_AMOUNT);

  cache.set(image, offscreen);
  return offscreen;
}

const cache = new WeakMap<CanvasImageSource, OffscreenCanvas>();

/**
 * Taken from @davidenke's context-filter-polyfill
 * @see {@link https://github.com/davidenke/context-filter-polyfill/blob/e1a04c24b8f31a0608f5d05155d29544a6d6429a/src/filters/invert.filter.ts}
 */
function invert(
  context: OffscreenCanvasRenderingContext2D,
  stringAmount = "0",
): void {
  let amount = normalizeNumberPercentage(stringAmount);

  // do not manipulate without proper amount
  if (amount <= 0) {
    return;
  }

  // a maximum of 100%
  if (amount > 1) {
    amount = 1;
  }

  const { height, width } = context.canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const { length } = data;

  for (let i = 0; i < length; i += 4) {
    data[i + 0] = Math.abs(data[i + 0] - 255 * amount);
    data[i + 1] = Math.abs(data[i + 1] - 255 * amount);
    data[i + 2] = Math.abs(data[i + 2] - 255 * amount);
  }

  context.putImageData(imageData, 0, 0);
}

/**
 * Taken from @davidenke's context-filter-polyfill
 * @see {@link https://github.com/davidenke/context-filter-polyfill/blob/e1a04c24b8f31a0608f5d05155d29544a6d6429a/src/filters/hue-rotate.filter.ts}
 */
function hueRotate(
  context: OffscreenCanvasRenderingContext2D,
  rotation = "0deg",
): void {
  const amount = normalizeAngle(rotation);

  // do not manipulate without proper amount
  if (amount <= 0) {
    return;
  }

  const { height, width } = context.canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  // in rgba world, every
  // n * 4 + 0 is red,
  // n * 4 + 1 green and
  // n * 4 + 2 is blue
  // the fourth can be skipped as it's the alpha channel
  // https://github.com/makoConstruct/canvas-hue-rotate/blob/master/hueShiftCanvas.js
  const h = ((amount % 1) + 1) % 1; // wraps the angle to unit interval, even when negative
  const th = h * 3;
  const thr = Math.floor(th);
  const d = th - thr;
  const b = 1 - d;
  let ma;
  let mb;
  let mc;
  let md;
  let me;
  let mf;
  let mg;
  let mh;
  let mi;

  switch (thr) {
    default:
      ma = mb = mc = md = me = mf = mg = mh = mi = 0;
      break;
    case 0:
      ma = b;
      mb = 0;
      mc = d;
      md = d;
      me = b;
      mf = 0;
      mg = 0;
      mh = d;
      mi = b;
      break;
    case 1:
      ma = 0;
      mb = d;
      mc = b;
      md = b;
      me = 0;
      mf = d;
      mg = d;
      mh = b;
      mi = 0;
      break;
    case 2:
      ma = d;
      mb = b;
      mc = 0;
      md = 0;
      me = d;
      mf = b;
      mg = b;
      mh = 0;
      mi = d;
      break;
  }
  // do the pixels
  let place = 0;
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      place = 4 * (y * width + x);

      const ir = data[place + 0];
      const ig = data[place + 1];
      const ib = data[place + 2];

      data[place + 0] = Math.floor(ma * ir + mb * ig + mc * ib);
      data[place + 1] = Math.floor(md * ir + me * ig + mf * ib);
      data[place + 2] = Math.floor(mg * ir + mh * ig + mi * ib);
    }
  }

  // set back image data to context
  context.putImageData(imageData, 0, 0);

  // return the context itself
}

/**
 * Taken from @davidenke's context-filter-polyfill
 * @see {@link https://github.com/davidenke/context-filter-polyfill/blob/e1a04c24b8f31a0608f5d05155d29544a6d6429a/src/filters/saturate.filter.ts}
 */
function saturate(
  context: OffscreenCanvasRenderingContext2D,
  saturation = "1",
): void {
  let amount = normalizeNumberPercentage(saturation);

  // do not manipulate without proper amount
  if (amount === 1) {
    return;
  }

  // align minimum
  if (amount < 0) {
    amount = 0;
  }

  const { height, width } = context.canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const lumR = (1 - amount) * 0.3086;
  const lumG = (1 - amount) * 0.6094;
  const lumB = (1 - amount) * 0.082;
  // tslint:disable-next-line no-bitwise
  const shiftW = width << 2;

  for (let j = 0; j < height; j++) {
    const offset = j * shiftW;
    for (let i = 0; i < width; i++) {
      // tslint:disable-next-line no-bitwise
      const pos = offset + (i << 2);
      const r = data[pos + 0];
      const g = data[pos + 1];
      const b = data[pos + 2];

      data[pos + 0] = (lumR + amount) * r + lumG * g + lumB * b;
      data[pos + 1] = lumR * r + (lumG + amount) * g + lumB * b;
      data[pos + 2] = lumR * r + lumG * g + (lumB + amount) * b;
    }
  }

  // set back image data to context
  context.putImageData(imageData, 0, 0);
}

function normalizeNumberPercentage(percentage: string): number {
  let normalized = parseFloat(percentage);

  // check for percentages and divide by a hundred
  if (/%\s*?$/i.test(percentage)) {
    normalized /= 100;
  }

  return normalized;
}

function normalizeAngle(angle: string): number {
  let normalized = parseFloat(angle);
  const unit = angle.slice(normalized.toString().length);

  // check for units and align accordingly
  switch (unit) {
    case "deg":
      normalized /= 360;
      break;
    case "grad":
      normalized /= 400;
      break;
    case "rad":
      normalized /= 2 * Math.PI;
      break;
  }

  return normalized;
}
