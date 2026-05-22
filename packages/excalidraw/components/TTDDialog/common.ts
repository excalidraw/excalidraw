import {
  DEFAULT_EXPORT_PADDING,
  EDITOR_LS_KEYS,
  THEME,
  getFontString,
} from "@excalidraw/common";

import { convertToExcalidrawElements, measureText } from "@excalidraw/element";

import { exportToCanvas } from "@excalidraw/utils";

import type {
  NonDeletedExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";

import { EditorLocalStorage } from "../../data/EditorLocalStorage";

import type { MermaidToExcalidrawLibProps } from "./types";

import type { AppClassProperties, BinaryFiles } from "../../types";

export const resetPreview = ({
  canvasRef,
  setError,
}: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  setError: (error: Error | null) => void;
}) => {
  const canvasNode = canvasRef.current;

  if (!canvasNode) {
    return;
  }
  const parent = canvasNode.parentElement;
  if (!parent) {
    return;
  }
  parent.style.background = "";
  setError(null);
  canvasNode.replaceChildren();
};

export const convertMermaidToExcalidraw = async ({
  canvasRef,
  mermaidToExcalidrawLib,
  mermaidDefinition,
  setError,
  data,
  theme,
}: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  mermaidDefinition: string;
  setError: (error: Error | null) => void;
  data: React.MutableRefObject<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>;
  theme: Theme;
}): Promise<{ success: true } | { success: false; error?: Error }> => {
  const canvasNode = canvasRef.current;
  const parent = canvasNode?.parentElement;

  if (!canvasNode || !parent) {
    return { success: false };
  }

  if (!mermaidDefinition) {
    resetPreview({ canvasRef, setError });
    return { success: false };
  }

  let ret;
  try {
    const api = await mermaidToExcalidrawLib.api;

    try {
      ret = await api.parseMermaidToExcalidraw(mermaidDefinition);
    } catch (err: unknown) {
      const originalParseError = err as Error;

      if (!mermaidDefinition.includes('"')) {
        return { success: false, error: originalParseError };
      }

      try {
        ret = await api.parseMermaidToExcalidraw(
          mermaidDefinition.replace(/"/g, "'"),
        );
      } catch {
        // Keep the original error so line/column references stay aligned with
        // the user's unmodified input.
        return { success: false, error: originalParseError };
      }
    }

    const { elements, files = {} } = ret;
    setError(null);

    const processedElements = elements.map((el: any) => {
      if (
        el.type === "text" &&
        typeof el.text === "string" &&
        /<br\s*\/?>/i.test(el.text)
      ) {
        const nextText = el.text.replace(/<br\s*\/?>/gi, "\n");
        const nextOriginalText = (el.originalText || el.text).replace(
          /<br\s*\/?>/gi,
          "\n",
        );
        const fontString = getFontString({
          fontSize: el.fontSize ?? 20,
          fontFamily: el.fontFamily ?? 1,
        });
        const metrics = measureText(
          nextText,
          fontString,
          el.lineHeight ?? 1.25,
        );
        return {
          ...el,
          text: nextText,
          originalText: nextOriginalText,
          width: metrics.width,
          height: metrics.height,
        };
      }
      return el;
    });

    data.current = {
      elements: convertToExcalidrawElements(processedElements, {
        regenerateIds: true,
      }),
      files,
    };

    const canvas = await exportToCanvas({
      elements: data.current.elements,
      files: data.current.files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight:
        Math.max(parent.offsetWidth, parent.offsetHeight) *
        window.devicePixelRatio,
      appState: {
        exportWithDarkMode: theme === THEME.DARK,
      },
    });

    parent.style.background = "var(--default-bg-color)";
    canvasNode.replaceChildren(canvas);
    return { success: true };
  } catch (err: any) {
    parent.style.background = "var(--default-bg-color)";
    if (mermaidDefinition) {
      setError(err);
    }

    // Return error so caller can display meaningful error message
    return { success: false, error: err };
  }
};
export const saveMermaidDataToStorage = (mermaidDefinition: string) => {
  EditorLocalStorage.set(
    EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW,
    mermaidDefinition,
  );
};

export const insertToEditor = ({
  app,
  data,
  text,
  shouldSaveMermaidDataToStorage,
}: {
  app: AppClassProperties;
  data: React.MutableRefObject<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>;
  text?: string;
  shouldSaveMermaidDataToStorage?: boolean;
}) => {
  const { elements: newElements, files } = data.current;

  if (!newElements.length) {
    return;
  }

  app.addElementsFromPasteOrLibrary({
    elements: newElements,
    files,
    position: "center",
    fitToContent: true,
  });
  app.setOpenDialog(null);

  if (shouldSaveMermaidDataToStorage && text) {
    saveMermaidDataToStorage(text);
  }
};
