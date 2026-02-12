import { DEFAULT_EXPORT_PADDING, EDITOR_LS_KEYS } from "@excalidraw/common";

import type {
  NonDeletedExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";

import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import {
  convertToExcalidrawElements,
  exportToCanvas,
  THEME,
} from "../../index";

import type { MermaidToExcalidrawLibProps } from "./types";

import type { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";

import type { AppClassProperties, BinaryFiles } from "../../types";

/**
 * Replaces HTML <br> tags (including <br/> and <br />) with newline characters.
 * Mermaid supports <br> tags for multiline text in node labels,
 * but Excalidraw renders text as-is, so we need to convert them to newlines.
 */
const replaceBrTags = (text: string): string => {
  return text.replace(/<br\s*\/?>/gi, "\n");
};

/**
 * Post-processes skeleton elements from mermaid-to-excalidraw to convert
 * HTML <br> tags in text labels to actual newline characters.
 */
export const sanitizeMermaidElements = (
  elements: MermaidToExcalidrawResult["elements"],
): MermaidToExcalidrawResult["elements"] => {
  return elements.map((el) => {
    const result = { ...el };

    // Handle label text on container elements (rectangles, diamonds, etc.)
    if (
      "label" in result &&
      result.label &&
      typeof result.label === "object" &&
      "text" in result.label &&
      typeof result.label.text === "string"
    ) {
      result.label = {
        ...result.label,
        text: replaceBrTags(result.label.text),
      };
    }

    // Handle direct text property on text elements
    if ("text" in result && typeof result.text === "string") {
      (result as any).text = replaceBrTags(result.text);
    }

    return result;
  });
};

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
      try {
        ret = await api.parseMermaidToExcalidraw(mermaidDefinition);
      } catch (err: unknown) {
        ret = await api.parseMermaidToExcalidraw(
          mermaidDefinition.replace(/"/g, "'"),
        );
      }
    } catch (err: unknown) {
      return { success: false, error: err as Error };
    }

    const { elements, files } = ret;
    setError(null);

    data.current = {
      elements: convertToExcalidrawElements(
        sanitizeMermaidElements(elements),
        {
          regenerateIds: true,
        },
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
