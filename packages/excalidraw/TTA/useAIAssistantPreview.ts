import { useCallback, useEffect, useRef, useState } from "react";

import { Scene } from "@excalidraw/element";
import { exportToSvg } from "@excalidraw/utils/export";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { useApp } from "../components/App";
import { useAppStateValue } from "../hooks/useAppStateValue";

import {
  convertAISkeletonsToSceneElements,
  fixBoundTextElements,
} from "./insertAISkeletons";

import type { Dispatch, SetStateAction } from "react";

import type { AssistantChatMessage } from "./types";
import type { AppClassProperties, AppState } from "../types";

const ASSISTANT_PREVIEW_RENDER_THROTTLE_DELAY = 300;

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
  messageId: string;
  renderKey: string;
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>;
};

type UseAIAssistantPreviewOptions = {
  enabled?: boolean;
};

const assistantPreviewCache = new Map<string, AssistantPreviewCacheEntry>();

const isDarkTheme = (theme: AppState["theme"]) => theme === "dark";

const getRenderKey = (
  message: AssistantChatMessage,
  theme: AppState["theme"],
) =>
  [
    message.id,
    message.messageId ?? "",
    message.turnId ?? "",
    theme,
    message.isComplete === false ? "streaming" : "complete",
  ].join(":");

const getCachedPreview = (
  messageId: string,
  renderKey: string,
  skeletons: ReadonlyArray<ExcalidrawElementSkeleton>,
) => {
  const cached = assistantPreviewCache.get(messageId);
  if (cached?.renderKey === renderKey && cached.skeletons === skeletons) {
    return cached.previewSvg;
  }
  return null;
};

const setLoadingState = (
  setPreviewState: Dispatch<SetStateAction<AIAssistantPreviewState>>,
) => {
  setPreviewState((prev) =>
    prev.status === "loading"
      ? prev
      : {
          previewSvg: prev.previewSvg,
          status: "loading",
        },
  );
};

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
  message: AssistantChatMessage,
  options: UseAIAssistantPreviewOptions = {},
): AIAssistantPreviewState => {
  const app = useApp();
  const theme = useAppStateValue("theme");
  const enabled = options.enabled ?? true;
  const skeletons = message.skeletons;
  const isStreaming = message.isComplete === false && !message.error;
  const renderKey = getRenderKey(message, theme);

  const [previewState, setPreviewState] = useState<AIAssistantPreviewState>(
    () => {
      // NOTE errored messages may still carry partial skeletons streamed
      // before the failure (C2 in tta.md) — render them so the salvaged
      // partial result stays previewable alongside the error.
      if (!skeletons?.length) {
        return {
          previewSvg: null,
          status: "unavailable",
        };
      }

      const cachedPreview = getCachedPreview(message.id, renderKey, skeletons);
      if (cachedPreview) {
        return {
          previewSvg: cachedPreview,
          status: "done",
        };
      }

      return {
        previewSvg: null,
        status: enabled ? "loading" : "idle",
      };
    },
  );

  const latestRenderKeyRef = useRef<string | null>(null);
  const renderTokenRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const isRenderingRef = useRef(false);
  const pendingRenderRef = useRef<AssistantPreviewRenderRequest | null>(null);
  const scheduledRenderRef = useRef<number | null>(null);

  const clearScheduledRender = useCallback(() => {
    if (scheduledRenderRef.current !== null) {
      window.clearTimeout(scheduledRenderRef.current);
      scheduledRenderRef.current = null;
    }
  }, []);

  const schedulePendingRender = useCallback(
    (delay: number, flushPendingRender: () => void) => {
      clearScheduledRender();
      scheduledRenderRef.current = window.setTimeout(() => {
        scheduledRenderRef.current = null;
        flushPendingRender();
      }, delay);
    },
    [clearScheduledRender],
  );

  const renderPreview = useCallback(
    async (request: AssistantPreviewRenderRequest) => {
      isRenderingRef.current = true;
      const renderToken = ++renderTokenRef.current;
      setLoadingState(setPreviewState);

      const previewSvg = await renderAIAssistantPreviewDataUrl({
        app,
        skeletons: request.skeletons,
        theme,
      });

      if (
        renderTokenRef.current === renderToken &&
        latestRenderKeyRef.current === request.renderKey
      ) {
        if (previewSvg) {
          assistantPreviewCache.set(request.messageId, {
            renderKey: request.renderKey,
            skeletons: request.skeletons,
            previewSvg,
          });
          setPreviewState({
            previewSvg,
            status: "done",
          });
        } else {
          setPreviewState({
            previewSvg: null,
            status: "unavailable",
          });
        }
      }

      isRenderingRef.current = false;
      lastRenderTimeRef.current = Date.now();
      flushPendingRenderRef.current();
    },
    [app, theme],
  );

  const flushPendingRenderRef = useRef<() => void>(() => {});

  const requestPreviewRender = useCallback(
    (request: AssistantPreviewRenderRequest, throttle: boolean) => {
      latestRenderKeyRef.current = request.renderKey;
      const cachedPreview = getCachedPreview(
        request.messageId,
        request.renderKey,
        request.skeletons,
      );

      if (cachedPreview) {
        pendingRenderRef.current = null;
        clearScheduledRender();
        setPreviewState({
          previewSvg: cachedPreview,
          status: "done",
        });
        return;
      }

      const existingCache = assistantPreviewCache.get(request.messageId);
      if (existingCache) {
        assistantPreviewCache.delete(request.messageId);
      }

      if (!throttle) {
        pendingRenderRef.current = null;
        clearScheduledRender();
        void renderPreview(request);
        return;
      }

      const timeSinceLastRender = Date.now() - lastRenderTimeRef.current;
      const remainingDelay = Math.max(
        0,
        ASSISTANT_PREVIEW_RENDER_THROTTLE_DELAY - timeSinceLastRender,
      );

      if (isRenderingRef.current || remainingDelay > 0) {
        pendingRenderRef.current = request;
        setLoadingState(setPreviewState);
        if (!isRenderingRef.current) {
          schedulePendingRender(remainingDelay, flushPendingRenderRef.current);
        }
        return;
      }

      void renderPreview(request);
    },
    [clearScheduledRender, renderPreview, schedulePendingRender],
  );

  flushPendingRenderRef.current = () => {
    if (isRenderingRef.current) {
      return;
    }

    const pendingRender = pendingRenderRef.current;
    if (!pendingRender) {
      return;
    }

    pendingRenderRef.current = null;
    requestPreviewRender(pendingRender, true);
  };

  useEffect(() => {
    if (!enabled) {
      latestRenderKeyRef.current = null;
      pendingRenderRef.current = null;
      clearScheduledRender();
      renderTokenRef.current += 1;

      if (skeletons?.length) {
        const cachedPreview = getCachedPreview(
          message.id,
          renderKey,
          skeletons,
        );
        setPreviewState(
          cachedPreview
            ? {
                previewSvg: cachedPreview,
                status: "done",
              }
            : {
                previewSvg: null,
                status: "idle",
              },
        );
      } else {
        setPreviewState({
          previewSvg: null,
          status: "unavailable",
        });
      }
      return;
    }

    if (!skeletons?.length) {
      latestRenderKeyRef.current = null;
      pendingRenderRef.current = null;
      clearScheduledRender();
      renderTokenRef.current += 1;
      setPreviewState({
        previewSvg: null,
        status: "unavailable",
      });
      return;
    }

    requestPreviewRender(
      {
        messageId: message.id,
        renderKey,
        skeletons,
      },
      isStreaming,
    );
  }, [
    clearScheduledRender,
    enabled,
    isStreaming,
    message.error,
    message.id,
    renderKey,
    requestPreviewRender,
    skeletons,
  ]);

  useEffect(() => {
    return () => {
      clearScheduledRender();
      renderTokenRef.current += 1;
    };
  }, [clearScheduledRender]);

  return previewState;
};
