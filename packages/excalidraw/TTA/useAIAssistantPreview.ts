import { useEffect, useMemo, useRef, useState } from "react";

import { Scene } from "@excalidraw/element";
import { exportToSvg } from "@excalidraw/utils/export";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { useApp } from "../components/App";
import { useAppStateValue } from "../hooks/useAppStateValue";

import {
  convertAISkeletonsToSceneElements,
  fixBoundTextElements,
} from "./insertAISkeletons";
import { throttle } from "./throttle";

import type { AssistantMessage } from "./types";
import type { AppClassProperties, AppState } from "../types";

const ASSISTANT_PREVIEW_RENDER_THROTTLE_DELAY = 300;

/** LRU bound for the module-level preview cache (M7). */
const ASSISTANT_PREVIEW_CACHE_MAX_ENTRIES = 32;

export type AIAssistantPreviewStatus =
  | "idle"
  | "loading"
  | "done"
  | "unavailable";

type AIAssistantPreviewState = {
  previewSvg: string | null;
  status: AIAssistantPreviewStatus;
};

type AssistantPreviewCacheEntry = {
  renderKey: string;
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>;
  previewSvg: string;
};

type AssistantPreviewRenderRequest = {
  app: AppClassProperties;
  theme: AppState["theme"];
  messageId: string;
  renderKey: string;
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>;
};

type UseAIAssistantPreviewOptions = {
  enabled?: boolean;
};

/**
 * Preview cache keyed by the (persistence-stable) local message id. The Map's
 * insertion order doubles as recency order — hits and writes re-insert their
 * entry, so the first key is always the least-recently-used one.
 */
const assistantPreviewCache = new Map<string, AssistantPreviewCacheEntry>();

const getCachedPreview = (
  messageId: string,
  renderKey: string,
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>,
) => {
  const cached = assistantPreviewCache.get(messageId);
  // streaming entries self-invalidate on new chunks: the skeletons identity
  // changes, so only the exact rendered partial ever hits
  if (cached?.renderKey === renderKey && cached.skeletons === skeletons) {
    assistantPreviewCache.delete(messageId);
    assistantPreviewCache.set(messageId, cached);
    return cached.previewSvg;
  }
  return null;
};

const setCachedPreview = (
  messageId: string,
  entry: AssistantPreviewCacheEntry,
) => {
  assistantPreviewCache.delete(messageId);
  assistantPreviewCache.set(messageId, entry);
  if (assistantPreviewCache.size > ASSISTANT_PREVIEW_CACHE_MAX_ENTRIES) {
    const leastRecentlyUsed = assistantPreviewCache.keys().next().value;
    if (leastRecentlyUsed !== undefined) {
      assistantPreviewCache.delete(leastRecentlyUsed);
    }
  }
};

/** Drops cached previews for the given messages — called on chat delete (M7). */
export const evictAssistantPreviews = (messageIds: Iterable<string>) => {
  for (const messageId of messageIds) {
    assistantPreviewCache.delete(messageId);
  }
};

const isDarkTheme = (theme: AppState["theme"]) => theme === "dark";

/** State updater that keeps the previous object identity when values match. */
const toPreviewState =
  (
    previewSvg: string | null,
    status: AIAssistantPreviewStatus,
  ): ((prev: AIAssistantPreviewState) => AIAssistantPreviewState) =>
  (prev) =>
    prev.previewSvg === previewSvg && prev.status === status
      ? prev
      : { previewSvg, status };

const getRenderKey = (message: AssistantMessage, theme: AppState["theme"]) =>
  [
    message.id,
    theme,
    message.status.kind === "streaming" ? "streaming" : "complete",
  ].join(":");

export const renderAIAssistantPreviewDataUrl = async ({
  app,
  skeletons,
  theme,
}: {
  app: AppClassProperties;
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>;
  theme: AppState["theme"];
}) => {
  if (!skeletons.length) {
    return null;
  }

  try {
    const elements = convertAISkeletonsToSceneElements(skeletons, app, {
      targetCenter: { x: 0, y: 0 },
    });
    if (!elements.length) {
      console.warn("AI Sidebar: no elements generated from skeletons");
      return null;
    }

    const scene = new Scene(elements, { skipValidation: true });
    fixBoundTextElements(elements, scene);

    if (typeof window === "undefined" || typeof XMLSerializer === "undefined") {
      return null;
    }

    const svgElement = await exportToSvg({
      elements,
      appState: {
        exportBackground: false,
        exportWithDarkMode: isDarkTheme(theme),
      },
      files: app.files,
      renderEmbeddables: false,
      skipInliningFonts: true,
    });
    const serialized = new XMLSerializer().serializeToString(svgElement);
    return `data:image/svg+xml,${encodeURIComponent(serialized)}`;
  } catch (error) {
    console.warn("[AI Chat] Failed to render preview", error);
    return null;
  }
};

export const useAIAssistantPreview = (
  message: AssistantMessage,
  options: UseAIAssistantPreviewOptions = {},
): AIAssistantPreviewState => {
  const app = useApp();
  const theme = useAppStateValue("theme");
  const enabled = options.enabled ?? true;
  const skeletons = message.skeletons;
  const isStreaming = message.status.kind === "streaming";
  const renderKey = getRenderKey(message, theme);

  const [previewState, setPreviewState] = useState<AIAssistantPreviewState>(
    () => {
      // NOTE errored messages may still carry partial skeletons streamed
      // before the failure (C2 in tta.md) — render them so the salvaged
      // partial result stays previewable alongside the error.
      if (!skeletons?.length) {
        return { previewSvg: null, status: "unavailable" };
      }
      const cachedPreview = getCachedPreview(message.id, renderKey, skeletons);
      if (cachedPreview) {
        return { previewSvg: cachedPreview, status: "done" };
      }
      return { previewSvg: null, status: enabled ? "loading" : "idle" };
    },
  );

  /**
   * Epoch token: the render key the hook currently wants on screen (null when
   * idle/unavailable). An async render result only lands — in state *and* in
   * the cache — while it still matches; `renderSeq` additionally drops it once
   * a newer render has *started*, so a slow stale export never clobbers a
   * newer one.
   */
  const activeRenderKeyRef = useRef<string | null>(null);
  const renderSeqRef = useRef(0);

  const throttledRender = useMemo(
    () =>
      throttle((request: AssistantPreviewRenderRequest) => {
        if (activeRenderKeyRef.current !== request.renderKey) {
          // parked trailing render whose render key was superseded
          return;
        }
        const seq = ++renderSeqRef.current;
        void renderAIAssistantPreviewDataUrl(request).then((previewSvg) => {
          if (
            renderSeqRef.current !== seq ||
            activeRenderKeyRef.current !== request.renderKey
          ) {
            return;
          }
          if (previewSvg) {
            setCachedPreview(request.messageId, {
              renderKey: request.renderKey,
              skeletons: request.skeletons,
              previewSvg,
            });
            setPreviewState(toPreviewState(previewSvg, "done"));
          } else {
            setPreviewState(toPreviewState(null, "unavailable"));
          }
        });
      }, ASSISTANT_PREVIEW_RENDER_THROTTLE_DELAY),
    [],
  );

  // NOTE deliberately no effect cleanup: canceling the throttle between runs
  // would drop the parked trailing render on every streaming chunk. Stale
  // parked/in-flight renders self-drop via the epoch checks above instead
  // (at worst one parked render completes after unmount and warms the cache).
  useEffect(() => {
    if (!skeletons?.length) {
      activeRenderKeyRef.current = null;
      renderSeqRef.current += 1;
      throttledRender.cancel();
      setPreviewState(toPreviewState(null, "unavailable"));
      return;
    }

    const cachedPreview = getCachedPreview(message.id, renderKey, skeletons);

    if (!enabled) {
      // offscreen history rows (IntersectionObserver lazy rendering): no
      // render work — fall back to the cached preview or stay idle
      activeRenderKeyRef.current = null;
      renderSeqRef.current += 1;
      throttledRender.cancel();
      setPreviewState(
        cachedPreview
          ? toPreviewState(cachedPreview, "done")
          : toPreviewState(null, "idle"),
      );
      return;
    }

    activeRenderKeyRef.current = renderKey;

    if (cachedPreview) {
      renderSeqRef.current += 1;
      throttledRender.cancel();
      setPreviewState(toPreviewState(cachedPreview, "done"));
      return;
    }

    // keep the previous preview visible while the replacement renders
    setPreviewState((prev) =>
      prev.status === "loading"
        ? prev
        : { previewSvg: prev.previewSvg, status: "loading" },
    );

    const request: AssistantPreviewRenderRequest = {
      app,
      theme,
      messageId: message.id,
      renderKey,
      skeletons,
    };
    if (isStreaming) {
      throttledRender(request);
    } else {
      // terminal renders are immediate: cancel() resets the throttle window,
      // so the call below invokes on its leading edge
      throttledRender.cancel();
      throttledRender(request);
    }
  }, [
    app,
    enabled,
    isStreaming,
    message.id,
    renderKey,
    skeletons,
    theme,
    throttledRender,
  ]);

  return previewState;
};
