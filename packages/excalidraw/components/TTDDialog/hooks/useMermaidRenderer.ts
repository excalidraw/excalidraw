import { useCallback, useEffect, useMemo, useRef } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { useAtom } from "../../../editor-jotai";

import { chatHistoryAtom, errorAtom, showPreviewAtom } from "../TTDContext";
import { convertMermaidToExcalidraw } from "../common";
import { isValidMermaidSyntax } from "../utils/mermaidValidation";

import { getLastAssistantMessage } from "../utils/chat";

import { useUIAppState } from "../../../context/ui-appState";

import type { BinaryFiles } from "../../../types";
import type { MermaidToExcalidrawLibProps } from "../types";

const FAST_THROTTLE_DELAY = 300;
const SLOW_THROTTLE_DELAY = 3000;
const RENDER_SPEED_THRESHOLD = 100;
const PARSE_FAIL_DELAY = 100;

interface UseMermaidRendererProps {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export const useMermaidRenderer = ({
  mermaidToExcalidrawLib,
  canvasRef,
}: UseMermaidRendererProps) => {
  const [chatHistory] = useAtom(chatHistoryAtom);
  const [, setError] = useAtom(errorAtom);

  const [showPreview, setShowPreview] = useAtom(showPreviewAtom);
  const isRenderingRef = useRef(false);

  const lastAssistantMessage = useMemo(
    () => getLastAssistantMessage(chatHistory),
    [chatHistory],
  );

  // Keeping lastAssistantMesssage in ref, so I can access it in useEffect hooks
  const lastAssistantMessageRef = useRef(lastAssistantMessage);
  useEffect(() => {
    lastAssistantMessageRef.current = lastAssistantMessage;
  }, [lastAssistantMessage]);

  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({
    elements: [],
    files: null,
  });

  const lastRenderTimeRef = useRef(0);
  const pendingContentRef = useRef<string | null>(null);
  const hasErrorOffsetRef = useRef(false);
  const currentThrottleDelayRef = useRef(FAST_THROTTLE_DELAY);

  const { theme } = useUIAppState();

  const renderMermaid = useCallback(
    async (mermaidDefinition: string): Promise<boolean> => {
      if (!mermaidDefinition.trim() || !mermaidToExcalidrawLib.loaded) {
        return false;
      }

      if (isRenderingRef.current) {
        return false;
      }

      isRenderingRef.current = true;

      const renderStartTime = performance.now();

      const result = await convertMermaidToExcalidraw({
        canvasRef,
        data,
        mermaidToExcalidrawLib,
        setError,
        mermaidDefinition,
        theme,
      });

      const renderDuration = performance.now() - renderStartTime;

      if (renderDuration < RENDER_SPEED_THRESHOLD) {
        currentThrottleDelayRef.current = FAST_THROTTLE_DELAY;
      } else {
        currentThrottleDelayRef.current = SLOW_THROTTLE_DELAY;
      }

      isRenderingRef.current = false;
      return result.success;
    },
    [canvasRef, mermaidToExcalidrawLib, setError, theme],
  );

  const throttledRenderMermaid = useMemo(() => {
    const fn = async (content: string) => {
      const now = Date.now();
      const timeSinceLastRender = now - lastRenderTimeRef.current;
      const throttleDelay = currentThrottleDelayRef.current;

      if (!isValidMermaidSyntax(content)) {
        if (!hasErrorOffsetRef.current) {
          lastRenderTimeRef.current = Math.max(
            lastRenderTimeRef.current,
            now - throttleDelay + PARSE_FAIL_DELAY,
          );
          hasErrorOffsetRef.current = true;
        }
        pendingContentRef.current = content;
        return;
      }

      hasErrorOffsetRef.current = false;

      if (timeSinceLastRender < throttleDelay) {
        pendingContentRef.current = content;
        return;
      }

      pendingContentRef.current = null;
      const success = await renderMermaid(content);
      lastRenderTimeRef.current = Date.now();

      if (!success) {
        lastRenderTimeRef.current =
          lastRenderTimeRef.current - throttleDelay + PARSE_FAIL_DELAY;
        hasErrorOffsetRef.current = true;
      }
    };

    fn.flush = async () => {
      if (pendingContentRef.current) {
        const content = pendingContentRef.current;
        pendingContentRef.current = null;
        await renderMermaid(content);
        lastRenderTimeRef.current = Date.now();
      }
    };

    fn.cancel = () => {
      pendingContentRef.current = null;
    };

    return fn;
  }, [renderMermaid]);

  const resetThrottleState = useCallback(() => {
    lastRenderTimeRef.current = 0;
    pendingContentRef.current = null;
    hasErrorOffsetRef.current = false;
    currentThrottleDelayRef.current = FAST_THROTTLE_DELAY;
  }, []);

  // this hook is responsible for keep rendering during streaming
  useEffect(() => {
    if (lastAssistantMessage?.content && lastAssistantMessage?.isGenerating) {
      throttledRenderMermaid(lastAssistantMessage.content);
    } else if (!lastAssistantMessage?.isGenerating) {
      throttledRenderMermaid.flush();
      resetThrottleState();
      if (lastAssistantMessage?.content) {
        throttledRenderMermaid(lastAssistantMessage.content);
      }
    }
  }, [
    resetThrottleState,
    throttledRenderMermaid,
    lastAssistantMessage?.isGenerating,
    lastAssistantMessage?.content,
  ]);

  // render the last message if the user navigates between the existing chats
  useEffect(() => {
    const msg = lastAssistantMessageRef.current;
    if (!msg?.content || msg.error) {
      return;
    }

    if (!showPreview) {
      return;
    }

    renderMermaid(msg.content);
  }, [chatHistory?.id, renderMermaid, showPreview]);

  useEffect(() => {
    if (
      !chatHistory.messages?.filter((msg) => msg.type === "assistant").length
    ) {
      const canvasNode = canvasRef.current;
      if (canvasNode) {
        const parent = canvasNode.parentElement;
        if (parent) {
          parent.style.background = "";
          canvasNode.replaceChildren();
        }
      }
      setShowPreview(false);
    } else if (!showPreview) {
      setShowPreview(true);
    }
  }, [chatHistory.messages, setShowPreview, canvasRef, showPreview]);

  return {
    data,
  };
};
