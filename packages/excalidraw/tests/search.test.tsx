import React from "react";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";
import { Excalidraw } from "../index";
import { CLASSES, SEARCH_SIDEBAR } from "../constants";
import { Keyboard } from "./helpers/ui";
import { KEYS } from "../keys";

const { h } = window;

describe("search", () => {
  const dimensions = { height: 3160, width: 6016 };

  beforeAll(() => {
    mockBoundingClientRect(dimensions);
  });

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    h.setState({
      openSidebar: null,
    });
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should toggle search on cmd+f", async () => {
    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(SEARCH_SIDEBAR.name);

    const searchInput =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      );

    expect(searchInput?.matches(":focus")).toBe(true);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    expect(h.app.state.openSidebar).toBeNull();
  });

  it("should refocus search input with cmd+f when search sidebar is still open", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      );

    searchInput?.blur();

    expect(h.app.state.openSidebar).not.toBeNull();
    expect(searchInput?.matches(":focus")).toBe(false);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(searchInput?.matches(":focus")).toBe(true);
  });
});
