import { useState, useRef, useEffect } from "react";
import { AppState, BinaryFiles } from "../types";
import { updateActiveTool } from "../utils";
import { useApp, useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import {
  parseMermaid,
  graphToExcalidraw,
} from "@excalidraw/mermaid-to-excalidraw";

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
  const [text, setText] = useState("");
  const [canvasData, setCanvasData] = useState<{
    //@ts-ignore
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });
  const canvasRef = useRef<HTMLDivElement>(null);
  const app = useApp();

  useEffect(() => {
    const data = importMermaidDataFromStorage();
    if (data) {
      setText(data);
    }
  }, []);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) {
      return;
    }
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
      elements: canvasData.elements,
      files: canvasData.files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: dimension,
    }).then((canvas) => {
      // if converting to blob fails, there's some problem that will
      // likely prevent preview and export (e.g. canvas too big)
      return canvasToBlob(canvas).then(() => {
        canvasNode.replaceChildren(canvas);
      });
    });
  }, [canvasData, canvasRef]);

  useEffect(() => {
    const convertMermaidToExcal = async () => {
      let mermaidGraphData;
      try {
        mermaidGraphData = await parseMermaid(text, {
          fontSize: DEFAULT_FONT_SIZE,
        });
      } catch (e) {
        // Parse error, displaying error message to users
      }

      if (mermaidGraphData) {
        const { elements, files } = graphToExcalidraw(mermaidGraphData);

        setCanvasData({
          elements: convertToExcalidrawElements(elements),
          files,
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
    app.scene.replaceAllElements([...elements, ...canvasData.elements]);
    app.addFiles(Object.values(canvasData.files || []));
    app.scrollToContent(canvasData.elements);

    app.setSelection(canvasData.elements);

    onClose();
  };

  return (
    <Dialog onCloseRequest={onClose} title="Mermaid to Excalidraw">
      <div className="mermaid-to-excalidraw-wrapper">
        <div className="mermaid-to-excalidraw-wrapper-text">
          <label>Describe</label>
          <textarea
            onChange={(event) => setText(event.target.value)}
            value={text}
          />
        </div>
        <div className="mermaid-to-excalidraw-wrapper-preview">
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
