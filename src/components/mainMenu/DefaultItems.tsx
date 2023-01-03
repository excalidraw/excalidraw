import clsx from "clsx";
import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { t } from "../../i18n";
import { ExcalidrawProps } from "../../types";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
  useExcalidrawActionManager,
} from "../App";
import { ExportIcon, ExportImageIcon, UsersIcon } from "../icons";
import { GithubIcon, DiscordIcon, TwitterIcon } from "../icons";
import MenuItem from "../menu/MenuItem";

export const LoadScene = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();
  if (appState.viewModeEnabled) {
    return null;
  }
  return actionManager.renderAction("loadScene");
};
LoadScene.displayName = "LoadScene";

export const SaveToActiveFile = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();
  if (!appState.fileHandle) {
    return null;
  }
  return actionManager.renderAction("saveToActiveFile");
};
SaveToActiveFile.displayName = "SaveToActiveFile";

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
SaveAsImage.displayName = "SaveAsImage";

export const Help = () => {
  const actionManager = useExcalidrawActionManager();
  return actionManager.renderAction("toggleShortcuts", undefined, true);
};
Help.displayName = "Help";

export const ClearCanvas = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (appState.viewModeEnabled) {
    return null;
  }
  return actionManager.renderAction("clearCanvas");
};
ClearCanvas.displayName = "ClearCanvas";

export const ToggleTheme = () => {
  const actionManager = useExcalidrawActionManager();
  return actionManager.renderAction("toggleTheme");
};
ToggleTheme.displayName = "ToggleTheme";

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
ChangeCanvasBackground.displayName = "ChangeCanvasBackground";

export const Export = () => {
  const setAppState = useExcalidrawSetAppState();
  return (
    <MenuItem
      icon={ExportIcon}
      onClick={() => {
        setAppState({ openDialog: "jsonExport" });
      }}
      dataTestId="json-export-button"
    >
      {t("buttons.export")}
    </MenuItem>
  );
};
Export.displayName = "Export";

export const Socials = () => (
  <>
    <MenuItem icon={GithubIcon} link="https://github.com/excalidraw/excalidraw">
      GitHub
    </MenuItem>
    <MenuItem icon={DiscordIcon} link="https://discord.gg/UexuTaE">
      Discord
    </MenuItem>
    <MenuItem icon={TwitterIcon} link="https://twitter.com/excalidraw">
      Twitter
    </MenuItem>
  </>
);

Socials.displayName = "Socials";

export const LiveCollaboration = ({
  onClick,
  isCollaborating,
}: {
  onClick: ExcalidrawProps["onCollabButtonClick"];
  isCollaborating: ExcalidrawProps["isCollaborating"];
}) => {
  return (
    <MenuItem
      dataTestId="collab-button"
      icon={UsersIcon}
      className={clsx({
        "active-collab": isCollaborating,
      })}
      onClick={onClick}
    >
      {t("labels.liveCollaboration")}
    </MenuItem>
  );
};

LiveCollaboration.displayName = "LiveCollaboration";
