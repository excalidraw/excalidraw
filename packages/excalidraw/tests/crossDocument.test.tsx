import React from "react";
import {
  act,
  fireEvent,
  render as renderReact,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";

import { FONT_FAMILY, MIME_TYPES } from "@excalidraw/common";

import { newImageElement, newTextElement } from "@excalidraw/element";

import type { FileId } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { Tooltip } from "../components/Tooltip";

import type { DataURL, ExcalidrawImperativeAPI } from "../types";

describe("cross-document rendering", () => {
  it("scopes listeners, fonts, and portals to ownerDocument", async () => {
    const sceneTextElement = newTextElement({
      x: 0,
      y: 0,
      text: "Code",
      fontFamily: FONT_FAMILY.Virgil,
    });
    const iframe = document.createElement("iframe");
    document.body.append(iframe);

    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);
    const ownerImages: HTMLImageElement[] = [];
    const OwnerImage = function () {
      const image = ownerDocument.createElement("img");
      ownerImages.push(image);
      return image;
    } as unknown as typeof Image;

    const fonts = {
      load: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockReturnValue(false),
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
      Image: { value: OwnerImage },
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
          initialData={{ elements: [sceneTextElement] }}
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
      const messageHandler = addEventListener.mock.calls.find(
        ([eventName]) => eventName === "message",
      )?.[1] as EventListener | undefined;
      expect(typeof messageHandler).toBe("function");
      expect(() =>
        messageHandler!(
          new ownerWindow.MessageEvent("message", {
            data: JSON.stringify({ method: "paused", value: true }),
            origin: "https://player.vimeo.com",
          }),
        ),
      ).not.toThrow();

      const excalidrawContainer = container.querySelector(".excalidraw")!;
      fireEvent.pointerEnter(excalidrawContainer);
      expect(ownerDocument.documentElement.style.overscrollBehaviorX).toBe(
        "none",
      );
      fireEvent.pointerLeave(excalidrawContainer);
      expect(ownerDocument.documentElement.style.overscrollBehaviorX).toBe(
        "auto",
      );

      expect(fonts.addEventListener).toHaveBeenCalledWith(
        "loadingdone",
        expect.any(Function),
        { passive: false },
      );
      // the scene text element's font is loaded with its unique characters
      await waitFor(() =>
        expect(fonts.load).toHaveBeenCalledWith(
          expect.stringContaining("Virgil"),
          expect.stringContaining("Code"),
        ),
      );
      // the default font family is prewarmed even though the scene
      // does not use it (chars are deduped, so "Excalidraw" -> "Excalidr")
      await waitFor(() =>
        expect(fonts.load).toHaveBeenCalledWith(
          expect.stringContaining("Excalifont"),
          expect.stringContaining("Excalidr"),
        ),
      );

      const ownerImageFileId = "owner-window-image" as FileId;
      act(() => {
        api!.updateScene({
          elements: [
            newImageElement({
              type: "image",
              x: 0,
              y: 0,
              fileId: ownerImageFileId,
              status: "saved",
              scale: [1, 1],
            }),
          ],
        });
        api!.addFiles([
          {
            id: ownerImageFileId,
            dataURL: `data:${MIME_TYPES.png};base64,AA==` as DataURL,
            mimeType: MIME_TYPES.png,
            created: Date.now(),
            lastRetrieved: Date.now(),
          },
        ]);
      });
      await waitFor(() => expect(ownerImages).toHaveLength(1));
      expect(ownerImages[0].ownerDocument).toBe(ownerDocument);

      ownerDocument.body.classList.add("excalidraw-animations-disabled");
      act(() => {
        api!.updateScene({
          appState: { openDialog: { name: "imageExport" } },
        });
      });

      await waitFor(() =>
        expect(
          ownerDocument.querySelector(".excalidraw-modal-container"),
        ).not.toBeNull(),
      );
      expect(document.querySelector(".excalidraw-modal-container")).toBeNull();
      expect(ownerDocument.querySelector(".Modal")).toHaveClass(
        "animations-disabled",
      );
    } finally {
      unmount?.();
      iframe.remove();
    }
  });

  it("renders tooltips in the trigger document", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const ownerDocument = iframe.contentDocument!;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);

    try {
      const renderResult = renderReact(
        <Tooltip label="Owner document tooltip">
          <span>Tooltip trigger</span>
        </Tooltip>,
        { container: mountNode, baseElement: ownerDocument.body },
      );
      fireEvent.pointerEnter(
        renderResult.getByText("Tooltip trigger").parentElement!,
      );

      expect(
        ownerDocument.querySelector(".excalidraw-tooltip")?.textContent,
      ).toBe("Owner document tooltip");
      expect(document.querySelector(".excalidraw-tooltip")).toBeNull();
      renderResult.unmount();
    } finally {
      iframe.remove();
    }
  });
});
