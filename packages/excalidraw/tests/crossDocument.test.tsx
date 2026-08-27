import React from "react";
import {
  act,
  fireEvent,
  render as renderReact,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";

import { MIME_TYPES } from "@excalidraw/common"; // zsviczian -- construct the migration image fixture
import { newImageElement } from "@excalidraw/element"; // zsviczian -- construct the migration image fixture

import type { FileId } from "@excalidraw/element/types"; // zsviczian -- type the migration image fixture

import { Excalidraw } from "../index";
import { Tooltip } from "../components/Tooltip"; // zsviczian -- exercise document-local tooltips, upstream #11974 follow-up

import type {
  BinaryFileData, // zsviczian -- type the migration image fixture
  DataURL, // zsviczian -- type the migration image fixture
  ExcalidrawImperativeAPI,
} from "../types";

describe("cross-document rendering", () => {
  it("scopes listeners, fonts, and portals to ownerDocument", async () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);

    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);
    const ownerImages: HTMLImageElement[] = []; // zsviczian -- record image construction in the editor realm, upstream #11974 follow-up
    const OwnerImage = function () {
      const image = ownerDocument.createElement("img");
      ownerImages.push(image);
      return image;
    } as unknown as typeof Image; // zsviczian -- minimal cross-document Image constructor double, upstream #11974 follow-up

    const fonts = {
      load: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockReturnValue(false), // zsviczian -- force the empty-scene UI font load path
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
      Image: { value: OwnerImage }, // zsviczian -- expose the editor-realm constructor to App, upstream #11974 follow-up
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

      // zsviczian START -- verify image decoding starts in the editor window
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
      // zsviczian END
      // zsviczian START -- verify the empty-scene UI font targets the editor document
      await waitFor(() =>
        expect(fonts.load).toHaveBeenCalledWith(
          expect.stringContaining("Excalifont"),
          expect.stringContaining("Excalid"),
        ),
      );
      // zsviczian END

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

  // zsviczian START -- keep tooltip nodes and viewport ownership in the trigger document
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
  // zsviczian END

  // zsviczian START -- keep the Obsidian migration decode boundary in a focused test that runs in this fork
  it("awaits image decoding started by addFiles", async () => {
    let api: ExcalidrawImperativeAPI | null = null;
    const renderResult = renderReact(
      <Excalidraw
        onExcalidrawAPI={(nextApi) => {
          api = nextApi;
        }}
      />,
    );
    const NativeImage = window.Image;
    const pendingImages: HTMLImageElement[] = [];
    try {
      await waitFor(() => expect(api).not.toBeNull());
      await waitFor(() => expect(api!.getAppState().isLoading).toBe(false));

      const fileId = "migration-image" as FileId;
      act(() => {
        api!.updateScene({
          elements: [
            newImageElement({
              type: "image",
              x: 0,
              y: 0,
              fileId,
              status: "saved",
              scale: [1, 1],
            }),
          ],
        });
      });
      vi.stubGlobal(
        "Image",
        class extends NativeImage {
          constructor() {
            super();
            pendingImages.push(this);
          }
        },
      );
      const file: BinaryFileData = {
        id: fileId,
        dataURL: `data:${MIME_TYPES.png};base64,AA==` as DataURL,
        mimeType: MIME_TYPES.png,
        created: Date.now(),
        lastRetrieved: Date.now(),
      };

      act(() => api!.addFiles([file]));
      expect(pendingImages).toHaveLength(1);
      let settled = false;
      const waitForImages = api!.awaitImageFiles([fileId]).then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      await act(async () => {
        pendingImages[0].onload?.(new Event("load"));
        await waitForImages;
      });
      expect(settled).toBe(true);
      expect(api!.getFiles()[fileId]).toBe(file);
    } finally {
      renderResult.unmount();
      vi.unstubAllGlobals();
    }
  });
  // zsviczian END
});
