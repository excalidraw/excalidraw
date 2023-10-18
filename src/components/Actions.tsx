import React, { useState } from "react";
import { ActionManager } from "../actions/manager";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useDevice } from "../components/App";
import {
  canChangeRoundness,
  canHaveArrowheads,
  getTargetElements,
  hasBackground,
  hasStrokeStyle,
  hasStrokeWidth,
  hasText,
} from "../scene";
import { SHAPES } from "../shapes";
import { AppClassProperties, UIAppState, Zoom } from "../types";
import { capitalizeString, isTransparent } from "../utils";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { hasStrokeColor } from "../scene/comparisons";
import { trackEvent } from "../analytics";
import { hasBoundTextElement } from "../element/typeChecks";
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
  EmbedIcon,
  extraToolsIcon,
  frameToolIcon,
  laserPointerToolIcon,
} from "./icons";
import { KEYS } from "../keys";

export const SelectedShapeActions = ({
  appState,
  elements,
  renderAction,
}: {
  appState: UIAppState;
  elements: readonly ExcalidrawElement[];
  renderAction: ActionManager["renderAction"];
}) => {
  const targetElements = getTargetElements(
    getNonDeletedElements(elements),
    appState,
  );

  let isSingleElementBoundContainer = false;
  if (
    targetElements.length === 2 &&
    (hasBoundTextElement(targetElements[0]) ||
      hasBoundTextElement(targetElements[1]))
  ) {
    isSingleElementBoundContainer = true;
  }
  const isEditing = Boolean(appState.editingElement);
  const device = useDevice();
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  const showFillIcons =
    hasBackground(appState.activeTool.type) ||
    targetElements.some(
      (element) =>
        hasBackground(element.type) && !isTransparent(element.backgroundColor),
    );
  const showChangeBackgroundIcons =
    hasBackground(appState.activeTool.type) ||
    targetElements.some((element) => hasBackground(element.type));

  const showLinkIcon =
    targetElements.length === 1 || isSingleElementBoundContainer;

  let commonSelectedType: string | null = targetElements[0]?.type || null;

  for (const element of targetElements) {
    if (element.type !== commonSelectedType) {
      commonSelectedType = null;
      break;
    }
  }

  return (
    <div className="panelColumn">
      <div>
        {((hasStrokeColor(appState.activeTool.type) &&
          appState.activeTool.type !== "image" &&
          commonSelectedType !== "image" &&
          commonSelectedType !== "frame") ||
          targetElements.some((element) => hasStrokeColor(element.type))) &&
          renderAction("changeStrokeColor")}
      </div>
      {showChangeBackgroundIcons && (
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

      {(hasText(appState.activeTool.type) ||
        targetElements.some((element) => hasText(element.type))) && (
        <>
          {renderAction("changeFontSize")}

          {renderAction("changeFontFamily")}

          {suppportsHorizontalAlign(targetElements) &&
            renderAction("changeTextAlign")}
        </>
      )}

      {shouldAllowVerticalAlign(targetElements) &&
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
          {renderAction("bringToFront")}
          {renderAction("bringForward")}
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
      {!isEditing && targetElements.length > 0 && (
        <fieldset>
          <legend>{t("labels.actions")}</legend>
          <div className="buttonList">
            {!device.isMobile && renderAction("duplicateSelection")}
            {!device.isMobile && renderAction("deleteSelectedElements")}
            {renderAction("group")}
            {renderAction("ungroup")}
            {showLinkIcon && renderAction("hyperlink")}
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
}: {
  activeTool: UIAppState["activeTool"];
  appState: UIAppState;
  app: AppClassProperties;
}) => {
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
  const device = useDevice();

  const frameToolSelected = activeTool.type === "frame";
  const laserToolSelected = activeTool.type === "laser";
  const embeddableToolSelected = activeTool.type === "embeddable";

  return (
    <>
      {SHAPES.map(({ value, icon, key, numericKey, fillable }, index) => {
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
      })}
      <div className="App-toolbar__divider" />
      {/* TEMP HACK because dropdown doesn't work well inside mobile toolbar */}
      {device.isMobile ? (
        <>
          <ToolButton
            className={clsx("Shape", { fillable: false })}
            type="radio"
            icon={frameToolIcon}
            checked={activeTool.type === "frame"}
            name="editor-current-shape"
            title={`${capitalizeString(
              t("toolBar.frame"),
            )} — ${KEYS.F.toLocaleUpperCase()}`}
            keyBindingLabel={KEYS.F.toLocaleUpperCase()}
            aria-label={capitalizeString(t("toolBar.frame"))}
            aria-keyshortcuts={KEYS.F.toLocaleUpperCase()}
            data-testid={`toolbar-frame`}
            onPointerDown={({ pointerType }) => {
              if (!appState.penDetected && pointerType === "pen") {
                app.togglePenMode(true);
              }
            }}
            onChange={({ pointerType }) => {
              trackEvent("toolbar", "frame", "ui");
              app.setActiveTool({ type: "frame" });
            }}
            selected={activeTool.type === "frame"}
          />
          <ToolButton
            className={clsx("Shape", { fillable: false })}
            type="radio"
            icon={EmbedIcon}
            checked={activeTool.type === "embeddable"}
            name="editor-current-shape"
            title={capitalizeString(t("toolBar.embeddable"))}
            aria-label={capitalizeString(t("toolBar.embeddable"))}
            data-testid={`toolbar-embeddable`}
            onPointerDown={({ pointerType }) => {
              if (!appState.penDetected && pointerType === "pen") {
                app.togglePenMode(true);
              }
            }}
            onChange={({ pointerType }) => {
              trackEvent("toolbar", "embeddable", "ui");
              app.setActiveTool({ type: "embeddable" });
            }}
            selected={activeTool.type === "embeddable"}
          />
        </>
      ) : (
        <DropdownMenu open={isExtraToolsMenuOpen}>
          <DropdownMenu.Trigger
            className={clsx("App-toolbar__extra-tools-trigger", {
              "App-toolbar__extra-tools-trigger--selected":
                frameToolSelected ||
                embeddableToolSelected ||
                // in collab we're already highlighting the laser button
                // outside toolbar, so let's not highlight extra-tools button
                // on top of it
                (laserToolSelected && !app.props.isCollaborating),
            })}
            onToggle={() => setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen)}
            title={t("toolBar.extraTools")}
          >
            {extraToolsIcon}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            onClickOutside={() => setIsExtraToolsMenuOpen(false)}
            onSelect={() => setIsExtraToolsMenuOpen(false)}
            className="App-toolbar__extra-tools-dropdown"
          >
            <DropdownMenu.Item
              onSelect={() => {
                app.setActiveTool({ type: "frame" });
              }}
              icon={frameToolIcon}
              shortcut={KEYS.F.toLocaleUpperCase()}
              data-testid="toolbar-frame"
              selected={frameToolSelected}
            >
              {t("toolBar.frame")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                app.setActiveTool({ type: "embeddable" });
              }}
              icon={EmbedIcon}
              data-testid="toolbar-embeddable"
              selected={embeddableToolSelected}
            >
              {t("toolBar.embeddable")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => {
                app.setActiveTool({ type: "laser" });
              }}
              icon={laserPointerToolIcon}
              data-testid="toolbar-laser"
              selected={laserToolSelected}
              shortcut={KEYS.K.toLocaleUpperCase()}
            >
              {t("toolBar.laser")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
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
  <Stack.Col gap={1} className="zoom-actions">
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
