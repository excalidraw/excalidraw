import React from "react";
import { render as renderWithoutWaiting } from "@testing-library/react";
import { vi } from "vitest";

import { MIME_TYPES, resolvablePromise } from "@excalidraw/common";

import ExcalidrawApp from "../../../excalidraw-app/App";
import { STORAGE_KEYS } from "../../../excalidraw-app/app_constants";
import { LocalData } from "../../../excalidraw-app/data/LocalData";

import { getDefaultAppState } from "../appState";
import { overwriteConfirmStateAtom } from "../components/OverwriteConfirm/OverwriteConfirmState";
import { loadFromBlob } from "../data/blob";
import * as filesystem from "../data/filesystem";
import { serializeAsJSON } from "../data/json";
import { editorJotaiStore } from "../editor-jotai";
import { t } from "../i18n";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import {
  act,
  fireEvent,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "./test-utils";

import type { ExcalidrawInitialDataState } from "../types";

const { h } = window;

type LaunchConsumer = (params: {
  files: FileSystemFileHandle[];
}) => void | Promise<void>;

let consumer: LaunchConsumer | undefined;
let queuedFiles: FileSystemFileHandle[] | undefined;
const setConsumer = vi.fn((callback: LaunchConsumer) => {
  consumer = callback;
  if (queuedFiles) {
    const files = queuedFiles;
    queuedFiles = undefined;
    void callback({ files });
  }
});

const createFileHandle = (ownerDocument: Document, id = "imported") => {
  const file = new ownerDocument.defaultView!.File(
    [
      serializeAsJSON(
        [API.createElement({ type: "ellipse", id })],
        { ...getDefaultAppState(), viewBackgroundColor: "#ff0000" },
        {},
        "local",
      ),
    ],
    "drawing.excalidraw",
    { type: MIME_TYPES.json },
  );
  return {
    kind: "file",
    name: file.name,
    getFile: vi.fn().mockResolvedValue(file),
  } as unknown as FileSystemFileHandle;
};

const confirmButton = () =>
  screen.getByRole("button", {
    name: t("overwriteConfirm.modal.loadFromFile.button"),
  });

describe("PWA file launches", () => {
  beforeEach(() => {
    consumer = undefined;
    queuedFiles = undefined;
    setConsumer.mockClear();
    vi.stubGlobal("launchQueue", { setConsumer });
    vi.stubGlobal("LaunchParams", class {});
  });

  afterEach(() => {
    unmountComponent();
    LocalData.flushSave();
    localStorage.clear();
    editorJotaiStore.set(overwriteConfirmStateAtom, { active: false });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the current drawing until the launched file is confirmed", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle", id: "original" })],
          appState: { viewBackgroundColor: "#ffffff" },
        }}
      />,
    );
    const fileHandle = createFileHandle(h.app.ownerDocument);

    act(() => {
      void consumer!({ files: [fileHandle] });
    });
    await waitFor(() => expect(confirmButton()).toBeVisible());
    expect(h.elements.map(({ id }) => id)).toEqual(["original"]);
    expect(h.state.viewBackgroundColor).toBe("#ffffff");

    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(h.elements.map(({ id }) => id)).toEqual(["imported"]),
    );
    expect(h.state.viewBackgroundColor).toBe("#ff0000");
    expect(h.state.fileHandle).toBe(fileHandle);
  });

  it("keeps the current drawing when the confirmation is dismissed", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle", id: "original" })],
        }}
      />,
    );
    const original = h.elements[0];
    act(() => {
      void consumer!({ files: [createFileHandle(h.app.ownerDocument)] });
    });
    await waitFor(() => expect(confirmButton()).toBeVisible());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(h.elements).toEqual([original]);
    expect(h.state.fileHandle).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits for the saved drawing before consuming a queued launch", async () => {
    const initialData = resolvablePromise<ExcalidrawInitialDataState>();
    const { container } = renderWithoutWaiting(
      <Excalidraw initialData={initialData} />,
    );
    const fileHandle = createFileHandle(container.ownerDocument);
    if (consumer) {
      act(() => {
        void consumer!({ files: [fileHandle] });
      });
    } else {
      queuedFiles = [fileHandle];
    }
    expect(fileHandle.getFile).not.toHaveBeenCalled();

    await act(async () => {
      initialData.resolve({
        elements: [API.createElement({ type: "rectangle", id: "saved" })],
      });
    });

    await waitFor(() => expect(confirmButton()).toBeVisible());
    expect(h.elements.map(({ id }) => id)).toEqual(["saved"]);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(h.elements.map(({ id }) => id)).toEqual(["saved"]);
  });

  it.each([false, true])(
    "opens without a confirmation when the canvas is empty (deleted elements: %s)",
    async (deleted) => {
      await render(
        <Excalidraw
          initialData={{
            elements: deleted
              ? [API.createElement({ type: "rectangle", isDeleted: true })]
              : [],
          }}
        />,
      );
      await act(async () => {
        await consumer!({ files: [createFileHandle(h.app.ownerDocument)] });
      });
      await waitFor(() =>
        expect(h.elements.map(({ id }) => id)).toEqual(["imported"]),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("preserves browser storage while the confirmation is open and after cancellation", async () => {
    const original = API.createElement({ type: "rectangle", id: "saved" });
    await render(<ExcalidrawApp />, {
      localStorageData: { elements: [original] },
    });
    act(() => {
      void consumer!({ files: [createFileHandle(h.app.ownerDocument)] });
    });
    await waitFor(() => expect(confirmButton()).toBeVisible());

    const savedIds = () =>
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS)!,
      ).map(({ id }: { id: string }) => id);

    LocalData.flushSave();
    expect(savedIds()).toEqual(["saved"]);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    LocalData.flushSave();
    expect(savedIds()).toEqual(["saved"]);
    expect(h.elements.map(({ id }) => id)).toEqual(["saved"]);
  });

  it("confirms successive launches separately", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle", id: "original" })],
        }}
      />,
    );
    const first = createFileHandle(h.app.ownerDocument, "first");
    const second = createFileHandle(h.app.ownerDocument, "second");
    act(() => {
      void consumer!({ files: [first] });
      void consumer!({ files: [second] });
    });
    await waitFor(() => expect(confirmButton()).toBeVisible());
    expect(second.getFile).not.toHaveBeenCalled();

    fireEvent.click(confirmButton());
    await waitFor(() => {
      expect(h.elements.map(({ id }) => id)).toEqual(["first"]);
      expect(second.getFile).toHaveBeenCalledTimes(1);
      expect(confirmButton()).toBeVisible();
    });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(h.elements.map(({ id }) => id)).toEqual(["first"]);
    expect(h.state.fileHandle).toBe(first);
  });

  it("backs up the original drawing before replacing it", async () => {
    const save = vi.spyOn(filesystem, "fileSave").mockResolvedValue(null);
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle", id: "original" })],
        }}
      />,
    );
    act(() => {
      void consumer!({ files: [createFileHandle(h.app.ownerDocument)] });
    });
    await waitFor(() => expect(confirmButton()).toBeVisible());
    fireEvent.click(
      screen.getByRole("button", {
        name: t("overwriteConfirm.action.saveToDisk.button"),
      }),
    );
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const backup = await loadFromBlob(await save.mock.calls[0][0], null, null);
    expect(backup.elements.map(({ id }) => id)).toEqual(["original"]);
    expect(h.elements.map(({ id }) => id)).toEqual(["original"]);

    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(h.elements.map(({ id }) => id)).toEqual(["imported"]),
    );
  });

  it("reports an unreadable file and can still handle the next launch", async () => {
    await render(<Excalidraw />);
    const unreadable = createFileHandle(h.app.ownerDocument);
    vi.mocked(unreadable.getFile).mockRejectedValueOnce(
      new Error("The file could not be read"),
    );
    await act(async () => {
      await consumer!({ files: [unreadable] });
    });
    expect(h.state.errorMessage).toBe("The file could not be read");
    expect(h.elements).toEqual([]);

    await act(async () => {
      await consumer!({ files: [createFileHandle(h.app.ownerDocument)] });
    });
    expect(h.elements.map(({ id }) => id)).toEqual(["imported"]);
  });

  it("ignores launches without files", async () => {
    await render(<Excalidraw />);
    await act(async () => {
      await consumer!({ files: [] });
    });
    expect(h.elements).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not register a consumer after unmounting during initialization", async () => {
    const initialData = resolvablePromise<ExcalidrawInitialDataState>();
    const { unmount } = renderWithoutWaiting(
      <Excalidraw initialData={initialData} />,
    );
    unmount();
    const callsAfterUnmount = setConsumer.mock.calls.length;
    await act(async () => {
      initialData.resolve({ elements: [] });
    });
    expect(setConsumer).toHaveBeenCalledTimes(callsAfterUnmount);
  });
});
