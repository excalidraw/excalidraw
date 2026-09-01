import React from "react";
import {
  act,
  fireEvent,
  render as renderReact,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";

import { FONT_FAMILY, MIME_TYPES } from "@excalidraw/common";

import {
  newElement,
  newImageElement,
  newTextElement,
} from "@excalidraw/element";

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
    const mainGetContext = window.HTMLCanvasElement.prototype.getContext.bind(
      window.HTMLCanvasElement.prototype,
    );
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      {
        value(this: HTMLCanvasElement, contextType: string) {
          const context = mainGetContext.call(this, contextType);
          // the canvas mock type-checks `drawImage` arguments against the
          // main realm's classes, but per the HTML spec a canvas accepts
          // image sources from any realm -- make it permissive so the
          // cross-document canvases can be drawn
          if (context) {
            (context as CanvasRenderingContext2D).drawImage = () => undefined;
          }
          return context;
        },
      },
    );
    const addDocumentEventListener = vi.spyOn(
      ownerDocument,
      "addEventListener",
    );
    const createElement = vi.spyOn(ownerDocument, "createElement");
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

      // App's own canvases are created in the owner document too; count the
      // baseline so we can tell the render pipeline's canvases apart
      const baselineCanvasCreations = createElement.mock.calls.filter(
        ([tag]) => tag === "canvas",
      ).length;

      const ownerImageFileId = "owner-window-image" as FileId;
      act(() => {
        api!.updateScene({
          elements: [
            ...api!.getSceneElements(),
            newImageElement({
              type: "image",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              fileId: ownerImageFileId,
              status: "saved",
              scale: [1, 1],
              link: "https://excalidraw.com",
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
      // the scene image is created in the owner document
      await waitFor(() =>
        expect(ownerImages.some((img) => img.src.includes(";base64"))).toBe(
          true,
        ),
      );
      const sceneImage = ownerImages.find((img) =>
        img.src.includes(";base64"),
      )!;
      expect(sceneImage.ownerDocument).toBe(ownerDocument);

      // per-element canvases (and the link icon canvas) are created in the
      // owner document through the editor's render environment
      await waitFor(() => {
        expect(
          createElement.mock.calls.filter(([tag]) => tag === "canvas").length,
        ).toBeGreaterThan(baselineCanvasCreations);
      });

      // the undecoded image's placeholder is created in the owner document
      await waitFor(() =>
        expect(ownerImages.some((img) => img.src.includes("fa-image"))).toBe(
          true,
        ),
      );
      const placeholderImage = ownerImages.find((img) =>
        img.src.includes("fa-image"),
      )!;
      expect(placeholderImage.ownerDocument).toBe(ownerDocument);

      // the external link icon's image is created in the owner document
      await waitFor(() =>
        expect(
          ownerImages.some((img) => img.src.includes("feather-external-link")),
        ).toBe(true),
      );
      const linkImage = ownerImages.find((img) =>
        img.src.includes("feather-external-link"),
      )!;
      expect(linkImage.ownerDocument).toBe(ownerDocument);

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

  it("infers the render environment from the container document when the ownerDocument prop is missing", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const ownerDocument = iframe.contentDocument!;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);
    const createElement = vi.spyOn(ownerDocument, "createElement");

    // the canvas mock only patches the main realm's canvas prototype; route
    // the owner realm's getContext through it (same as the test above)
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    const mainGetContext = window.HTMLCanvasElement.prototype.getContext.bind(
      window.HTMLCanvasElement.prototype,
    );
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      {
        value(this: HTMLCanvasElement, contextType: string) {
          const context = mainGetContext.call(this, contextType);
          if (context) {
            (context as CanvasRenderingContext2D).drawImage = () => undefined;
          }
          return context;
        },
      },
    );

    const linkedRect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      link: "https://excalidraw.com",
    });

    const renderResult = renderReact(
      <Excalidraw initialData={{ elements: [linkedRect] }} />,
      { container: mountNode, baseElement: ownerDocument.body },
    );

    try {
      // the env object is allocated during the pre-commit render, when the
      // container ref is still null and the document falls back to the
      // module realm; the factories must nonetheless resolve to the
      // container's document (per-element and link icon canvases are
      // created in the owner document through the env)
      await waitFor(() => {
        expect(
          createElement.mock.calls.filter(([tag]) => tag === "canvas").length,
        ).toBeGreaterThan(0);
      });
    } finally {
      renderResult.unmount();
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
