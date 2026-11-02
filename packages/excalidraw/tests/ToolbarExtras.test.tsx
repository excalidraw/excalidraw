// <ToolbarExtras> children render inside the native toolbar, after the eraser
// and before the "more tools" divider.
import { Excalidraw, ToolbarExtras } from "../index";

import {
  fireEvent,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "./test-utils";

const { h } = window;

const precedes = (a: Element, b: Element) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("<ToolbarExtras/>", () => {
  it("renders nothing extra when the host does not use it", async () => {
    const { container } = await render(<Excalidraw />);
    expect(container.querySelector("[data-testid=host-tool]")).toBe(null);
  });

  it("renders the host buttons inside the toolbar, right after the eraser", async () => {
    const { container } = await render(
      <Excalidraw>
        <ToolbarExtras>
          <button data-testid="host-tool">GIF</button>
        </ToolbarExtras>
      </Excalidraw>,
    );
    const hostTool = container.querySelector("[data-testid=host-tool]");
    expect(hostTool).not.toBe(null);
    const toolbar = container.querySelector(".App-toolbar");
    expect(toolbar?.contains(hostTool)).toBe(true);
    const eraser = container.querySelector("[data-testid=toolbar-eraser]");
    expect(eraser).not.toBe(null);
    // the eraser precedes the host button in document order
    expect(
      eraser!.compareDocumentPosition(hostTool!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the host buttons between the eraser and the more tools menu in a narrow window", async () => {
    const { container } = await render(
      <Excalidraw>
        <ToolbarExtras>
          <button data-testid="host-tool">GIF</button>
        </ToolbarExtras>
      </Excalidraw>,
    );

    // below MQ_MAX_TABLET but above the phone breakpoint, a desktop window
    // gets the compact toolbar (still `Toolbar`, not `MobileToolbar`)
    await withExcalidrawDimensions({ width: 1100, height: 800 }, async () => {
      expect(h.app.editorInterface.formFactor).toBe("tablet");

      const toolbar = container.querySelector(".App-toolbar--compact");
      expect(toolbar).not.toBe(null);
      const eraser = toolbar!.querySelector("[data-testid=toolbar-eraser]");
      const hostTool = toolbar!.querySelector("[data-testid=host-tool]");
      const moreTools = toolbar!.querySelector(
        ".App-toolbar__extra-tools-trigger",
      );
      expect(eraser).not.toBe(null);
      expect(hostTool).not.toBe(null);
      expect(moreTools).not.toBe(null);
      expect(precedes(eraser!, hostTool!)).toBe(true);
      expect(precedes(hostTool!, moreTools!)).toBe(true);

      // opening the more tools menu leaves the host button where it was
      fireEvent.click(moreTools!);
      const dropdown = await waitFor(() => {
        const menu = document.querySelector(
          ".App-toolbar__extra-tools-dropdown",
        );
        expect(menu).not.toBe(null);
        return menu!;
      });
      expect(dropdown.contains(hostTool)).toBe(false);
      const hostTools = toolbar!.querySelectorAll("[data-testid=host-tool]");
      expect(hostTools).toHaveLength(1);
    });
  });
});
