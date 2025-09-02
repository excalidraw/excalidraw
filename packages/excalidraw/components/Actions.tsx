import clsx from "clsx";
import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";

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
  isArrowElement,
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

import { getFormValue } from "../actions/actionProperties";

import { useTextEditorFocus } from "../hooks/useTextEditorFocus";

import { getToolbarTools } from "./shapes";

import "./Actions.scss";

import { useDevice, useExcalidrawContainer } from "./App";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { PropertiesPopover } from "./PropertiesPopover";
import {
  EmbedIcon,
  extraToolsIcon,
  frameToolIcon,
  mermaidLogoIcon,
  laserPointerToolIcon,
  MagicIcon,
  LassoIcon,
  sharpArrowIcon,
  roundArrowIcon,
  elbowArrowIcon,
  TextSizeIcon,
  adjustmentsIcon,
  DotsHorizontalIcon,
} from "./icons";

import type {
  AppClassProperties,
  AppProps,
  UIAppState,
  Zoom,
  AppState,
} from "../types";
import type { ActionManager } from "../actions/manager";

// Common CSS class combinations
const PROPERTIES_CLASSES = clsx([
  CLASSES.SHAPE_ACTIONS_THEME_SCOPE,
  "properties-content",
]);

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
    !appState.selectedLinearElement?.isEditing &&
    targetElements.length === 1 &&
    isLinearElement(targetElements[0]) &&
    !isElbowArrow(targetElements[0]);

  const showCropEditorAction =
    !appState.croppingElementId &&
    targetElements.length === 1 &&
    isImageElement(targetElements[0]);

  const showAlignActions =
    !isSingleElementBoundContainer && alignActionsPredicate(appState, app);

  return (
    <div className="selected-shape-actions">
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

export const CompactShapeActions = ({
  appState,
  elementsMap,
  renderAction,
  app,
  setAppState,
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
  renderAction: ActionManager["renderAction"];
  app: AppClassProperties;
  setAppState: React.Component<any, AppState>["setState"];
}) => {
  const targetElements = getTargetElements(elementsMap, appState);
  const [strokePopoverOpen, setStrokePopoverOpen] = useState(false);
  const [otherActionsPopoverOpen, setOtherActionsPopoverOpen] = useState(false);
  const [preventTextAlignClose, setPreventTextAlignClose] = useState(false);
  const { saveCaretPosition, restoreCaretPosition } = useTextEditorFocus();
  const { container } = useExcalidrawContainer();

  const isEditingTextOrNewElement = Boolean(
    appState.editingTextElement || appState.newElement,
  );

  const showFillIcons =
    (hasBackground(appState.activeTool.type) &&
      !isTransparent(appState.currentItemBackgroundColor)) ||
    targetElements.some(
      (element) =>
        hasBackground(element.type) && !isTransparent(element.backgroundColor),
    );

  const showLinkIcon = targetElements.length === 1;

  const showLineEditorAction =
    !appState.selectedLinearElement?.isEditing &&
    targetElements.length === 1 &&
    isLinearElement(targetElements[0]) &&
    !isElbowArrow(targetElements[0]);

  const showCropEditorAction =
    !appState.croppingElementId &&
    targetElements.length === 1 &&
    isImageElement(targetElements[0]);

  const showAlignActions = alignActionsPredicate(appState, app);

  let isSingleElementBoundContainer = false;
  if (
    targetElements.length === 2 &&
    (hasBoundTextElement(targetElements[0]) ||
      hasBoundTextElement(targetElements[1]))
  ) {
    isSingleElementBoundContainer = true;
  }

  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  // Close local popovers any time a global popup (appState.openPopup) opens/switches
  useEffect(() => {
    if (appState.openPopup) {
      setStrokePopoverOpen(false);
      setOtherActionsPopoverOpen(false);
    }
  }, [appState.openPopup]);

  return (
    <div className="compact-shape-actions">
      {/* Stroke Color */}
      {canChangeStrokeColor(appState, targetElements) && (
        <div className={clsx("compact-action-item")}>
          {renderAction("changeStrokeColor", { compactMode: true })}
        </div>
      )}

      {/* Background Color */}
      {canChangeBackgroundColor(appState, targetElements) && (
        <div className="compact-action-item">
          {renderAction("changeBackgroundColor", { compactMode: true })}
        </div>
      )}

      {/* Combined Properties (Fill, Stroke, Opacity) */}
      {(showFillIcons ||
        hasStrokeWidth(appState.activeTool.type) ||
        targetElements.some((element) => hasStrokeWidth(element.type)) ||
        hasStrokeStyle(appState.activeTool.type) ||
        targetElements.some((element) => hasStrokeStyle(element.type)) ||
        canChangeRoundness(appState.activeTool.type) ||
        targetElements.some((element) => canChangeRoundness(element.type))) && (
        <div className="compact-action-item">
          <Popover.Root
            open={strokePopoverOpen}
            onOpenChange={(open) => {
              setStrokePopoverOpen(open);
              if (open) {
                setOtherActionsPopoverOpen(false);
                setAppState({ openPopup: null });
              }
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="compact-action-button properties-trigger"
                title={t("labels.stroke")}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setStrokePopoverOpen((open) => {
                    const next = !open;
                    if (next) {
                      setOtherActionsPopoverOpen(false);
                      setAppState({ openPopup: null });
                    }
                    return next;
                  });
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {adjustmentsIcon}
              </button>
            </Popover.Trigger>
            {strokePopoverOpen && (
              <PropertiesPopover
                className={PROPERTIES_CLASSES}
                container={container}
                style={{ maxWidth: "13rem" }}
                onClose={() => setStrokePopoverOpen(false)}
              >
                <div className="selected-shape-actions">
                  {showFillIcons && renderAction("changeFillStyle")}
                  {(hasStrokeWidth(appState.activeTool.type) ||
                    targetElements.some((element) =>
                      hasStrokeWidth(element.type),
                    )) &&
                    renderAction("changeStrokeWidth")}
                  {(hasStrokeStyle(appState.activeTool.type) ||
                    targetElements.some((element) =>
                      hasStrokeStyle(element.type),
                    )) && (
                    <>
                      {renderAction("changeStrokeStyle")}
                      {renderAction("changeSloppiness")}
                    </>
                  )}
                  {(canChangeRoundness(appState.activeTool.type) ||
                    targetElements.some((element) =>
                      canChangeRoundness(element.type),
                    )) &&
                    renderAction("changeRoundness")}
                  {renderAction("changeOpacity")}
                </div>
              </PropertiesPopover>
            )}
          </Popover.Root>
        </div>
      )}

      {/* Combined Arrow Properties */}
      {(toolIsArrow(appState.activeTool.type) ||
        targetElements.some((element) => toolIsArrow(element.type))) && (
        <div className="compact-action-item">
          <Popover.Root
            open={appState.openPopup === "arrowProperties"}
            onOpenChange={(open) => {
              if (open) {
                setAppState({ openPopup: "arrowProperties" });
                setStrokePopoverOpen(false);
                setOtherActionsPopoverOpen(false);
              }
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="compact-action-button properties-trigger"
                title={t("labels.arrowtypes")}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (appState.openPopup === "arrowProperties") {
                    setAppState({ openPopup: null });
                  } else {
                    setStrokePopoverOpen(false);
                    setOtherActionsPopoverOpen(false);
                    setAppState({ openPopup: "arrowProperties" });
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {(() => {
                  // Show an icon based on the current arrow type
                  const arrowType = getFormValue(
                    targetElements,
                    app,
                    (element) => {
                      if (isArrowElement(element)) {
                        return element.elbowed
                          ? "elbow"
                          : element.roundness
                          ? "round"
                          : "sharp";
                      }
                      return null;
                    },
                    (element) => isArrowElement(element),
                    (hasSelection) =>
                      hasSelection ? null : appState.currentItemArrowType,
                  );

                  if (arrowType === "elbow") {
                    return elbowArrowIcon;
                  }
                  if (arrowType === "round") {
                    return roundArrowIcon;
                  }
                  return sharpArrowIcon; // default
                })()}
              </button>
            </Popover.Trigger>
            {appState.openPopup === "arrowProperties" && (
              <PropertiesPopover
                container={container}
                className="properties-content"
                style={{ maxWidth: "13rem" }}
                onClose={() => {
                  setAppState((prev: AppState) =>
                    prev.openPopup === "arrowProperties"
                      ? { openPopup: null }
                      : null,
                  );
                }}
              >
                {renderAction("changeArrowProperties")}
              </PropertiesPopover>
            )}
          </Popover.Root>
        </div>
      )}

      {/* Linear Editor */}
      {showLineEditorAction && (
        <div className="compact-action-item">
          {renderAction("toggleLinearEditor", { compactMode: true })}
        </div>
      )}

      {/* Text Properties */}
      {(appState.activeTool.type === "text" ||
        targetElements.some(isTextElement)) && (
        <>
          <div className="compact-action-item">
            {renderAction("changeFontFamily", {
              compactMode: true,
              onPreventClose: () => setPreventTextAlignClose(true),
            })}
          </div>
          <div className="compact-action-item">
            <Popover.Root
              open={appState.openPopup === "textAlign"}
              onOpenChange={(open) => {
                if (!open) {
                  // If we're preventing close due to selection, ignore this close event
                  if (preventTextAlignClose) {
                    setPreventTextAlignClose(false);
                    return;
                  }

                  setAppState({ openPopup: null });

                  // Refocus text editor if it was being edited and restore caret position
                  if (appState.editingTextElement) {
                    restoreCaretPosition();
                  }
                } else {
                  // Save current caret position before opening popover
                  if (appState.editingTextElement) {
                    saveCaretPosition();
                  }

                  setAppState({ openPopup: "textAlign" });
                  setStrokePopoverOpen(false);
                  setOtherActionsPopoverOpen(false);
                }
              }}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="compact-action-button properties-trigger"
                  title={t("labels.textAlign")}
                  onPointerDown={(e) => {
                    // Prevent default behavior that might dismiss keyboard on mobile
                    if (appState.editingTextElement) {
                      e.preventDefault();
                    }
                  }}
                  onClick={() => {}}
                >
                  {TextSizeIcon}
                </button>
              </Popover.Trigger>
              {appState.openPopup === "textAlign" && (
                <PropertiesPopover
                  className={PROPERTIES_CLASSES}
                  container={container}
                  style={{ maxWidth: "13rem" }}
                  // Improve focus handling for text editing scenarios
                  preventAutoFocusOnTouch={!!appState.editingTextElement}
                  onClose={() => {
                    setAppState({ openPopup: null });
                    // Refocus text editor when popover closes with caret restoration
                    if (appState.editingTextElement) {
                      restoreCaretPosition();
                    }
                  }}
                >
                  <div className="selected-shape-actions">
                    {(appState.activeTool.type === "text" ||
                      suppportsHorizontalAlign(targetElements, elementsMap)) &&
                      renderAction("changeTextAlign", {
                        compactMode: true,
                        onPreventClose: () => setPreventTextAlignClose(true),
                      })}
                    {shouldAllowVerticalAlign(targetElements, elementsMap) &&
                      renderAction("changeVerticalAlign", {
                        compactMode: true,
                        onPreventClose: () => setPreventTextAlignClose(true),
                      })}
                    {(appState.activeTool.type === "text" ||
                      targetElements.some(isTextElement)) &&
                      renderAction("changeFontSize", {
                        compactMode: true,
                        onPreventClose: () => setPreventTextAlignClose(true),
                      })}
                  </div>
                </PropertiesPopover>
              )}
            </Popover.Root>
          </div>
        </>
      )}

      {/* Dedicated Copy Button */}
      {!isEditingTextOrNewElement && targetElements.length > 0 && (
        <div className="compact-action-item">
          {renderAction("duplicateSelection", { compactMode: true })}
        </div>
      )}

      {/* Dedicated Delete Button */}
      {!isEditingTextOrNewElement && targetElements.length > 0 && (
        <div className="compact-action-item">
          {renderAction("deleteSelectedElements", { compactMode: true })}
        </div>
      )}

      {/* Combined Other Actions */}
      {!isEditingTextOrNewElement && targetElements.length > 0 && (
        <div className="compact-action-item">
          <Popover.Root
            open={otherActionsPopoverOpen}
            onOpenChange={(open) => {
              setOtherActionsPopoverOpen(open);
              if (open) {
                setStrokePopoverOpen(false);
                setAppState({ openPopup: null });
              }
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="compact-action-button properties-trigger"
                title={t("labels.actions")}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setOtherActionsPopoverOpen((open) => {
                    const next = !open;
                    if (next) {
                      setStrokePopoverOpen(false);
                      setAppState({ openPopup: null });
                    }
                    return next;
                  });
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {DotsHorizontalIcon}
              </button>
            </Popover.Trigger>
            {otherActionsPopoverOpen && (
              <PropertiesPopover
                className={PROPERTIES_CLASSES}
                container={container}
                style={{
                  maxWidth: "12rem",
                  // center the popover content
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onClose={() => setOtherActionsPopoverOpen(false)}
              >
                <div className="selected-shape-actions">
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
                  <fieldset>
                    <legend>{t("labels.actions")}</legend>
                    <div className="buttonList">
                      {renderAction("group")}
                      {renderAction("ungroup")}
                      {showLinkIcon && renderAction("hyperlink")}
                      {showCropEditorAction && renderAction("cropEditor")}
                    </div>
                  </fieldset>
                </div>
              </PropertiesPopover>
            )}
          </Popover.Root>
        </div>
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
  const lassoToolSelected =
    activeTool.type === "lasso" && app.defaultSelectionTool !== "lasso";

  const embeddableToolSelected = activeTool.type === "embeddable";

  const { TTDDialogTriggerTunnel } = useTunnels();

  return (
    <>
      {getToolbarTools(app).map(
        ({ value, icon, key, numericKey, fillable }, index) => {
          if (
            UIOptions.tools?.[
              value as Extract<
                typeof value,
                keyof AppProps["UIOptions"]["tools"]
              >
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
                  });
                } else {
                  app.setActiveTool({ type: value });
                }
              }}
            />
          );
        },
      )}
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
          {app.defaultSelectionTool !== "lasso" && (
            <DropdownMenu.Item
              onSelect={() => app.setActiveTool({ type: "lasso" })}
              icon={LassoIcon}
              data-testid="toolbar-lasso"
              selected={lassoToolSelected}
            >
              {t("toolBar.lasso")}
            </DropdownMenu.Item>
          )}
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
