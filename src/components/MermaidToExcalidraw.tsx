import { useState, useRef, useEffect } from "react";
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

const LOCAL_STORAGE_KEY_MERMAID_TO_EXCALIDRAW = "mermaid-to-excalidraw";

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

const MermaidToExcalidraw = ({
  appState,
  elements,
}: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const mermaidToExcalidrawLib = useRef<any>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const app = useApp();

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
      const data = importMermaidDataFromStorage();
      if (data) {
        setText(data);
      }
    }
  }, [loading]);

  useEffect(() => {
    const convertMermaidToExcal = async () => {
      let mermaidGraphData;
      const canvasNode = canvasRef.current;
      if (!canvasNode) {
        return;
      }
      try {
        mermaidGraphData = await mermaidToExcalidrawLib.current.parseMermaid(
          text,
          {
            fontSize: DEFAULT_FONT_SIZE,
          },
        );
      } catch (e) {
        console.error(e);
        canvasNode.replaceChildren();
      }

      if (mermaidGraphData) {
        const { elements, files } =
          mermaidToExcalidrawLib.current.graphToExcalidraw(mermaidGraphData);

        data.current = {
          elements: convertToExcalidrawElements(elements),
          files,
        };

        const maxWidth = canvasNode.offsetWidth;
        const maxHeight = canvasNode.offsetHeight;
        let dimension = Math.max(maxWidth, maxHeight);
        if (dimension > canvasNode.offsetWidth) {
          dimension = canvasNode.offsetWidth - 10;
        }
        if (dimension > canvasNode.offsetHeight) {
          dimension = canvasNode.offsetHeight;
        }
        exportToCanvas({
          elements: data.current.elements,
          files: data.current.files,
          exportPadding: DEFAULT_EXPORT_PADDING,
          maxWidthOrHeight: dimension,
        }).then((canvas) => {
          // if converting to blob fails, there's some problem that will
          // likely prevent preview and export (e.g. canvas too big)
          return canvasToBlob(canvas).then(() => {
            canvasNode.replaceChildren(canvas);
          });
        });
      }
    };
    convertMermaidToExcal();
  }, [text]);

  const setAppState = useExcalidrawSetAppState();

  const onClose = () => {
    const activeTool = updateActiveTool(appState, { type: "selection" });
    setAppState({ activeTool });
    saveMermaidDataToStorage(text);
  };

  const onSelect = () => {
    const { elements: newElements, files } = data.current;
    app.scene.replaceAllElements([...elements, ...newElements]);
    app.addFiles(Object.values(files || []));
    app.scrollToContent(newElements);

    app.setSelection(newElements);

    onClose();
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={
        <>
          <p style={{ marginBottom: "5px" }}>Mermaid to Excalidraw</p>
          <span
            style={{ fontSize: "15px", fontStyle: "italic", fontWeight: 500 }}
          >
            Currently only flowcharts are supported. The other types would be
            rendered as image in Excalidraw
          </span>
        </>
      }
    >
      <div className="mermaid-to-excalidraw-wrapper">
        <div
          className="mermaid-to-excalidraw-wrapper-text"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <label>Describe</label>
          <textarea
            style={{
              padding: "0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--ImageExportModal-preview-border)",
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
          <div
            className="mermaid-to-excalidraw-wrapper-preview-canvas"
            ref={canvasRef}
          ></div>
          <Button
            className="mermaid-to-excalidraw-wrapper-preview-insert"
            onSelect={onSelect}
          >
            Insert
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
export default MermaidToExcalidraw;
