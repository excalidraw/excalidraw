import React from "react";
import { ActionManager } from "../actions/manager";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement, PointerType } from "../element/types";
import { t } from "../i18n";
import { useDeviceType } from "../components/App";
import {
  canChangeSharpness,
  canHaveArrowheads,
  getTargetElements,
  hasBackground,
  hasStrokeStyle,
  hasStrokeWidth,
  hasText,
} from "../scene";
import { SHAPES } from "../shapes";
import { AppState, Zoom } from "../types";
import {
  capitalizeString,
  isTransparent,
  setCursorForShape,
  withBatchedUpdates,
} from "../utils";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { hasStrokeColor } from "../scene/comparisons";
import { trackEvent } from "../analytics";
import { hasBoundTextElement, isBoundToContainer } from "../element/typeChecks";

export const SelectedShapeActions = ({
  appState,
  elements,
  renderAction,
  activeTool,
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  renderAction: ActionManager["renderAction"];
  activeTool: AppState["activeTool"]["type"];
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
  const deviceType = useDeviceType();
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  const showFillIcons =
    hasBackground(activeTool) ||
    targetElements.some(
      (element) =>
        hasBackground(element.type) && !isTransparent(element.backgroundColor),
    );
  const showChangeBackgroundIcons =
    hasBackground(activeTool) ||
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
      {((hasStrokeColor(activeTool) &&
        activeTool !== "image" &&
        commonSelectedType !== "image") ||
        targetElements.some((element) => hasStrokeColor(element.type))) &&
        renderAction("changeStrokeColor")}
      {showChangeBackgroundIcons && renderAction("changeBackgroundColor")}
      {showFillIcons && renderAction("changeFillStyle")}

      {(hasStrokeWidth(activeTool) ||
        targetElements.some((element) => hasStrokeWidth(element.type))) &&
        renderAction("changeStrokeWidth")}

      {(activeTool === "freedraw" ||
        targetElements.some((element) => element.type === "freedraw")) &&
        renderAction("changeStrokeShape")}

      {(hasStrokeStyle(activeTool) ||
        targetElements.some((element) => hasStrokeStyle(element.type))) && (
        <>
          {renderAction("changeStrokeStyle")}
          {renderAction("changeSloppiness")}
        </>
      )}

      {(canChangeSharpness(activeTool) ||
        targetElements.some((element) => canChangeSharpness(element.type))) && (
        <>{renderAction("changeSharpness")}</>
      )}

      {(hasText(activeTool) ||
        targetElements.some((element) => hasText(element.type))) && (
        <>
          {renderAction("changeFontSize")}

          {renderAction("changeFontFamily")}

          {renderAction("changeTextAlign")}
        </>
      )}

      {targetElements.some(
        (element) =>
          hasBoundTextElement(element) || isBoundToContainer(element),
      ) && renderAction("changeVerticalAlign")}
      {(canHaveArrowheads(activeTool) ||
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
            <div className="iconRow">
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
            {!deviceType.isMobile && renderAction("duplicateSelection")}
            {!deviceType.isMobile && renderAction("deleteSelectedElements")}
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
  canvas,
  activeTool,
  setAppState,
  onImageAction,
  appState,
}: {
  canvas: HTMLCanvasElement | null;
  activeTool: AppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
  onImageAction: (data: { pointerType: PointerType | null }) => void;
  appState: AppState;
}) => {
  const onChange = withBatchedUpdates(
    ({
      activeToolType,
      pointerType,
    }: {
      activeToolType: typeof SHAPES[number]["value"];
      pointerType: PointerType | null;
    }) => {
      if (appState.activeTool.type !== activeToolType) {
        trackEvent("toolbar", activeToolType, "ui");
      }
      if (!appState.penDetected && pointerType === "pen") {
        setAppState({
          penDetected: true,
          penMode: true,
        });
      }
      const nextActiveTool = { ...activeTool, type: activeToolType };
      setAppState({
        activeTool: nextActiveTool,
        multiElement: null,
        selectedElementIds: {},
      });
      setCursorForShape(canvas, {
        ...appState,
        activeTool: nextActiveTool,
      });
      if (activeToolType === "image") {
        onImageAction({ pointerType });
      }
    },
  );

  return (
    <>
      {SHAPES.map(({ value, icon, key }, index) => {
        const label = t(`toolBar.${value}`);
        const letter = key && (typeof key === "string" ? key : key[0]);
        const shortcut = letter
          ? `${capitalizeString(letter)} ${t("helpDialog.or")} ${index + 1}`
          : `${index + 1}`;
        return (
          <ToolButton
            className="Shape"
            key={value}
            type="radio"
            icon={icon}
            checked={activeTool.type === value}
            name="editor-current-shape"
            title={`${capitalizeString(label)} — ${shortcut}`}
            keyBindingLabel={`${index + 1}`}
            aria-label={capitalizeString(label)}
            aria-keyshortcuts={shortcut}
            data-testid={value}
            onPointerDown={({ pointerType }) => {
              onChange({ activeToolType: value, pointerType });
            }}
            onChange={({ pointerType }) => {
              onChange({ activeToolType: value, pointerType });
            }}
          />
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
  <Stack.Col gap={1}>
    <Stack.Row gap={1} align="center">
      {renderAction("zoomOut")}
      {renderAction("zoomIn")}
      {renderAction("resetZoom")}
    </Stack.Row>
  </Stack.Col>
);
