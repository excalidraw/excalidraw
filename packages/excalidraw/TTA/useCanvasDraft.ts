import { useCallback, useEffect, useMemo, useRef } from "react";

import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { CaptureUpdateActionType } from "@excalidraw/element";

import {
  getElementsWithDeletedGenerationTags,
  insertAISkeletons,
  isIntermediatePreviewElement,
  INTERMEDIATE_PREVIEW_ELEMENT_KEY,
} from "./insertAISkeletons";

import { AI_CLIENT_ERRORS } from "./utils";
import { getElementsCenter } from "./chatHelpers";
import { withAIChatErrorMeta } from "./chatErrors";
import { throttle } from "./throttle";

import type { AIStreamPartialPayload } from "./types";

import type { AppClassProperties } from "../types";

const STREAMING_PREVIEW_RENDER_THROTTLE_DELAY = 300;

/**
 * The one canvas-draft record (tta_rewrite_final.md §2.4). The draft is keyed
 * by the LOCAL generation id (`message.id`) — known synchronously at send
 * time, stable across error-retries and reload — which is also the
 * `customData[AI_GENERATED_ELEMENTS_KEY]` tag stamped on every inserted
 * element.
 */
type CanvasDraftRecord = {
  /** Generation currently drawing on the canvas (null = no active draft). */
  generationId: string | null;
  /** Element ids of the last rendered intermediate preview. */
  elementIds: string[];
  /** First chunk's bounds center — anchors all subsequent renders. */
  targetCenter: { x: number; y: number } | null;
  /**
   * Tags of previous generations queued for replacement. They stay visible
   * until the replacing generation first yields drawable content, and the
   * queue survives a stop/error that never rendered — so the next successful
   * generation still replaces them.
   */
  queuedReplacementTags: string[];
};

const createEmptyDraftRecord = (): CanvasDraftRecord => ({
  generationId: null,
  elementIds: [],
  targetCenter: null,
  queuedReplacementTags: [],
});

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

type UseCanvasDraftOptions = {
  app: AppClassProperties;
};

/**
 * Owns the streaming canvas draft: the throttled chunk renders, the
 * NEVER→IMMEDIATELY commit dance, and the replacement queue that swaps out
 * previous generations once the next one has drawable content.
 */
export const useCanvasDraft = ({ app }: UseCanvasDraftOptions) => {
  const draftRef = useRef<CanvasDraftRecord>(createEmptyDraftRecord());

  const removePreviewElementsByIds = useCallback(
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

  const removeElementsByGenerationTags = useCallback(
    (
      generationTags: readonly string[],
      captureUpdate: CaptureUpdateActionType,
    ) => {
      if (!generationTags.length) {
        return;
      }
      const { elements, didChange } = getElementsWithDeletedGenerationTags(
        app.scene.getElementsIncludingDeleted(),
        new Set(generationTags),
      );
      if (!didChange) {
        return;
      }
      // Element-only mutations use `updateScene`; anything captured/selected
      // goes through `syncActionResult`.
      if (captureUpdate === CaptureUpdateAction.IMMEDIATELY) {
        app.syncActionResult({ elements, captureUpdate });
      } else {
        app.api.updateScene({ elements, captureUpdate });
      }
    },
    [app],
  );

  /** Tombstones the current intermediate preview render (if any). */
  const clearPreviewElements = useCallback(() => {
    const draft = draftRef.current;
    if (draft.elementIds.length) {
      removePreviewElementsByIds(draft.elementIds);
    }
    draft.elementIds = [];
    draft.targetCenter = null;
  }, [removePreviewElementsByIds]);

  /**
   * Queues a previous generation's tag for replacement. Kept visible until
   * the next generation yields renderable skeletons.
   */
  const queueReplacement = useCallback(
    (generationTag: string | null | undefined) => {
      if (!generationTag) {
        return;
      }
      const draft = draftRef.current;
      if (!draft.queuedReplacementTags.includes(generationTag)) {
        draft.queuedReplacementTags = [
          ...draft.queuedReplacementTags,
          generationTag,
        ];
      }
    },
    [],
  );

  const commitQueuedReplacements = useCallback(() => {
    const draft = draftRef.current;
    const pending = draft.queuedReplacementTags;
    if (!pending.length) {
      return;
    }
    draft.queuedReplacementTags = [];
    // Remove stale generations once the replacing one has started rendering.
    // No self-filter: an error-retry reuses its generation id, so its own tag
    // being queued means "replace the failed attempt's committed partial" —
    // at this point the new attempt has nothing on canvas yet.
    removeElementsByGenerationTags(pending, CaptureUpdateAction.IMMEDIATELY);
  }, [removeElementsByGenerationTags]);

  const finalizeDraft = useCallback((generationId: string) => {
    const draft = draftRef.current;
    draft.elementIds = [];
    draft.targetCenter = null;
    if (draft.generationId === generationId) {
      draft.generationId = null;
    }
  }, []);

  const activateDraft = useCallback(
    (generationId: string) => {
      const draft = draftRef.current;
      if (draft.generationId === generationId) {
        return;
      }

      // If we start rendering a new generation (e.g. retry), swap out the
      // prior generation only after the new one has drawable content.
      commitQueuedReplacements();
      if (draft.generationId) {
        removeElementsByGenerationTags(
          [draft.generationId],
          CaptureUpdateAction.NEVER,
        );
      }
      clearPreviewElements();
      draft.generationId = generationId;
    },
    [
      clearPreviewElements,
      commitQueuedReplacements,
      removeElementsByGenerationTags,
    ],
  );

  const renderResult = useCallback(
    (result: AIStreamPartialPayload, generationId: string) => {
      const draft = draftRef.current;

      if (!result.skeletons.length) {
        if (result.isComplete) {
          clearPreviewElements();
          finalizeDraft(generationId);
        }
        return;
      }

      activateDraft(generationId);

      const previousTargetCenter = draft.targetCenter;
      if (draft.elementIds.length) {
        removePreviewElementsByIds(draft.elementIds);
      }

      const insertOptions = {
        generationId,
        targetCenter: previousTargetCenter ?? undefined,
        captureUpdate: result.isComplete
          ? CaptureUpdateAction.IMMEDIATELY
          : CaptureUpdateAction.NEVER,
        // Streaming payload ids are stable server-side. Preserving them lets
        // the final render replace the tombstoned preview instead of appending
        // a fresh copy with regenerated ids.
        regenerateIds: false,
        selectInsertedElements: result.isComplete,
        intermediatePreviewElement: !result.isComplete,
      };

      let inserted: ReturnType<typeof insertAISkeletons> = [];
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
          finalizeDraft(generationId);
        } else {
          draft.elementIds = [];
          draft.targetCenter = null;
        }
        return;
      }

      if (result.isComplete) {
        finalizeDraft(generationId);
        return;
      }

      draft.elementIds = inserted.map((element) => element.id);
      draft.targetCenter = getElementsCenter(inserted);
    },
    [
      activateDraft,
      app,
      clearPreviewElements,
      finalizeDraft,
      removePreviewElementsByIds,
    ],
  );

  const throttledRender = useMemo(
    () => throttle(renderResult, STREAMING_PREVIEW_RENDER_THROTTLE_DELAY),
    [renderResult],
  );

  /** Renders a streaming partial, throttled with a trailing edge (M1). */
  const applyChunk = useCallback(
    (result: AIStreamPartialPayload, generationId: string) => {
      throttledRender(result, generationId);
    },
    [throttledRender],
  );

  /**
   * Renders the final result. Any chunk parked in the throttle window is
   * flushed first so the final render replaces the latest preview.
   */
  const applyFinal = useCallback(
    (result: AIStreamPartialPayload, generationId: string) => {
      throttledRender.flush();
      renderResult(result, generationId);
    },
    [renderResult, throttledRender],
  );

  /** Drops any parked render and resets the throttle window. */
  const cancelPendingRenders = useCallback(() => {
    throttledRender.cancel();
  }, [throttledRender]);

  /**
   * Commits the current intermediate preview as regular, undoable elements
   * (user Stop and the on-error policy — tta_rewrite_final.md §2.2).
   */
  const commitDraft = useCallback(() => {
    throttledRender.cancel();

    const draft = draftRef.current;
    if (!draft.elementIds.length) {
      return;
    }

    const idSet = new Set(draft.elementIds);
    const existingElements = app.scene.getElementsIncludingDeleted();
    const tombstonedPreviewElements = new Map<string, ExcalidrawElement>();
    let didDeletePreview = false;

    const elementsWithDeletedPreview = existingElements.map((element) => {
      if (
        idSet.has(element.id) &&
        !element.isDeleted &&
        isIntermediatePreviewElement(element)
      ) {
        didDeletePreview = true;
        const tombstonedElement = newElementWith(element, { isDeleted: true });
        tombstonedPreviewElements.set(element.id, tombstonedElement);
        return tombstonedElement;
      }
      return element;
    });

    if (!didDeletePreview) {
      draft.elementIds = [];
      draft.targetCenter = null;
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

    // Captured update → `syncActionResult` (element-only mutations use
    // `updateScene`; anything captured/selected goes through it).
    app.syncActionResult({
      elements: elementsWithDeletedPreview.map((element) => {
        return committedPreviewElements.get(element.id) ?? element;
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    draft.generationId = null;
    draft.elementIds = [];
    draft.targetCenter = null;
  }, [app, throttledRender]);

  /**
   * Removes the active draft from the canvas without committing it (message
   * delete and other destructive teardowns). The replacement queue is left
   * intact — it must survive a stop/error that never rendered.
   */
  const clearDraft = useCallback(() => {
    throttledRender.cancel();
    const draft = draftRef.current;
    clearPreviewElements();
    if (draft.generationId) {
      removeElementsByGenerationTags(
        [draft.generationId],
        CaptureUpdateAction.NEVER,
      );
      draft.generationId = null;
    }
  }, [clearPreviewElements, removeElementsByGenerationTags, throttledRender]);

  /** Full reset: `clearDraft` plus dropping the replacement queue. */
  const reset = useCallback(() => {
    clearDraft();
    draftRef.current.queuedReplacementTags = [];
  }, [clearDraft]);

  useEffect(() => {
    return () => {
      throttledRender.cancel();
      clearPreviewElements();
    };
  }, [clearPreviewElements, throttledRender]);

  return {
    applyChunk,
    applyFinal,
    commitDraft,
    queueReplacement,
    clearDraft,
    reset,
    cancelPendingRenders,
  };
};

export type CanvasDraft = ReturnType<typeof useCanvasDraft>;
