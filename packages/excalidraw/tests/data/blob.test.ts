import { vi } from "vitest";

import { loadSceneOrLibraryFromBlob } from "../../data/blob";
import * as restoreModule from "../../data/restore";

const sceneBlob = (elements: unknown[] = []) =>
  new Blob(
    [
      JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "test",
        elements,
        appState: {},
      }),
    ],
    { type: "application/json" },
  ) as Blob & { handle?: unknown };

describe("loadSceneOrLibraryFromBlob", () => {
  // Every failure in here was collapsed into "Error: invalid file" with the
  // original discarded and nothing logged, which is why import failures are
  // undiagnosable from a bug report — see #8444.
  it("preserves the underlying error as `cause` when restore throws", async () => {
    const underlying = new TypeError("points is null");
    const spy = vi
      .spyOn(restoreModule, "restoreElements")
      .mockImplementation(() => {
        throw underlying;
      });

    try {
      await expect(
        loadSceneOrLibraryFromBlob(
          sceneBlob([{ type: "rectangle" }]),
          null,
          null,
        ),
      ).rejects.toMatchObject({
        message: "Error: invalid file",
        cause: underlying,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("still rejects with the same message for genuinely unrecognized data", async () => {
    const notAScene = new Blob([JSON.stringify({ hello: "world" })], {
      type: "application/json",
    }) as Blob;

    await expect(
      loadSceneOrLibraryFromBlob(notAScene as any, null, null),
    ).rejects.toThrow("Error: invalid file");
  });
});
