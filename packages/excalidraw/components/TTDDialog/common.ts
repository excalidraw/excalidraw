import {
  DEFAULT_EXPORT_PADDING,
  EDITOR_LS_KEYS,
  THEME,
} from "@excalidraw/common";

import { convertToExcalidrawElements } from "@excalidraw/element";

import { exportToCanvas } from "@excalidraw/utils";

import type {
  NonDeletedExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";

import { EditorLocalStorage } from "../../data/EditorLocalStorage";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";

import type { MermaidToExcalidrawLibProps } from "./types";

import type { AppClassProperties, BinaryFiles } from "../../types";

const BR_TAG_RE = /<br\s*\/?>/gi;

/**
 * Replaces `<br>` / `<br/>` / `<br />` tags with newlines in Mermaid
 * skeleton element text, since Mermaid supports them for multiline
 * labels but Excalidraw renders them as literal text.
 */
export const sanitizeMermaidElementText = (
  elements: ExcalidrawElementSkeleton[],
): ExcalidrawElementSkeleton[] =>
  elements.map((el) => {
    const result = { ...el } as any;
    if ("text" in result && typeof result.text === "string") {
      result.text = result.text.replace(BR_TAG_RE, "\n");
    }
    if (result.label?.text) {
      result.label = {
        ...result.label,
        text: result.label.text.replace(BR_TAG_RE, "\n"),
      };
    }
    return result;
  });

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

    data.current = {
      elements: convertToExcalidrawElements(
        sanitizeMermaidElementText(elements),
        { regenerateIds: true },
      ),
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
