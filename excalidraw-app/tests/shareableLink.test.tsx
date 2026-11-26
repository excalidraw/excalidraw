import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { overwriteConfirmStateAtom } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import * as overwriteConfirmState from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { render } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import type { ExcalidrawImageElement, FileId } from "@excalidraw/element/types";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";
import * as dataModule from "../data";
import { isSameSceneContent } from "../data";
import { LocalData } from "../data/LocalData";

const { h } = window;

vi.mock("../../excalidraw-app/data/firebase.ts", () => ({
  loadFromFirebase: async () => null,
  saveToFirebase: () => {},
  isSavedToFirebase: () => true,
  loadFilesFromFirebase: async () => ({
    loadedFiles: [],
    erroredFiles: new Map(),
  }),
  saveFilesToFirebase: async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  }),
}));

vi.mock("socket.io-client", () => ({
  default: () => ({
    close: () => {},
    on: () => {},
    once: () => {},
    off: () => {},
    emit: () => {},
  }),
}));

describe("isSameSceneContent", () => {
  it("treats scenes with identical content as equal regardless of version metadata, image save status, or transient UI state", () => {
    const rect = API.createElement({
      type: "rectangle",
      id: "rect-1",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
    const img = API.createElement({
      type: "image",
      id: "img-1",
      fileId: "file-1" as FileId,
      status: "pending",
      x: 200,
      y: 20,
      width: 80,
      height: 80,
    }) as ExcalidrawImageElement;
    const deleted = API.createElement({
      type: "ellipse",
      id: "deleted-1",
      isDeleted: true,
    });

    const localRect = {
      ...rect,
      x: 10,
      version: 9,
      versionNonce: 123456,
      updated: 999999,
      index: "a5" as typeof rect.index,
    };
    const localImg: ExcalidrawImageElement = {
      ...img,
      status: "saved",
      version: 4,
      versionNonce: 654321,
      updated: 888888,
    };

    const incomingRect = {
      ...rect,
      x: 10,
      version: 1,
      versionNonce: 111,
      updated: 111,
      index: "a0" as typeof rect.index,
    };

    expect(
      isSameSceneContent(
        {
          elements: [localRect, localImg, deleted],
          appState: {
            ...getDefaultAppState(),
            viewBackgroundColor: "#ffffff",
            theme: "dark",
            scrollX: 500,
            scrollY: -200,
            selectedElementIds: { "rect-1": true },
          },
        },
        {
          elements: [incomingRect, img],
          appState: {
            ...getDefaultAppState(),
            viewBackgroundColor: "#ffffff",
            theme: "light",
            scrollX: 0,
            scrollY: 0,
            selectedElementIds: {},
          },
        },
      ),
    ).toBe(true);
  });

  it("treats -0 and 0 as equal to match JSON serialization", () => {
    const a = API.createElement({
      type: "rectangle",
      id: "r1",
      x: -0,
      y: 0,
    });
    const b = API.createElement({
      type: "rectangle",
      id: "r1",
      x: 0,
      y: 0,
    });

    expect(isSameSceneContent({ elements: [a] }, { elements: [b] })).toBe(true);
  });

  it("returns false when element content, order, count, or persisted appState differs", () => {
    const r1 = API.createElement({
      type: "rectangle",
      id: "r1",
      x: 0,
      y: 0,
    });
    const r2 = API.createElement({
      type: "ellipse",
      id: "r2",
      x: 100,
      y: 0,
    });

    expect(
      isSameSceneContent({ elements: [{ ...r1, x: 50 }] }, { elements: [r1] }),
    ).toBe(false);

    expect(isSameSceneContent({ elements: [r1, r2] }, { elements: [r1] })).toBe(
      false,
    );

    expect(
      isSameSceneContent({ elements: [r1, r2] }, { elements: [r2, r1] }),
    ).toBe(false);

    expect(
      isSameSceneContent(
        {
          elements: [r1],
          appState: { viewBackgroundColor: "#f0f0f0" },
        },
        {
          elements: [r1],
          appState: { viewBackgroundColor: "#ffffff" },
        },
      ),
    ).toBe(false);

    expect(
      isSameSceneContent(
        {
          elements: [r1],
          appState: { gridModeEnabled: true },
        },
        {
          elements: [r1],
          appState: { gridModeEnabled: false },
        },
      ),
    ).toBe(false);
  });
});

describe("shareable link reload prompt", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
    editorJotaiStore.set(overwriteConfirmStateAtom, { active: false });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    LocalData.flushSave();
    localStorage.clear();
    globalThis.fetch = originalFetch;
  });

  it("skips the overwrite prompt on #json reload when localStorage already has the same scene", async () => {
    const rect = restoreElements(
      [
        API.createElement({
          type: "rectangle",
          id: "shared-rect",
          x: 10,
          y: 20,
          width: 120,
          height: 80,
        }),
      ],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    )[0];

    const localAppState = {
      ...getDefaultAppState(),
      viewBackgroundColor: "#ffffff",
      theme: "dark" as const,
      scrollX: 250,
    };

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([
        { ...rect, version: rect.version + 3, versionNonce: 999 },
      ]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(clearAppStateForLocalStorage(localAppState)),
    );

    const importSpy = vi
      .spyOn(dataModule, "importFromBackend")
      .mockResolvedValue({
        elements: [rect],
        appState: { viewBackgroundColor: "#ffffff" },
      });
    const modalSpy = vi.spyOn(overwriteConfirmState, "openConfirmModal");

    window.location.hash = "#json=drawing123,encryptionKey456";

    await render(<ExcalidrawApp />);

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith("drawing123", "encryptionKey456");
      expect(h.elements.length).toBe(1);
    });

    expect(modalSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/replace my content/i)).toBeNull();
    expect(h.elements[0].id).toBe("shared-rect");
  });

  it("shows the overwrite prompt on #json load when localStorage has edits and handles cancel/confirm", async () => {
    const incomingRect = restoreElements(
      [
        API.createElement({
          type: "rectangle",
          id: "shared-rect",
          x: 10,
          y: 20,
          width: 120,
          height: 80,
        }),
      ],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    )[0];

    const editedLocalRect = { ...incomingRect, x: 300 };

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([editedLocalRect]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(clearAppStateForLocalStorage(getDefaultAppState())),
    );

    vi.spyOn(dataModule, "importFromBackend").mockResolvedValue({
      elements: [incomingRect],
      appState: { viewBackgroundColor: "#ffffff" },
    });

    window.location.hash = "#json=drawing123,encryptionKey456";

    rtlRender(<ExcalidrawApp />);

    const replaceButton = await screen.findByRole("button", {
      name: /replace my content/i,
    });
    expect(replaceButton).toBeInTheDocument();

    fireEvent.click(replaceButton);

    await waitFor(() => {
      expect(h.state.isLoading).toBe(false);
      expect(h.elements[0]?.x).toBe(10);
    });
  });

  it("preserves local elements without prompting when importFromBackend fails", async () => {
    const localRect = restoreElements(
      [
        API.createElement({
          type: "rectangle",
          id: "local-rect",
          x: 42,
          y: 24,
        }),
      ],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    )[0];

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([localRect]),
    );

    vi.spyOn(dataModule, "importFromBackend").mockResolvedValue({});
    const modalSpy = vi.spyOn(overwriteConfirmState, "openConfirmModal");

    window.location.hash = "#json=missing123,key456";

    await render(<ExcalidrawApp />);

    await waitFor(() => {
      expect(dataModule.importFromBackend).toHaveBeenCalledWith(
        "missing123",
        "key456",
      );
      expect(h.elements[0]?.id).toBe("local-rect");
    });

    expect(modalSpy).not.toHaveBeenCalled();
  });

  it("preserves local edited elements when user cancels the overwrite prompt on #json load", async () => {
    const incomingRect = restoreElements(
      [
        API.createElement({
          type: "rectangle",
          id: "shared-rect",
          x: 10,
          y: 20,
          width: 120,
          height: 80,
        }),
      ],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    )[0];

    const editedLocalRect = { ...incomingRect, x: 350 };

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([editedLocalRect]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(clearAppStateForLocalStorage(getDefaultAppState())),
    );

    vi.spyOn(dataModule, "importFromBackend").mockResolvedValue({
      elements: [incomingRect],
      appState: { viewBackgroundColor: "#ffffff" },
    });

    window.location.hash = "#json=drawing123,encryptionKey456";

    rtlRender(<ExcalidrawApp />);

    await screen.findByRole("button", {
      name: /replace my content/i,
    });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText(/replace my content/i)).toBeNull();
      expect(h.state.isLoading).toBe(false);
      expect(h.elements[0]?.x).toBe(350);
    });
  });

  it("skips the overwrite prompt on #url reload when localStorage already has the same scene", async () => {
    const rect = restoreElements(
      [
        API.createElement({
          type: "rectangle",
          id: "url-rect",
          x: 15,
          y: 25,
          width: 100,
          height: 60,
        }),
      ],
      null,
      { repairBindings: true, deleteInvisibleElements: true },
    )[0];

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([{ ...rect, version: rect.version + 2 }]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(clearAppStateForLocalStorage(getDefaultAppState())),
    );

    const json = serializeAsJSON([rect], getDefaultAppState(), {}, "local");
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(json)) as any;

    const modalSpy = vi.spyOn(overwriteConfirmState, "openConfirmModal");
    window.location.hash = `#url=${encodeURIComponent(
      "https://example.com/scene.excalidraw",
    )}`;

    await render(<ExcalidrawApp />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://example.com/scene.excalidraw",
      );
      expect(h.elements[0]?.id).toBe("url-rect");
    });

    expect(modalSpy).not.toHaveBeenCalled();
  });
});
