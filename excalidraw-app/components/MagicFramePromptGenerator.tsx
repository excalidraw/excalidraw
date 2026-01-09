import { useState, useEffect, useCallback } from "react";
import {
  exportToBlob,
  getTextFromElements,
  MIME_TYPES,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import {
  CaptureUpdateAction,
  isMagicFrameElement,
  newIframeElement,
} from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  generatePromptFromWireframe,
  generateImageDescription,
  wrapMarkdownInHtml,
} from "./AI";

declare global {
  interface WindowEventMap {
    "excalidraw:generate-prompt-request": CustomEvent<{ frameId: string }>;
    "excalidraw:describe-image-request": CustomEvent<{ frameId: string }>;
  }
}

interface MagicFramePromptGeneratorProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

type GenerationType = "prompt" | "describe";

export const MagicFramePromptGenerator = ({
  excalidrawAPI,
}: MagicFramePromptGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneration = useCallback(
    async (frameId: string, type: GenerationType) => {
      if (isGenerating) {
        return;
      }

      const elements = excalidrawAPI.getSceneElements();
      const frame = elements.find((el) => el.id === frameId);

      if (!frame || !isMagicFrameElement(frame)) {
        console.error("Magic frame not found");
        return;
      }

      setIsGenerating(true);

      const children = elements.filter((el) => el.frameId === frame.id);

      if (!children.length) {
        excalidrawAPI.setToast({
          message: "Cannot generate from an empty frame",
          closable: true,
        });
        setIsGenerating(false);
        return;
      }

      const iframeElement = newIframeElement({
        type: "iframe",
        x: frame.x + frame.width + 30,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        customData: {
          generationData: { status: "pending" },
        },
      });

      excalidrawAPI.updateScene({
        elements: [...elements, iframeElement],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      try {
        const appState = excalidrawAPI.getAppState();

        const blob = await exportToBlob({
          elements: children,
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: appState.viewBackgroundColor,
          },
          exportingFrame: frame,
          files: excalidrawAPI.getFiles(),
          mimeType: MIME_TYPES.jpg,
        });

        const dataURL = await getDataURL(blob);

        let markdown: string;
        let title: string;

        if (type === "prompt") {
          const textElements = getTextFromElements(children);
          markdown = await generatePromptFromWireframe(dataURL, textElements);
          title = "Development Prompt";
        } else {
          markdown = await generateImageDescription(dataURL);
          title = "Image Description";
        }

        const htmlWrapper = wrapMarkdownInHtml(markdown, appState.theme, title);

        excalidrawAPI.updateScene({
          elements: excalidrawAPI.getSceneElements().map((el) =>
            el.id === iframeElement.id
              ? {
                  ...el,
                  customData: {
                    generationData: { status: "done", html: htmlWrapper },
                  },
                }
              : el,
          ),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      } catch (error) {
        console.error("Generation failed:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Generation failed";

        excalidrawAPI.updateScene({
          elements: excalidrawAPI.getSceneElements().map((el) =>
            el.id === iframeElement.id
              ? {
                  ...el,
                  customData: {
                    generationData: {
                      status: "error",
                      code: "ERR_GENERATION",
                      message: errorMessage,
                    },
                  },
                }
              : el,
          ),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [excalidrawAPI, isGenerating],
  );

  const handlePromptRequest = useCallback(
    (e: CustomEvent<{ frameId: string }>) => {
      handleGeneration(e.detail.frameId, "prompt");
    },
    [handleGeneration],
  );

  const handleDescribeRequest = useCallback(
    (e: CustomEvent<{ frameId: string }>) => {
      handleGeneration(e.detail.frameId, "describe");
    },
    [handleGeneration],
  );

  useEffect(() => {
    window.addEventListener(
      "excalidraw:generate-prompt-request",
      handlePromptRequest,
    );
    window.addEventListener(
      "excalidraw:describe-image-request",
      handleDescribeRequest,
    );
    return () => {
      window.removeEventListener(
        "excalidraw:generate-prompt-request",
        handlePromptRequest,
      );
      window.removeEventListener(
        "excalidraw:describe-image-request",
        handleDescribeRequest,
      );
    };
  }, [handlePromptRequest, handleDescribeRequest]);

  return null;
};
