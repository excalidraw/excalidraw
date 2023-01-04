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
import DropdownMenuItem from "../dropdownMenu/DropdownMenuItem";

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
  // Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();
  return (
    <DropdownMenuItem
      icon={ExportImageIcon}
      dataTestId="image-export-button"
      onClick={() => setAppState({ openDialog: "imageExport" })}
      shortcut={getShortcutFromShortcutName("imageExport")}
    >
      {t("buttons.exportImage")}
    </DropdownMenuItem>
  );
};
SaveAsImage.displayName = "SaveAsImage";

export const Help = () => {
  // Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();

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
  // Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();
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
  // Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  return (
    <DropdownMenuItem
      icon={ExportIcon}
      onClick={() => {
        setAppState({ openDialog: "jsonExport" });
      }}
      dataTestId="json-export-button"
    >
      {t("buttons.export")}
    </DropdownMenuItem>
  );
};
Export.displayName = "Export";

export const Socials = () => (
  <>
    <DropdownMenuItem
      icon={GithubIcon}
      link="https://github.com/excalidraw/excalidraw"
    >
      GitHub
    </DropdownMenuItem>
    <DropdownMenuItem icon={DiscordIcon} link="https://discord.gg/UexuTaE">
      Discord
    </DropdownMenuItem>
    <DropdownMenuItem icon={TwitterIcon} link="https://twitter.com/excalidraw">
      Twitter
    </DropdownMenuItem>
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
  // Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();
  return (
    <DropdownMenuItem
      dataTestId="collab-button"
      icon={UsersIcon}
      className={clsx({
        "active-collab": isCollaborating,
      })}
      onClick={onClick}
    >
      {t("labels.liveCollaboration")}
    </DropdownMenuItem>
  );
};

LiveCollaboration.displayName = "LiveCollaboration";
