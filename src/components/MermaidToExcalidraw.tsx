import { useState, useRef, useEffect, useDeferredValue } from "react";
import { AppState, BinaryFiles } from "../types";
import { updateActiveTool } from "../utils";
import { useApp, useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

import "./MermaidToExcalidraw.scss";
import { DEFAULT_EXPORT_PADDING, DEFAULT_FONT_SIZE } from "../constants";
import {
  convertToExcalidrawElements,
  exportToCanvas,
} from "../packages/excalidraw/index";
import { NonDeletedExcalidrawElement } from "../element/types";
import { canvasToBlob } from "../data/blob";
import { ArrowRightIcon } from "./icons";
import Spinner from "./Spinner";

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
    <div
      style={{
        color: "red",
        fontWeight: 800,
        fontSize: "30px",
        wordBreak: "break-word",
        overflow: "auto",
        maxHeight: "100%",
        textAlign: "center",
      }}
    >
      Error! <p style={{ fontSize: "18px", fontWeight: "600" }}>{error}</p>
    </div>
  );
};

const MermaidToExcalidraw = ({
  appState,
  elements,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const mermaidToExcalidrawLib = useRef<any>(null);
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
    if (!loading) {
      const data = importMermaidDataFromStorage() || MERMAID_EXAMPLE;

      setText(data);
    }
  }, [loading]);

  useEffect(() => {
    const renderExcalidrawPreview = async () => {
      const canvasNode = canvasRef.current;
      if (!canvasNode) {
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
        parent.style.background = "#fff";
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
  }, [deferredText, appState]);

  const setAppState = useExcalidrawSetAppState();

  const onClose = () => {
    const activeTool = updateActiveTool(appState, { type: "selection" });
    setAppState({ activeTool });
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
      onCloseRequest={onClose}
      title={
        <>
          <p style={{ marginBottom: "5px", marginTop: "2px" }}>
            Mermaid to Excalidraw
          </p>
          <span
            style={{ fontSize: "15px", fontStyle: "italic", fontWeight: 500 }}
          >
            Currently only{" "}
            <a href="https://mermaid.js.org/syntax/flowchart.html">
              flowcharts
            </a>{" "}
            are supported. The other types will be rendered as image in
            Excalidraw. <br />
          </span>
        </>
      }
    >
      <div className="mermaid-to-excalidraw-wrapper">
        <div
          className="mermaid-to-excalidraw-wrapper-text"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <label>Mermaid Syntax</label>

          <textarea
            style={{
              padding: "0.85rem",
              borderRadius: "8px",
              border: "1px solid #e4e4eb",
              whiteSpace: "pre-wrap",
            }}
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
        </div>
        <div
          className="mermaid-to-excalidraw-wrapper-preview"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <label>Preview</label>
          <div className="mermaid-to-excalidraw-wrapper-preview-canvas">
            {error && <ErrorComp error={error} />}
            {loading && <Spinner size="2rem" />}
            <div ref={canvasRef} />
          </div>
          <Button
            className="mermaid-to-excalidraw-wrapper-preview-insert"
            onSelect={onSelect}
          >
            Insert{" "}
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
