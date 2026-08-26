import React from "react";
import { render as renderReact, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { Excalidraw } from "../index";

import type { ExcalidrawImperativeAPI } from "../types";

describe("cross-document rendering", () => {
  it("registers input and font listeners in ownerDocument", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);

    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);

    const fonts = {
      load: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockReturnValue(true),
      has: vi.fn().mockReturnValue(true),
      add: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(ownerDocument, "fonts", { value: fonts });
    const addEventListener = vi.fn();
    Object.defineProperties(ownerWindow, {
      addEventListener: { value: addEventListener },
      removeEventListener: { value: vi.fn() },
      requestAnimationFrame: {
        value: window.requestAnimationFrame.bind(window),
      },
      ResizeObserver: { value: window.ResizeObserver },
    });
    Object.defineProperty(ownerDocument, "defaultView", {
      value: ownerWindow,
    });
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      {
        value: window.HTMLCanvasElement.prototype.getContext,
      },
    );
    const addDocumentEventListener = vi.spyOn(
      ownerDocument,
      "addEventListener",
    );
    let unmount: (() => void) | null = null;
    try {
      let api: ExcalidrawImperativeAPI | null = null;
      const renderResult = renderReact(
        <Excalidraw
          ownerDocument={ownerDocument}
          handleKeyboardGlobally={true}
          onExcalidrawAPI={(nextApi) => {
            api = nextApi;
          }}
        />,
        { container: mountNode, baseElement: ownerDocument.body },
      );
      unmount = renderResult.unmount;
      const { container } = renderResult;

      await waitFor(() =>
        expect(container.querySelector("canvas.interactive")).not.toBeNull(),
      );
      expect(api).not.toBeNull();
      await waitFor(() => expect(api!.getAppState().isLoading).toBe(false));
      expect(
        addDocumentEventListener.mock.calls.some(
          ([eventName]) => eventName === "pointermove",
        ),
      ).toBe(true);
      expect(
        addDocumentEventListener.mock.calls.some(
          ([eventName]) => eventName === "keydown",
        ),
      ).toBe(true);
      expect(
        addDocumentEventListener.mock.calls.some(
          ([eventName]) => eventName === "paste",
        ),
      ).toBe(true);
      expect(
        addEventListener.mock.calls.some(
          ([eventName]) => eventName === "message",
        ),
      ).toBe(true);
      expect(fonts.addEventListener).toHaveBeenCalledWith(
        "loadingdone",
        expect.any(Function),
        { passive: false },
      );
    } finally {
      unmount?.();
      iframe.remove();
    }
  });
});
