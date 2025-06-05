import clsx from "clsx";
import { useState } from "react";

import {
  CLASSES,
  KEYS,
  capitalizeString,
  isTransparent,
} from "@excalidraw/common";

import {
  shouldAllowVerticalAlign,
  suppportsHorizontalAlign,
} from "@excalidraw/element";

import {
  hasBoundTextElement,
  isElbowArrow,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "@excalidraw/element";

import { hasStrokeColor, toolIsArrow } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawElementType,
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { actionToggleZenMode } from "../actions";

import { alignActionsPredicate } from "../actions/actionAlign";
import { trackEvent } from "../analytics";
import { useTunnels } from "../context/tunnels";

import { t } from "../i18n";
import {
  canChangeRoundness,
  canHaveArrowheads,
  getTargetElements,
  hasBackground,
  hasStrokeStyle,
  hasStrokeWidth,
} from "../scene";

import { SHAPES } from "./shapes";

import "./Actions.scss";

import { useDevice } from "./App";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  EmbedIcon,
  extraToolsIcon,
  frameToolIcon,
  mermaidLogoIcon,
  laserPointerToolIcon,
  MagicIcon,
  LassoIcon,
} from "./icons";

import type { AppClassProperties, AppProps, UIAppState, Zoom } from "../types";
import type { ActionManager } from "../actions/manager";

import type { AppState } from "../types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { 
  getRabbitGroupsFromElements, 
  getSelectedRabbitGroupIds,
  getSelectedRabbitGroupId,
  changeGroupColor
} from '@excalidraw/element/rabbitGroupUtils';

import { AutoOrganizer } from '@excalidraw/element/autoOrganizer';

const getRabbitGroupSelection = (
  targetElements: ExcalidrawElement[],
  allElements: readonly ExcalidrawElement[]
): {
  type: 'none' | 'single' | 'multiple';
  singleGroupId?: string;
  multipleGroupIds?: string[];
  groupsInfo?: any[];
} => {
  const selectedGroupIds = getSelectedRabbitGroupIds(targetElements, allElements);
  const allGroups = getRabbitGroupsFromElements(allElements);
  
  if (selectedGroupIds.length === 0) {
    return { type: 'none' };
  }
  
  if (selectedGroupIds.length === 1) {
    const singleGroupId = getSelectedRabbitGroupId(targetElements, allElements);
    if (singleGroupId) {
      const groupInfo = allGroups.get(singleGroupId);
      return { 
        type: 'single', 
        singleGroupId,
        groupsInfo: groupInfo ? [groupInfo] : []
      };
    }
  }
  
  const groupsInfo = selectedGroupIds.map(id => allGroups.get(id)).filter(Boolean);
  return { 
    type: 'multiple', 
    multipleGroupIds: selectedGroupIds,
    groupsInfo
  };
};

export const canChangeStrokeColor = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
) => {
  let commonSelectedType: ExcalidrawElementType | null =
    targetElements[0]?.type || null;

  for (const element of targetElements) {
    if (element.type !== commonSelectedType) {
      commonSelectedType = null;
      break;
    }
  }

  return (
    (hasStrokeColor(appState.activeTool.type) &&
      commonSelectedType !== "image" &&
      commonSelectedType !== "frame" &&
      commonSelectedType !== "magicframe") ||
    targetElements.some((element) => hasStrokeColor(element.type))
  );
};

export const canChangeBackgroundColor = (
  appState: UIAppState,
  targetElements: ExcalidrawElement[],
) => {
  return (
    hasBackground(appState.activeTool.type) ||
    targetElements.some((element) => hasBackground(element.type))
  );
};

export const SelectedShapeActions = ({
  appState,
  elementsMap,
  renderAction,
  app,
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
  renderAction: ActionManager["renderAction"];
  app: AppClassProperties;
}) => {
  const targetElements = getTargetElements(elementsMap, appState);
  const freshElements = app.scene.getNonDeletedElements();

  let isSingleElementBoundContainer = false;
  if (
    targetElements.length === 2 &&
    (hasBoundTextElement(targetElements[0]) ||
      hasBoundTextElement(targetElements[1]))
  ) {
    isSingleElementBoundContainer = true;
  }
  const isEditingTextOrNewElement = Boolean(
    appState.editingTextElement || appState.newElement,
  );
  const device = useDevice();
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  const updateGroupColor = (groupId: string, newColor: string) => {
    const elements = app.scene.getNonDeletedElements();
    const groups = getRabbitGroupsFromElements(elements);
    const group = groups.get(groupId);
    
    if (!group) return;
    
    const groupElementIds: string[] = [
      ...(group.searchBox ? [group.searchBox.id] : []),
      ...group.images.map(img => img.id)
    ];

    const updatedElements = elements.map(element => {
      if (groupElementIds.includes(element.id)) {
        return { 
          ...element, 
          strokeColor: newColor,
          customData: {
            ...element.customData,
            rabbitGroup: {
              ...element.customData?.rabbitGroup,
              color: newColor
            }
          }
        };
      }
      return element;
    });

    // Use the app's updateScene method
    (app as any).updateScene({ elements: updatedElements });
  };

  const showFillIcons =
    (hasBackground(appState.activeTool.type) &&
      !isTransparent(appState.currentItemBackgroundColor)) ||
    targetElements.some(
      (element) =>
        hasBackground(element.type) && !isTransparent(element.backgroundColor),
    );

  const showLinkIcon =
    targetElements.length === 1 || isSingleElementBoundContainer;

  const showLineEditorAction =
    !appState.editingLinearElement &&
    targetElements.length === 1 &&
    isLinearElement(targetElements[0]) &&
    !isElbowArrow(targetElements[0]);

  const showCropEditorAction =
    !appState.croppingElementId &&
    targetElements.length === 1 &&
    isImageElement(targetElements[0]);

  const showAlignActions =
    !isSingleElementBoundContainer && alignActionsPredicate(appState, app);

  const rabbitGroupSelection = getRabbitGroupSelection(targetElements, freshElements);

  // Create AutoOrganizer instance for organization actions
  const autoOrganizer = new AutoOrganizer(app as any);

  return (
    <div className="panelColumn">
      <div>
        {canChangeStrokeColor(appState, targetElements) &&
          renderAction("changeStrokeColor")}
      </div>
      {canChangeBackgroundColor(appState, targetElements) && (
        <div>{renderAction("changeBackgroundColor")}</div>
      )}
      {showFillIcons && renderAction("changeFillStyle")}

      {(hasStrokeWidth(appState.activeTool.type) ||
        targetElements.some((element) => hasStrokeWidth(element.type))) &&
        renderAction("changeStrokeWidth")}

      {(appState.activeTool.type === "freedraw" ||
        targetElements.some((element) => element.type === "freedraw")) &&
        renderAction("changeStrokeShape")}

      {(hasStrokeStyle(appState.activeTool.type) ||
        targetElements.some((element) => hasStrokeStyle(element.type))) && (
        <>
          {renderAction("changeStrokeStyle")}
          {renderAction("changeSloppiness")}
        </>
      )}

      {(canChangeRoundness(appState.activeTool.type) ||
        targetElements.some((element) => canChangeRoundness(element.type))) && (
        <>{renderAction("changeRoundness")}</>
      )}

      {(toolIsArrow(appState.activeTool.type) ||
        targetElements.some((element) => toolIsArrow(element.type))) && (
        <>{renderAction("changeArrowType")}</>
      )}

      {(appState.activeTool.type === "text" ||
        targetElements.some(isTextElement)) && (
        <>
          {renderAction("changeFontFamily")}
          {renderAction("changeFontSize")}
          {(appState.activeTool.type === "text" ||
            suppportsHorizontalAlign(targetElements, elementsMap)) &&
            renderAction("changeTextAlign")}
        </>
      )}

      {shouldAllowVerticalAlign(targetElements, elementsMap) &&
        renderAction("changeVerticalAlign")}
      {(canHaveArrowheads(appState.activeTool.type) ||
        targetElements.some((element) => canHaveArrowheads(element.type))) && (
        <>{renderAction("changeArrowhead")}</>
      )}

      {renderAction("changeOpacity")}

      {/* Single Group Controls */}
      {rabbitGroupSelection.type === 'single' && (
        <fieldset>
          <legend>Search Group: "{rabbitGroupSelection.groupsInfo?.[0]?.query}"</legend>
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>
              Group Color:
                <input
                  type="color"
                  value={rabbitGroupSelection.groupsInfo?.[0]?.color || '#000000'}
                  onChange={(e) => {
                    if (rabbitGroupSelection.singleGroupId) {
                      updateGroupColor(rabbitGroupSelection.singleGroupId, e.target.value);
                    }
                  }}
                  style={{ marginLeft: '8px', width: '30px', height: '20px' }}
                />
            </label>
          </div>

          {/* Organization Buttons */}
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '6px' }}>
              Organize Layout:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.singleGroupId) {
                    autoOrganizer.organizeSingleGroupHierarchical(rabbitGroupSelection.singleGroupId);
                  }
                }}
                title="Organize in a top-down hierarchy"
              >
                Tree
              </button>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.singleGroupId) {
                    autoOrganizer.organizeSingleGroupGrid(rabbitGroupSelection.singleGroupId);
                  }
                }}
                title="Organize in a grid pattern"
              >
                Grid
              </button>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.singleGroupId) {
                    autoOrganizer.organizeSingleGroupCircular(rabbitGroupSelection.singleGroupId);
                  }
                }}
                title="Organize in a circular pattern"
              >
                Circle
              </button>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.singleGroupId) {
                    autoOrganizer.organizeSingleGroupBreadthFirst(rabbitGroupSelection.singleGroupId);
                  }
                }}
                title="Organize in breadth-first layout"
              >
                Flow
              </button>
            </div>
          </div>
        </fieldset>
      )}

      {/* Multiple Groups Controls */}
      {rabbitGroupSelection.type === 'multiple' && (
        <fieldset>
          <legend>
            Multiple Search Groups ({rabbitGroupSelection.multipleGroupIds?.length})
          </legend>
          
          {/* Organization Buttons for Multiple Groups */}
          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '6px' }}>
              Organize All Selected Groups:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.multipleGroupIds) {
                    autoOrganizer.organizeMultipleGroupsHierarchical(rabbitGroupSelection.multipleGroupIds);
                  }
                }}
                title="Organize selected groups in a top-down hierarchy"
              >
                Tree
              </button>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.multipleGroupIds) {
                    autoOrganizer.organizeMultipleGroupsGrid(rabbitGroupSelection.multipleGroupIds);
                  }
                }}
                title="Organize selected groups in a grid pattern"
              >
                Grid
              </button>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.multipleGroupIds) {
                    autoOrganizer.organizeMultipleGroupsCircular(rabbitGroupSelection.multipleGroupIds);
                  }
                }}
                title="Organize selected groups in a circular pattern"
              >
                Circle
              </button>
              <button
                type="button"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (rabbitGroupSelection.multipleGroupIds) {
                    autoOrganizer.organizeMultipleGroupsBreadthFirst(rabbitGroupSelection.multipleGroupIds);
                  }
                }}
                title="Organize selected groups in breadth-first layout"
              >
                Flow
              </button>
            </div>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>{t("labels.layers")}</legend>
        <div className="buttonList">
          {renderAction("sendToBack")}
          {renderAction("sendBackward")}
          {renderAction("bringForward")}
          {renderAction("bringToFront")}
        </div>
      </fieldset>

      {showAlignActions && !isSingleElementBoundContainer && (
        <fieldset>
          <legend>{t("labels.align")}</legend>
          <div className="buttonList">
            {
              // swap this order for RTL so the button positions always match their action
              // (i.e. the leftmost button aligns left)
            }
            {isRTL ? (
              <>
                {renderAction("alignRight")}
                {renderAction("alignHorizontallyCentered")}
                {renderAction("alignLeft")}
              </>
            ) : (
              <>
                {renderAction("alignLeft")}
                {renderAction("alignHorizontallyCentered")}
                {renderAction("alignRight")}
              </>
            )}
            {targetElements.length > 2 &&
              renderAction("distributeHorizontally")}
            {/* breaks the row ˇˇ */}
            <div style={{ flexBasis: "100%", height: 0 }} />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: ".5rem",
                marginTop: "-0.5rem",
              }}
            >
              {renderAction("alignTop")}
              {renderAction("alignVerticallyCentered")}
              {renderAction("alignBottom")}
              {targetElements.length > 2 &&
                renderAction("distributeVertically")}
            </div>
          </div>
        </fieldset>
      )}
      {!isEditingTextOrNewElement && targetElements.length > 0 && (
        <fieldset>
          <legend>{t("labels.actions")}</legend>
          <div className="buttonList">
            {!device.editor.isMobile && renderAction("duplicateSelection")}
            {!device.editor.isMobile && renderAction("deleteSelectedElements")}
            {renderAction("group")}
            {renderAction("ungroup")}
            {showLinkIcon && renderAction("hyperlink")}
            {showCropEditorAction && renderAction("cropEditor")}
            {showLineEditorAction && renderAction("toggleLinearEditor")}
          </div>
        </fieldset>
      )}
    </div>
  );
};

export const ShapesSwitcher = ({
  activeTool,
  appState,
  app,
  UIOptions,
}: {
  activeTool: UIAppState["activeTool"];
  appState: UIAppState;
  app: AppClassProperties;
  UIOptions: AppProps["UIOptions"];
}) => {
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);

  const frameToolSelected = activeTool.type === "frame";
  const laserToolSelected = activeTool.type === "laser";
  const lassoToolSelected = activeTool.type === "lasso";

  const embeddableToolSelected = activeTool.type === "embeddable";

  const { TTDDialogTriggerTunnel } = useTunnels();

  return (
    <>
      {SHAPES.map(({ value, icon, key, numericKey, fillable }, index) => {
        if (
          UIOptions.tools?.[
            value as Extract<typeof value, keyof AppProps["UIOptions"]["tools"]>
          ] === false
        ) {
          return null;
        }

        const label = t(`toolBar.${value}`);
        const letter =
          key && capitalizeString(typeof key === "string" ? key : key[0]);
        const shortcut = letter
          ? `${letter} ${t("helpDialog.or")} ${numericKey}`
          : `${numericKey}`;

        return (
          <ToolButton
            className={clsx("Shape", { fillable })}
            key={value}
            type="radio"
            icon={icon}
            checked={activeTool.type === value}
            name="editor-current-shape"
            title={`${capitalizeString(label)} — ${shortcut}`}
            keyBindingLabel={numericKey || letter}
            aria-label={capitalizeString(label)}
            aria-keyshortcuts={shortcut}
            data-testid={`toolbar-${value}`}
            onPointerDown={({ pointerType }) => {
              if (!appState.penDetected && pointerType === "pen") {
                app.togglePenMode(true);
              }

              if (value === "selection") {
                if (appState.activeTool.type === "selection") {
                  app.setActiveTool({ type: "lasso" });
                } else {
                  app.setActiveTool({ type: "selection" });
                }
              }
            }}
            onChange={({ pointerType }) => {
              if (appState.activeTool.type !== value) {
                trackEvent("toolbar", value, "ui");
              }
              if (value === "image") {
                app.setActiveTool({
                  type: value,
                  insertOnCanvasDirectly: pointerType !== "mouse",
                });
              } else {
                app.setActiveTool({ type: value });
              }
            }}
          />
        );
      })}
      <div className="App-toolbar__divider" />

      <DropdownMenu open={isExtraToolsMenuOpen}>
        <DropdownMenu.Trigger
          className={clsx("App-toolbar__extra-tools-trigger", {
            "App-toolbar__extra-tools-trigger--selected":
              frameToolSelected ||
              embeddableToolSelected ||
              lassoToolSelected ||
              // in collab we're already highlighting the laser button
              // outside toolbar, so let's not highlight extra-tools button
              // on top of it
              (laserToolSelected && !app.props.isCollaborating),
          })}
          onToggle={() => setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen)}
          title={t("toolBar.extraTools")}
        >
          {frameToolSelected
            ? frameToolIcon
            : embeddableToolSelected
            ? EmbedIcon
            : laserToolSelected && !app.props.isCollaborating
            ? laserPointerToolIcon
            : lassoToolSelected
            ? LassoIcon
            : extraToolsIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsExtraToolsMenuOpen(false)}
          onSelect={() => setIsExtraToolsMenuOpen(false)}
          className="App-toolbar__extra-tools-dropdown"
        >
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "frame" })}
            icon={frameToolIcon}
            shortcut={KEYS.F.toLocaleUpperCase()}
            data-testid="toolbar-frame"
            selected={frameToolSelected}
          >
            {t("toolBar.frame")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "embeddable" })}
            icon={EmbedIcon}
            data-testid="toolbar-embeddable"
            selected={embeddableToolSelected}
          >
            {t("toolBar.embeddable")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "laser" })}
            icon={laserPointerToolIcon}
            data-testid="toolbar-laser"
            selected={laserToolSelected}
            shortcut={KEYS.K.toLocaleUpperCase()}
          >
            {t("toolBar.laser")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => app.setActiveTool({ type: "lasso" })}
            icon={LassoIcon}
            data-testid="toolbar-lasso"
            selected={lassoToolSelected}
          >
            {t("toolBar.lasso")}
          </DropdownMenu.Item>
          <div style={{ margin: "6px 0", fontSize: 14, fontWeight: 600 }}>
            Generate
          </div>
          {app.props.aiEnabled !== false && <TTDDialogTriggerTunnel.Out />}
          <DropdownMenu.Item
            onSelect={() => app.setOpenDialog({ name: "ttd", tab: "mermaid" })}
            icon={mermaidLogoIcon}
            data-testid="toolbar-embeddable"
          >
            {t("toolBar.mermaidToExcalidraw")}
          </DropdownMenu.Item>
          {app.props.aiEnabled !== false && app.plugins.diagramToCode && (
            <>
              <DropdownMenu.Item
                onSelect={() => app.onMagicframeToolSelect()}
                icon={MagicIcon}
                data-testid="toolbar-magicframe"
              >
                {t("toolBar.magicframe")}
                <DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </>
  );
};

export const ZoomActions = ({
  renderAction,
  zoom,
}: {
  renderAction: ActionManager["renderAction"];
  zoom: Zoom;
}) => (
  <Stack.Col gap={1} className={CLASSES.ZOOM_ACTIONS}>
    <Stack.Row align="center">
      {renderAction("zoomOut")}
      {renderAction("resetZoom")}
      {renderAction("zoomIn")}
    </Stack.Row>
  </Stack.Col>
);

export const UndoRedoActions = ({
  renderAction,
  className,
}: {
  renderAction: ActionManager["renderAction"];
  className?: string;
}) => (
  <div className={`undo-redo-buttons ${className}`}>
    <div className="undo-button-container">
      <Tooltip label={t("buttons.undo")}>{renderAction("undo")}</Tooltip>
    </div>
    <div className="redo-button-container">
      <Tooltip label={t("buttons.redo")}> {renderAction("redo")}</Tooltip>
    </div>
  </div>
);

export const ExitZenModeAction = ({
  actionManager,
  showExitZenModeBtn,
}: {
  actionManager: ActionManager;
  showExitZenModeBtn: boolean;
}) => (
  <button
    type="button"
    className={clsx("disable-zen-mode", {
      "disable-zen-mode--visible": showExitZenModeBtn,
    })}
    onClick={() => actionManager.executeAction(actionToggleZenMode)}
  >
    {t("buttons.exitZenMode")}
  </button>
);

export const FinalizeAction = ({
  renderAction,
  className,
}: {
  renderAction: ActionManager["renderAction"];
  className?: string;
}) => (
  <div className={`finalize-button ${className}`}>
    {renderAction("finalize", { size: "small" })}
  </div>
);