import { Excalidraw } from "../../index";
import { setLanguage, t } from "../../i18n";
import { API } from "../../tests/helpers/api";
import { act, render, waitFor } from "../../tests/test-utils";

import { CommandPalette } from "./CommandPalette";

import type { CommandPaletteItem } from "./types";

const openCommandPalette = () => {
  act(() => {
    API.setAppState({ openDialog: { name: "commandPalette" } });
  });
};

const getCommandLabels = () =>
  Array.from(
    document.querySelectorAll(".command-palette-dialog .command-item .name"),
  ).map((el) => el.textContent ?? "");

describe("CommandPalette", () => {
  afterEach(async () => {
    // reset language so other tests aren't affected
    await act(async () => {
      await setLanguage({ code: "en", label: "English" });
    });
  });

  it("re-translates built-in command labels when the language changes while open (#11569)", async () => {
    await render(
      <Excalidraw>
        <CommandPalette />
      </Excalidraw>,
    );

    openCommandPalette();

    // labels start out in English
    await waitFor(() => {
      const labels = getCommandLabels();
      expect(labels.length).toBeGreaterThan(0);
      expect(labels).toContain("Canvas background");
    });

    // switch language while the palette is open
    await act(async () => {
      await setLanguage({ code: "hi-IN", label: "हिन्दी" });
    });

    // labels should now all be in Hindi, with no stale English labels left over
    await waitFor(() => {
      const labels = getCommandLabels();
      expect(labels).toContain("चित्रपटल पृष्ठभूमि");
      expect(labels).not.toContain("Canvas background");
    });
  });

  it("re-translates custom command labels passed as a function on language change (#11569)", async () => {
    // a function label is resolved lazily on each language change; a plain
    // string label is captured once and intentionally does not update.
    const customItems: CommandPaletteItem[] = [
      {
        label: () => t("labels.share"),
        category: "App",
        predicate: true,
        perform: () => {},
      },
      {
        label: t("labels.share"),
        category: "App",
        predicate: true,
        perform: () => {},
      },
    ];

    await render(
      <Excalidraw>
        <CommandPalette customCommandPaletteItems={customItems} />
      </Excalidraw>,
    );

    const englishShare = t("labels.share");

    openCommandPalette();

    await waitFor(() => {
      const labels = getCommandLabels();
      // both the lazy and the plain-string item render in English initially
      expect(labels.filter((l) => l === englishShare)).toHaveLength(2);
    });

    await act(async () => {
      await setLanguage({ code: "hi-IN", label: "हिन्दी" });
    });

    const hindiShare = t("labels.share");
    expect(hindiShare).not.toEqual(englishShare);

    await waitFor(() => {
      const labels = getCommandLabels();
      // the function label re-translates to Hindi...
      expect(labels).toContain(hindiShare);
      // ...while the plain-string label stays in its originally-captured value
      expect(labels).toContain(englishShare);
    });
  });
});
