import { AppState } from "../types";
import { updateActiveTool } from "../utils";
import { useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

import "./MermaidToExcalidraw.scss";
const MermaidToExcalidraw = ({ appState }: { appState: AppState }) => {
  const setAppState = useExcalidrawSetAppState();
  if (appState?.activeTool?.type !== "mermaid") {
    return null;
  }
  return (
    <Dialog
      onCloseRequest={() => {
        const activeTool = updateActiveTool(appState, { type: "selection" });
        setAppState({ activeTool });
      }}
      title="Mermaid to Excalidraw"
    >
      <div className="mermaid-to-excalidraw-wrapper">
        <div className="mermaid-to-excalidraw-wrapper-text">
          <label>Describe</label>
          <textarea />
        </div>
        <div className="mermaid-to-excalidraw-wrapper-preview">
          <label>Preview</label>
          <div className="mermaid-to-excalidraw-wrapper-preview-canvas"></div>
          <Button
            className="mermaid-to-excalidraw-wrapper-preview-insert"
            onSelect={() => console.log("hey")}
          >
            Insert
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
export default MermaidToExcalidraw;
