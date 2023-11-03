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
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[Car]";

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
  const [mermaidToExcalidrawLib, setMermaidToExcalidrawLib] = useState<{
    loaded: boolean;
    api: {
      parseMermaidToExcalidraw: (
        defination: string,
        options: MermaidOptions,
      ) => Promise<MermaidToExcalidrawResult>;
    } | null;
  }>({ loaded: false, api: null });

  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text.trim());
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
    setError(null);
    canvasNode.replaceChildren();
  };

  useEffect(() => {
    const loadMermaidToExcalidrawLib = async () => {
      const api = await import(
        /* webpackChunkName:"mermaid-to-excalidraw" */ "@excalidraw/mermaid-to-excalidraw"
      );
      setMermaidToExcalidrawLib({ loaded: true, api });
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
      const parent = canvasNode?.parentElement;
      if (
        !mermaidToExcalidrawLib.loaded ||
        !canvasNode ||
        !parent ||
        !mermaidToExcalidrawLib.api
      ) {
        return;
      }
      if (!deferredText) {
        resetPreview();
        return;
      }
      try {
        const { elements, files } =
          await mermaidToExcalidrawLib.api.parseMermaidToExcalidraw(
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
      } catch (e: any) {
        parent.style.background = "var(--default-bg-color)";
        if (deferredText) {
          setError(e.message);
        }
      }
    };
    renderExcalidrawPreview();
  }, [deferredText, mermaidToExcalidrawLib]);

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
      size={1200}
      title={
        <>
          <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
          <span className="dialog-mermaid-desc">
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
      <div className="dialog-mermaid-body">
        <div className="dialog-mermaid-panels">
          <div className="dialog-mermaid-panels-text">
            <label>{t("mermaid.syntax")}</label>

            <textarea
              onChange={(event) => setText(event.target.value)}
              value={text}
            />
          </div>
          <div className="dialog-mermaid-panels-preview">
            <label>{t("mermaid.preview")}</label>
            <div className="dialog-mermaid-panels-preview-wrapper">
              {error && <ErrorComp error={error} />}
              {mermaidToExcalidrawLib.loaded ? (
                <div
                  ref={canvasRef}
                  style={{ opacity: error ? "0.15" : 1 }}
                  className="dialog-mermaid-panels-preview-canvas-container"
                />
              ) : (
                <Spinner size="2rem" />
              )}
            </div>
          </div>
        </div>
        <div className="dialog-mermaid-buttons">
          <Button className="dialog-mermaid-insert" onSelect={onSelect}>
            {t("mermaid.button")}
            <span>{ArrowRightIcon}</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
export default MermaidToExcalidraw;
