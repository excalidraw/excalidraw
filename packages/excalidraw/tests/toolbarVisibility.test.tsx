import React from "react";

import { Excalidraw } from "../index";

import { fireEvent, render, withExcalidrawDimensions } from "./test-utils";

describe("drawing toolbar visibility (#9229)", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("hides and restores the toolbar in compact layout", async () => {
    await withExcalidrawDimensions({ width: 800, height: 700 }, async () => {
      const toggle = document.querySelector<HTMLButtonElement>(
        '[data-testid="toolbar-visibility-toggle"]',
      );
      const tools = document.querySelector<HTMLElement>(
        ".App-toolbar > .Stack_horizontal",
      );

      expect(toggle).not.toBeNull();
      expect(tools).not.toBeNull();
      expect(tools!.style.display).not.toBe("none");

      fireEvent.click(toggle!);
      expect(tools!.style.display).toBe("none");

      fireEvent.click(toggle!);
      expect(tools!.style.display).not.toBe("none");
    });
  });

  it("hides and restores the toolbar on phones", async () => {
    await withExcalidrawDimensions({ width: 390, height: 780 }, async () => {
      const toggle = document.querySelector<HTMLButtonElement>(
        '[data-testid="toolbar-visibility-toggle"]',
      );

      expect(toggle).not.toBeNull();
      expect(document.querySelector(".mobile-toolbar")).not.toBeNull();

      fireEvent.click(toggle!);
      expect(document.querySelector(".mobile-toolbar")).toBeNull();

      fireEvent.click(toggle!);
      expect(document.querySelector(".mobile-toolbar")).not.toBeNull();
    });
  });
});
