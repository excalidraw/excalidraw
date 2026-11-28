import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  newElementWith,
} from "@excalidraw/excalidraw";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { createCanvasTools } from "./tools";

const createRectangle = (id: string, x: number) =>
  convertToExcalidrawElements(
    [
      {
        id,
        type: "rectangle",
        x,
        y: 20,
        width: 100,
        height: 60,
      },
    ],
    { regenerateIds: false },
  )[0];

const createHarness = () => {
  let elements: ExcalidrawElement[] = [
    createRectangle("visible-a", 10),
    createRectangle("visible-b", 160),
    newElementWith(createRectangle("deleted", 320) as ExcalidrawElement, {
      isDeleted: true,
    }),
  ];
  let selectedElementIds: AppState["selectedElementIds"] = {
    "visible-b": true,
  };
  const capturedUpdates: unknown[] = [];
  const viewportUpdates: unknown[] = [];

  const api = {
    isDestroyed: false,
    getSceneElements: () => elements.filter((element) => !element.isDeleted),
    getSceneElementsIncludingDeleted: () => elements,
    getAppState: () => ({ selectedElementIds } as AppState),
    updateScene: ({
      elements: nextElements,
      appState,
      captureUpdate,
    }: {
      elements?: readonly ExcalidrawElement[];
      appState?: Partial<AppState>;
      captureUpdate?: unknown;
    }) => {
      if (nextElements) {
        elements = [...nextElements];
      }
      if (appState?.selectedElementIds) {
        selectedElementIds = appState.selectedElementIds;
      }
      capturedUpdates.push(captureUpdate);
    },
    setViewport: (options: unknown) => {
      viewportUpdates.push(options);
    },
  } as unknown as ExcalidrawImperativeAPI;

  return {
    api,
    getElements: () => elements,
    getCapturedUpdates: () => capturedUpdates,
    getViewportUpdates: () => viewportUpdates,
    humanMove: (id: string, x: number) => {
      elements = elements.map((element) =>
        element.id === id ? newElementWith(element, { x }) : element,
      );
    },
    select: (ids: string[]) => {
      selectedElementIds = Object.fromEntries(ids.map((id) => [id, true]));
    },
  };
};

const getTool = (
  api: ExcalidrawImperativeAPI,
  name:
    | "read_canvas"
    | "add_elements"
    | "update_elements"
    | "delete_elements"
    | "fit_to_content",
) => {
  const tool = createCanvasTools(api).find(
    (candidate) => candidate.name === name,
  );
  if (!tool) {
    throw new Error(`Missing WebMCP tool: ${name}`);
  }
  return tool;
};

describe("WebMCP canvas tools", () => {
  it("reads only live elements in stable revision-bound pages", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");

    const first = (await readCanvas.execute({ limit: 1 })) as Record<
      string,
      unknown
    >;

    expect(first).toMatchObject({
      ok: true,
      element_count: 2,
      selected_ids: ["visible-b"],
      elements: [expect.objectContaining({ id: "visible-a" })],
      truncated: true,
      next_cursor: expect.any(String),
      revision: expect.any(String),
    });
    expect(JSON.stringify(first)).not.toContain("deleted");

    const second = await readCanvas.execute({
      limit: 1,
      cursor: first.next_cursor,
    });
    expect(second).toMatchObject({
      ok: true,
      elements: [expect.objectContaining({ id: "visible-b" })],
      truncated: false,
    });
  });

  it("rejects a pagination cursor after a human canvas change", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const first = (await readCanvas.execute({ limit: 1 })) as Record<
      string,
      unknown
    >;

    harness.humanMove("visible-a", 50);

    expect(
      await readCanvas.execute({ limit: 1, cursor: first.next_cursor }),
    ).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
      current_revision: expect.any(String),
    });
  });

  it("rejects a pagination cursor past the end of the current canvas", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const first = (await readCanvas.execute({})) as { revision: string };

    expect(
      await readCanvas.execute({ cursor: `${first.revision}:999` }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("adds elements as one immediate history update", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const addElements = getTool(harness.api, "add_elements");
    const read = (await readCanvas.execute({})) as { revision: string };
    const skeleton: ExcalidrawElementSkeleton = {
      id: "added",
      type: "rectangle",
      x: 400,
      y: 20,
      width: 100,
      height: 60,
    };

    const result = await addElements.execute({
      expected_revision: read.revision,
      elements: [skeleton],
    });

    expect(result).toMatchObject({
      ok: true,
      affected_ids: ["added"],
      revision: expect.any(String),
    });
    expect(harness.getElements().some(({ id }) => id === "added")).toBe(true);
    expect(harness.getCapturedUpdates()).toEqual([
      CaptureUpdateAction.IMMEDIATELY,
    ]);
  });

  it("rejects unknown add properties and IDs reserved by deleted elements", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const addElements = getTool(harness.api, "add_elements");
    const read = (await readCanvas.execute({})) as { revision: string };

    expect(
      await addElements.execute({
        expected_revision: read.revision,
        elements: [
          {
            id: "unsafe",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            link: "https://example.com",
          },
        ],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });

    expect(
      await addElements.execute({
        expected_revision: read.revision,
        elements: [
          {
            id: "invalid-text",
            type: "text",
            x: 0,
            y: 0,
            text: "Too large",
            fontSize: 1_000,
          },
        ],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });

    expect(
      await addElements.execute({
        expected_revision: read.revision,
        elements: [
          {
            id: "invalid-label",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            label: { text: "Label", link: "https://example.com" },
          },
        ],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });

    expect(
      await addElements.execute({
        expected_revision: read.revision,
        elements: [
          {
            id: "deleted",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          },
        ],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(harness.getCapturedUpdates()).toEqual([]);
  });

  it("honors a canceled write before changing the canvas", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const addElements = getTool(harness.api, "add_elements");
    const read = (await readCanvas.execute({})) as { revision: string };
    const controller = new AbortController();
    controller.abort();

    expect(
      await addElements.execute(
        {
          expected_revision: read.revision,
          elements: [
            {
              id: "canceled",
              type: "rectangle",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
            },
          ],
        },
        { signal: controller.signal },
      ),
    ).toMatchObject({ ok: false, code: "CANCELED" });
    expect(harness.getElements().some(({ id }) => id === "canceled")).toBe(
      false,
    );
    expect(harness.getCapturedUpdates()).toEqual([]);
  });

  it("rejects an element update based on a stale canvas revision", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const updateElements = getTool(harness.api, "update_elements");
    const read = (await readCanvas.execute({})) as { revision: string };

    harness.humanMove("visible-a", 80);

    expect(
      await updateElements.execute({
        expected_revision: read.revision,
        patches: [{ id: "visible-a", changes: { x: 200 } }],
      }),
    ).toMatchObject({
      ok: false,
      code: "STALE_REVISION",
      current_revision: expect.any(String),
    });
    expect(harness.getElements().find(({ id }) => id === "visible-a")?.x).toBe(
      80,
    );
    expect(harness.getCapturedUpdates()).toEqual([]);
  });

  it("rejects invalid update values and incompatible geometry", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const updateElements = getTool(harness.api, "update_elements");
    const read = (await readCanvas.execute({})) as { revision: string };

    expect(
      await updateElements.execute({
        expected_revision: read.revision,
        patches: [{ id: "visible-a", changes: { width: -1 } }],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      await updateElements.execute({
        expected_revision: read.revision,
        patches: [{ id: "visible-a", changes: { x: "bad" } }],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(harness.getCapturedUpdates()).toEqual([]);
  });

  it("updates and deletes elements through versioned immediate history updates", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const updateElements = getTool(harness.api, "update_elements");
    const deleteElements = getTool(harness.api, "delete_elements");
    const before = harness.getElements().find(({ id }) => id === "visible-a")!;
    const firstRead = (await readCanvas.execute({})) as { revision: string };

    const updated = (await updateElements.execute({
      expected_revision: firstRead.revision,
      patches: [{ id: "visible-a", changes: { x: 240 } }],
    })) as { revision: string };

    const afterUpdate = harness
      .getElements()
      .find(({ id }) => id === "visible-a")!;
    expect(afterUpdate).toMatchObject({ x: 240, isDeleted: false });
    expect(afterUpdate.version).toBeGreaterThan(before.version);

    const deleted = await deleteElements.execute({
      expected_revision: updated.revision,
      ids: ["visible-a"],
    });

    expect(deleted).toMatchObject({
      ok: true,
      affected_ids: ["visible-a"],
    });
    expect(
      harness.getElements().find(({ id }) => id === "visible-a")?.isDeleted,
    ).toBe(true);
    expect(harness.getCapturedUpdates()).toEqual([
      CaptureUpdateAction.IMMEDIATELY,
      CaptureUpdateAction.IMMEDIATELY,
    ]);
  });

  it("deletes a container label together with its container", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const addElements = getTool(harness.api, "add_elements");
    const deleteElements = getTool(harness.api, "delete_elements");
    const read = (await readCanvas.execute({})) as { revision: string };

    const added = (await addElements.execute({
      expected_revision: read.revision,
      elements: [
        {
          id: "labeled",
          type: "rectangle",
          x: 400,
          y: 20,
          width: 100,
          height: 60,
          label: { text: "Bound label" },
        },
      ],
    })) as { revision: string; affected_ids: string[] };
    const container = harness.getElements().find(({ id }) => id === "labeled")!;
    const labelId = container.boundElements?.find(
      (binding) => binding.type === "text",
    )?.id;

    expect(labelId).toEqual(expect.any(String));
    expect(
      await deleteElements.execute({
        expected_revision: added.revision,
        ids: ["labeled"],
      }),
    ).toMatchObject({
      ok: true,
      affected_ids: expect.arrayContaining(["labeled", labelId]),
    });
    expect(
      harness
        .getElements()
        .filter(({ id }) => id === "labeled" || id === labelId)
        .every(({ isDeleted }) => isDeleted),
    ).toBe(true);
  });

  it("removes deleted element IDs from the current selection", async () => {
    const harness = createHarness();
    const readCanvas = getTool(harness.api, "read_canvas");
    const deleteElements = getTool(harness.api, "delete_elements");
    const read = (await readCanvas.execute({})) as { revision: string };

    await deleteElements.execute({
      expected_revision: read.revision,
      ids: ["visible-b"],
    });

    expect(await readCanvas.execute({})).toMatchObject({
      ok: true,
      selected_ids: [],
    });
  });

  it("fits the viewport to the current selection without changing revision", async () => {
    const harness = createHarness();
    harness.select(["visible-b"]);
    const fitToContent = getTool(harness.api, "fit_to_content");

    const result = await fitToContent.execute({
      scope: "selection",
      animate: false,
    });

    expect(result).toMatchObject({
      ok: true,
      focused_ids: ["visible-b"],
      revision: expect.any(String),
    });
    expect(harness.getViewportUpdates()).toEqual([
      expect.objectContaining({
        target: [expect.objectContaining({ id: "visible-b" })],
        fit: "contain",
        animation: false,
      }),
    ]);
    expect(harness.getCapturedUpdates()).toEqual([]);
  });
});
