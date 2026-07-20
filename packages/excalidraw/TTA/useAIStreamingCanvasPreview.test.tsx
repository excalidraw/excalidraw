import React, { useEffect, useRef, useState } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useAIStreamingCanvasPreview } from "./useAIStreamingCanvasPreview";
import { INTERMEDIATE_PREVIEW_ELEMENT_KEY } from "./insertAISkeletons";

import type { AppClassProperties } from "../types";

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
    ({ elements: nextElements }: { elements: ExcalidrawElement[] }) => {
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

const PreviewHarness = ({
  app,
  firstSkeletons,
  secondSkeletons,
}: {
  app: AppClassProperties;
  firstSkeletons: ExcalidrawElementSkeleton[];
  secondSkeletons: ExcalidrawElementSkeleton[];
}) => {
  const didRunRef = useRef(false);
  const [removeGeneratedElementsByMessageId] = useState(() => vi.fn());
  const [commitQueuedGenerationReplacements] = useState(() => vi.fn());
  const { applyStreamingCanvasPreviewResult } = useAIStreamingCanvasPreview({
    app,
    removeGeneratedElementsByMessageId,
    commitQueuedGenerationReplacements,
  });

  useEffect(() => {
    if (didRunRef.current) {
      return;
    }
    didRunRef.current = true;
    applyStreamingCanvasPreviewResult(
      { skeletons: firstSkeletons, isComplete: false },
      "message-1",
    );
    applyStreamingCanvasPreviewResult(
      { skeletons: secondSkeletons, isComplete: false },
      "message-1",
    );
  }, [applyStreamingCanvasPreviewResult, firstSkeletons, secondSkeletons]);

  return null;
};

const CommitPreviewHarness = ({
  app,
  skeletons,
}: {
  app: AppClassProperties;
  skeletons: ExcalidrawElementSkeleton[];
}) => {
  const didRunRef = useRef(false);
  const [removeGeneratedElementsByMessageId] = useState(() => vi.fn());
  const [commitQueuedGenerationReplacements] = useState(() => vi.fn());
  const { applyStreamingCanvasPreviewResult, commitStreamingCanvasPreview } =
    useAIStreamingCanvasPreview({
      app,
      removeGeneratedElementsByMessageId,
      commitQueuedGenerationReplacements,
    });

  useEffect(() => {
    if (didRunRef.current) {
      return;
    }
    didRunRef.current = true;
    applyStreamingCanvasPreviewResult(
      { skeletons, isComplete: false },
      "message-1",
    );
    commitStreamingCanvasPreview();
  }, [applyStreamingCanvasPreviewResult, commitStreamingCanvasPreview, skeletons]);

  return null;
};

describe("useAIStreamingCanvasPreview", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("tombstones replaced preview elements and bumps same-id replacements", async () => {
    const setup = createMockApp();

    render(
      <PreviewHarness
        app={setup.app}
        firstSkeletons={[
          {
            type: "rectangle",
            id: "preview-id",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
          },
        ]}
        secondSkeletons={[
          {
            type: "ellipse",
            id: "preview-id",
            x: 20,
            y: 20,
            width: 30,
            height: 30,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(setup.syncActionResult).toHaveBeenCalledTimes(2);
    });

    const firstSyncedElements = setup.syncActionResult.mock.calls[0][0]
      .elements as ExcalidrawElement[];
    const firstPreviewElement = firstSyncedElements.find(
      (element) => element.id === "preview-id",
    )!;
    expect(
      firstPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBe(true);

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

    expect(
      setup.getElements().filter((element) => element.id === "preview-id"),
    ).toHaveLength(1);
  });

  it("commits the visible preview as regular elements", async () => {
    const setup = createMockApp();

    render(
      <CommitPreviewHarness
        app={setup.app}
        skeletons={[
          {
            type: "rectangle",
            id: "preview-id",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(setup.updateScene).toHaveBeenCalledTimes(2);
    });

    expect(setup.syncActionResult).toHaveBeenCalledTimes(1);
    const insertedPreviewElement = setup.syncActionResult.mock.calls[0][0]
      .elements[0] as ExcalidrawElement;
    expect(
      insertedPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBe(true);

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

    expect(setup.updateScene.mock.calls[1][0].captureUpdate).toBe(
      CaptureUpdateAction.IMMEDIATELY,
    );
    const committedPreviewElement = setup.updateScene.mock.calls[1][0]
      .elements[0] as ExcalidrawElement;
    expect(committedPreviewElement).toMatchObject({
      id: "preview-id",
      isDeleted: false,
    });
    expect(
      committedPreviewElement.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY],
    ).toBeUndefined();
    expect(committedPreviewElement.version).toBeGreaterThan(
      tombstonedPreviewElement.version,
    );
    expect(setup.getElements()).toEqual([committedPreviewElement]);
  });
});
