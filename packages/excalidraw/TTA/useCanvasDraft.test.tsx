import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useCanvasDraft, type CanvasDraft } from "./useCanvasDraft";
import {
  AI_GENERATED_ELEMENTS_KEY,
  INTERMEDIATE_PREVIEW_ELEMENT_KEY,
} from "./insertAISkeletons";

import type { AppClassProperties } from "../types";

const THROTTLE_DELAY = 300;

const createMockApp = (initialElements: ExcalidrawElement[] = []) => {
  let elements = [...initialElements];

  const updateScene = vi.fn(
    ({
      elements: nextElements,
    }: {
      elements: ExcalidrawElement[];
      captureUpdate?: unknown;
    }) => {
      elements = nextElements;
    },
  );
  const syncActionResult = vi.fn(
    ({
      elements: nextElements,
    }: {
      elements: ExcalidrawElement[];
      captureUpdate?: unknown;
    }) => {
      elements = nextElements;
    },
  );

  const app = {
    api: {
      updateScene,
    },
    state: {
      width: 1000,
      height: 1000,
      scrollX: 0,
      scrollY: 0,
      offsetLeft: 0,
      offsetTop: 0,
      zoom: { value: 1 },
      selectedElementIds: {},
    } as AppClassProperties["state"],
    scene: {
      getNonDeletedElements: () =>
        elements.filter(
          (element): element is NonDeletedExcalidrawElement =>
            !element.isDeleted,
        ),
      getElementsIncludingDeleted: () => elements,
    } as unknown as AppClassProperties["scene"],
    syncActionResult,
  } as unknown as AppClassProperties;

  return {
    app,
    getElements: () => elements,
    syncActionResult,
    updateScene,
  };
};

const createCommittedGenerationElement = (
  id: string,
  generationTag: string,
): ExcalidrawElement =>
  ({
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    isDeleted: false,
    version: 1,
    versionNonce: 1,
    updated: 1,
    customData: { [AI_GENERATED_ELEMENTS_KEY]: generationTag },
  } as unknown as ExcalidrawElement);

const renderCanvasDraft = (app: AppClassProperties) => {
  const result = { current: null as unknown as CanvasDraft };
  const Harness = () => {
    result.current = useCanvasDraft({ app });
    return null;
  };
  render(<Harness />);
  return result;
};

const rectSkeleton = (id: string): ExcalidrawElementSkeleton => ({
  type: "rectangle",
  id,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});

const ellipseSkeleton = (id: string): ExcalidrawElementSkeleton => ({
  type: "ellipse",
  id,
  x: 20,
  y: 20,
  width: 30,
  height: 30,
});

describe("useCanvasDraft", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("tombstones replaced preview elements and bumps same-id replacements", () => {
    vi.useFakeTimers();
    const setup = createMockApp();
    const draft = renderCanvasDraft(setup.app);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("preview-id")], isComplete: false },
      "gen-1",
    );
    draft.current.applyChunk(
      { skeletons: [ellipseSkeleton("preview-id")], isComplete: false },
      "gen-1",
    );
    vi.advanceTimersByTime(THROTTLE_DELAY);

    expect(setup.syncActionResult).toHaveBeenCalledTimes(2);

    const firstSyncedElements = setup.syncActionResult.mock.calls[0][0]
      .elements as ExcalidrawElement[];
    const firstPreviewElement = firstSyncedElements.find(
      (element) => element.id === "preview-id",
    )!;
    expect(
      firstPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBe(true);
    expect(firstPreviewElement.customData?.[AI_GENERATED_ELEMENTS_KEY]).toBe(
      "gen-1",
    );

    expect(setup.updateScene).toHaveBeenCalledTimes(1);
    const removedPreviewElements = setup.updateScene.mock.calls[0][0]
      .elements as ExcalidrawElement[];
    const removedPreviewElement = removedPreviewElements.find(
      (element) => element.id === "preview-id",
    )!;
    expect(removedPreviewElement.isDeleted).toBe(true);
    expect(
      removedPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBe(true);
    expect(removedPreviewElement.version).toBeGreaterThan(
      firstPreviewElement.version,
    );

    const secondSyncedElements = setup.syncActionResult.mock.calls[1][0]
      .elements as ExcalidrawElement[];
    const secondPreviewElement = secondSyncedElements.find(
      (element) => element.id === "preview-id",
    )!;
    expect(secondPreviewElement).toMatchObject({
      id: "preview-id",
      type: "ellipse",
      isDeleted: false,
      customData: expect.objectContaining({
        [INTERMEDIATE_PREVIEW_ELEMENT_KEY]: true,
      }),
    });
    expect(secondPreviewElement.version).toBeGreaterThan(
      removedPreviewElement.version,
    );

    // single instance per element id
    expect(
      setup.getElements().filter((element) => element.id === "preview-id"),
    ).toHaveLength(1);
  });

  it("renders a chunk parked inside the throttle window via the trailing edge (M1)", () => {
    vi.useFakeTimers();
    const setup = createMockApp();
    const draft = renderCanvasDraft(setup.app);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("preview-id")], isComplete: false },
      "gen-1",
    );
    // leading edge rendered immediately
    expect(setup.syncActionResult).toHaveBeenCalledTimes(1);

    draft.current.applyChunk(
      { skeletons: [ellipseSkeleton("preview-id")], isComplete: false },
      "gen-1",
    );
    // parked inside the window — no render yet
    expect(setup.syncActionResult).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(THROTTLE_DELAY - 1);
    expect(setup.syncActionResult).toHaveBeenCalledTimes(1);

    // trailing edge fires WITHOUT a subsequent chunk
    vi.advanceTimersByTime(1);
    expect(setup.syncActionResult).toHaveBeenCalledTimes(2);
    const trailingElements = setup.syncActionResult.mock.calls[1][0]
      .elements as ExcalidrawElement[];
    expect(
      trailingElements.find((element) => element.id === "preview-id"),
    ).toMatchObject({ type: "ellipse", isDeleted: false });
  });

  it("commits the visible preview as regular elements", () => {
    const setup = createMockApp();
    const draft = renderCanvasDraft(setup.app);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("preview-id")], isComplete: false },
      "gen-1",
    );
    draft.current.commitDraft();

    expect(setup.syncActionResult).toHaveBeenCalledTimes(2);
    const insertedPreviewElement = setup.syncActionResult.mock.calls[0][0]
      .elements[0] as ExcalidrawElement;
    expect(
      insertedPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBe(true);

    // pinned ordering: the updateScene-NEVER tombstone happens BEFORE the
    // syncActionResult-IMMEDIATELY commit
    expect(setup.updateScene).toHaveBeenCalledTimes(1);
    expect(setup.updateScene.mock.calls[0][0].captureUpdate).toBe(
      CaptureUpdateAction.NEVER,
    );
    const tombstonedPreviewElement = setup.updateScene.mock.calls[0][0]
      .elements[0] as ExcalidrawElement;
    expect(tombstonedPreviewElement).toMatchObject({
      id: "preview-id",
      isDeleted: true,
    });
    expect(
      tombstonedPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBe(true);

    const commitCall = setup.syncActionResult.mock.calls[1][0];
    expect(commitCall.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
    expect(setup.updateScene.mock.invocationCallOrder[0]).toBeLessThan(
      setup.syncActionResult.mock.invocationCallOrder[1],
    );

    const committedPreviewElement = commitCall.elements[0] as ExcalidrawElement;
    expect(committedPreviewElement).toMatchObject({
      id: "preview-id",
      isDeleted: false,
    });
    // intermediate flag stripped on commit
    expect(
      committedPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBeUndefined();
    expect(
      committedPreviewElement.customData?.[AI_GENERATED_ELEMENTS_KEY],
    ).toBe("gen-1");
    expect(committedPreviewElement.version).toBeGreaterThan(
      tombstonedPreviewElement.version,
    );
    expect(setup.getElements()).toEqual([committedPreviewElement]);
  });

  it("replaces the preview with the same-id final result", () => {
    const setup = createMockApp();
    const draft = renderCanvasDraft(setup.app);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("stable-preview-id")], isComplete: false },
      "gen-1",
    );
    draft.current.applyFinal(
      { skeletons: [ellipseSkeleton("stable-preview-id")], isComplete: true },
      "gen-1",
    );

    expect(setup.updateScene).toHaveBeenCalledTimes(1);
    const tombstonedPreviewElement = setup.updateScene.mock.calls[0][0]
      .elements[0] as ExcalidrawElement;
    expect(tombstonedPreviewElement).toMatchObject({
      id: "stable-preview-id",
      isDeleted: true,
    });

    expect(setup.syncActionResult).toHaveBeenCalledTimes(2);
    const finalSync = setup.syncActionResult.mock.calls[1][0];
    expect(finalSync.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
    const finalElements = finalSync.elements as ExcalidrawElement[];
    expect(finalElements).toHaveLength(1);

    const finalElement = finalElements[0];
    expect(finalElement).toMatchObject({
      id: "stable-preview-id",
      type: "ellipse",
      isDeleted: false,
    });
    expect(
      finalElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBeUndefined();
    expect(finalElement.version).toBeGreaterThan(
      tombstonedPreviewElement.version,
    );
    expect(setup.getElements()).toEqual([finalElement]);
  });

  it("flushes a parked chunk before rendering the final result", () => {
    vi.useFakeTimers();
    const setup = createMockApp();
    const draft = renderCanvasDraft(setup.app);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("preview-id")], isComplete: false },
      "gen-1",
    );
    draft.current.applyChunk(
      { skeletons: [rectSkeleton("late-preview-id")], isComplete: false },
      "gen-1",
    );
    draft.current.applyFinal(
      { skeletons: [ellipseSkeleton("final-id")], isComplete: true },
      "gen-1",
    );

    // leading chunk + flushed parked chunk + final
    expect(setup.syncActionResult).toHaveBeenCalledTimes(3);
    const finalElements = setup.syncActionResult.mock.calls[2][0]
      .elements as ExcalidrawElement[];
    expect(
      finalElements.filter((element) => !element.isDeleted).map((el) => el.id),
    ).toEqual(["final-id"]);

    // nothing parked anymore — no trailing render fires later
    vi.advanceTimersByTime(THROTTLE_DELAY * 2);
    expect(setup.syncActionResult).toHaveBeenCalledTimes(3);
  });

  it("keeps a queued previous generation visible until the next one renders, then replaces it", () => {
    const setup = createMockApp([
      createCommittedGenerationElement("prev-el", "gen-1"),
    ]);
    const draft = renderCanvasDraft(setup.app);

    draft.current.queueReplacement("gen-1");
    // queueing alone must not touch the canvas
    expect(setup.getElements()[0].isDeleted).toBe(false);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("new-el")], isComplete: false },
      "gen-2",
    );

    // the previous generation was removed as a captured (IMMEDIATELY) update
    const replacementCall = setup.syncActionResult.mock.calls.find((call) =>
      (call[0].elements as ExcalidrawElement[]).some(
        (element) => element.id === "prev-el" && element.isDeleted,
      ),
    );
    expect(replacementCall?.[0].captureUpdate).toBe(
      CaptureUpdateAction.IMMEDIATELY,
    );

    const elements = setup.getElements();
    expect(
      elements.find((element) => element.id === "prev-el")?.isDeleted,
    ).toBe(true);
    expect(elements.find((element) => element.id === "new-el")?.isDeleted).toBe(
      false,
    );
  });

  it("keeps the queue across a stop/error that never rendered", () => {
    const setup = createMockApp([
      createCommittedGenerationElement("prev-el", "gen-1"),
    ]);
    const draft = renderCanvasDraft(setup.app);

    draft.current.queueReplacement("gen-1");
    // stop/error before the new generation rendered anything: the commit is a
    // no-op and the queued tag must survive
    draft.current.commitDraft();
    expect(setup.getElements()[0].isDeleted).toBe(false);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("new-el")], isComplete: false },
      "gen-2",
    );
    expect(
      setup.getElements().find((element) => element.id === "prev-el")
        ?.isDeleted,
    ).toBe(true);
  });

  it("replaces a failed attempt's committed partial on error-retry with the same generation id", () => {
    // an error-retry reuses the local generation id, so the queued tag equals
    // the retrying generation's own id — its old elements must still be
    // replaced once the new attempt renders
    const setup = createMockApp([
      createCommittedGenerationElement("old-el", "gen-1"),
    ]);
    const draft = renderCanvasDraft(setup.app);

    draft.current.queueReplacement("gen-1");
    draft.current.applyChunk(
      { skeletons: [rectSkeleton("new-el")], isComplete: false },
      "gen-1",
    );

    const elements = setup.getElements();
    expect(elements.find((element) => element.id === "old-el")?.isDeleted).toBe(
      true,
    );
    expect(elements.find((element) => element.id === "new-el")?.isDeleted).toBe(
      false,
    );
  });

  it("drops the queue on reset", () => {
    const setup = createMockApp([
      createCommittedGenerationElement("prev-el", "gen-1"),
    ]);
    const draft = renderCanvasDraft(setup.app);

    draft.current.queueReplacement("gen-1");
    draft.current.reset();

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("new-el")], isComplete: false },
      "gen-2",
    );
    // the queued tag was dropped — the previous generation stays
    expect(
      setup.getElements().find((element) => element.id === "prev-el")
        ?.isDeleted,
    ).toBe(false);
  });

  it("clearDraft removes the active draft from the canvas without committing", () => {
    const setup = createMockApp();
    const draft = renderCanvasDraft(setup.app);

    draft.current.applyChunk(
      { skeletons: [rectSkeleton("preview-id")], isComplete: false },
      "gen-1",
    );
    draft.current.clearDraft();

    const previewElement = setup
      .getElements()
      .find((element) => element.id === "preview-id");
    expect(previewElement?.isDeleted).toBe(true);
    // teardown is uncaptured — no IMMEDIATELY update was issued
    expect(
      setup.syncActionResult.mock.calls.some(
        (call) => call[0].captureUpdate === CaptureUpdateAction.IMMEDIATELY,
      ),
    ).toBe(false);
    expect(
      setup.updateScene.mock.calls.every(
        (call) => call[0].captureUpdate === CaptureUpdateAction.NEVER,
      ),
    ).toBe(true);
  });
});
