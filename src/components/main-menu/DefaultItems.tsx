import clsx from "clsx";
import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { t } from "../../i18n";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
  useExcalidrawActionManager,
} from "../App";
import {
  ExportIcon,
  ExportImageIcon,
  HelpIcon,
  LoadIcon,
  MoonIcon,
  save,
  SunIcon,
  TrashIcon,
  UsersIcon,
} from "../icons";
import { GithubIcon, DiscordIcon, TwitterIcon } from "../icons";
import DropdownMenuItem from "../dropdownMenu/DropdownMenuItem";
import DropdownMenuItemLink from "../dropdownMenu/DropdownMenuItemLink";
import {
  actionClearCanvas,
  actionLoadScene,
  actionSaveToActiveFile,
  actionShortcuts,
  actionToggleTheme,
} from "../../actions";

import "./DefaultItems.scss";
import { useState } from "react";
import ConfirmDialog from "../ConfirmDialog";

export const LoadScene = () => {
  // FIXME Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (!actionManager.isActionEnabled(actionLoadScene)) {
    return null;
  }

  return (
    <DropdownMenuItem
      icon={LoadIcon}
      onSelect={() => actionManager.executeAction(actionLoadScene)}
      dataTestId="load-button"
      shortcut={getShortcutFromShortcutName("loadScene")}
      ariaLabel={t("buttons.load")}
    >
      {t("buttons.load")}
    </DropdownMenuItem>
  );
};
LoadScene.displayName = "LoadScene";

export const SaveToActiveFile = () => {
  // FIXME Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (!actionManager.isActionEnabled(actionSaveToActiveFile)) {
    return null;
  }

  return (
    <DropdownMenuItem
      shortcut={getShortcutFromShortcutName("saveScene")}
      dataTestId="save-button"
      onSelect={() => actionManager.executeAction(actionSaveToActiveFile)}
      icon={save}
      ariaLabel={`${t("buttons.save")}`}
    >{`${t("buttons.save")}`}</DropdownMenuItem>
  );
};
SaveToActiveFile.displayName = "SaveToActiveFile";

export const SaveAsImage = () => {
  const setAppState = useExcalidrawSetAppState();
  // FIXME Hack until we tie "t" to lang state
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
  // FIXME Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();

  const actionManager = useExcalidrawActionManager();

  return (
    <DropdownMenuItem
      dataTestId="help-menu-item"
      icon={HelpIcon}
      onSelect={() => actionManager.executeAction(actionShortcuts)}
      shortcut="?"
      ariaLabel={t("helpDialog.title")}
    >
      {t("helpDialog.title")}
    </DropdownMenuItem>
  );
};
Help.displayName = "Help";

export const ClearCanvas = () => {
  // FIXME Hack until we tie "t" to lang state
  // eslint-disable-next-line
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  const [showDialog, setShowDialog] = useState(false);
  const toggleDialog = () => setShowDialog(!showDialog);

  if (!actionManager.isActionEnabled(actionClearCanvas)) {
    return null;
  }

  return (
    <>
      <DropdownMenuItem
        icon={TrashIcon}
        onSelect={toggleDialog}
        dataTestId="clear-canvas-button"
        ariaLabel={t("buttons.clearReset")}
      >
        {t("buttons.clearReset")}
      </DropdownMenuItem>

      {/* FIXME this should live outside MainMenu so it stays open
          if menu is closed */}
      {showDialog && (
        <ConfirmDialog
          onConfirm={() => {
            actionManager.executeAction(actionClearCanvas);
            toggleDialog();
          }}
          onCancel={toggleDialog}
          title={t("clearCanvasDialog.title")}
        >
          <p className="clear-canvas__content"> {t("alerts.clearReset")}</p>
        </ConfirmDialog>
      )}
    </>
  );
};
ClearCanvas.displayName = "ClearCanvas";

export const ToggleTheme = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (!actionManager.isActionEnabled(actionToggleTheme)) {
    return null;
  }

  return (
    <DropdownMenuItem
      onSelect={() => {
        return actionManager.executeAction(actionToggleTheme);
      }}
      icon={appState.theme === "dark" ? SunIcon : MoonIcon}
      dataTestId="toggle-dark-mode"
      shortcut={getShortcutFromShortcutName("toggleTheme")}
      ariaLabel={
        appState.theme === "dark"
          ? t("buttons.lightMode")
          : t("buttons.darkMode")
      }
    >
      {appState.theme === "dark"
        ? t("buttons.lightMode")
        : t("buttons.darkMode")}
    </DropdownMenuItem>
  );
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
  // FIXME Hack until we tie "t" to lang state
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
  // FIXME Hack until we tie "t" to lang state
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
