import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { t } from "../../i18n";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
  useExcalidrawActionManager,
} from "../App";
import { ExportImageIcon } from "../icons";
import MenuItem from "./MenuItem";

export const LoadScene = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();
  if (appState.viewModeEnabled) {
    return null;
  }
  return actionManager.renderAction("loadScene");
};

export const SaveToActiveFile = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();
  if (!appState.fileHandle) {
    return null;
  }
  return actionManager.renderAction("saveToActiveFile");
};

export const SaveAsImage = () => {
  const setAppState = useExcalidrawSetAppState();
  return (
    <MenuItem
      icon={ExportImageIcon}
      dataTestId="image-export-button"
      onClick={() => setAppState({ openDialog: "imageExport" })}
      shortcut={getShortcutFromShortcutName("imageExport")}
    >
      {t("buttons.exportImage")}
    </MenuItem>
  );
};

export const Help = () => {
  const actionManager = useExcalidrawActionManager();
  return actionManager.renderAction("toggleShortcuts", undefined, true);
};

export const ClearCanvas = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (appState.viewModeEnabled) {
    return null;
  }
  return actionManager.renderAction("clearCanvas");
};
export const ToggleTheme = () => {
  const actionManager = useExcalidrawActionManager();
  return actionManager.renderAction("toggleTheme");
};

export const ChangeCanvasBackground = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (appState.viewModeEnabled) {
    return null;
  }
  return (
    <div>
      <div style={{ fontSize: ".75rem", marginBottom: ".5rem" }}>
        {t("labels.canvasBackground")}
      </div>
      <div style={{ padding: "0 0.625rem" }}>
        {actionManager.renderAction("changeViewBackgroundColor")}
      </div>
    </div>
  );
};
