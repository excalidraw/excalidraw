import { createContext, useContext } from "react";

import type { FontFamilyValues } from "@excalidraw/element/types";

import { useTopPicksDnD } from "../TopPicksDnD/topPicksDnD";

import type {
  CreateTopPicksGhost,
  TopPicksDnD,
} from "../TopPicksDnD/topPicksDnD";

/**
 * the ghost is just the font's icon on a strip-button tile (never the whole
 * list row), so it previews how the pick lands in the strip.
 *
 * The ghost lives outside the editor's CSS scope — the tile look is sampled
 * from a rendered strip button instead.
 */
const createFontGhost: CreateTopPicksGhost<FontFamilyValues> = ({
  sourceEl,
  stripEl,
}) => {
  const isPick = sourceEl.dataset.topPickIndex != null;
  const template =
    (isPick
      ? sourceEl
      : stripEl.querySelector<HTMLElement>(
          "[data-top-pick-index]:not(.active)",
        )) ?? stripEl.querySelector<HTMLElement>("[data-top-pick-index]")!;
  const templateStyle = getComputedStyle(template);
  const templateRect = template.getBoundingClientRect();

  const tile = document.createElement("div");
  tile.className = "excalidraw-font-dnd-ghost-tile";
  tile.style.backgroundColor = templateStyle.backgroundColor;
  tile.style.color = templateStyle.color;
  tile.style.borderStyle = "solid";
  tile.style.borderWidth = templateStyle.borderTopWidth;
  tile.style.borderColor = templateStyle.borderTopColor;
  tile.style.borderRadius = templateStyle.borderTopLeftRadius;

  const icon = sourceEl.querySelector("svg");
  if (icon) {
    const templateIconRect = template
      .querySelector("svg")
      ?.getBoundingClientRect();
    const iconClone = icon.cloneNode(true) as SVGSVGElement;
    if (templateIconRect) {
      iconClone.style.width = `${templateIconRect.width}px`;
      iconClone.style.height = `${templateIconRect.height}px`;
    }
    tile.appendChild(iconClone);
  } else {
    // a pick rendering a glyph sample instead of an icon
    const sample = sourceEl.querySelector<HTMLElement>(
      ".FontPicker__top-pick-sample",
    );
    if (sample) {
      const sampleClone = sample.cloneNode(true) as HTMLElement;
      // the ghost is outside the editor's CSS scope
      sampleClone.style.fontSize = getComputedStyle(sample).fontSize;
      sampleClone.style.lineHeight = "1";
      tile.appendChild(sampleClone);
    }
  }

  if (isPick) {
    return { content: tile, rect: templateRect };
  }

  // list rows: spawn from (and fly back to) the row's icon
  const anchorRect = (icon ?? sourceEl).getBoundingClientRect();
  return {
    content: tile,
    rect: new DOMRect(
      anchorRect.left + anchorRect.width / 2 - templateRect.width / 2,
      anchorRect.top + anchorRect.height / 2 - templateRect.height / 2,
      templateRect.width,
      templateRect.height,
    ),
  };
};

export type FontPickerDnD = TopPicksDnD<FontFamilyValues>;

export const FontPickerDnDContext = createContext<FontPickerDnD | null>(null);

export const useFontPickerDnD = () => useContext(FontPickerDnDContext);

/** pinning fonts from the font picker list to the top-picks strip, and
 * reordering the strip */
export const useFontTopPicksDnD = ({
  enabled,
  picks,
  onPicksChange,
}: {
  enabled: boolean;
  picks: readonly FontFamilyValues[];
  onPicksChange: (picks: FontFamilyValues[]) => void;
}): FontPickerDnD =>
  useTopPicksDnD({
    enabled,
    picks,
    onPicksChange,
    createGhost: createFontGhost,
  });
