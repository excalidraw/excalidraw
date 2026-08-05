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

const openMainMenu = async (container: HTMLElement) => {
  fireEvent.click(getByTestId(container, "main-menu-trigger"));
  expect(window.h.state.openMenu).toBe("canvas");
  await waitFor(() => {
    expect(
      document.querySelector('[data-testid="search-menu-button"]'),
    ).not.toBeNull();
  });
};

const getSearchMenuItem = () =>
  document.querySelector<HTMLElement>('[data-testid="search-menu-button"]')!;

describe("Test <DropdownMenu/>", () => {
  it("should", async () => {
    const { container } = await render(<Excalidraw />);

    expect(window.h.state.openMenu).toBe(null);

    fireEvent.click(getByTestId(container, "main-menu-trigger"));
    expect(window.h.state.openMenu).toBe("canvas");

    await waitFor(() => {
      Keyboard.keyDown(KEYS.ESCAPE);
      expect(window.h.state.openMenu).toBe(null);
    });
  });

  describe("tap during scroll animation (issue #9204)", () => {
    const pointerEventInit = {
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    } as const;

    it("activates the item when the browser suppresses the click (iOS momentum/rubber-band scroll)", async () => {
      const { container } = await render(<Excalidraw />);
      await openMainMenu(container);

      const item = getSearchMenuItem();
      const onClickSpy = vi.fn();
      item.addEventListener("click", onClickSpy);

      // Simulate iOS: a tap (pointer down/up without movement) whose `click`
      // event the browser suppresses because it interrupted a scroll animation.
      fireEvent.pointerDown(item, pointerEventInit);
      fireEvent.pointerUp(item, pointerEventInit);

      // The tap should still activate the item (menu closes) via the fallback.
      await waitFor(() => {
        expect(window.h.state.openMenu).toBe(null);
      });

      // exactly one click was replayed — no duplicates
      expect(onClickSpy).toHaveBeenCalledTimes(1);
    });

    it("does not double-activate when the native click is delivered", async () => {
      const { container } = await render(<Excalidraw />);
      await openMainMenu(container);

      const item = getSearchMenuItem();
      const onClickSpy = vi.fn();
      item.addEventListener("click", onClickSpy);

      // Settled menu: pointer up is followed by the native click.
      fireEvent.pointerDown(item, pointerEventInit);
      fireEvent.pointerUp(item, pointerEventInit);
      fireEvent.click(item);

      await waitFor(() => {
        expect(window.h.state.openMenu).toBe(null);
      });

      // the native click wins and the fallback is cancelled
      expect(onClickSpy).toHaveBeenCalledTimes(1);
    });

    it("does not activate items when the pointer moved (real drag/scroll)", async () => {
      const { container } = await render(<Excalidraw />);
      await openMainMenu(container);

      const item = getSearchMenuItem();
      const onClickSpy = vi.fn();
      item.addEventListener("click", onClickSpy);

      fireEvent.pointerDown(item, pointerEventInit);
      // drag beyond the dragging threshold
      fireEvent.pointerMove(item, {
        ...pointerEventInit,
        clientX: 10,
        clientY: 60,
      });
      fireEvent.pointerUp(item, { ...pointerEventInit, clientY: 60 });

      // let any (incorrectly scheduled) fallback fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onClickSpy).not.toHaveBeenCalled();
      expect(window.h.state.openMenu).toBe("canvas");
    });

    it("keeps working for regular mouse clicks", async () => {
      const { container } = await render(<Excalidraw />);
      await openMainMenu(container);

      const item = getSearchMenuItem();

      fireEvent.pointerDown(item, {
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      });
      fireEvent.pointerUp(item, {
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      });
      fireEvent.click(item);

      await waitFor(() => {
        expect(window.h.state.openMenu).toBe(null);
      });
    });
  });
});
