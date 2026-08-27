import { vi } from "vitest";

import { getDefaultAppState } from "../../appState";

import { loadSceneOrLibraryFromBlob } from "../../data/blob";
import * as restoreModule from "../../data/restore";

import type { AppState } from "../../types";

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

  // The end-to-end path, which the restore.test.ts unit tests never traverse:
  // they call `restoreElements` directly. Fixing the raw-element call inside
  // `restoreElements` is not sufficient on its own, because
  // `getScrollToContentState` was handed the *raw* array three lines later and
  // filters it through `isInvisiblySmallElement`, throwing inside the same
  // try/catch. `localAppState` is non-null on the real open/drop path
  // (App.tsx passes `this.state`), so that branch does run in production.
  it("imports a scene containing a malformed element, with localAppState set", async () => {
    const localAppState = {
      ...getDefaultAppState(),
      width: 800,
      height: 600,
      offsetLeft: 0,
      offsetTop: 0,
    } as AppState;

    const result: any = await loadSceneOrLibraryFromBlob(
      sceneBlob([
        {
          type: "freedraw",
          id: "broken",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          points: null,
          version: 1,
          versionNonce: 1,
          seed: 1,
          isDeleted: false,
        },
        {
          type: "rectangle",
          id: "keep-me",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          version: 1,
          versionNonce: 1,
          seed: 1,
          isDeleted: false,
        },
      ]),
      localAppState,
      null,
    );

    expect(result.data.elements.map((element: any) => element.id)).toContain(
      "keep-me",
    );
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
