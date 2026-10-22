import { createContext, useContext } from "react";

import { isTransparent } from "@excalidraw/common";

import { useTopPicksDnD } from "../TopPicksDnD/topPicksDnD";

import { getTopPickColor, isSameTopPick } from "./colorTopPickUtils";

import type {
  CreateTopPicksGhost,
  TopPicksDnD,
} from "../TopPicksDnD/topPicksDnD";
import type { ColorTopPick } from "../../types";

const createColorGhost: CreateTopPicksGhost<ColorTopPick> = ({
  value,
  sourceEl,
}) => {
  const color = getTopPickColor(value);
  // the source may live in another window's document (e.g. a popout)
  const ownerDocument = sourceEl.ownerDocument;
  const swatch = ownerDocument.createElement("div");
  swatch.className = "excalidraw-color-dnd-ghost-swatch";
  if (isTransparent(color)) {
    swatch.classList.add("is-transparent");
  } else {
    // swatches render the theme-adjusted color (dark mode remaps colors
    // rather than CSS-filtering them) — sample the rendered color so the
    // ghost matches what the user picked up
    const rendered =
      ownerDocument.defaultView?.getComputedStyle(sourceEl).backgroundColor;
    swatch.style.backgroundColor =
      rendered && rendered !== "rgba(0, 0, 0, 0)" ? rendered : color;
  }
  return { content: swatch, rect: sourceEl.getBoundingClientRect() };
};

export type ColorPickerDnD = TopPicksDnD<ColorTopPick>;

export const ColorPickerDnDContext = createContext<ColorPickerDnD | null>(null);

export const useColorPickerDnD = () => useContext(ColorPickerDnDContext);

/** pinning colors from the picker popup (palette/shades/custom) or the
 * active-color trigger to the top-picks strip, and reordering the strip */
export const useColorTopPicksDnD = ({
  enabled,
  picks,
  onPicksChange,
}: {
  enabled: boolean;
  picks: readonly ColorTopPick[];
  onPicksChange: (picks: ColorTopPick[]) => void;
}): ColorPickerDnD =>
  useTopPicksDnD({
    enabled,
    picks,
    onPicksChange,
    isSamePick: isSameTopPick,
    createGhost: createColorGhost,
  });
