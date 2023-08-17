import { AppState } from "../types";
import { updateActiveTool } from "../utils";
import { useExcalidrawSetAppState } from "./App";
import { Dialog } from "./Dialog";

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
      <div>Hello</div>
    </Dialog>
  );
};
export default MermaidToExcalidraw;
