import React, { act } from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw, MainMenu } from "../../index";
import { Keyboard } from "../../tests/helpers/ui";
import { defaultLang, languages, setLanguage } from "../../i18n";
import {
  render,
  waitFor,
  getByTestId,
  getByText,
  fireEvent,
} from "../../tests/test-utils";

describe("Test <DropdownMenu/>", () => {
  it("closes on Escape", async () => {
    const { container } = await render(<Excalidraw />);

    expect(window.h.state.openMenu).toBe(null);

    fireEvent.click(getByTestId(container, "main-menu-trigger"));
    expect(window.h.state.openMenu).toBe("canvas");

    await waitFor(() => {
      Keyboard.keyDown(KEYS.ESCAPE);
      expect(window.h.state.openMenu).toBe(null);
    });
  });

  it("repositions submenu when switching language direction", async () => {
    const { container } = await render(
      <Excalidraw>
        <MainMenu>
          <MainMenu.DefaultItems.Preferences />
        </MainMenu>
      </Excalidraw>,
    );

    const rtlLang = languages.find((lang) => lang.rtl)!;

    fireEvent.click(getByTestId(container, "main-menu-trigger"));
    fireEvent.click(getByText(container, "Preferences"));

    await waitFor(() => {
      expect(
        container.querySelector(".excalidraw-main-menu-preferences-submenu"),
      ).not.toBeNull();
    });

    await act(async () => {
      await setLanguage(rtlLang);
    });

    expect(document.documentElement.dir).toBe("rtl");

    await act(async () => {
      await setLanguage(defaultLang);
    });

    expect(document.documentElement.dir).toBe("ltr");
  });

  it.each([
    ["main menu", '[data-testid="main-menu-trigger"]'],
    ["more tools", ".App-toolbar__extra-tools-trigger"],
  ])(
    "closes %s on outside pointer and touch events after reopening",
    async (_, triggerSelector) => {
      const { container } = await render(<Excalidraw />);
      const trigger = container.querySelector<HTMLElement>(triggerSelector)!;
      const canvas = container.querySelector<HTMLCanvasElement>("canvas")!;
      const toolbar = getByTestId(container, "toolbar-rectangle");

      for (const outsideTarget of [canvas, toolbar]) {
        for (const event of [fireEvent.pointerDown, fireEvent.touchStart]) {
          fireEvent.click(trigger);
          await waitFor(() => {
            expect(
              container.querySelector('[data-testid="dropdown-menu"]'),
            ).not.toBeNull();
          });

          event(outsideTarget);
          await waitFor(() => {
            expect(
              container.querySelector('[data-testid="dropdown-menu"]'),
            ).toBeNull();
          });
        }
      }
    },
  );
});
