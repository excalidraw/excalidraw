import React from "react";
import { ActionManager } from "../actions/manager";
import { useIsMobile } from "../components/App";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement, PointerType } from "../element/types";
import { t } from "../i18n";
import {
  canChangeSharpness,
  canHaveArrowheads,
  getTargetElements,
  hasBackground,
  hasStrokeStyle,
  hasStrokeWidth,
  hasText,
} from "../scene";
import { hasStrokeColor } from "../scene/comparisons";
import { SHAPES } from "../shapes";
import { AppState, Zoom } from "../types";
import { capitalizeString, isTransparent, setCursorForShape } from "../utils";
import SetImageNameDialog from "./SetImageNameDialog";
import SetTableNameDialog from "./SetTableNameDialog";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import ToolDropdownButton, { ToolDropdownOption } from "./ToolDropdownButton";

export const SelectedShapeActions = ({
  appState,
  elements,
  renderAction,
  elementType,
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  renderAction: ActionManager["renderAction"];
  elementType: ExcalidrawElement["type"];
}) => {
  const targetElements = getTargetElements(
    getNonDeletedElements(elements),
    appState,
  );
  const isEditing = Boolean(appState.editingElement);
  const isMobile = useIsMobile();
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  const showFillIcons =
    hasBackground(elementType) ||
    targetElements.some(
      (element) =>
        hasBackground(element.type) && !isTransparent(element.backgroundColor),
    );
  const showChangeBackgroundIcons =
    hasBackground(elementType) ||
    targetElements.some((element) => hasBackground(element.type));

  let commonSelectedType: string | null = targetElements[0]?.type || null;

  for (const element of targetElements) {
    if (element.type !== commonSelectedType) {
      commonSelectedType = null;
      break;
    }
  }

  return (
    <div className="panelColumn">
      {((hasStrokeColor(elementType) &&
        elementType !== "image" &&
        commonSelectedType !== "image") ||
        targetElements.some((element) => hasStrokeColor(element.type))) &&
        renderAction("changeStrokeColor")}
      {showChangeBackgroundIcons && renderAction("changeBackgroundColor")}
      {showFillIcons && renderAction("changeFillStyle")}

      {(hasStrokeWidth(elementType) ||
        targetElements.some((element) => hasStrokeWidth(element.type))) &&
        renderAction("changeStrokeWidth")}

      {(elementType === "freedraw" ||
        targetElements.some((element) => element.type === "freedraw")) &&
        renderAction("changeStrokeShape")}

      {(hasStrokeStyle(elementType) ||
        targetElements.some((element) => hasStrokeStyle(element.type))) && (
        <>
          {renderAction("changeStrokeStyle")}
          {renderAction("changeSloppiness")}
        </>
      )}

      {(canChangeSharpness(elementType) ||
        targetElements.some((element) => canChangeSharpness(element.type))) && (
        <>{renderAction("changeSharpness")}</>
      )}

      {(hasText(elementType) ||
        targetElements.some((element) => hasText(element.type))) && (
        <>
          {renderAction("changeFontSize")}

          {renderAction("changeFontFamily")}

          {renderAction("changeTextAlign")}
        </>
      )}

      {(canHaveArrowheads(elementType) ||
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

      {targetElements.length > 1 && (
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
      {!isMobile && !isEditing && targetElements.length > 0 && (
        <fieldset>
          <legend>{t("labels.actions")}</legend>
          <div className="buttonList">
            {renderAction("duplicateSelection")}
            {renderAction("deleteSelectedElements")}
            {renderAction("group")}
            {renderAction("ungroup")}
          </div>
        </fieldset>
      )}
    </div>
  );
};

export const ShapesSwitcher = ({
  canvas,
  elementType,
  setAppState,
  onImageAction,
  onTableAction,
}: {
  canvas: HTMLCanvasElement | null;
  elementType: ExcalidrawElement["type"];
  setAppState: React.Component<any, AppState>["setState"];
  onImageAction: (data: {
    pointerType: PointerType | null;
    isNew?: boolean;
    imagename?: string;
  }) => void;
  onTableAction: (data: {
    pointerType: PointerType | null;
    isNew?: boolean;
    tablename?: string;
  }) => void;
}) => (
  <>
    {SHAPES.map(({ value, icon, key }, index) => {
      const label = t(`toolBar.${value}`);
      const letter = key && (typeof key === "string" ? key : key[0]);
      const shortcut = letter
        ? `${capitalizeString(letter)} ${t("helpDialog.or")} ${index + 1}`
        : `${index + 1}`;
      const toolButtonProps = {
        className: "Shape",
        icon,
        name: "editor-current-shape",
        title: `${capitalizeString(label)} — ${shortcut}`,
        keyBindingLabel: `${index + 1}`,
        "aria-label": capitalizeString(label),
        "aria-keyshortcuts": shortcut,
        "data-testid": value,
      };
      if (value === "table") {
        const dropdownOptions = [
          {
            label: "New table container",
            confirmDialog: (closeDialog) => {
              return (
                <SetTableNameDialog
                  onConfirm={(tablename) => {
                    closeDialog();
                    setAppState({
                      elementType: value,
                      multiElement: null,
                      selectedElementIds: {},
                    });
                    setCursorForShape(canvas, value);
                    onTableAction({
                      pointerType: "mouse",
                      isNew: true,
                      tablename,
                    });
                  }}
                  onCancel={() => closeDialog()}
                />
              );
            },
          },
          {
            label: "Upload CSV",
            onClick: () => {
              setAppState({
                elementType: value,
                multiElement: null,
                selectedElementIds: {},
              });
              setCursorForShape(canvas, value);
              onTableAction({ pointerType: "mouse" });
            },
          },
        ] as ToolDropdownOption[];
        return (
          <ToolDropdownButton
            {...toolButtonProps}
            key={value}
            type="button"
            options={dropdownOptions}
          />
        );
      } else if (value === "image") {
        const dropdownOptions = [
          {
            label: "New image container",
            confirmDialog: (closeDialog) => {
              return (
                <SetImageNameDialog
                  onConfirm={(imagename) => {
                    closeDialog();
                    setAppState({
                      elementType: value,
                      multiElement: null,
                      selectedElementIds: {},
                    });
                    setCursorForShape(canvas, value);
                    onImageAction({
                      pointerType: "mouse",
                      isNew: true,
                      imagename,
                    });
                  }}
                  onCancel={() => closeDialog()}
                />
              );
            },
          },
          {
            label: "Upload Image",
            onClick: () => {
              setAppState({
                elementType: value,
                multiElement: null,
                selectedElementIds: {},
              });
              setCursorForShape(canvas, value);
              onImageAction({ pointerType: "mouse" });
            },
          },
        ] as ToolDropdownOption[];
        return (
          <ToolDropdownButton
            {...toolButtonProps}
            key={value}
            type="button"
            options={dropdownOptions}
          />
        );
      }
      return (
        <ToolButton
          {...toolButtonProps}
          key={value}
          type="radio"
          checked={elementType === value}
          onChange={({ pointerType }) => {
            setAppState({
              elementType: value,
              multiElement: null,
              selectedElementIds: {},
            });
            setCursorForShape(canvas, value);
          }}
        />
      );
    })}
  </>
);

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
