import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

describe("HelpDialog shortcut order in RTL locales", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("keeps shortcut key order LTR when the UI is RTL (issue #12404)", async () => {
    await act(async () => {
      API.setAppState({
        openDialog: { name: "help" },
      });
    });

    const containers = document.querySelectorAll(
      ".HelpDialog__key-container",
    );
    expect(containers.length).toBeGreaterThan(0);
    containers.forEach((container) => {
      // isolates key order (Ctrl+X) from the inherited RTL layout
      expect(container.getAttribute("dir")).toBe("ltr");
    });

    // DOM order itself stays logical: Ctrl before X
    const firstKeys = Array.from(
      document.querySelectorAll(".HelpDialog__key-container"),
    ).map((c) => c.textContent);
    expect(firstKeys.some((t) => t && t.includes("Ctrl"))).toBe(true);
  });
});
