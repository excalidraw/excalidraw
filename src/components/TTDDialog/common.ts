import { MermaidOptions } from "@excalidraw/mermaid-to-excalidraw";
import { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";
import { DEFAULT_EXPORT_PADDING, DEFAULT_FONT_SIZE } from "../../constants";
import {
  convertToExcalidrawElements,
  exportToCanvas,
} from "../../packages/excalidraw/index";
import { NonDeletedExcalidrawElement } from "../../element/types";
import { AppClassProperties, BinaryFiles } from "../../types";
import { canvasToBlob } from "../../data/blob";

const resetPreview = ({
  canvasRef,
  setError,
}: {
  canvasRef: React.RefObject<HTMLDivElement>;
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

export interface MermaidToExcalidrawLibProps {
  loaded: boolean;
  api: Promise<{
    parseMermaidToExcalidraw: (
      definition: string,
      options: MermaidOptions,
    ) => Promise<MermaidToExcalidrawResult>;
  }>;
}

interface ConvertMermaidToExcalidrawFormatProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
  mermaidDefinition: string;
  setError: (error: Error | null) => void;
  data: React.MutableRefObject<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>;
}

export const convertMermaidToExcalidraw = async ({
  canvasRef,
  mermaidToExcalidrawLib,
  mermaidDefinition,
  setError,
  data,
}: ConvertMermaidToExcalidrawFormatProps) => {
  const canvasNode = canvasRef.current;
  const parent = canvasNode?.parentElement;

  if (!canvasNode || !parent) {
    return;
  }

  if (!mermaidDefinition) {
    resetPreview({ canvasRef, setError });
    return;
  }

  try {
    const api = await mermaidToExcalidrawLib.api;

    let ret;
    try {
      ret = await api.parseMermaidToExcalidraw(mermaidDefinition, {
        fontSize: DEFAULT_FONT_SIZE,
      });
    } catch (err: any) {
      ret = await api.parseMermaidToExcalidraw(
        mermaidDefinition.replace(/"/g, "'"),
        {
          fontSize: DEFAULT_FONT_SIZE,
        },
      );
    }
    const { elements, files } = ret;
    setError(null);

    data.current = {
      elements: convertToExcalidrawElements(elements, {
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
    });
    // if converting to blob fails, there's some problem that will
    // likely prevent preview and export (e.g. canvas too big)
    await canvasToBlob(canvas);
    parent.style.background = "var(--default-bg-color)";
    canvasNode.replaceChildren(canvas);
  } catch (err: any) {
    console.error(err);
    parent.style.background = "var(--default-bg-color)";
    if (mermaidDefinition) {
      setError(err);
    }

    throw err;
  }
};

export const LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW = "mermaid-to-excalidraw";
export const saveMermaidDataToStorage = (data: string) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW, data);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
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
