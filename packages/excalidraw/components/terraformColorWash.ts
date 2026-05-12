import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * Color washing for Terraform relationship focus dimming. We blend each element's
 * `strokeColor` / `backgroundColor` toward the canvas background instead of lowering
 * `opacity`, so dimmed elements still fully cover what's behind them on canvas.
 *
 * Originals are stashed under `customData.terraformDimmedOriginals` on first dim and
 * restored from there when focus clears, so re-dimming always blends from the canonical
 * unaffected color (never from an already-washed value).
 */

/** Subset of `ExcalidrawElement` fields we read from / write to during washing. */
type WashableElement = Pick<
  ExcalidrawElement,
  "strokeColor" | "backgroundColor" | "fillStyle" | "customData"
>;

type RGB = { r: number; g: number; b: number };

const TRANSPARENT_TOKENS = new Set(["transparent", "none"]);

const TERRAFORM_DIMMED_ORIGINALS_KEY = "terraformDimmedOriginals";

/** Stored under `customData.terraformDimmedOriginals`. */
export type TerraformDimmedOriginals = {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: ExcalidrawElement["fillStyle"];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Parses `#rgb`, `#rrggbb`, or 8-char `#rrggbbaa` (alpha ignored). Returns `null`
 * for `"transparent"` / `"none"` / unrecognized input so callers can decide whether
 * to treat as transparent or no-op.
 */
export const parseHexColor = (color: string): RGB | null => {
  if (!color || typeof color !== "string") {
    return null;
  }
  const trimmed = color.trim().toLowerCase();
  if (TRANSPARENT_TOKENS.has(trimmed)) {
    return null;
  }
  if (!trimmed.startsWith("#")) {
    return null;
  }

  const hex = trimmed.slice(1);
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some(Number.isNaN)) {
      return null;
    }
    return { r, g, b };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) {
      return null;
    }
    return { r, g, b };
  }
  return null;
};

const formatHex = ({ r, g, b }: RGB): string => {
  const channel = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
};

/**
 * Returns `color` blended toward `backgroundColor` by `washFactor` (0..1).
 * - `washFactor === 0` → returns `color` unchanged.
 * - `washFactor === 1` → returns `backgroundColor`.
 * - If `color` is transparent / unparseable, returns the background blended toward
 *   itself (i.e. the background) so a transparent fill becomes an opaque washed fill.
 * - If both colors are unparseable, returns `color` unchanged.
 */
export const washHexColor = (
  color: string,
  washFactor: number,
  backgroundColor: string,
): string => {
  const factor = clamp(washFactor, 0, 1);
  if (factor === 0) {
    return color;
  }

  const bg = parseHexColor(backgroundColor) ?? { r: 255, g: 255, b: 255 };
  const fg = parseHexColor(color);

  if (!fg) {
    return formatHex(bg);
  }

  return formatHex({
    r: fg.r + (bg.r - fg.r) * factor,
    g: fg.g + (bg.g - fg.g) * factor,
    b: fg.b + (bg.b - fg.b) * factor,
  });
};

const isTransparent = (color: string): boolean => {
  if (!color || typeof color !== "string") {
    return false;
  }
  return TRANSPARENT_TOKENS.has(color.trim().toLowerCase());
};

const readStashedOriginals = (
  element: WashableElement,
): TerraformDimmedOriginals | null => {
  const stashed = element.customData?.[TERRAFORM_DIMMED_ORIGINALS_KEY];
  if (!stashed || typeof stashed !== "object") {
    return null;
  }
  const candidate = stashed as Partial<TerraformDimmedOriginals>;
  if (
    typeof candidate.strokeColor !== "string" ||
    typeof candidate.backgroundColor !== "string" ||
    typeof candidate.fillStyle !== "string"
  ) {
    return null;
  }
  return candidate as TerraformDimmedOriginals;
};

/** Patch fields that `dimmedTerraformElementOverrides` / `restoredTerraformElementOverrides` produce. */
export type TerraformWashOverrides = {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: ExcalidrawElement["fillStyle"];
  customData: Record<string, any>;
};

const cloneCustomDataWithoutStash = (
  customData: ExcalidrawElement["customData"],
): Record<string, any> => {
  const next = { ...(customData ?? {}) };
  delete next[TERRAFORM_DIMMED_ORIGINALS_KEY];
  return next;
};

/**
 * Builds the field patch needed to "dim" a terraform element to a given semantic
 * `level` (0..100; 100 means no dimming). Stashes the original colors / fillStyle
 * under `customData.terraformDimmedOriginals` on first dim so subsequent re-dims
 * always blend from the canonical originals.
 *
 * Returns `null` when `level >= 100` (no dim needed) or when the element already
 * has the exact target colors and customData (no-op so the focus reducer can skip it).
 *
 * Transparent backgrounds become an opaque washed fill (with `fillStyle: "solid"`)
 * so dimmed cards / module frames fully hide whatever is rendered behind them.
 */
export const dimmedTerraformElementOverrides = (
  element: WashableElement,
  level: number,
  viewBackgroundColor: string,
): TerraformWashOverrides | null => {
  if (level >= 100) {
    return null;
  }
  const washFactor = clamp(1 - level / 100, 0, 1);
  if (washFactor === 0) {
    return null;
  }

  const stashed = readStashedOriginals(element);
  const originalStroke = stashed?.strokeColor ?? element.strokeColor;
  const originalBackground =
    stashed?.backgroundColor ?? element.backgroundColor;
  const originalFillStyle = stashed?.fillStyle ?? element.fillStyle;

  const nextStroke = washHexColor(
    originalStroke,
    washFactor,
    viewBackgroundColor,
  );
  const transparentBackground = isTransparent(originalBackground);
  const nextBackground = transparentBackground
    ? washHexColor("transparent", washFactor, viewBackgroundColor)
    : washHexColor(originalBackground, washFactor, viewBackgroundColor);
  const nextFillStyle = transparentBackground ? "solid" : originalFillStyle;

  const dimmedOriginals: TerraformDimmedOriginals = {
    strokeColor: originalStroke,
    backgroundColor: originalBackground,
    fillStyle: originalFillStyle,
  };
  const nextCustomData = {
    ...(element.customData ?? {}),
    [TERRAFORM_DIMMED_ORIGINALS_KEY]: dimmedOriginals,
  };

  if (
    element.strokeColor === nextStroke &&
    element.backgroundColor === nextBackground &&
    element.fillStyle === nextFillStyle &&
    stashed !== null &&
    stashed.strokeColor === originalStroke &&
    stashed.backgroundColor === originalBackground &&
    stashed.fillStyle === originalFillStyle
  ) {
    return null;
  }

  return {
    strokeColor: nextStroke,
    backgroundColor: nextBackground,
    fillStyle: nextFillStyle,
    customData: nextCustomData,
  };
};

/**
 * Returns the patch to restore a previously-dimmed element to its stashed originals
 * and remove `customData.terraformDimmedOriginals`. Returns `null` when there's
 * nothing to restore.
 */
export const restoredTerraformElementOverrides = (
  element: WashableElement,
): TerraformWashOverrides | null => {
  const stashed = readStashedOriginals(element);
  if (!stashed) {
    return null;
  }
  const nextCustomData = cloneCustomDataWithoutStash(element.customData);
  if (
    element.strokeColor === stashed.strokeColor &&
    element.backgroundColor === stashed.backgroundColor &&
    element.fillStyle === stashed.fillStyle
  ) {
    return {
      strokeColor: stashed.strokeColor,
      backgroundColor: stashed.backgroundColor,
      fillStyle: stashed.fillStyle,
      customData: nextCustomData,
    };
  }
  return {
    strokeColor: stashed.strokeColor,
    backgroundColor: stashed.backgroundColor,
    fillStyle: stashed.fillStyle,
    customData: nextCustomData,
  };
};

/** True when `customData.terraformDimmedOriginals` is present (used by callers to detect leftover dimming). */
export const hasStashedTerraformOriginals = (
  element: WashableElement,
): boolean => readStashedOriginals(element) !== null;
