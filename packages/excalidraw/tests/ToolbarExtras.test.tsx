// <ToolbarExtras> children render inside the native toolbar, after the eraser
// and before the "more tools" divider.
import { vi } from "vitest";

import { Excalidraw, ToolbarExtras } from "../index";

import { act, fireEvent, render, waitFor } from "./test-utils";

const { h } = window;

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

  describe("on phones", () => {
    const renderOnPhone = async (children?: React.ReactNode) => {
      const result = await render(
        <Excalidraw UIOptions={{ getFormFactor: () => "phone" }}>
          {children}
        </Excalidraw>,
      );
      fireEvent.resize(window);
      await waitFor(() =>
        expect(h.app.editorInterface.formFactor).toBe("phone"),
      );
      return result;
    };

    afterEach(() => {
      vi.restoreAllMocks();
      delete (window as any).ResizeObserver;
    });

    it("hides the slot when the host does not use it", async () => {
      const { container } = await renderOnPhone();
      const slot = container.querySelector(".mobile-toolbar-extras");
      expect(slot).not.toBe(null);
      expect(slot!.childElementCount).toBe(0);
    });

    it("renders the host buttons once, between the eraser and the more tools trigger", async () => {
      const { container } = await renderOnPhone(
        <ToolbarExtras>
          <button data-testid="host-tool">GIF</button>
        </ToolbarExtras>,
      );
      const hostTools = container.querySelectorAll("[data-testid=host-tool]");
      expect(hostTools.length).toBe(1);
      const toolbar = container.querySelector(".mobile-toolbar");
      expect(toolbar?.contains(hostTools[0])).toBe(true);

      const eraser = toolbar!.querySelector("[data-testid=toolbar-eraser]");
      const moreTools = toolbar!.querySelector(
        ".App-toolbar__extra-tools-trigger",
      );
      expect(
        eraser!.compareDocumentPosition(hostTools[0]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        hostTools[0].compareDocumentPosition(moreTools!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("moves native tools into the menu to make room for the host buttons", async () => {
      // wide enough for every optional native tool when the slot is empty
      const TOOLBAR_WIDTH = 396;
      const nativeRect = Element.prototype.getBoundingClientRect;
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          return this.classList.contains("mobile-toolbar")
            ? ({ width: TOOLBAR_WIDTH } as DOMRect)
            : nativeRect.call(this);
        },
      );
      let notifyResize: (width: number) => void = () => {};
      (window as any).ResizeObserver = class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          notifyResize = (width) =>
            callback(
              [{ contentRect: { width } } as ResizeObserverEntry],
              this as unknown as globalThis.ResizeObserver,
            );
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      };

      const { container } = await renderOnPhone(
        <ToolbarExtras>
          <button data-testid="host-tool">GIF</button>
        </ToolbarExtras>,
      );
      const frameTool = () =>
        container.querySelector(".mobile-toolbar [data-testid=toolbar-frame]");
      await waitFor(() => expect(frameTool()).not.toBe(null));

      act(() => notifyResize(36));

      await waitFor(() => expect(frameTool()).toBe(null));
    });
  });
});
