import { render, waitFor } from "@testing-library/react";

import { syncInvalidIndices } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type {
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

import { ExcalidrawPlusIframeExport } from "../ExcalidrawPlusIframeExport";
import { STORAGE_KEYS } from "../app_constants";
import { LocalData } from "../data/LocalData";

const plusOrigin = vi.hoisted(() => {
  const origin = "https://plus.excalidraw.com";
  vi.stubEnv("VITE_APP_PLUS_APP", origin);
  return origin;
});

describe("ExcalidrawPlusIframeExport", () => {
  const appState = { viewBackgroundColor: "#abcdef" };

  beforeEach(() => {
    vi.stubEnv("VITE_APP_PLUS_EXPORT_PUBLIC_KEY", "dGVzdA==");
    vi.stubGlobal("crypto", {
      subtle: {
        importKey: vi.fn().mockResolvedValue({}),
        verify: vi.fn().mockResolvedValue(true),
      },
    });
    vi.spyOn(LocalData.fileStorage, "getFiles").mockResolvedValue({
      loadedFiles: [],
      erroredFiles: new Map(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const requestScene = async (elements: OrderedExcalidrawElement[]) => {
    const { container, rerender } = render(<></>);
    const ownerWindow = container.ownerDocument.defaultView!;
    const postMessage = vi.spyOn(ownerWindow, "postMessage").mockReturnValue();
    ownerWindow.localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(elements),
    );
    ownerWindow.localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(appState),
    );
    rerender(<ExcalidrawPlusIframeExport />);
    postMessage.mockClear();

    ownerWindow.dispatchEvent(
      new ownerWindow.MessageEvent("message", {
        origin: plusOrigin,
        data: { type: "REQUEST_SCENE", jwt: "e30.e30.dGVzdA" },
        source: ownerWindow,
      }),
    );

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    expect(postMessage.mock.calls[0][1]).toEqual({
      targetOrigin: plusOrigin,
    });
    return postMessage.mock.calls[0][0];
  };

  it.each(["empty", "all-deleted"])(
    "rejects an %s scene without loading files",
    async (scene) => {
      const elements =
        scene === "empty"
          ? []
          : syncInvalidIndices([
              API.createElement({ type: "rectangle", isDeleted: true }),
              API.createElement({
                type: "image",
                isDeleted: true,
                fileId: "deleted-file",
              }),
            ]);

      expect(await requestScene(elements)).toEqual({
        type: "ERROR",
        message: "Scene is empty, nothing to export.",
      });
      expect(LocalData.fileStorage.getFiles).not.toHaveBeenCalled();
    },
  );

  it("exports only live elements from a mixed scene in their original order", async () => {
    const [first, deleted, last] = syncInvalidIndices([
      API.createElement({ type: "rectangle" }),
      API.createElement({ type: "rectangle", isDeleted: true }),
      API.createElement({ type: "ellipse" }),
    ]);

    expect(await requestScene([first, deleted, last])).toEqual({
      type: "SCENE_DATA",
      elements: [first, last],
      appState,
      files: { loadedFiles: [], erroredFiles: new Map() },
    });
    expect(LocalData.fileStorage.getFiles).toHaveBeenCalledWith([]);
  });

  it("loads only files referenced by live initialized images", async () => {
    const liveFile: BinaryFileData = {
      id: "live-file" as FileId,
      dataURL: "data:image/png;base64,dGVzdA==" as DataURL,
      mimeType: "image/png",
      created: 1,
    };
    const missingFileId = "missing-file" as FileId;
    const files = {
      loadedFiles: [liveFile],
      erroredFiles: new Map([[missingFileId, true as const]]),
    };
    vi.mocked(LocalData.fileStorage.getFiles).mockResolvedValue(files);
    const [deleted, live, uninitialized, missing, rectangle] =
      syncInvalidIndices([
        API.createElement({
          type: "image",
          fileId: "deleted-file",
          isDeleted: true,
        }),
        API.createElement({ type: "image", fileId: liveFile.id }),
        API.createElement({ type: "image" }),
        API.createElement({ type: "image", fileId: missingFileId }),
        API.createElement({ type: "rectangle" }),
      ]);

    expect(
      await requestScene([deleted, live, uninitialized, missing, rectangle]),
    ).toEqual({
      type: "SCENE_DATA",
      elements: [live, uninitialized, missing, rectangle],
      appState,
      files,
    });
    expect(LocalData.fileStorage.getFiles).toHaveBeenCalledTimes(1);
    expect(LocalData.fileStorage.getFiles).toHaveBeenCalledWith([
      liveFile.id,
      missingFileId,
    ]);
  });
});
