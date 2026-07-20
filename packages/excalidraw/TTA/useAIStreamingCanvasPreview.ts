import { useCallback, useMemo, useRef } from "react";

import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  insertAISkeletons,
  INTERMEDIATE_PREVIEW_ELEMENT_KEY,
} from "./insertAISkeletons";

import { AI_CLIENT_ERRORS } from "./utils";
import { getElementsCenter } from "./chatHelpers";
import { withAIChatErrorMeta } from "./chatErrors";

import type { AIStreamPartialPayload } from "./types";

import type { AppClassProperties } from "../types";

const STREAMING_PREVIEW_RENDER_THROTTLE_DELAY = 300;

type StreamingCanvasPreviewHandle = {
  elementIds: string[];
  targetCenter: { x: number; y: number } | null;
};

type PendingStreamingCanvasPreviewRender = {
  result: AIStreamPartialPayload;
  messageId: string;
};

type ThrottledStreamingCanvasPreviewRenderer = {
  (result: AIStreamPartialPayload, messageId: string): void;
  flush: () => void;
  cancel: () => void;
};

type UseAIStreamingCanvasPreviewOptions = {
  app: AppClassProperties;
  removeGeneratedElementsByMessageId: (messageId: string | null) => void;
  commitQueuedGenerationReplacements: (activeMessageId?: string | null) => void;
};

const getCustomDataWithoutIntermediatePreviewFlag = (
  customData: ExcalidrawElement["customData"],
) => {
  if (!customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY]) {
    return customData;
  }

  const {
    [INTERMEDIATE_PREVIEW_ELEMENT_KEY]: _intermediatePreviewElement,
    ...nextCustomData
  } = customData;
  return Object.keys(nextCustomData).length ? nextCustomData : undefined;
};

export const useAIStreamingCanvasPreview = ({
  app,
  removeGeneratedElementsByMessageId,
  commitQueuedGenerationReplacements,
}: UseAIStreamingCanvasPreviewOptions) => {
  const streamingCanvasPreviewHandleRef =
    useRef<StreamingCanvasPreviewHandle | null>(null);
  const activeCanvasDraftMessageIdRef = useRef<string | null>(null);
  const lastStreamingCanvasPreviewRenderTimeRef = useRef(0);
  const pendingStreamingCanvasPreviewResultRef =
    useRef<PendingStreamingCanvasPreviewRender | null>(null);

  const removeCanvasPreviewElementsByIds = useCallback(
    (elementIds: string[]) => {
      if (!elementIds.length) {
        return;
      }

      const idSet = new Set(elementIds);
      const existingElements = app.scene.getElementsIncludingDeleted();
      let didChange = false;
      const nextElements = existingElements.map((element) => {
        if (idSet.has(element.id) && !element.isDeleted) {
          didChange = true;
          return newElementWith(element, { isDeleted: true });
        }
        return element;
      });

      if (didChange) {
        app.api.updateScene({
          elements: nextElements,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
    },
    [app],
  );

  const clearStreamingCanvasPreview = useCallback(() => {
    const preview = streamingCanvasPreviewHandleRef.current;
    if (preview?.elementIds.length) {
      removeCanvasPreviewElementsByIds(preview.elementIds);
    }
    streamingCanvasPreviewHandleRef.current = null;
  }, [removeCanvasPreviewElementsByIds]);

  const commitStreamingCanvasPreview = useCallback(() => {
    const preview = streamingCanvasPreviewHandleRef.current;
    if (!preview?.elementIds.length) {
      return;
    }

    const idSet = new Set(preview.elementIds);
    const existingElements = app.scene.getElementsIncludingDeleted();
    const tombstonedPreviewElements = new Map<string, ExcalidrawElement>();
    let didDeletePreview = false;

    const elementsWithDeletedPreview = existingElements.map((element) => {
      if (
        idSet.has(element.id) &&
        !element.isDeleted &&
        element.customData?.[INTERMEDIATE_PREVIEW_ELEMENT_KEY] === true
      ) {
        didDeletePreview = true;
        const tombstonedElement = newElementWith(element, { isDeleted: true });
        tombstonedPreviewElements.set(element.id, tombstonedElement);
        return tombstonedElement;
      }
      return element;
    });

    if (!didDeletePreview) {
      streamingCanvasPreviewHandleRef.current = null;
      return;
    }

    // The preview was inserted with `NEVER`, so it is already part of the
    // Store snapshot. Tombstone it first so the following `IMMEDIATELY` update
    // captures "add this stopped result" rather than just "remove the
    // intermediate preview flag". That keeps undo behavior correct.
    app.api.updateScene({
      elements: elementsWithDeletedPreview,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    const committedPreviewElements = new Map<string, ExcalidrawElement>();
    for (const tombstonedElement of tombstonedPreviewElements.values()) {
      committedPreviewElements.set(
        tombstonedElement.id,
        newElementWith(
          tombstonedElement,
          {
            isDeleted: false,
            customData: getCustomDataWithoutIntermediatePreviewFlag(
              tombstonedElement.customData,
            ),
          },
          true,
        ),
      );
    }

    app.api.updateScene({
      elements: elementsWithDeletedPreview.map((element) => {
        return committedPreviewElements.get(element.id) ?? element;
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    streamingCanvasPreviewHandleRef.current = null;
    activeCanvasDraftMessageIdRef.current = null;
  }, [app]);

  const finalizeCanvasDraft = useCallback((messageId: string) => {
    streamingCanvasPreviewHandleRef.current = null;
    if (activeCanvasDraftMessageIdRef.current === messageId) {
      activeCanvasDraftMessageIdRef.current = null;
    }
  }, []);

  const activateCanvasDraft = useCallback(
    (messageId: string) => {
      if (activeCanvasDraftMessageIdRef.current === messageId) {
        return;
      }

      // If we start rendering a new generation (e.g. retry), swap out the
      // prior generation only after the new one has drawable content.
      commitQueuedGenerationReplacements(messageId);
      if (activeCanvasDraftMessageIdRef.current) {
        removeGeneratedElementsByMessageId(
          activeCanvasDraftMessageIdRef.current,
        );
      }
      clearStreamingCanvasPreview();
      activeCanvasDraftMessageIdRef.current = messageId;
    },
    [
      clearStreamingCanvasPreview,
      commitQueuedGenerationReplacements,
      removeGeneratedElementsByMessageId,
    ],
  );

  const applyStreamingCanvasPreviewResult = useCallback(
    (result: AIStreamPartialPayload, messageId: string) => {
      if (!result.skeletons.length) {
        if (result.isComplete) {
          clearStreamingCanvasPreview();
          finalizeCanvasDraft(messageId);
        }
        return;
      }

      activateCanvasDraft(messageId);

      const previousHandle = streamingCanvasPreviewHandleRef.current;
      if (previousHandle?.elementIds.length) {
        removeCanvasPreviewElementsByIds(previousHandle.elementIds);
      }

      const insertOptions = {
        generationId: messageId,
        targetCenter: previousHandle?.targetCenter ?? undefined,
        captureUpdate: result.isComplete
          ? CaptureUpdateAction.IMMEDIATELY
          : CaptureUpdateAction.NEVER,
        regenerateIds: result.isComplete,
        selectInsertedElements: result.isComplete,
        intermediatePreviewElement: !result.isComplete,
      };

      let inserted: readonly NonDeletedExcalidrawElement[] = [];
      try {
        inserted = insertAISkeletons(app, result.skeletons, insertOptions);
      } catch (error) {
        throw withAIChatErrorMeta(
          new Error("AI response could not be rendered on canvas."),
          {
            code: AI_CLIENT_ERRORS.INVALID_RESULT,
            cause: error,
          },
        );
      }

      if (!inserted.length) {
        if (result.isComplete) {
          finalizeCanvasDraft(messageId);
        } else {
          streamingCanvasPreviewHandleRef.current = null;
        }
        return;
      }

      if (result.isComplete) {
        finalizeCanvasDraft(messageId);
        return;
      }

      streamingCanvasPreviewHandleRef.current = {
        elementIds: inserted.map((element) => element.id),
        targetCenter: getElementsCenter(inserted),
      };
    },
    [
      activateCanvasDraft,
      app,
      clearStreamingCanvasPreview,
      finalizeCanvasDraft,
      removeCanvasPreviewElementsByIds,
    ],
  );

  const throttledApplyStreamingCanvasPreviewResult = useMemo(() => {
    const fn = (result: AIStreamPartialPayload, messageId: string) => {
      const now = Date.now();
      const timeSinceLastRender =
        now - lastStreamingCanvasPreviewRenderTimeRef.current;

      if (timeSinceLastRender < STREAMING_PREVIEW_RENDER_THROTTLE_DELAY) {
        pendingStreamingCanvasPreviewResultRef.current = {
          result,
          messageId,
        };
        return;
      }

      pendingStreamingCanvasPreviewResultRef.current = null;
      applyStreamingCanvasPreviewResult(result, messageId);
      lastStreamingCanvasPreviewRenderTimeRef.current = Date.now();
    };

    fn.flush = () => {
      const pending = pendingStreamingCanvasPreviewResultRef.current;
      if (!pending) {
        return;
      }

      pendingStreamingCanvasPreviewResultRef.current = null;
      applyStreamingCanvasPreviewResult(pending.result, pending.messageId);
      lastStreamingCanvasPreviewRenderTimeRef.current = Date.now();
    };

    fn.cancel = () => {
      pendingStreamingCanvasPreviewResultRef.current = null;
    };

    return fn as ThrottledStreamingCanvasPreviewRenderer;
  }, [applyStreamingCanvasPreviewResult]);

  const resetStreamingCanvasPreviewState = useCallback(() => {
    lastStreamingCanvasPreviewRenderTimeRef.current = 0;
    pendingStreamingCanvasPreviewResultRef.current = null;
  }, []);

  const resetActiveCanvasDraft = useCallback(() => {
    activeCanvasDraftMessageIdRef.current = null;
  }, []);

  const clearActiveCanvasDraftFromCanvas = useCallback(() => {
    const activeCanvasDraftMessageId = activeCanvasDraftMessageIdRef.current;
    if (activeCanvasDraftMessageId) {
      removeGeneratedElementsByMessageId(activeCanvasDraftMessageId);
    }
    clearStreamingCanvasPreview();
    activeCanvasDraftMessageIdRef.current = null;
  }, [clearStreamingCanvasPreview, removeGeneratedElementsByMessageId]);

  return {
    applyStreamingCanvasPreviewResult,
    throttledApplyStreamingCanvasPreviewResult,
    clearStreamingCanvasPreview,
    commitStreamingCanvasPreview,
    clearActiveCanvasDraftFromCanvas,
    resetActiveCanvasDraft,
    resetStreamingCanvasPreviewState,
  };
};
