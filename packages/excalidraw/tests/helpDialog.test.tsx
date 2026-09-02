import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, fireEvent, render, waitFor } from "./test-utils";

const queryHelpContent = () =>
  document.querySelector<HTMLDivElement>(".HelpDialog__content")!;

const querySearchInput = () =>
  queryHelpContent().querySelector<HTMLInputElement>(
    ".HelpDialog__search-input",
  )!;

describe("help dialog", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({ openDialog: { name: "help" } });
  });

  it("should focus the shortcut search on ctrl/cmd+f", async () => {
    await waitFor(() => {
      expect(querySearchInput()).not.toBeNull();
    });

    const input = querySearchInput();
    expect(input.matches(":focus")).toBe(false);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    await waitFor(() => {
      expect(querySearchInput().matches(":focus")).toBe(true);
    });
  });

  it("should filter shortcuts and hide empty islands while searching", async () => {
    const content = await waitFor(() => {
      const content = queryHelpContent();
      expect(content.querySelector(".HelpDialog__search-input")).not.toBeNull();
      return content;
    });

    const allShortcuts = () =>
      Array.from(
        content.querySelectorAll<HTMLElement>(".HelpDialog__shortcut"),
      );

    const total = allShortcuts().length;
    expect(total).toBeGreaterThan(0);
    expect(allShortcuts().filter((el) => !el.hidden)).toHaveLength(total);

    const input = querySearchInput();

    act(() => {
      fireEvent.change(input, { target: { value: "zoom" } });
    });

    await waitFor(() => {
      const visible = allShortcuts().filter((el) => !el.hidden);
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThan(total);
      for (const el of visible) {
        expect(el.firstElementChild?.textContent?.toLowerCase()).toContain(
          "zoom",
        );
      }
      for (const island of Array.from(
        content.querySelectorAll<HTMLElement>(".HelpDialog__island"),
      )) {
        if (!island.hidden) {
          expect(
            island.querySelector(".HelpDialog__shortcut:not([hidden])"),
          ).not.toBeNull();
        }
      }
    });

    act(() => {
      fireEvent.change(input, { target: { value: "zzz-no-match-zzz" } });
    });

    await waitFor(() => {
      expect(allShortcuts().filter((el) => !el.hidden)).toHaveLength(0);
      const noResults = content.querySelector<HTMLElement>(
        ".HelpDialog__no-results",
      );
      expect(noResults).not.toBeNull();
      expect(noResults!.hidden).toBe(false);
    });
  });
});
