import { DARK_THEME_FILTER } from "./constants";

const DEFAULT_DARK_THEME_FILTER_INVERT = 0.93;
const DEFAULT_DARK_THEME_FILTER_HUE_ROTATE_DEG = 180;

const parseDarkThemeFilter = (filter: string) => {
  const invertMatch = filter.match(/invert\((\d+(?:\.\d+)?)%\)/i);
  const hueRotateMatch = filter.match(/hue-rotate\((\d+(?:\.\d+)?)deg\)/i);

  return {
    invert:
      invertMatch?.[1] != null
        ? Number(invertMatch[1]) / 100
        : DEFAULT_DARK_THEME_FILTER_INVERT,
    hueRotateDeg:
      hueRotateMatch?.[1] != null
        ? Number(hueRotateMatch[1])
        : DEFAULT_DARK_THEME_FILTER_HUE_ROTATE_DEG,
  };
};

const { invert: DARK_THEME_FILTER_INVERT, hueRotateDeg } =
  parseDarkThemeFilter(DARK_THEME_FILTER);

const clampToByte = (value: number) =>
  value < 0 ? 0 : value > 255 ? 255 : value;

const hueRotate = (r: number, g: number, b: number, rotateDeg: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return {
      r,
      g,
      b,
    };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }

  h = (h * 60 + rotateDeg + 360) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rr = 0;
  let gg = 0;
  let bb = 0;

  if (h < 60) {
    rr = c;
    gg = x;
  } else if (h < 120) {
    rr = x;
    gg = c;
  } else if (h < 180) {
    gg = c;
    bb = x;
  } else if (h < 240) {
    gg = x;
    bb = c;
  } else if (h < 300) {
    rr = x;
    bb = c;
  } else {
    rr = c;
    bb = x;
  }

  return {
    r: rr + m,
    g: gg + m,
    b: bb + m,
  };
};

export const applyDarkThemeFilterToImageData = (imageData: ImageData) => {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i];
    const g0 = data[i + 1];
    const b0 = data[i + 2];

    const rInv =
      255 * DARK_THEME_FILTER_INVERT + r0 * (1 - 2 * DARK_THEME_FILTER_INVERT);
    const gInv =
      255 * DARK_THEME_FILTER_INVERT + g0 * (1 - 2 * DARK_THEME_FILTER_INVERT);
    const bInv =
      255 * DARK_THEME_FILTER_INVERT + b0 * (1 - 2 * DARK_THEME_FILTER_INVERT);

    const { r, g, b } = hueRotate(
      rInv / 255,
      gInv / 255,
      bInv / 255,
      hueRotateDeg,
    );

    data[i] = clampToByte(Math.round(r * 255));
    data[i + 1] = clampToByte(Math.round(g * 255));
    data[i + 2] = clampToByte(Math.round(b * 255));
  }
};
