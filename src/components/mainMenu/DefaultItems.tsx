import clsx from "clsx";
import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { t } from "../../i18n";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
  useExcalidrawActionManager,
} from "../App";
import { ExportIcon, ExportImageIcon, UsersIcon } from "../icons";
import { GithubIcon, DiscordIcon, TwitterIcon } from "../icons";
import DropdownMenuItem from "../dropdownMenu/DropdownMenuItem";
import DropdownMenuItemLink from "../dropdownMenu/DropdownMenuItemLink";

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
      onSelect={() => setAppState({ openDialog: "imageExport" })}
      shortcut={getShortcutFromShortcutName("imageExport")}
      ariaLabel={t("buttons.exportImage")}
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
    <div style={{ marginTop: "0.5rem" }}>
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
      onSelect={() => {
        setAppState({ openDialog: "jsonExport" });
      }}
      dataTestId="json-export-button"
      ariaLabel={t("buttons.export")}
    >
      {t("buttons.export")}
    </DropdownMenuItem>
  );
};
Export.displayName = "Export";

export const Socials = () => (
  <>
    <DropdownMenuItemLink
      icon={GithubIcon}
      href="https://github.com/excalidraw/excalidraw"
      ariaLabel="GitHub"
    >
      GitHub
    </DropdownMenuItemLink>
    <DropdownMenuItemLink
      icon={DiscordIcon}
      href="https://discord.gg/UexuTaE"
      ariaLabel="Discord"
    >
      Discord
    </DropdownMenuItemLink>
    <DropdownMenuItemLink
      icon={TwitterIcon}
      href="https://twitter.com/excalidraw"
      ariaLabel="Twitter"
    >
      Twitter
    </DropdownMenuItemLink>
  </>
);
Socials.displayName = "Socials";

export const LiveCollaboration = ({
  onSelect,
  isCollaborating,
}: {
  onSelect: () => void;
  isCollaborating: boolean;
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
      onSelect={onSelect}
    >
      {t("labels.liveCollaboration")}
    </DropdownMenuItem>
  );
};

LiveCollaboration.displayName = "LiveCollaboration";
