import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render } from "@excalidraw/excalidraw/tests/test-utils";
import { syncInvalidIndices } from "@excalidraw/element";

import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";
import { LocalData } from "../data/LocalData";

vi.mock(
  "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState")
    >()),
    openConfirmModal: vi.fn().mockResolvedValue(true),
  }),
);

vi.mock("../data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../data")>()),
  importFromBackend: vi.fn().mockResolvedValue({ elements: [], appState: {} }),
}));

describe("opening links with locally deleted content", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(LocalData.fileStorage, "saveFiles").mockResolvedValue({
      savedFiles: new Map(),
      erroredFiles: new Map(),
    });
    vi.mocked(openConfirmModal).mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      await LocalData.flushSave();
    });
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    "/#json=scene,key",
    "/?id=scene",
    "/#url=https%3A%2F%2Fexample.test%2Fscene.excalidraw",
  ])(
    "does not prompt for an all-deleted stored scene when opening %s",
    async (url) => {
      const elements = syncInvalidIndices([
        API.createElement({
          type: "rectangle",
          id: "deleted",
          isDeleted: true,
        }),
      ]);
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
        JSON.stringify(elements),
      );
      window.history.replaceState({}, "", url);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          blob: async () =>
            new Blob(
              [
                JSON.stringify({
                  type: "excalidraw",
                  version: 2,
                  elements: [],
                  appState: {},
                }),
              ],
              { type: "application/json" },
            ),
        }),
      );

      await render(<ExcalidrawApp />);

      expect(openConfirmModal).not.toHaveBeenCalled();
    },
  );

  it("still prompts before replacing a drawing with visible content", async () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(
        syncInvalidIndices([
          API.createElement({ type: "rectangle", id: "visible" }),
        ]),
      ),
    );
    window.history.replaceState({}, "", "/#json=scene,key");

    await render(<ExcalidrawApp />);

    expect(openConfirmModal).toHaveBeenCalledTimes(1);
  });
});
