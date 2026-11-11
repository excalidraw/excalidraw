import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../../index";
import { Keyboard } from "../../tests/helpers/ui";
import {
  render,
  waitFor,
  getByTestId,
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
