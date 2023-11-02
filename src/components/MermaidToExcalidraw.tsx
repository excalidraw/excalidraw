import { useState, useRef, useEffect, useDeferredValue } from "react";
import { BinaryFiles } from "../types";
import { useApp } from "./App";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { DEFAULT_EXPORT_PADDING, DEFAULT_FONT_SIZE } from "../constants";
import {
  convertToExcalidrawElements,
  exportToCanvas,
} from "../packages/excalidraw/index";
import { NonDeletedExcalidrawElement } from "../element/types";
import { canvasToBlob } from "../data/blob";
import { ArrowRightIcon } from "./icons";
import Spinner from "./Spinner";
import "./MermaidToExcalidraw.scss";

import { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";
import type { MermaidOptions } from "@excalidraw/mermaid-to-excalidraw";
import { t } from "../i18n";
import Trans from "./Trans";

const LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW = "mermaid-to-excalidraw";
const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[test]";

const saveMermaidDataToStorage = (data: string) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW, data);
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

const importMermaidDataFromStorage = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW);
    if (data) {
      return data;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

const ErrorComp = ({ error }: { error: string }) => {
  return (
    <div data-testid="mermaid-error" className="mermaid-error">
      Error! <p>{error}</p>
    </div>
  );
};

const MermaidToExcalidraw = () => {
  const mermaidToExcalidrawLib = useRef<{
    parseMermaidToExcalidraw: (
      defination: string,
      options: MermaidOptions,
    ) => Promise<MermaidToExcalidrawResult>;
  } | null>(null);
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const app = useApp();

  const resetPreview = () => {
    const canvasNode = canvasRef.current;

    if (!canvasNode) {
      return;
    }
    const parent = canvasNode.parentElement;
    if (!parent) {
      return;
    }
    parent.style.background = "";
    canvasNode.replaceChildren();
  };

  useEffect(() => {
    const loadMermaidToExcalidrawLib = async () => {
      mermaidToExcalidrawLib.current = await import(
        /* webpackChunkName:"mermaid-to-excalidraw" */ "@excalidraw/mermaid-to-excalidraw"
      );
      setLoading(false);
    };
    loadMermaidToExcalidrawLib();
  }, []);

  useEffect(() => {
    const data = importMermaidDataFromStorage() || MERMAID_EXAMPLE;
    setText(data);
  }, []);

  useEffect(() => {
    const renderExcalidrawPreview = async () => {
      const canvasNode = canvasRef.current;
      if (loading || !canvasNode || !mermaidToExcalidrawLib.current) {
        return;
      }
      try {
        const { elements, files } =
          await mermaidToExcalidrawLib.current.parseMermaidToExcalidraw(
            deferredText,
            {
              fontSize: DEFAULT_FONT_SIZE,
            },
          );
        setError(null);

        data.current = {
          elements: convertToExcalidrawElements(elements, {
            regenerateIds: true,
          }),
          files,
        };
        const parent = canvasNode.parentElement!;
        const maxWidth = parent.offsetWidth;
        const maxHeight = parent.offsetHeight;
        let dimension = Math.max(maxWidth, maxHeight);
        dimension = Math.min(dimension, parent.offsetWidth - 10);
        dimension = Math.min(dimension, parent.offsetHeight - 10);

        const canvas = await exportToCanvas({
          elements: data.current.elements,
          files: data.current.files,
          exportPadding: DEFAULT_EXPORT_PADDING,
          maxWidthOrHeight: dimension,
        });
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        await canvasToBlob(canvas);
        parent.style.background = "var(--default-bg-color)";
        canvasNode.replaceChildren(canvas);
      } catch (e: any) {
        console.error(e.message);
        resetPreview();
        if (deferredText) {
          setError(e.message);
        }
      }
    };
    renderExcalidrawPreview();
  }, [deferredText, loading]);

  const onClose = () => {
    app.setOpenDialog(null);
    saveMermaidDataToStorage(text);
  };

  const onSelect = () => {
    const { elements: newElements, files } = data.current;
    app.addElementsFromPasteOrLibrary({
      elements: newElements,
      files,
      position: "center",
      fitToContent: true,
    });
    onClose();
  };

  return (
    <Dialog
      className="dialog-mermaid"
      onCloseRequest={onClose}
      title={
        <>
          <p style={{ marginBottom: "5px", marginTop: "2px" }}>
            {t("mermaid.title")}
          </p>
          <span
            style={{ fontSize: "15px", fontStyle: "italic", fontWeight: 500 }}
          >
            <Trans
              i18nKey="mermaid.description"
              flowchartLink={(el) => (
                <a href="https://mermaid.js.org/syntax/flowchart.html">{el}</a>
              )}
              sequenceLink={(el) => (
                <a href="https://mermaid.js.org/syntax/sequenceDiagram.html">
                  {el}
                </a>
              )}
            />
            <br />
          </span>
        </>
      }
    >
      <div className="mermaid-to-excalidraw-wrapper">
        <div className="mermaid-to-excalidraw-wrapper-text">
          <label>{t("mermaid.syntax")}</label>

          <textarea
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
        </div>
        <div className="mermaid-to-excalidraw-wrapper-preview">
          <label>{t("mermaid.preview")}</label>
          <div className="mermaid-to-excalidraw-wrapper-preview-canvas">
            {error && <ErrorComp error={error} />}
            {loading && <Spinner size="2rem" />}
            <div ref={canvasRef} />
          </div>
          <Button
            className="mermaid-to-excalidraw-wrapper-preview-insert"
            onSelect={onSelect}
          >
            {t("mermaid.button")}
            <span style={{ paddingLeft: "8px", display: "flex" }}>
              {ArrowRightIcon}
            </span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
export default MermaidToExcalidraw;
