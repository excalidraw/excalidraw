import { fireEvent, render, waitFor } from "./test-utils";
import { queryByTestId } from "@testing-library/react";

import ExcalidrawApp from "../excalidraw-app";
import { API } from "./helpers/api";
import { MIME_TYPES } from "../constants";
import { LibraryItem, LibraryItems } from "../types";
import { UI } from "./helpers/ui";
import { serializeLibraryAsJSON } from "../data/json";
import { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { ExcalidrawGenericElement } from "../element/types";
import { getCommonBoundingBox } from "../element/bounds";
import { parseLibraryJSON } from "../data/blob";

const { h } = window;

const libraryJSONPromise = API.readFile(
  "./fixtures/fixture_library.excalidrawlib",
  "utf8",
);

const mockLibraryFilePromise = new Promise<Blob>(async (resolve, reject) => {
  try {
    resolve(
      new Blob([await libraryJSONPromise], { type: MIME_TYPES.excalidrawlib }),
    );
  } catch (error) {
    reject(error);
  }
});

jest.mock("../data/filesystem.ts", () => ({
  __esmodule: true,
  ...jest.requireActual("../data/filesystem.ts"),
  fileOpen: jest.fn(() => mockLibraryFilePromise),
}));

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
    const libraryItems = parseLibraryJSON(await libraryJSONPromise);
    await API.drop(
      new Blob([serializeLibraryAsJSON(libraryItems)], {
        type: MIME_TYPES.excalidrawlib,
      }),
    );
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A_copy" })]);
    });
  });

  it("should regenerate ids but retain bindings on library insert", async () => {
    const rectangle = API.createElement({
      id: "rectangle1",
      type: "rectangle",
      boundElements: [
        { type: "text", id: "text1" },
        { type: "arrow", id: "arrow1" },
      ],
    });
    const text = API.createElement({
      id: "text1",
      type: "text",
      text: "ola",
      containerId: "rectangle1",
    });
    const arrow = API.createElement({
      id: "arrow1",
      type: "arrow",
      endBinding: { elementId: "rectangle1", focus: -1, gap: 0 },
    });

    await API.drop(
      new Blob(
        [
          serializeLibraryAsJSON([
            {
              id: "item1",
              status: "published",
              elements: [rectangle, text, arrow],
              created: 1,
            },
          ]),
        ],
        {
          type: MIME_TYPES.excalidrawlib,
        },
      ),
    );

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: "rectangle1_copy",
          boundElements: expect.arrayContaining([
            { type: "text", id: "text1_copy" },
            { type: "arrow", id: "arrow1_copy" },
          ]),
        }),
        expect.objectContaining({
          id: "text1_copy",
          containerId: "rectangle1_copy",
        }),
        expect.objectContaining({
          id: "arrow1_copy",
          endBinding: expect.objectContaining({ elementId: "rectangle1_copy" }),
        }),
      ]);
    });
  });

  it("should fix duplicate ids between items on insert", async () => {
    // note, we're not testing for duplicate group ids and such because
    // deduplication of that happens upstream in the library component
    // which would be very hard to orchestrate in this test

    const elem1 = API.createElement({
      id: "elem1",
      type: "rectangle",
    });
    const item1: LibraryItem = {
      id: "item1",
      status: "published",
      elements: [elem1],
      created: 1,
    };

    await API.drop(
      new Blob([serializeLibraryAsJSON([item1, item1])], {
        type: MIME_TYPES.excalidrawlib,
      }),
    );

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          id: "elem1_copy",
        }),
        expect.objectContaining({
          id: expect.not.stringMatching(/^(elem1_copy|elem1)$/),
        }),
      ]);
    });
  });

  it("inserting library item should revert to selection tool", async () => {
    UI.clickTool("rectangle");
    expect(h.elements).toEqual([]);
    const libraryItems = parseLibraryJSON(await libraryJSONPromise);
    await API.drop(
      new Blob([serializeLibraryAsJSON(libraryItems)], {
        type: MIME_TYPES.excalidrawlib,
      }),
    );
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ id: "A_copy" })]);
    });
    expect(h.state.activeTool.type).toBe("selection");
  });
});

describe("library menu", () => {
  it("should load library from file picker", async () => {
    const { container } = await render(<ExcalidrawApp />);

    const latestLibrary = await h.app.library.getLatestLibrary();
    expect(latestLibrary.length).toBe(0);

    const libraryButton = container.querySelector(".sidebar-trigger");

    fireEvent.click(libraryButton!);
    fireEvent.click(
      queryByTestId(
        container.querySelector(".layer-ui__library")!,
        "dropdown-menu-button",
      )!,
    );
    queryByTestId(container, "lib-dropdown--load")!.click();

    const libraryItems = parseLibraryJSON(await libraryJSONPromise);

    await waitFor(async () => {
      const latestLibrary = await h.app.library.getLatestLibrary();
      expect(latestLibrary.length).toBeGreaterThan(0);
      expect(latestLibrary.length).toBe(libraryItems.length);
      expect(latestLibrary[0].elements).toEqual(libraryItems[0].elements);
    });

    expect(true).toBe(true);
  });
});

describe("distributeLibraryItemsOnSquareGrid()", () => {
  it("should distribute items on a grid", async () => {
    const createLibraryItem = (
      elements: ExcalidrawGenericElement[],
    ): LibraryItem => {
      return {
        id: `id-${Date.now()}`,
        elements,
        status: "unpublished",
        created: Date.now(),
      };
    };

    const PADDING = 50;

    const el1 = API.createElement({
      id: "id1",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });

    const el2 = API.createElement({
      id: "id2",
      width: 100,
      height: 80,
      x: -100,
      y: -50,
    });

    const el3 = API.createElement({
      id: "id3",
      width: 40,
      height: 50,
      x: -100,
      y: -50,
    });

    const el4 = API.createElement({
      id: "id4",
      width: 50,
      height: 50,
      x: 0,
      y: 0,
    });

    const el5 = API.createElement({
      id: "id5",
      width: 70,
      height: 100,
      x: 40,
      y: 0,
    });

    const libraryItems: LibraryItems = [
      createLibraryItem([el1]),
      createLibraryItem([el2]),
      createLibraryItem([el3]),
      createLibraryItem([el4, el5]),
    ];

    const distributed = distributeLibraryItemsOnSquareGrid(libraryItems);
    // assert the returned library items are flattened to elements
    expect(distributed.length).toEqual(
      libraryItems.map((x) => x.elements).flat().length,
    );
    expect(distributed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: el1.id,
          x: 0,
          y: 0,
        }),
        expect.objectContaining({
          id: el2.id,
          x:
            el1.width +
            PADDING +
            (getCommonBoundingBox([el4, el5]).width - el2.width) / 2,
          y: Math.abs(el1.height - el2.height) / 2,
        }),
        expect.objectContaining({
          id: el3.id,
          x: Math.abs(el1.width - el3.width) / 2,
          y:
            Math.max(el1.height, el2.height) +
            PADDING +
            Math.abs(el3.height - Math.max(el4.height, el5.height)) / 2,
        }),
        expect.objectContaining({
          id: el4.id,
          x: Math.max(el1.width, el2.width) + PADDING,
          y: Math.max(el1.height, el2.height) + PADDING,
        }),
        expect.objectContaining({
          id: el5.id,
          x: Math.max(el1.width, el2.width) + PADDING + Math.abs(el5.x - el4.x),
          y:
            Math.max(el1.height, el2.height) +
            PADDING +
            Math.abs(el5.y - el4.y),
        }),
      ]),
    );
  });
});
