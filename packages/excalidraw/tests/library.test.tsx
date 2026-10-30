import { act, queryByTestId } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

import { KEYS, MIME_TYPES, ORIG_ID } from "@excalidraw/common";

import { getCommonBoundingBox } from "@excalidraw/element";

import type {
  ExcalidrawGenericElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { loadLibraryFromBlob, parseLibraryJSON } from "../data/blob";
import { serializeLibraryAsJSON } from "../data/json";
import { fileOpen } from "../data/filesystem";
import {
  distributeLibraryItemsOnSquareGrid,
  loadLibraryFromBlobs,
  mergeLibraryItems,
} from "../data/library";
import { t } from "../i18n";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

import type { LibraryItem, LibraryItems } from "../types";

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

vi.mock("../data/filesystem.ts", async (importOriginal) => {
  const module = await importOriginal();
  return {
    __esmodule: true,
    //@ts-ignore
    ...module,
    // the library file picker allows selecting multiple files
    fileOpen: vi.fn(async () => [await mockLibraryFilePromise]),
  };
});

const createLibraryItem = (
  id: string,
  status?: LibraryItem["status"],
): LibraryItem => ({
  id,
  status: status!,
  created: 1,
  elements: [
    {
      ...API.createElement({ id: `${id}-element`, type: "rectangle" }),
      // like in saved library files (restore regenerates a missing one)
      versionNonce: 1,
    },
  ],
});

const createLibraryFile = (name: string, libraryItems: LibraryItem[]) =>
  new File([serializeLibraryAsJSON(libraryItems)], `${name}.excalidrawlib`, {
    type: MIME_TYPES.excalidrawlib,
  });

const getLibraryItemIds = async () =>
  (await h.app.library.getLatestLibrary()).map((item) => item.id);

describe("library items inserting", () => {
  beforeEach(async () => {
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
      endBinding: {
        elementId: "rectangle1",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });

    const libraryItems: LibraryItems = [
      {
        id: "libraryItem_id0",
        status: "unpublished",
        elements: [rectangle, text, arrow],
        created: 0,
        name: "test",
      },
    ];

    await render(<Excalidraw initialData={{ libraryItems }} />);
  });

  afterEach(async () => {
    await act(() => {
      return h.app.library.resetLibrary();
    });
  });

  it("should regenerate ids but retain bindings on library insert", async () => {
    const libraryItems = await h.app.library.getLatestLibrary();

    expect(libraryItems.length).toBe(1);

    await API.drop([
      {
        kind: "string",
        value: JSON.stringify({
          itemIds: [libraryItems[0].id],
        }),
        type: MIME_TYPES.excalidrawlibIds,
      },
    ]);

    await waitFor(() => {
      const rectangle = h.elements.find((e) => e.type === "rectangle")!;
      const text = h.elements.find((e) => e.type === "text")!;
      const arrow = h.elements.find((e) => e.type === "arrow")!;
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "rectangle",
            id: expect.not.stringMatching("rectangle1"),
            boundElements: expect.arrayContaining([
              { type: "text", id: text.id },
              { type: "arrow", id: arrow.id },
            ]),
          }),
          expect.objectContaining({
            type: "text",
            id: expect.not.stringMatching("text1"),
            containerId: rectangle.id,
          }),
          expect.objectContaining({
            type: "arrow",
            id: expect.not.stringMatching("arrow1"),
            endBinding: expect.objectContaining({
              elementId: rectangle.id,
            }),
          }),
        ]),
      );
    });
  });
});

describe("library", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    await act(() => {
      return h.app.library.resetLibrary();
    });
  });

  it("import library via drag&drop", async () => {
    expect(await h.app.library.getLatestLibrary()).toEqual([]);
    await API.drop([
      {
        kind: "file",
        type: MIME_TYPES.excalidrawlib,
        file: await API.loadFile("./fixtures/fixture_library.excalidrawlib"),
      },
    ]);
    await waitFor(async () => {
      expect(await h.app.library.getLatestLibrary()).toEqual([
        {
          status: "unpublished",
          elements: [expect.objectContaining({ id: "A" })],
          id: expect.any(String),
          created: expect.any(Number),
        },
      ]);
    });
  });

  it("import multiple libraries via drag&drop", async () => {
    await API.drop([
      {
        kind: "file",
        file: createLibraryFile("arrows", [createLibraryItem("arrow")]),
      },
      {
        kind: "file",
        file: createLibraryFile("icons", [
          createLibraryItem("icon1"),
          createLibraryItem("icon2"),
        ]),
      },
    ]);

    await waitFor(async () => {
      expect(await getLibraryItemIds()).toEqual(["icon1", "icon2", "arrow"]);
    });
    expect(h.state.openSidebar?.name).toBe("default");
    expect(h.elements).toEqual([]);
  });

  it("import multiple libraries via drag&drop keeps the existing items", async () => {
    await h.app.library.setLibrary([createLibraryItem("existing")]);

    await API.drop([
      { kind: "file", file: createLibraryFile("a", [createLibraryItem("a")]) },
      { kind: "file", file: createLibraryFile("b", [createLibraryItem("b")]) },
    ]);

    await waitFor(async () => {
      expect(await getLibraryItemIds()).toEqual(["b", "a", "existing"]);
    });
  });

  it("shows an error and imports nothing if one of the dropped libraries is invalid", async () => {
    await API.drop([
      { kind: "file", file: createLibraryFile("a", [createLibraryItem("a")]) },
      {
        kind: "file",
        file: new File(["not a library"], "broken.excalidrawlib", {
          type: MIME_TYPES.excalidrawlib,
        }),
      },
    ]);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(t("errors.importLibraryError"));
    });
    expect(await getLibraryItemIds()).toEqual([]);
  });

  // NOTE: mocked to test logic, not actual drag&drop via UI
  it("drop library item onto canvas", async () => {
    expect(h.elements).toEqual([]);
    const libraryItems = parseLibraryJSON(await libraryJSONPromise);
    await API.drop([
      {
        kind: "string",
        value: serializeLibraryAsJSON(libraryItems),
        type: MIME_TYPES.excalidrawlib,
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ [ORIG_ID]: "A" })]);
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

    await API.drop([
      {
        kind: "string",
        value: serializeLibraryAsJSON([item1, item1]),
        type: MIME_TYPES.excalidrawlib,
      },
    ]);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          [ORIG_ID]: "elem1",
        }),
        expect.objectContaining({
          id: expect.not.stringMatching(/^elem1$/),
          [ORIG_ID]: expect.not.stringMatching(/^\w+$/),
        }),
      ]);
    });
  });

  it("inserting library item should revert to selection tool", async () => {
    UI.clickTool("rectangle");
    expect(h.elements).toEqual([]);
    const libraryItems = parseLibraryJSON(await libraryJSONPromise);
    await API.drop([
      {
        kind: "string",
        value: serializeLibraryAsJSON(libraryItems),
        type: MIME_TYPES.excalidrawlib,
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ [ORIG_ID]: "A" })]);
    });
    // this has a high flake
    // expect(h.state.activeTool.type).toBe("selection");
  });
});

describe("library menu", () => {
  it("should load library from file picker", async () => {
    const { container } = await render(<Excalidraw />);

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
    fireEvent.click(queryByTestId(container, "lib-dropdown--load")!);

    const libraryItems = parseLibraryJSON(await libraryJSONPromise);

    await waitFor(async () => {
      const latestLibrary = await h.app.library.getLatestLibrary();
      expect(latestLibrary.length).toBeGreaterThan(0);
      expect(latestLibrary.length).toBe(libraryItems.length);
      const { versionNonce, ...strippedElement } = libraryItems[0]?.elements[0]; // stripped due to mutations
      expect(latestLibrary[0].elements).toEqual([
        expect.objectContaining(strippedElement),
      ]);
    });
  });
});

describe("library menu: importing multiple files", () => {
  const openLibraryFilePicker = async () => {
    const { container } = await render(<Excalidraw />);
    fireEvent.click(container.querySelector(".sidebar-trigger")!);
    fireEvent.click(
      queryByTestId(
        container.querySelector(".layer-ui__library")!,
        "dropdown-menu-button",
      )!,
    );
    fireEvent.click(queryByTestId(container, "lib-dropdown--load")!);
  };

  it("should let the user select multiple library files", async () => {
    await openLibraryFilePicker();

    expect(fileOpen).toHaveBeenLastCalledWith(
      expect.objectContaining({ multiple: true }),
    );
  });

  it("should load all library files selected in the file picker", async () => {
    vi.mocked(fileOpen).mockResolvedValueOnce([
      createLibraryFile("arrows", [createLibraryItem("arrow")]),
      createLibraryFile("icons", [
        createLibraryItem("icon1"),
        createLibraryItem("icon2"),
      ]),
    ]);

    await openLibraryFilePicker();

    await waitFor(async () => {
      expect(await getLibraryItemIds()).toEqual(["icon1", "icon2", "arrow"]);
    });
  });
});

describe("library menu Escape (undocked sidebar)", () => {
  const openLibraryWithItems = async () => {
    const { container } = await render(<Excalidraw />);
    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: ["wall", "door"].map((name) => ({
          id: name,
          name,
          status: "unpublished",
          created: 1,
          elements: [API.createElement({ type: "rectangle", id: name })],
        })),
        openLibraryMenu: true,
      }),
    );
    const searchInput = await waitFor(() => {
      const input = container.querySelector<HTMLInputElement>(
        ".library-menu-items-container__search input",
      );
      expect(input).not.toBeNull();
      return input!;
    });
    expect(h.state.openSidebar).not.toBe(null);
    return { container, searchInput };
  };

  it("should clear an active search instead of closing the sidebar", async () => {
    const { searchInput } = await openLibraryWithItems();

    fireEvent.change(searchInput, { target: { value: "wall" } });
    expect(searchInput.value).toBe("wall");

    fireEvent.keyDown(searchInput, { key: KEYS.ESCAPE });
    expect(h.state.openSidebar).not.toBe(null);
    expect(searchInput.value).toBe("");

    // with the search cleared, Escape closes the sidebar
    fireEvent.keyDown(searchInput, { key: KEYS.ESCAPE });
    expect(h.state.openSidebar).toBe(null);
  });

  it("should clear the item selection instead of closing the sidebar", async () => {
    const { container, searchInput } = await openLibraryWithItems();

    const itemDragger = await waitFor(() => {
      const dragger = container.querySelector(".library-unit__dragger");
      expect(dragger).not.toBeNull();
      return dragger!;
    });
    fireEvent.click(itemDragger, { shiftKey: true });
    await waitFor(() =>
      expect(container.querySelector(".library-unit--selected")).not.toBe(null),
    );

    fireEvent.keyDown(searchInput, { key: KEYS.ESCAPE });
    expect(container.querySelector(".library-unit--selected")).toBe(null);
    expect(h.state.openSidebar).not.toBe(null);
  });
});

describe("distributeLibraryItemsOnSquareGrid()", () => {
  it("should distribute items on a grid", async () => {
    const createLibraryItem = (
      elements: NonDeleted<ExcalidrawGenericElement>[],
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

describe("loadLibraryFromBlobs()", () => {
  it("should load the items of all files, later files first", async () => {
    const libraryItems = await loadLibraryFromBlobs([
      createLibraryFile("a", [
        createLibraryItem("a1"),
        createLibraryItem("a2"),
      ]),
      createLibraryFile("b", [createLibraryItem("b1")]),
    ]);

    expect(libraryItems.map((item) => item.id)).toEqual(["b1", "a1", "a2"]);
  });

  it("should merge files like importing them one after another", async () => {
    const files = [
      createLibraryFile("a", [createLibraryItem("a")]),
      createLibraryFile("b", [createLibraryItem("b")]),
    ];

    const loadedAtOnce = await loadLibraryFromBlobs(files);

    let loadedOneByOne: LibraryItems = [];
    for (const file of files) {
      loadedOneByOne = mergeLibraryItems(
        loadedOneByOne,
        await loadLibraryFromBlob(file),
      );
    }

    const ids = (items: LibraryItems) => items.map((item) => item.id);
    expect(ids(loadedAtOnce)).toEqual(ids(loadedOneByOne));
  });

  it("should return no items for no files", async () => {
    expect(await loadLibraryFromBlobs([])).toEqual([]);
  });

  it("should apply the default status to items without one", async () => {
    const libraryItems = await loadLibraryFromBlobs(
      [
        createLibraryFile("a", [
          createLibraryItem("a"),
          createLibraryItem("b", "unpublished"),
        ]),
      ],
      "published",
    );

    expect(libraryItems.map((item) => item.status)).toEqual([
      "published",
      "unpublished",
    ]);
  });

  it("should reject when one of the files is not a library", async () => {
    await expect(
      loadLibraryFromBlobs([
        createLibraryFile("a", [createLibraryItem("a")]),
        new Blob(["not a library"], { type: MIME_TYPES.excalidrawlib }),
      ]),
    ).rejects.toThrow();
  });
});
