import { FC, useState } from "react";
import type { ActionManager } from "../actions/manager";
import type {
  ExcalidrawElement,
  ExcalidrawElementType,
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "../element/types";
import { t } from "../i18n";
import { useDevice } from "./App";
import {
  canChangeRoundness,
  canHaveArrowheads,
  getTargetElements,
  hasBackground,
  hasStrokeStyle,
  hasStrokeWidth,
} from "../scene";
import { SHAPES } from "../shapes";
import {
  AppClassProperties,
  AppProps,
  ToolbarDropdownCustomItem,
  ToolbarDropdownTool,
  ToolbarElementCustomItem,
  ToolbarElementDropdown,
  ToolbarElementTool,
  UIAppState,
  Zoom,
} from "../types";
import { capitalizeString, isTransparent } from "../utils";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { hasStrokeColor, toolIsArrow } from "../scene/comparisons";
import { trackEvent } from "../analytics";
import {
  hasBoundTextElement,
  isElbowArrow,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "../element/typeChecks";
import clsx from "clsx";
import { actionToggleZenMode } from "../actions";
import { Tooltip } from "./Tooltip";
import {
  shouldAllowVerticalAlign,
  suppportsHorizontalAlign,
} from "../element/textElement";

import "./Actions.scss";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  CLASSES,
  isToolbarElementDropdown,
  isToolbarElementCustomItem,
  isToolbarElementTool,
} from "../constants";

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
      appState.activeTool.type !== "image" &&
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
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
  renderAction: ActionManager["renderAction"];
}) => {
  const targetElements = getTargetElements(elementsMap, appState);

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

      <fieldset>
        <legend>{t("labels.layers")}</legend>
        <div className="buttonList">
          {renderAction("sendToBack")}
          {renderAction("sendBackward")}
          {renderAction("bringForward")}
          {renderAction("bringToFront")}
        </div>
      </fieldset>

      {targetElements.length > 1 && !isSingleElementBoundContainer && (
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

const ToolbarToolItem: FC<{
  toolId: ToolbarElementTool;
  activeTool: UIAppState["activeTool"];
  appState: UIAppState;
  app: AppClassProperties;
}> = (props) => {
  const { toolId, activeTool, app, appState } = props;
  const shapeTool = SHAPES.find(({ value }) => value === toolId.tool);

  if (!shapeTool) {
    return null;
  }

  const { value, icon, key, numericKey, fillable } = shapeTool;

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
};

const ToolbarCustomItem: FC<{
  tool: ToolbarElementCustomItem;
  activeTool: UIAppState["activeTool"];
  appState: UIAppState;
  app: AppClassProperties;
}> = (props) => {
  const { tool, activeTool, app, appState } = props;
  const { selectKey, label, icon, shortcut, testid, onSelect } = tool;

  return (
    <ToolButton
      className={clsx("Shape")}
      key={selectKey}
      type="radio"
      icon={icon}
      checked={activeTool.type === selectKey}
      name="editor-current-shape"
      title={
        typeof label === "string"
          ? shortcut
            ? `${capitalizeString(label)} — ${shortcut}`
            : capitalizeString(label)
          : undefined
      }
      keyBindingLabel={shortcut}
      aria-label={typeof label === "string" ? capitalizeString(label) : ""}
      aria-keyshortcuts={shortcut}
      data-testid={`toolbar-${testid}`}
      onPointerDown={({ pointerType }) => {
        if (!appState.penDetected && pointerType === "pen") {
          app.togglePenMode(true);
        }
      }}
      onChange={() => onSelect(app)}
    />
  );
};

const ToolbarDropdownItem: FC<{
  element: ToolbarElementDropdown;
  activeTool: UIAppState["activeTool"];
  app: AppClassProperties;
}> = (props) => {
  const { element, activeTool, app } = props;
  const [isOpen, setOpen] = useState(false);
  const isSelectedNestedItemsSelected =
    element.elements
      .filter((element): element is ToolbarDropdownTool => {
        return element.type === "Tool";
      })
      .some(({ tool: toolbarTool }) => toolbarTool === activeTool.type) ||
    element.elements
      .filter((element): element is ToolbarDropdownCustomItem => {
        return element.type === "Item";
      })
      .some(({ selectKey }) => selectKey === activeTool.type);

  return (
    <DropdownMenu open={isOpen}>
      <DropdownMenu.Trigger
        onToggle={() => setOpen((prevState) => !prevState)}
        title={t("toolBar.extraTools")}
        className={clsx("App-toolbar__extra-tools-trigger", {
          "App-toolbar__extra-tools-trigger--selected":
            isSelectedNestedItemsSelected,
        })}
      >
        {element.icon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        onClickOutside={() => setOpen(false)}
        onSelect={() => setOpen(false)}
        className="App-toolbar__extra-tools-dropdown"
      >
        {element.elements.map((dropdownTool, index) => {
          if (dropdownTool.type === "Text") {
            return (
              <div
                key={`dropdownItem-text-${index}`}
                style={{ margin: "6px 0", fontSize: 14, fontWeight: 600 }}
              >
                {dropdownTool.text}
              </div>
            );
          }

          if (dropdownTool.type === "Item") {
            const isSelected =
              !!dropdownTool.selectKey &&
              dropdownTool.selectKey === activeTool.type;

            return (
              <DropdownMenu.Item
                key={`dropdownItem-item-${dropdownTool.selectKey}`}
                onSelect={() => dropdownTool.onSelect(app)}
                icon={dropdownTool.icon}
                shortcut={dropdownTool.shortcut}
                data-testid={`toolbar-${dropdownTool}`}
                selected={isSelected}
              >
                {dropdownTool.label}
                {dropdownTool.badge && (
                  <DropdownMenu.Item.Badge>
                    {dropdownTool.badge}
                  </DropdownMenu.Item.Badge>
                )}
              </DropdownMenu.Item>
            );
          }

          const shape = SHAPES.find(({ value }) => value === dropdownTool.tool);
          if (!shape) return null;

          const isSelected = activeTool.type === dropdownTool.tool;

          return (
            <DropdownMenu.Item
              key={`dropdownItem-tool-${dropdownTool.tool}`}
              onSelect={() => app.setActiveTool({ type: dropdownTool.tool })}
              icon={shape.icon}
              shortcut={shape.numericKey}
              data-testid={`toolbar-${dropdownTool.tool}`}
              selected={isSelected}
            >
              {t(`toolBar.${shape.value}`)}
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
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
  return (
    <>
      {UIOptions.tools?.map((toolElement, index) => {
        if (isToolbarElementDropdown(toolElement)) {
          return (
            <ToolbarDropdownItem
              element={toolElement}
              activeTool={activeTool}
              app={app}
              key={`dropdown-${index}`}
            />
          );
        }

        if (isToolbarElementTool(toolElement)) {
          return (
            <ToolbarToolItem
              toolId={toolElement}
              activeTool={activeTool}
              app={app}
              appState={appState}
              key={`tool-${toolElement.tool}`}
            />
          );
        }

        if (isToolbarElementCustomItem(toolElement)) {
          return (
            <ToolbarCustomItem
              tool={toolElement}
              activeTool={activeTool}
              app={app}
              appState={appState}
              key={`customItem-${toolElement.selectKey}`}
            />
          );
        }

        return (
          <div key={`separator-${index}`} className="App-toolbar__divider" />
        );
      })}
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
