import clsx from "clsx";

import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import {
  actionClearCanvas,
  actionLoadScene,
  actionSaveToActiveFile,
  actionShortcuts,
  actionToggleArrowBinding,
  actionToggleGridMode,
  actionToggleMidpointSnapping,
  actionToggleObjectsSnapMode,
  actionToggleSearchMenu,
  actionToggleStats,
  actionToggleTheme,
  actionToggleZenMode,
} from "../../actions";
import { actionToggleViewMode } from "../../actions/actionToggleViewMode";
import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { trackEvent } from "../../analytics";
import { useUIAppState } from "../../context/ui-appState";
import { useSetAtom } from "../../editor-jotai";
import { useI18n } from "../../i18n";
import { activeConfirmDialogAtom } from "../ActiveConfirmDialog";
import {
  useExcalidrawSetAppState,
  useExcalidrawActionManager,
  useExcalidrawElements,
  useAppProps,
  useApp,
} from "../App";
import {
  collapseAllTerraformExplode,
  expandAllTerraformExplode,
  buildTerraformReconcileOptionsForAppState,
  getTerraformEdgeLayer,
  inferLegacyTerraformEdgePinsFromElements,
  isTerraformExpandAllActive,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "../terraformVisibility";
import { openConfirmModal } from "../OverwriteConfirm/OverwriteConfirmState";
import Trans from "../Trans";
import DropdownMenuItem from "../dropdownMenu/DropdownMenuItem";
import DropdownMenuItemCheckbox from "../dropdownMenu/DropdownMenuItemCheckbox";
import DropdownMenuItemContentRadio from "../dropdownMenu/DropdownMenuItemContentRadio";
import DropdownMenuItemLink from "../dropdownMenu/DropdownMenuItemLink";
import DropdownMenuSeparator from "../dropdownMenu/DropdownMenuSeparator";
import DropdownMenuSub from "../dropdownMenu/DropdownMenuSub";
import {
  GithubIcon,
  DiscordIcon,
  XBrandIcon,
  settingsIcon,
  emptyIcon,
} from "../icons";
import {
  boltIcon,
  DeviceDesktopIcon,
  ExportIcon,
  ExportImageIcon,
  HelpIcon,
  LoadIcon,
  MoonIcon,
  save,
  searchIcon,
  SunIcon,
  TrashIcon,
  usersIcon,
  ZoomOutIcon,
} from "../icons";
import {
  updateTerraformImportSessionLodEnabled,
  updateTerraformImportSessionLodPreset,
} from "../terraformImportSession";
import {
  TERRAFORM_LOD_DEFAULT_PRESET,
  type TerraformLodPreset,
} from "../terraformLod";

import "./DefaultItems.scss";

type TerraformEdgeLayer =
  | "dependency"
  | "dataFlow"
  | "declaredDataFlow"
  | "networking";

const isTerraformDependencyPreviewEdge = (element: {
  customData?: Record<string, any>;
}) => element.customData?.terraformDependencyPreview === true;

export const LoadScene = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const elements = useExcalidrawElements();

  if (!actionManager.isActionEnabled(actionLoadScene)) {
    return null;
  }

  const handleSelect = async () => {
    if (
      !elements.length ||
      (await openConfirmModal({
        title: t("overwriteConfirm.modal.loadFromFile.title"),
        actionLabel: t("overwriteConfirm.modal.loadFromFile.button"),
        color: "warning",
        description: (
          <Trans
            i18nKey="overwriteConfirm.modal.loadFromFile.description"
            bold={(text) => <strong>{text}</strong>}
            br={() => <br />}
          />
        ),
      }))
    ) {
      actionManager.executeAction(actionLoadScene);
    }
  };

  return (
    <DropdownMenuItem
      icon={LoadIcon}
      onSelect={handleSelect}
      data-testid="load-button"
      shortcut={getShortcutFromShortcutName("loadScene")}
      aria-label={t("buttons.load")}
    >
      {t("buttons.load")}
    </DropdownMenuItem>
  );
};
LoadScene.displayName = "LoadScene";

//todo: add button here
export const SaveToActiveFile = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();

  if (!actionManager.isActionEnabled(actionSaveToActiveFile)) {
    return null;
  }

  return (
    <DropdownMenuItem
      shortcut={getShortcutFromShortcutName("saveScene")}
      data-testid="save-button"
      onSelect={() => actionManager.executeAction(actionSaveToActiveFile)}
      icon={save}
      aria-label={`${t("buttons.save")}`}
    >{`${t("buttons.save")}`}</DropdownMenuItem>
  );
};
SaveToActiveFile.displayName = "SaveToActiveFile";

export const SaveAsImage = () => {
  const setAppState = useExcalidrawSetAppState();
  const { t } = useI18n();
  return (
    <DropdownMenuItem
      icon={ExportImageIcon}
      data-testid="image-export-button"
      onSelect={() => setAppState({ openDialog: { name: "imageExport" } })}
      shortcut={getShortcutFromShortcutName("imageExport")}
      aria-label={t("buttons.exportImage")}
    >
      {t("buttons.exportImage")}
    </DropdownMenuItem>
  );
};
SaveAsImage.displayName = "SaveAsImage";

export const ImportTerraform = () => {
  const setAppState = useExcalidrawSetAppState();
  return (
    <DropdownMenuItem
      icon={LoadIcon}
      data-testid="terraform-import-button"
      onSelect={() => setAppState({ openDialog: { name: "terraformImport" } })}
      shortcut={getShortcutFromShortcutName("terraformImport")}
      aria-label="Import Terraform"
    >
      Import Terraform
    </DropdownMenuItem>
  );
};
ImportTerraform.displayName = "ImportTerraform";

const hasTerraformResourceNodes = (
  elements: ReadonlyArray<{ customData?: any }>,
) =>
  elements.some((el) => el.customData?.terraformVisibilityRole === "resource");

export const TerraformExpandAllToggle = () => {
  const app = useApp();
  // Subscribe to scene updates so the checkbox re-renders while the menu stays open.
  useExcalidrawElements();
  const elements = app.scene.getElementsIncludingDeleted();

  if (!hasTerraformResourceNodes(elements)) {
    return null;
  }

  const checked = isTerraformExpandAllActive(elements);

  return (
    <DropdownMenuItemCheckbox
      checked={checked}
      data-testid="terraform-expand-all-toggle"
      onSelect={(event) => {
        event.preventDefault();
        const els = app.scene.getElementsIncludingDeleted();
        const reconcileOpts = buildTerraformReconcileOptionsForAppState(
          app.state.terraformEdgeLayerPins,
          app.state.terraformEdgeHoverPeekKey,
        );
        app.scene.replaceAllElements(
          isTerraformExpandAllActive(els)
            ? collapseAllTerraformExplode(els, reconcileOpts)
            : expandAllTerraformExplode(els, reconcileOpts),
        );
      }}
      aria-label="Expand all Terraform nodes"
    >
      Expand all Terraform
    </DropdownMenuItemCheckbox>
  );
};
TerraformExpandAllToggle.displayName = "TerraformExpandAllToggle";

const TerraformLayerItem = ({
  layer,
  children,
}: {
  layer: TerraformEdgeLayer;
  children: React.ReactNode;
}) => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const elements = useExcalidrawElements();
  const allElements = app.scene.getElementsIncludingDeleted();
  const hasLayer = allElements.some(
    (element) => getTerraformEdgeLayer(element) === layer,
  );
  const pins = app.state.terraformEdgeLayerPins;
  const checked =
    pins != null
      ? pins[layer]
      : elements.some(
          (element) =>
            getTerraformEdgeLayer(element) === layer &&
            (layer !== "dependency" ||
              !isTerraformDependencyPreviewEdge(element)),
        );

  if (!hasLayer) {
    return null;
  }

  return (
    <DropdownMenuItemCheckbox
      checked={checked}
      onSelect={(event) => {
        const nextChecked = !checked;
        let basePins = pins;
        if (basePins == null) {
          basePins = inferLegacyTerraformEdgePinsFromElements(allElements);
        }
        const updatedPins = { ...basePins, [layer]: nextChecked };
        setAppState({
          terraformEdgeLayerPins: updatedPins,
        });
        app.scene.replaceAllElements(
          reconcileTerraformVisibility(
            repairTerraformEdgeBindings(allElements),
            {
              pins: updatedPins,
              hoverPeekKey: app.state.terraformEdgeHoverPeekKey ?? null,
            },
          ),
        );
        event.preventDefault();
      }}
    >
      {children}
    </DropdownMenuItemCheckbox>
  );
};

export const TerraformLayers = () => {
  const app = useApp();
  const hasTerraformLayers = app.scene
    .getElementsIncludingDeleted()
    .some((element) => getTerraformEdgeLayer(element));

  if (!hasTerraformLayers) {
    return null;
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSub.Trigger icon={ExportImageIcon}>
        Terraform layers
      </DropdownMenuSub.Trigger>
      <DropdownMenuSub.Content>
        <TerraformLayerItem layer="dependency">
          Dependency edges
        </TerraformLayerItem>
        <TerraformLayerItem layer="networking">
          Networking edges
        </TerraformLayerItem>
        <TerraformLayerItem layer="dataFlow">
          Data flow edges
        </TerraformLayerItem>
        <TerraformLayerItem layer="declaredDataFlow">
          Declared data flow edges
        </TerraformLayerItem>
      </DropdownMenuSub.Content>
    </DropdownMenuSub>
  );
};
TerraformLayers.displayName = "TerraformLayers";

export const TerraformZoomLod = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  useExcalidrawElements();
  const elements = app.scene.getElementsIncludingDeleted();

  if (!hasTerraformResourceNodes(elements)) {
    return null;
  }

  const lodEnabled = app.state.terraformLodEnabled;
  const lodPreset =
    app.state.terraformLodPreset ?? TERRAFORM_LOD_DEFAULT_PRESET;

  return (
    <DropdownMenuSub>
      <DropdownMenuSub.Trigger
        icon={ZoomOutIcon}
        data-testid="terraform-zoom-lod-submenu"
        aria-label="Zoom LOD settings"
      >
        Zoom LOD
      </DropdownMenuSub.Trigger>
      <DropdownMenuSub.Content>
        <DropdownMenuItemCheckbox
          checked={lodEnabled}
          data-testid="terraform-zoom-lod-enable"
          onSelect={(event) => {
            const next = !lodEnabled;
            updateTerraformImportSessionLodEnabled(next);
            setAppState({ terraformLodEnabled: next });
            event.preventDefault();
          }}
          aria-label="Enable zoom LOD"
        >
          Enable zoom LOD
        </DropdownMenuItemCheckbox>
        <DropdownMenuSeparator />
        <div
          className={clsx("terraform-zoom-lod-preset-row", {
            "terraform-zoom-lod-preset-row--inactive": !lodEnabled,
          })}
        >
          <DropdownMenuItemContentRadio<TerraformLodPreset>
            name="terraform-lod-preset"
            icon={ZoomOutIcon}
            value={lodPreset}
            onChange={(value) => {
              updateTerraformImportSessionLodPreset(value);
              setAppState({ terraformLodPreset: value });
            }}
            choices={[
              {
                value: "performance",
                label: "Performance",
                ariaLabel:
                  "Performance — hide detail soonest when zoomed out",
                testId: "terraform-lod-preset-performance",
              },
              {
                value: "balanced",
                label: "Balanced",
                ariaLabel: "Balanced — default detail when zoomed out",
                testId: "terraform-lod-preset-balanced",
              },
              {
                value: "detailed",
                label: "Detailed",
                ariaLabel:
                  "Detailed — show labels and satellites from farther out",
                testId: "terraform-lod-preset-detailed",
              },
            ]}
          >
            Detail level
          </DropdownMenuItemContentRadio>
        </div>
        <div
          className="dropdown-menu-item-hint"
          id="terraform-lod-hint"
          role="note"
        >
          Hide labels and satellites when zoomed out.
          {!lodEnabled ? " Preset applies when zoom LOD is enabled." : ""}
        </div>
      </DropdownMenuSub.Content>
    </DropdownMenuSub>
  );
};
TerraformZoomLod.displayName = "TerraformZoomLod";

export const CommandPalette = (opts?: { className?: string }) => {
  const setAppState = useExcalidrawSetAppState();
  const { t } = useI18n();

  return (
    <DropdownMenuItem
      icon={boltIcon}
      data-testid="command-palette-button"
      onSelect={() => {
        trackEvent("command_palette", "open", "menu");
        setAppState({ openDialog: { name: "commandPalette" } });
      }}
      shortcut={getShortcutFromShortcutName("commandPalette")}
      aria-label={t("commandPalette.title")}
      className={opts?.className}
    >
      {t("commandPalette.title")}
    </DropdownMenuItem>
  );
};
CommandPalette.displayName = "CommandPalette";

export const SearchMenu = (opts?: { className?: string }) => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();

  return (
    <DropdownMenuItem
      icon={searchIcon}
      data-testid="search-menu-button"
      onSelect={() => {
        actionManager.executeAction(actionToggleSearchMenu);
      }}
      shortcut={getShortcutFromShortcutName("searchMenu")}
      aria-label={t("search.title")}
      className={opts?.className}
    >
      {t("search.title")}
    </DropdownMenuItem>
  );
};
SearchMenu.displayName = "SearchMenu";

export const Help = () => {
  const { t } = useI18n();

  const actionManager = useExcalidrawActionManager();

  return (
    <DropdownMenuItem
      data-testid="help-menu-item"
      icon={HelpIcon}
      onSelect={() => actionManager.executeAction(actionShortcuts)}
      shortcut="?"
      aria-label={t("helpDialog.title")}
    >
      {t("helpDialog.title")}
    </DropdownMenuItem>
  );
};
Help.displayName = "Help";

export const ClearCanvas = () => {
  const { t } = useI18n();

  const setActiveConfirmDialog = useSetAtom(activeConfirmDialogAtom);
  const actionManager = useExcalidrawActionManager();

  if (!actionManager.isActionEnabled(actionClearCanvas)) {
    return null;
  }

  return (
    <DropdownMenuItem
      icon={TrashIcon}
      onSelect={() => setActiveConfirmDialog("clearCanvas")}
      data-testid="clear-canvas-button"
      aria-label={t("buttons.clearReset")}
    >
      {t("buttons.clearReset")}
    </DropdownMenuItem>
  );
};
ClearCanvas.displayName = "ClearCanvas";

export const ToggleTheme = (
  props:
    | {
        allowSystemTheme: true;
        theme: Theme | "system";
        onSelect: (theme: Theme | "system") => void;
      }
    | {
        allowSystemTheme?: false;
        onSelect?: (theme: Theme) => void;
      },
) => {
  const { t } = useI18n();
  const appState = useUIAppState();
  const actionManager = useExcalidrawActionManager();
  const shortcut = getShortcutFromShortcutName("toggleTheme");

  if (!actionManager.isActionEnabled(actionToggleTheme)) {
    return null;
  }

  if (props?.allowSystemTheme) {
    return (
      <DropdownMenuItemContentRadio
        name="theme"
        value={props.theme}
        onChange={(value: Theme | "system") => props.onSelect(value)}
        choices={[
          {
            value: THEME.LIGHT,
            label: SunIcon,
            ariaLabel: `${t("buttons.lightMode")} - ${shortcut}`,
          },
          {
            value: THEME.DARK,
            label: MoonIcon,
            ariaLabel: `${t("buttons.darkMode")} - ${shortcut}`,
          },
          {
            value: "system",
            label: DeviceDesktopIcon,
            ariaLabel: t("buttons.systemMode"),
          },
        ]}
      >
        {t("labels.theme")}
      </DropdownMenuItemContentRadio>
    );
  }

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        // do not close the menu when changing theme
        event.preventDefault();

        if (props?.onSelect) {
          props.onSelect(
            appState.theme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
          );
        } else {
          return actionManager.executeAction(actionToggleTheme);
        }
      }}
      icon={appState.theme === THEME.DARK ? SunIcon : MoonIcon}
      data-testid="toggle-dark-mode"
      shortcut={shortcut}
      aria-label={
        appState.theme === THEME.DARK
          ? t("buttons.lightMode")
          : t("buttons.darkMode")
      }
    >
      {appState.theme === THEME.DARK
        ? t("buttons.lightMode")
        : t("buttons.darkMode")}
    </DropdownMenuItem>
  );
};
ToggleTheme.displayName = "ToggleTheme";

export const ChangeCanvasBackground = () => {
  const { t } = useI18n();
  const appState = useUIAppState();
  const actionManager = useExcalidrawActionManager();
  const appProps = useAppProps();

  if (
    appState.viewModeEnabled ||
    !appProps.UIOptions.canvasActions.changeViewBackgroundColor
  ) {
    return null;
  }
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div
        data-testid="canvas-background-label"
        style={{
          fontSize: "0.875rem",
          marginBottom: "0.25rem",
          marginLeft: "0.5rem",
        }}
      >
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
  const { t } = useI18n();
  const setAppState = useExcalidrawSetAppState();
  return (
    <DropdownMenuItem
      icon={ExportIcon}
      onSelect={() => {
        setAppState({ openDialog: { name: "jsonExport" } });
      }}
      data-testid="json-export-button"
      aria-label={t("buttons.export")}
    >
      {t("buttons.export")}
    </DropdownMenuItem>
  );
};
Export.displayName = "Export";

export const Socials = () => {
  const { t } = useI18n();

  return (
    <>
      <DropdownMenuItemLink
        icon={GithubIcon}
        href="https://github.com/excalidraw/excalidraw"
        aria-label="GitHub"
      >
        GitHub
      </DropdownMenuItemLink>
      <DropdownMenuItemLink
        icon={XBrandIcon}
        href="https://x.com/excalidraw"
        aria-label="X"
      >
        {t("labels.followUs")}
      </DropdownMenuItemLink>
      <DropdownMenuItemLink
        icon={DiscordIcon}
        href="https://discord.gg/UexuTaE"
        aria-label="Discord"
      >
        {t("labels.discordChat")}
      </DropdownMenuItemLink>
    </>
  );
};
Socials.displayName = "Socials";

export const LiveCollaborationTrigger = ({
  onSelect,
  isCollaborating,
}: {
  onSelect: () => void;
  isCollaborating: boolean;
}) => {
  const { t } = useI18n();
  return (
    <DropdownMenuItem
      data-testid="collab-button"
      icon={usersIcon}
      className={clsx({
        "active-collab": isCollaborating,
      })}
      onSelect={onSelect}
    >
      {t("labels.liveCollaboration")}
    </DropdownMenuItem>
  );
};

LiveCollaborationTrigger.displayName = "LiveCollaborationTrigger";

const PreferencesToggleToolLockItem = () => {
  const { t } = useI18n();
  const app = useApp();
  const appState = useUIAppState();

  return (
    <DropdownMenuItemCheckbox
      checked={appState.activeTool.locked}
      shortcut={getShortcutFromShortcutName("toolLock")}
      onSelect={(event) => {
        app.toggleLock();
        event.preventDefault();
      }}
    >
      {t("labels.preferences_toolLock")}
    </DropdownMenuItemCheckbox>
  );
};

const PreferencesBoxSelectionModeItem = () => {
  const { t } = useI18n();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  return (
    <DropdownMenuItemContentRadio<"contain" | "overlap">
      name="boxSelectionMode"
      icon={emptyIcon}
      value={appState.boxSelectionMode}
      onChange={(value) => {
        setAppState({
          boxSelectionMode: value,
        });
      }}
      choices={[
        {
          value: "contain",
          label: t("labels.boxSelectionContain"),
          ariaLabel: t("labels.boxSelectionContain"),
        },
        {
          value: "overlap",
          label: t("labels.boxSelectionOverlap"),
          ariaLabel: t("labels.boxSelectionOverlap"),
        },
      ]}
    >
      {t("labels.boxSelectionMode")}
    </DropdownMenuItemContentRadio>
  );
};

const PreferencesToggleSnapModeItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();
  return (
    <DropdownMenuItemCheckbox
      checked={appState.objectsSnapModeEnabled}
      shortcut={getShortcutFromShortcutName("objectsSnapMode")}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleObjectsSnapMode);
        event.preventDefault();
      }}
    >
      {t("buttons.objectsSnapMode")}
    </DropdownMenuItemCheckbox>
  );
};

const PreferencesToggleArrowBindingItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();
  return (
    <DropdownMenuItemCheckbox
      checked={appState.bindingPreference === "enabled"}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleArrowBinding);
        event.preventDefault();
      }}
    >
      {t("labels.arrowBinding")}
    </DropdownMenuItemCheckbox>
  );
};

const PreferencesToggleMidpointSnappingItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();
  return (
    <DropdownMenuItemCheckbox
      checked={appState.isMidpointSnappingEnabled}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleMidpointSnapping);
        event.preventDefault();
      }}
    >
      {t("labels.midpointSnapping")}
    </DropdownMenuItemCheckbox>
  );
};

export const PreferencesToggleGridModeItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();

  return (
    <DropdownMenuItemCheckbox
      checked={appState.gridModeEnabled}
      shortcut={getShortcutFromShortcutName("gridMode")}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleGridMode);
        event.preventDefault();
      }}
    >
      {t("labels.toggleGrid")}
    </DropdownMenuItemCheckbox>
  );
};

export const PreferencesToggleZenModeItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();
  return (
    <DropdownMenuItemCheckbox
      checked={appState.zenModeEnabled}
      shortcut={getShortcutFromShortcutName("zenMode")}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleZenMode);
        event.preventDefault();
      }}
    >
      {t("buttons.zenMode")}
    </DropdownMenuItemCheckbox>
  );
};

const PreferencesToggleViewModeItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();
  return (
    <DropdownMenuItemCheckbox
      checked={appState.viewModeEnabled}
      shortcut={getShortcutFromShortcutName("viewMode")}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleViewMode);
        event.preventDefault();
      }}
    >
      {t("labels.viewMode")}
    </DropdownMenuItemCheckbox>
  );
};

const PreferencesToggleElementPropertiesItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();
  return (
    <DropdownMenuItemCheckbox
      checked={appState.stats.open}
      shortcut={getShortcutFromShortcutName("stats")}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleStats);
        event.preventDefault();
      }}
    >
      {t("stats.fullTitle")}
    </DropdownMenuItemCheckbox>
  );
};

export const Preferences = ({
  children,
  additionalItems,
}: {
  children?: React.ReactNode;
  additionalItems?: React.ReactNode;
}) => {
  const { t } = useI18n();
  return (
    <DropdownMenuSub>
      <DropdownMenuSub.Trigger icon={settingsIcon}>
        {t("labels.preferences")}
      </DropdownMenuSub.Trigger>
      <DropdownMenuSub.Content className="excalidraw-main-menu-preferences-submenu">
        {children || (
          <>
            <PreferencesBoxSelectionModeItem />
            <PreferencesToggleToolLockItem />
            <PreferencesToggleSnapModeItem />
            <PreferencesToggleGridModeItem />
            <PreferencesToggleZenModeItem />
            <PreferencesToggleViewModeItem />
            <PreferencesToggleElementPropertiesItem />
            <PreferencesToggleArrowBindingItem />
            <PreferencesToggleMidpointSnappingItem />
          </>
        )}
        {additionalItems}
      </DropdownMenuSub.Content>
    </DropdownMenuSub>
  );
};

Preferences.ToggleToolLock = PreferencesToggleToolLockItem;
Preferences.BoxSelectionMode = PreferencesBoxSelectionModeItem;
Preferences.ToggleSnapMode = PreferencesToggleSnapModeItem;
Preferences.ToggleArrowBinding = PreferencesToggleArrowBindingItem;
Preferences.ToggleMidpointSnapping = PreferencesToggleMidpointSnappingItem;
Preferences.ToggleGridMode = PreferencesToggleGridModeItem;
Preferences.ToggleZenMode = PreferencesToggleZenModeItem;
Preferences.ToggleViewMode = PreferencesToggleViewModeItem;
Preferences.ToggleElementProperties = PreferencesToggleElementPropertiesItem;

Preferences.displayName = "Preferences";
