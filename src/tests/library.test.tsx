import { render, waitFor } from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import { API } from "./helpers/api";
import { MIME_TYPES } from "../constants";
import { LibraryItem } from "../types";
import { UI } from "./helpers/ui";

const { h } = window;

describe("library", () => {
  beforeEach(async () => {
    await render(<ExcalidrawApp />);
    h.app.library.resetLibrary();
  });

  it("import library via drag&drop", async () => {
    expect(await h.app.library.getLatestLibrary()).toEqual([]);
    await API.drop(
      await API.loadFile("./fixtures/fixture_library.excalidrawlib"),
    );
    await waitFor(async () => {
      expect(await h.app.library.getLatestLibrary()).toEqual([
        {
          status: "unpublished",
          elements: [expect.objectContaining({ id: "A" })],
          id: "id0",
          created: expect.any(Number),
        },
      ]);
    });
  });

  // NOTE: mocked to test logic, not actual drag&drop via UI
  it("drop library item onto canvas", async () => {
    expect(h.elements).toEqual([]);
    const libraryItems: LibraryItem = JSON.parse(
      await API.readFile("./fixtures/fixture_library.excalidrawlib", "utf8"),
    ).library[0];
    await API.drop(
      new Blob([JSON.stringify(libraryItems)], {
        type: MIME_TYPES.excalidrawlib,
      }),
    );
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A_copy" })]);
    });
  });

  it("inserting library item should revert to selection tool", async () => {
    UI.clickTool("rectangle");
    expect(h.elements).toEqual([]);
    const libraryItems: LibraryItem = JSON.parse(
      await API.readFile("./fixtures/fixture_library.excalidrawlib", "utf8"),
    ).library[0];
    await API.drop(
      new Blob([JSON.stringify(libraryItems)], {
        type: MIME_TYPES.excalidrawlib,
      }),
    );
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A_copy" })]);
    });
    expect(h.state.activeTool.type).toBe("selection");
  });
});
