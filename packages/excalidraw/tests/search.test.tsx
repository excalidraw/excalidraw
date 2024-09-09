import React from "react";
import { render, waitFor } from "./test-utils";
import { Excalidraw } from "../index";
import { CLASSES, SEARCH_SIDEBAR } from "../constants";
import { Keyboard } from "./helpers/ui";
import { KEYS } from "../keys";

const { h } = window;

describe("search", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
  });

  it("should toggle search on cmd+f", async () => {
    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(SEARCH_SIDEBAR.name);

    await waitFor(() => {
      const searchInput =
        h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        );

      expect(searchInput?.matches(":focus")).toBe(true);
    });
  });
});
