/* eslint-disable import/first */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { browserOpen, browserSave, nativeInvoke, tauriIsDesktop } = vi.hoisted(
  () => ({
    browserOpen: vi.fn(),
    browserSave: vi.fn(),
    nativeInvoke: vi.fn(),
    tauriIsDesktop: vi.fn(),
  }),
);

vi.mock("browser-fs-access", () => ({
  fileOpen: browserOpen,
  fileSave: browserSave,
  supported: true,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: nativeInvoke,
  isTauri: tauriIsDesktop,
}));

import {
  createDesktopFileBridge,
  flushDesktopDocument,
  installDesktopBridge,
  MAX_DOCUMENT_BYTES,
  persistDesktopDocument,
  restoreDesktopDocument,
  validateDocument,
} from "../desktop/bridge";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { MIME_TYPES } from "@excalidraw/excalidraw/constants";
import type { AppState } from "@excalidraw/excalidraw/types";
import { fileOpen, fileSave } from "@excalidraw/excalidraw/data/filesystem";
import type {
  FileOpenOptions,
  FileSystemHandle,
} from "@excalidraw/excalidraw/data/filesystem";
import {
  loadFromJSON,
  saveLibraryAsJSON,
} from "@excalidraw/excalidraw/data/json";
import { AbortError } from "@excalidraw/excalidraw/errors";

const scene = JSON.stringify({
  type: "excalidraw",
  version: 2,
  elements: [],
  appState: {},
  files: {},
});

const sceneOptions: FileOpenOptions = {
  description: "Excalidraw files",
  extensions: ["json", "excalidraw"],
};
const saveOptions = {
  name: "drawing",
  extension: "excalidraw",
  description: "Excalidraw file",
} as const;
const defaultAppState = getDefaultAppState() as AppState;

const deferred = () => {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  browserOpen.mockReset();
  browserSave.mockReset();
  nativeInvoke.mockReset().mockResolvedValue(undefined);
  tauriIsDesktop.mockReset().mockReturnValue(false);
  delete window.__EXCALIDRAW_DESKTOP__;
});

afterEach(async () => {
  await flushDesktopDocument();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.__EXCALIDRAW_DESKTOP__;
});

describe("desktop document bridge", () => {
  it("validates canonical scenes and rejects malformed or oversized input", () => {
    expect(validateDocument(scene)).toMatchObject({ type: "excalidraw" });
    expect(() => validateDocument("not json")).toThrow();
    expect(() =>
      validateDocument(
        JSON.stringify({ type: "excalidraw", version: 2, elements: [null] }),
      ),
    ).toThrow();
    expect(() => validateDocument("x".repeat(MAX_DOCUMENT_BYTES + 1))).toThrow(
      /10 MiB/,
    );
    expect(() => validateDocument(undefined)).toThrow(/contents/);
  });

  it("opens and saves through typed native commands", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const invoke = vi.fn(
      async <T>(command: string, args?: Record<string, unknown>) => {
        calls.push({ command, args });
        if (command === "open_document") {
          return { name: "drawing.excalidraw", contents: scene } as T;
        }
        return true as T;
      },
    );
    const bridge = createDesktopFileBridge(invoke);

    const opened = await bridge.fileOpen({
      description: "Excalidraw files",
      extensions: ["json", "excalidraw"],
    });
    expect(opened.name).toBe("drawing.excalidraw");
    expect(opened.type).toBe(MIME_TYPES.json);
    expect(opened.handle).toBeUndefined();

    await expect(
      bridge.fileSave(new Blob([scene]), {
        name: "drawing",
        extension: "excalidraw",
        description: "Excalidraw file",
      }),
    ).resolves.toBeNull();
    expect(calls.map(({ command }) => command)).toEqual([
      "open_document",
      "save_document",
    ]);
    expect(calls[1].args).toEqual({
      request: { contents: scene, extension: "excalidraw" },
    });
  });

  it("rejects unsupported extensions and malformed native responses", async () => {
    const invoke = vi.fn(async () => ({
      name: "drawing.excalidraw",
      contents: "{}",
    }));
    const bridge = createDesktopFileBridge(invoke);

    await expect(
      bridge.fileSave(new Blob([scene]), {
        name: "drawing",
        extension: "png",
        description: "PNG",
      }),
    ).rejects.toThrow(/extension/);
    await expect(
      bridge.fileOpen({
        description: "Excalidraw files",
        extensions: ["json", "excalidraw"],
      }),
    ).rejects.toThrow(/Invalid Excalidraw/);
  });

  it.each([
    undefined,
    false,
    [],
    {},
    { name: "drawing" },
    { name: 1, contents: scene },
    { name: "", contents: scene },
    { name: "drawing", contents: {} },
  ])("rejects a malformed open response: %j", async (response) => {
    const bridge = createDesktopFileBridge(vi.fn().mockResolvedValue(response));
    await expect(bridge.fileOpen(sceneOptions)).rejects.toThrow(/response/);
  });

  it("rejects oversized UTF-8 native contents and save blobs", async () => {
    // Fewer than 10 MiB UTF-16 code units, but over 10 MiB on the wire.
    const contents = JSON.stringify({
      ...JSON.parse(scene),
      source: "😀".repeat(MAX_DOCUMENT_BYTES / 4),
    });
    expect(contents.length).toBeLessThan(MAX_DOCUMENT_BYTES);
    const call = vi
      .fn()
      .mockResolvedValue({ name: "large.excalidraw", contents });
    const bridge = createDesktopFileBridge(call);
    await expect(bridge.fileOpen(sceneOptions)).rejects.toThrow(/10 MiB/);
    await expect(
      bridge.fileSave(new Blob([contents]), saveOptions),
    ).rejects.toThrow(/10 MiB/);
    expect(call).toHaveBeenCalledOnce();
    nativeInvoke.mockResolvedValue(contents);
    tauriIsDesktop.mockReturnValue(true);
    await expect(restoreDesktopDocument()).rejects.toThrow(/10 MiB/);
  });

  it("reports native dialog cancellation as AbortError", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(false);
    const bridge = createDesktopFileBridge(call);
    window.__EXCALIDRAW_DESKTOP__ = bridge;
    await expect(fileOpen(sceneOptions)).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(
      fileSave(new Blob([scene]), saveOptions),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(browserOpen).not.toHaveBeenCalled();
    expect(browserSave).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "true", 1, {}])(
    "rejects a malformed save response: %j",
    async (response) => {
      const bridge = createDesktopFileBridge(
        vi.fn().mockResolvedValue(response),
      );
      await expect(
        bridge.fileSave(new Blob([scene]), saveOptions),
      ).rejects.toThrow(/response/);
    },
  );

  it("does not open a second dialog when a native command fails", async () => {
    const error = new Error("Native command failed");
    const call = vi.fn().mockRejectedValue(error);
    window.__EXCALIDRAW_DESKTOP__ = createDesktopFileBridge(call);
    await expect(fileOpen(sceneOptions)).rejects.toBe(error);
    await expect(fileSave(new Blob([scene]), saveOptions)).rejects.toBe(error);
    expect(browserOpen).not.toHaveBeenCalled();
    expect(browserSave).not.toHaveBeenCalled();
  });

  it("rejects direct multi-select bridge calls before invoking native code", async () => {
    const call = vi.fn();
    await expect(
      createDesktopFileBridge(call).fileOpen({
        ...sceneOptions,
        multiple: true,
      }),
    ).rejects.toThrow(/one document/);
    expect(call).not.toHaveBeenCalled();
  });

  it("installs the adapter only inside Tauri", () => {
    installDesktopBridge();
    expect(window.__EXCALIDRAW_DESKTOP__).toBeUndefined();
    tauriIsDesktop.mockReturnValue(true);
    installDesktopBridge();
    expect(window.__EXCALIDRAW_DESKTOP__?.fileOpen).toBeTypeOf("function");
  });

  it("restores a native scene or returns null when none was persisted", async () => {
    tauriIsDesktop.mockReturnValue(true);
    nativeInvoke.mockResolvedValueOnce(null).mockResolvedValueOnce(scene);
    await expect(restoreDesktopDocument()).resolves.toBeNull();
    await expect(restoreDesktopDocument()).resolves.toMatchObject({
      elements: [],
      files: {},
    });
    expect(nativeInvoke).toHaveBeenNthCalledWith(1, "restore_document");
    expect(nativeInvoke).toHaveBeenNthCalledWith(2, "restore_document");
  });

  it.each([undefined, false, {}, "", "{}"])(
    "rejects a malformed restored document: %j",
    async (response) => {
      tauriIsDesktop.mockReturnValue(true);
      nativeInvoke.mockResolvedValue(response);
      await expect(restoreDesktopDocument()).rejects.toThrow();
    },
  );
});

describe("browser and desktop file routing", () => {
  it("keeps loadFromJSON unfiltered in the browser", async () => {
    browserOpen.mockResolvedValue(
      new File([scene], "drawing.excalidraw", {
        type: MIME_TYPES.json,
      }),
    );
    await expect(loadFromJSON(defaultAppState, null)).resolves.toMatchObject({
      elements: [],
    });
    expect(browserOpen).toHaveBeenCalledWith({
      description: "Excalidraw files",
      extensions: undefined,
      mimeTypes: undefined,
      multiple: false,
      legacySetup: expect.any(Function),
    });
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it("uses the explicit scene hint for loadFromJSON on desktop", async () => {
    nativeInvoke.mockResolvedValue({
      name: "drawing.excalidraw",
      contents: scene,
    });
    window.__EXCALIDRAW_DESKTOP__ = createDesktopFileBridge(nativeInvoke);
    await expect(loadFromJSON(defaultAppState, null)).resolves.toMatchObject({
      elements: [],
    });
    expect(nativeInvoke).toHaveBeenCalledWith("open_document");
    expect(browserOpen).not.toHaveBeenCalled();
  });

  it("preserves browser scene open/save arguments and existing handles without an adapter", async () => {
    const file = new File([scene], "drawing.excalidraw");
    browserOpen.mockResolvedValue(file);
    await expect(fileOpen(sceneOptions)).resolves.toBe(file);
    expect(browserOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: [".json", ".excalidraw"],
        mimeTypes: [MIME_TYPES.json, MIME_TYPES.excalidraw],
        multiple: false,
      }),
    );
    const blob = new Blob([scene]);
    const handle = {
      name: "drawing.excalidraw",
      kind: "file",
    } as FileSystemHandle;
    browserSave.mockResolvedValue(handle);
    await expect(
      fileSave(blob, { ...saveOptions, fileHandle: handle }),
    ).resolves.toBe(handle);
    expect(browserSave).toHaveBeenCalledWith(
      blob,
      {
        fileName: "drawing.excalidraw",
        description: saveOptions.description,
        extensions: [".excalidraw"],
        mimeTypes: undefined,
      },
      handle,
    );
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it("preserves browser cancellation", async () => {
    const error = new AbortError();
    browserOpen.mockRejectedValue(error);
    browserSave.mockRejectedValue(error);
    await expect(loadFromJSON(defaultAppState, null)).rejects.toBe(error);
    await expect(fileSave(new Blob([scene]), saveOptions)).rejects.toBe(error);
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it.each<FileOpenOptions<boolean>>([
    { description: "Library" },
    { description: "Empty extensions", extensions: [] },
    {
      description: "Empty scene extensions",
      extensions: [],
      desktopScene: true,
    },
    { description: "Library", extensions: ["json", "excalidrawlib"] },
    { description: "PNG", extensions: ["png"] },
    { description: "SVG", extensions: ["svg"] },
    { description: "Mixed", extensions: ["json", "png"], desktopScene: true },
    { ...sceneOptions, multiple: true },
    { description: "Unfiltered multiple", multiple: true, desktopScene: true },
  ])(
    "keeps $description (multiple=$multiple) on the browser picker",
    async (options) => {
      const call = vi.fn();
      window.__EXCALIDRAW_DESKTOP__ = createDesktopFileBridge(call);
      const file = new File([scene], "selected-file");
      const result = options.multiple ? [file, file] : file;
      browserOpen.mockResolvedValue(result);
      await expect(fileOpen(options)).resolves.toBe(result);
      expect(browserOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          multiple: options.multiple ?? false,
          extensions: options.extensions?.map((extension) => `.${extension}`),
        }),
      );
      expect(call).not.toHaveBeenCalled();
    },
  );

  it.each(["json", "excalidraw"] as const)(
    "routes single .%s scene opens to native",
    async (extension) => {
      const call = vi
        .fn()
        .mockResolvedValue({ name: `drawing.${extension}`, contents: scene });
      window.__EXCALIDRAW_DESKTOP__ = createDesktopFileBridge(call);
      await expect(
        fileOpen({
          description: "Scene",
          extensions: [extension],
          multiple: false,
        }),
      ).resolves.toMatchObject({ name: `drawing.${extension}` });
      expect(call).toHaveBeenCalledOnce();
      expect(browserOpen).not.toHaveBeenCalled();
    },
  );

  it("routes only json/excalidraw exports to native, keeping library and image exports in the browser", async () => {
    const call = vi.fn().mockResolvedValue(true);
    window.__EXCALIDRAW_DESKTOP__ = createDesktopFileBridge(call);
    browserSave.mockResolvedValue(null);
    await fileSave(new Blob([scene]), saveOptions);
    await fileSave(new Blob([scene]), { ...saveOptions, extension: "json" });
    await fileSave(new Blob(["image"]), {
      name: "image",
      extension: "png",
      description: "PNG",
    });
    await saveLibraryAsJSON([]);

    expect(call).toHaveBeenCalledTimes(2);
    expect(browserSave).toHaveBeenCalledTimes(2);
    expect(browserSave).toHaveBeenLastCalledWith(
      expect.any(Blob),
      {
        fileName: "library.excalidrawlib",
        description: "Excalidraw library file",
        extensions: [".excalidrawlib"],
        mimeTypes: undefined,
      },
      undefined,
    );
  });
});

describe("desktop persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tauriIsDesktop.mockReturnValue(true);
  });

  it("does no serialization, scheduling, or native work in a browser", async () => {
    tauriIsDesktop.mockReturnValue(false);
    const serialize = vi.fn(() => scene);
    persistDesktopDocument(serialize);
    persistDesktopDocument("not even JSON");
    expect(vi.getTimerCount()).toBe(0);
    await flushDesktopDocument();
    await expect(restoreDesktopDocument()).resolves.toBeNull();
    expect(serialize).not.toHaveBeenCalled();
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it("debounces from the latest edit and serializes only the coalesced scene", async () => {
    const first = vi.fn(() => scene);
    const latestScene = scene.replace(
      '"appState":{}',
      '"appState":{"name":"latest"}',
    );
    const latest = vi.fn(() => latestScene);
    persistDesktopDocument(first);
    await vi.advanceTimersByTimeAsync(200);
    persistDesktopDocument(latest);
    await vi.advanceTimersByTimeAsync(299);
    expect(first).not.toHaveBeenCalled();
    expect(latest).not.toHaveBeenCalled();
    expect(nativeInvoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await flushDesktopDocument();
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    expect(nativeInvoke).toHaveBeenCalledExactlyOnceWith("persist_document", {
      request: { contents: latestScene },
    });
  });

  it("flushes immediately, supports strings, and cancels the debounce timer", async () => {
    const superseded = vi.fn(() => scene);
    persistDesktopDocument(superseded);
    persistDesktopDocument(scene);
    await flushDesktopDocument();
    expect(superseded).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    await flushDesktopDocument();
    expect(nativeInvoke).toHaveBeenCalledExactlyOnceWith("persist_document", {
      request: { contents: scene },
    });
  });

  it("serializes writes and lets flush await an in-flight queue without duplicating writes", async () => {
    const first = deferred();
    const second = deferred();
    nativeInvoke
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const laterScene = scene.replace(
      '"appState":{}',
      '"appState":{"name":"second"}',
    );
    const serializeLater = vi.fn(() => laterScene);
    try {
      persistDesktopDocument(scene);
      await vi.advanceTimersByTimeAsync(300);
      persistDesktopDocument(serializeLater);
      await vi.advanceTimersByTimeAsync(300);
      expect(nativeInvoke).toHaveBeenCalledOnce();
      expect(serializeLater).not.toHaveBeenCalled();
      const settled = vi.fn();
      const flush = flushDesktopDocument().then(settled);
      expect(settled).not.toHaveBeenCalled();
      first.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(serializeLater).toHaveBeenCalledOnce();
      expect(nativeInvoke).toHaveBeenNthCalledWith(2, "persist_document", {
        request: { contents: laterScene },
      });
      expect(settled).not.toHaveBeenCalled();
      second.resolve();
      await flush;
      expect(settled).toHaveBeenCalledOnce();
      await flushDesktopDocument();
      expect(nativeInvoke).toHaveBeenCalledTimes(2);
    } finally {
      first.resolve();
      second.resolve();
    }
  });

  it("recovers queued and future writes after native rejection without logging payloads", async () => {
    const first = deferred();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    nativeInvoke.mockReturnValueOnce(first.promise);
    try {
      persistDesktopDocument(scene);
      await vi.advanceTimersByTimeAsync(300);
      persistDesktopDocument(() => scene);
      const flush = flushDesktopDocument();
      first.reject(new Error(`private document payload: ${scene}`));
      await expect(flush).resolves.toBeUndefined();
      expect(nativeInvoke).toHaveBeenCalledTimes(2);
      persistDesktopDocument(scene);
      await flushDesktopDocument();
      expect(nativeInvoke).toHaveBeenCalledTimes(3);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "Failed to persist desktop document.",
      );
    } finally {
      first.resolve();
    }
  });

  it("catches a debounced failure even when the caller does not flush", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    nativeInvoke.mockRejectedValueOnce(new Error("private native failure"));
    persistDesktopDocument(() => scene);
    await vi.advanceTimersByTimeAsync(300);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "Failed to persist desktop document.",
    );
    persistDesktopDocument(scene);
    await vi.advanceTimersByTimeAsync(300);
    expect(nativeInvoke).toHaveBeenCalledTimes(2);
  });

  it("recovers from lazy serialization and validation errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    persistDesktopDocument(() => {
      throw new Error(`private serializer payload: ${scene}`);
    });
    await expect(flushDesktopDocument()).resolves.toBeUndefined();
    persistDesktopDocument("");
    await expect(flushDesktopDocument()).resolves.toBeUndefined();
    expect(nativeInvoke).not.toHaveBeenCalled();
    expect(log.mock.calls).toEqual([
      ["Failed to persist desktop document."],
      ["Failed to persist desktop document."],
    ]);
    persistDesktopDocument(() => scene);
    await flushDesktopDocument();
    expect(nativeInvoke).toHaveBeenCalledOnce();
  });
});
