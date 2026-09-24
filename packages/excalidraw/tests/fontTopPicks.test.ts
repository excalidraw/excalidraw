import {
  FONT_FAMILY,
  FONT_FAMILY_FALLBACKS,
  FONT_TOP_PICKS_SLOTS,
} from "@excalidraw/common";

import { DEFAULT_FONTS } from "../components/FontPicker/FontPicker";
import { restoreAppState } from "../data/restore";

describe("font top picks slots", () => {
  it("matches the default font list length", () => {
    expect(DEFAULT_FONTS.length).toBe(FONT_TOP_PICKS_SLOTS);
  });
});

describe("restore appState.fontTopPicks", () => {
  it("dedupes and drops unknown, internal and fallback font families", () => {
    const restored = restoreAppState(
      {
        fontTopPicks: [
          FONT_FAMILY["Lilita One"],
          "7",
          FONT_FAMILY["Lilita One"],
          4, // unused id
          FONT_FAMILY.Assistant, // private
          FONT_FAMILY_FALLBACKS.Xiaolai,
          FONT_FAMILY.Virgil, // deprecated, but still pickable
        ],
      } as any,
      null,
    );
    expect(restored.fontTopPicks).toEqual([
      FONT_FAMILY["Lilita One"],
      FONT_FAMILY.Virgil,
    ]);
  });

  it("caps at the strip slot count and nulls malformed input", () => {
    const many = [
      FONT_FAMILY.Nunito,
      FONT_FAMILY.Excalifont,
      FONT_FAMILY["Lilita One"],
      FONT_FAMILY["Comic Shanns"],
      FONT_FAMILY.Virgil,
    ];
    expect(
      restoreAppState({ fontTopPicks: many } as any, null).fontTopPicks,
    ).toEqual(many.slice(0, FONT_TOP_PICKS_SLOTS));
    expect(
      restoreAppState({ fontTopPicks: "junk" } as any, null).fontTopPicks,
    ).toBe(null);
    expect(
      restoreAppState({ fontTopPicks: [4, "5"] } as any, null).fontTopPicks,
    ).toBe(null);
  });
});
