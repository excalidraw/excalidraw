import { describe, expect, it } from "vitest";

import {
  getBoundTextMaxWidth,
  getCommonBounds,
  isTextElement,
  measureText,
  type ExcalidrawElementSkeleton,
} from "@excalidraw/element";
import { getFontString } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  insertAISkeletons,
  INTERMEDIATE_PREVIEW_ELEMENT_KEY,
} from "./insertAISkeletons";

import type { AppClassProperties, NormalizedZoomValue } from "../types";

const createTestApp = (
  initialElements: ExcalidrawElement[] = [],
  appStateOverrides: Partial<AppClassProperties["state"]> = {},
) => {
  let elements = [...initialElements];
  let lastSync: {
    elements: ExcalidrawElement[];
    appState?: AppClassProperties["state"];
  } | null = null;

  const app = {
    state: {
      width: 1000,
      height: 1000,
      scrollX: 0,
      scrollY: 0,
      offsetLeft: 0,
      offsetTop: 0,
      zoom: { value: 1 },
      selectedElementIds: {},
      ...appStateOverrides,
    } as AppClassProperties["state"],
    scene: {
      getNonDeletedElements: () =>
        elements.filter(
          (element): element is NonDeletedExcalidrawElement =>
            !element.isDeleted,
        ),
      getElementsIncludingDeleted: () => elements,
    } as unknown as AppClassProperties["scene"],
    syncActionResult: ({
      elements: nextElements,
      appState,
    }: {
      elements: ExcalidrawElement[];
      appState?: AppClassProperties["state"];
    }) => {
      elements = nextElements;
      lastSync = { elements: nextElements, appState };
    },
  } as unknown as AppClassProperties;

  return {
    app,
    getElements: () => elements,
    getLastSync: () => lastSync,
  };
};

const getById = <T extends { id: string }>(
  elements: readonly T[],
  id: string,
) => elements.find((element) => element.id === id);

const getInsertedBoundsCenter = (
  inserted: readonly NonDeletedExcalidrawElement[],
) => {
  const [minX, minY, maxX, maxY] = getCommonBounds(inserted);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};

describe("insertAISkeletons", () => {
  it("preserves existing deleted elements when inserting", () => {
    const setup = createTestApp();
    insertAISkeletons(
      setup.app,
      [
        {
          type: "rectangle",
          id: "deleted-rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
      { targetCenter: { x: 0, y: 0 } },
    );
    const deletedElement = {
      ...setup.getElements()[0],
      isDeleted: true,
    } as ExcalidrawElement;

    const { app, getLastSync } = createTestApp([deletedElement]);

    insertAISkeletons(
      app,
      [
        {
          type: "ellipse",
          id: "new-ellipse",
          x: 20,
          y: 20,
          width: 30,
          height: 30,
        },
      ],
      { targetCenter: { x: 0, y: 0 } },
    );

    expect(getLastSync()!.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "deleted-rect", isDeleted: true }),
        expect.objectContaining({ id: "new-ellipse", isDeleted: false }),
      ]),
    );
  });

  it("marks replaced generation elements deleted when inserting", () => {
    const setup = createTestApp();
    insertAISkeletons(
      setup.app,
      [
        {
          type: "rectangle",
          id: "old-rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
      { generationId: "old-generation", targetCenter: { x: 0, y: 0 } },
    );
    const oldElement = setup.getElements()[0];

    const { app, getLastSync } = createTestApp([oldElement]);

    insertAISkeletons(
      app,
      [
        {
          type: "ellipse",
          id: "new-ellipse",
          x: 20,
          y: 20,
          width: 30,
          height: 30,
        },
      ],
      {
        generationId: "new-generation",
        targetCenter: { x: 0, y: 0 },
        deleteGenerationTags: ["old-generation"],
      },
    );

    const synced = getLastSync()!.elements;
    const deletedOldElement = getById(synced, "old-rect")!;
    const newElement = getById(synced, "new-ellipse")!;

    expect(deletedOldElement).toMatchObject({
      id: "old-rect",
      isDeleted: true,
    });
    expect(deletedOldElement.version).toBeGreaterThan(oldElement.version);
    expect(newElement).toMatchObject({
      id: "new-ellipse",
      isDeleted: false,
      customData: expect.objectContaining({
        aiSidebarGenerationId: "new-generation",
      }),
    });
  });

  it("marks intermediate preview elements", () => {
    const { app, getLastSync } = createTestApp();

    insertAISkeletons(
      app,
      [
        {
          type: "rectangle",
          id: "preview-rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
      {
        generationId: "preview-generation",
        targetCenter: { x: 0, y: 0 },
        intermediatePreviewElement: true,
      },
    );

    expect(getLastSync()!.elements[0]).toMatchObject({
      id: "preview-rect",
      customData: expect.objectContaining({
        aiSidebarGenerationId: "preview-generation",
        [INTERMEDIATE_PREVIEW_ELEMENT_KEY]: true,
      }),
    });
  });

  it("replaces existing elements with matching inserted ids", () => {
    const setup = createTestApp();
    insertAISkeletons(
      setup.app,
      [
        {
          type: "rectangle",
          id: "stable-id",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
      { targetCenter: { x: 0, y: 0 } },
    );
    const deletedStableElement = {
      ...setup.getElements()[0],
      isDeleted: true,
    } as ExcalidrawElement;

    const { app, getLastSync } = createTestApp([deletedStableElement]);

    insertAISkeletons(
      app,
      [
        {
          type: "ellipse",
          id: "stable-id",
          x: 20,
          y: 20,
          width: 30,
          height: 30,
        },
      ],
      { targetCenter: { x: 0, y: 0 } },
    );

    const synced = getLastSync()!.elements;
    const matchingElements = synced.filter(
      (element) => element.id === "stable-id",
    );

    expect(matchingElements).toHaveLength(1);
    expect(matchingElements[0]).toMatchObject({
      id: "stable-id",
      type: "ellipse",
      isDeleted: false,
    });
    expect(matchingElements[0].version).toBeGreaterThan(
      deletedStableElement.version,
    );
  });

  it("inserts normal elements and preserves relative offsets", () => {
    const { app } = createTestApp();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "rectangle",
        id: "rect-1",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
      },
      {
        type: "ellipse",
        id: "ell-1",
        x: 200,
        y: 80,
        width: 60,
        height: 40,
      },
      {
        type: "text",
        id: "text-1",
        x: 50,
        y: 30,
        text: "Hello world",
        fontSize: 20,
        fontFamily: 1,
      },
    ];

    const inserted = insertAISkeletons(app, skeletons, {
      targetCenter: { x: 0, y: 0 },
      selectInsertedElements: true,
    });

    const rect = getById(inserted, "rect-1")!;
    const ellipse = getById(inserted, "ell-1")!;
    const text = getById(inserted, "text-1")!;

    const rectSkeleton = skeletons[0];
    const ellipseSkeleton = skeletons[1];
    const textSkeleton = skeletons[2];

    expect(ellipse.x - rect.x).toBeCloseTo(
      ellipseSkeleton.x! - rectSkeleton.x!,
    );
    expect(ellipse.y - rect.y).toBeCloseTo(
      ellipseSkeleton.y! - rectSkeleton.y!,
    );
    expect(text.x - rect.x).toBeCloseTo(textSkeleton.x! - rectSkeleton.x!);
    expect(text.y - rect.y).toBeCloseTo(textSkeleton.y! - rectSkeleton.y!);
  });

  it("repairs bound text elements on insert", () => {
    const { app, getLastSync } = createTestApp();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "rectangle",
        id: "rect-1",
        x: 100,
        y: 100,
        width: 200,
        height: 80,
        boundElements: [{ type: "text", id: "text-1" }],
      },
      {
        type: "text",
        id: "text-1",
        x: 120,
        y: 120,
        text: "Bound label",
        fontSize: 18,
        fontFamily: 1,
        containerId: "missing-container",
      },
    ];

    insertAISkeletons(app, skeletons, {
      targetCenter: { x: 0, y: 0 },
    });

    const synced = getLastSync()!.elements;
    const rect = getById(synced, "rect-1")!;
    const text = getById(synced, "text-1")!;

    if (!isTextElement(text)) {
      throw new Error("Expected text element");
    }
    expect(text.type).toBe("text");
    expect(text.containerId).toBe(rect.id);
    expect(rect.boundElements?.some((el) => el.id === text.id)).toBe(true);
  });

  it("handles arrows with bindings and labels", () => {
    const { app } = createTestApp();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "rectangle",
        id: "rect-a",
        x: 20,
        y: 40,
        width: 120,
        height: 60,
      },
      {
        type: "rectangle",
        id: "rect-b",
        x: 260,
        y: 40,
        width: 120,
        height: 60,
      },
      {
        type: "arrow",
        id: "arrow-1",
        x: 140,
        y: 70,
        width: 120,
        height: 0,
        start: {
          id: "rect-a",
        },
        end: {
          id: "rect-b",
        },
        label: {
          text: "Flow",
        },
      },
    ];

    const inserted = insertAISkeletons(app, skeletons, {
      targetCenter: { x: 0, y: 0 },
    });

    const rectA = getById(inserted, "rect-a")!;
    const rectB = getById(inserted, "rect-b")!;
    const arrow = getById(inserted, "arrow-1") as Extract<
      NonDeletedExcalidrawElement,
      { type: "arrow" }
    >;
    const label = inserted.find(
      (element) => element.type === "text" && element.containerId === arrow.id,
    );

    expect(arrow).toBeDefined();
    expect(arrow.type).toBe("arrow");
    expect(arrow.startBinding?.elementId).toBe(rectA.id);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    expect(label).toBeDefined();
    if (label) {
      expect(
        arrow.boundElements?.some(
          (boundElement) => boundElement.id === label.id,
        ),
      ).toBe(true);
    }
  });

  it("keeps frame membership for large children when regenerating ids", () => {
    const { app, getElements } = createTestApp();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "rectangle",
        id: "child-1",
        x: 1000,
        y: 1200,
        width: 2000,
        height: 1000,
        boundElements: [{ type: "text", id: "child-text" }],
      },
      {
        type: "text",
        id: "child-text",
        x: 1100,
        y: 1250,
        text: "Big child",
        fontSize: 20,
        fontFamily: 1,
        containerId: "child-1",
      },
      {
        type: "frame",
        id: "frame-1",
        name: "Frame with big children",
        width: 800,
        height: 450,
        children: ["child-1"],
      },
    ];

    expect(() =>
      insertAISkeletons(app, skeletons, {
        targetCenter: { x: 0, y: 0 },
        regenerateIds: true,
      }),
    ).not.toThrow();

    const elements = getElements();
    const frame = elements.find((element) => element.type === "frame")!;
    const frameChildren = elements.filter(
      (element) => element.frameId === frame.id,
    );
    const frameChild = frameChildren.find((element) => element.type !== "text");
    const boundText = frameChildren.find((element) => element.type === "text");

    expect(frameChild).toBeDefined();
    expect(boundText).toBeDefined();
    expect(frame.width).toBe(800);
    expect(frame.height).toBe(450);
  });

  it("preserves layout spacing across multiple frames", () => {
    const { app } = createTestApp();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "frame",
        id: "frame-left",
        name: "Left",
        x: 0,
        y: 0,
        width: 200,
        height: 150,
        children: ["left-child"],
      },
      {
        type: "rectangle",
        id: "left-child",
        x: 20,
        y: 30,
        width: 80,
        height: 60,
      },
      {
        type: "frame",
        id: "frame-right",
        name: "Right",
        x: 500,
        y: 0,
        width: 200,
        height: 150,
        children: ["right-child"],
      },
      {
        type: "rectangle",
        id: "right-child",
        x: 520,
        y: 30,
        width: 80,
        height: 60,
      },
    ];

    const inserted = insertAISkeletons(app, skeletons, {
      targetCenter: { x: 0, y: 0 },
    });

    const leftFrame = inserted.find(
      (element) => element.type === "frame" && element.name === "Left",
    ) as Extract<NonDeletedExcalidrawElement, { type: "frame" }>;
    const rightFrame = inserted.find(
      (element) => element.type === "frame" && element.name === "Right",
    ) as Extract<NonDeletedExcalidrawElement, { type: "frame" }>;

    expect(leftFrame).toBeDefined();
    expect(rightFrame).toBeDefined();

    const left = leftFrame!;
    const right = rightFrame!;

    const originalDistance =
      skeletons[2].x! +
      skeletons[2].width! / 2 -
      (skeletons[0].x! + skeletons[0].width! / 2);
    const insertedDistance =
      right.x + right.width / 2 - (left.x + left.width / 2);

    expect(insertedDistance).toBeCloseTo(originalDistance);
  });

  it("handles arrows that bind to frames", () => {
    const { app } = createTestApp();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "frame",
        id: "frame-1",
        name: "Target frame",
        x: 300,
        y: 0,
        width: 200,
        height: 200,
        children: ["frame-child"],
      },
      {
        type: "rectangle",
        id: "frame-child",
        x: 320,
        y: 20,
        width: 80,
        height: 60,
      },
      {
        type: "rectangle",
        id: "source",
        x: 0,
        y: 40,
        width: 80,
        height: 60,
      },
      {
        type: "arrow",
        id: "arrow-to-frame",
        x: 80,
        y: 70,
        width: 220,
        height: 0,
        elbowed: true,
        start: { id: "source" },
        end: { id: "frame-1" },
      } as ExcalidrawElementSkeleton,
    ];

    const inserted = insertAISkeletons(app, skeletons, {
      regenerateIds: true,
      selectInsertedElements: true,
    });

    const insertedFrame = inserted.find(
      (element) => element.type === "frame",
    ) as Extract<NonDeletedExcalidrawElement, { type: "frame" }>;
    const insertedArrow = inserted.find(
      (element) => element.type === "arrow",
    ) as Extract<NonDeletedExcalidrawElement, { type: "arrow" }>;

    expect(insertedFrame).toBeDefined();
    expect(insertedArrow).toBeDefined();
    expect(insertedArrow.endBinding?.elementId).toBe(insertedFrame.id);
  });

  it("verifies near-threshold bound text wraps and restores single-line text", () => {
    const { app, getLastSync } = createTestApp();
    const originalText = "Hello world";
    const fontFamily = 1;
    const fontSize = 16;
    const lineHeight = 1.25 as ExcalidrawTextElement["lineHeight"];
    const singleLineWidth = measureText(
      originalText,
      getFontString({ fontFamily, fontSize }),
      lineHeight,
    ).width;

    let ellipseSize: number | null = null;
    for (let candidate = 100; candidate <= 220; candidate += 1) {
      const maxWidth = getBoundTextMaxWidth(
        {
          type: "ellipse",
          width: candidate,
          height: candidate,
        } as any,
        {
          fontSize,
        } as any,
      );
      const overflow = singleLineWidth - maxWidth;
      if (overflow > 0.05 && overflow <= 1.4) {
        ellipseSize = candidate;
        break;
      }
    }

    expect(ellipseSize).not.toBeNull();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "ellipse",
        id: "bubble",
        x: 100,
        y: 100,
        width: ellipseSize!,
        height: ellipseSize!,
        boundElements: [{ type: "text", id: "label" }],
      },
      {
        type: "text",
        id: "label",
        x: 120,
        y: 120,
        text: "Hello\nworld",
        originalText,
        fontSize,
        fontFamily,
        lineHeight,
        textAlign: "center",
        verticalAlign: "middle",
        autoResize: true,
        containerId: "bubble",
      },
    ];

    insertAISkeletons(app, skeletons, {
      targetCenter: { x: 0, y: 0 },
    });

    const synced = getLastSync()!.elements;
    const bubble = getById(synced, "bubble")!;
    const label = getById(synced, "label");

    expect(label).toBeDefined();
    if (!label || !isTextElement(label)) {
      throw new Error("Expected text element");
    }

    expect(label.text).toBe(originalText);
    expect(bubble.width).toBeGreaterThanOrEqual(ellipseSize!);
  });

  it("does not force cross-frame arrows into a child frame", () => {
    const { app } = createTestApp();

    const skeletons: ExcalidrawElementSkeleton[] = [
      {
        type: "frame",
        id: "frame-a",
        name: "A",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        children: ["child-a"],
      },
      {
        type: "rectangle",
        id: "child-a",
        x: 20,
        y: 20,
        width: 80,
        height: 60,
      },
      {
        type: "frame",
        id: "frame-b",
        name: "B",
        x: 500,
        y: 0,
        width: 300,
        height: 200,
        children: [],
      },
      {
        type: "arrow",
        id: "cross-frame",
        x: 60,
        y: 50,
        width: 440,
        height: 0,
        elbowed: true,
        start: { id: "child-a" },
        end: { id: "frame-b" },
      } as ExcalidrawElementSkeleton,
    ];

    const inserted = insertAISkeletons(app, skeletons, {
      regenerateIds: true,
      selectInsertedElements: true,
    });

    const arrow = inserted.find(
      (element) => element.type === "arrow",
    ) as Extract<NonDeletedExcalidrawElement, { type: "arrow" }>;

    expect(arrow).toBeDefined();
    expect(arrow.startBinding?.elementId).toBeDefined();
    expect(arrow.endBinding?.elementId).toBeDefined();
    expect(arrow.frameId).toBeNull();
  });

  it("centers inserted elements in the visible viewport when the canvas has a page offset", () => {
    const { app } = createTestApp([], {
      width: 1000,
      height: 800,
      offsetLeft: 480,
      offsetTop: 120,
    });

    const inserted = insertAISkeletons(app, [
      { type: "rectangle", id: "rect-1", x: 0, y: 0, width: 100, height: 50 },
    ]);

    // Scene-space viewport center is (width / 2) / zoom - scroll; the canvas
    // page offset cancels out of the client→scene transform and must NOT
    // shift the result (C4 in tta.md: the old formula landed this at
    // (20, 280) — i.e. offset px to the left/top of the visible center).
    const center = getInsertedBoundsCenter(inserted);
    expect(center.x).toBeCloseTo(500);
    expect(center.y).toBeCloseTo(400);
  });

  it("centers inserted elements with offset, zoom and scroll combined", () => {
    const { app } = createTestApp([], {
      width: 1000,
      height: 800,
      offsetLeft: 480,
      offsetTop: 120,
      scrollX: 100,
      scrollY: -50,
      zoom: { value: 2 as NormalizedZoomValue },
    });

    const inserted = insertAISkeletons(app, [
      { type: "rectangle", id: "rect-1", x: 0, y: 0, width: 100, height: 50 },
    ]);

    // x: (1000 / 2) / 2 - 100 = 150 ; y: (800 / 2) / 2 - (-50) = 250
    // (old formula: (-90, 190))
    const center = getInsertedBoundsCenter(inserted);
    expect(center.x).toBeCloseTo(150);
    expect(center.y).toBeCloseTo(250);
  });

  it("keeps offset-0 centering unchanged at zoom/scroll (excalidraw.com regression)", () => {
    const { app } = createTestApp([], {
      width: 1000,
      height: 800,
      scrollX: 100,
      scrollY: -50,
      zoom: { value: 2 as NormalizedZoomValue },
    });

    const inserted = insertAISkeletons(app, [
      { type: "rectangle", id: "rect-1", x: 0, y: 0, width: 100, height: 50 },
    ]);

    // Identical before and after the fix — pins the offset-0 behavior.
    const center = getInsertedBoundsCenter(inserted);
    expect(center.x).toBeCloseTo(150);
    expect(center.y).toBeCloseTo(250);
  });
});
