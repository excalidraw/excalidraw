import React from "react";
import { AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { ActionManager } from "../actions/manager";
import { hasBackground, hasStroke, hasText, getTargetElement } from "../scene";
import { t } from "../i18n";
import { SHAPES } from "../shapes";
import { ToolButton } from "./ToolButton";
import { capitalizeString, setCursorForShape } from "../utils";
import Stack from "./Stack";
import useIsMobile from "../is-mobile";
import { getNonDeletedElements } from "../element";

export function SelectedShapeActions({
  appState,
  elements,
  renderAction,
  elementType,
}: {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
  renderAction: ActionManager["renderAction"];
  elementType: ExcalidrawElement["type"];
}) {
  const targetElements = getTargetElement(
    getNonDeletedElements(elements),
    appState,
  );
  const isEditing = Boolean(appState.editingElement);
  const isMobile = useIsMobile();

  return (
    <div className="panelColumn">
      {renderAction("changeStrokeColor")}
      {(hasBackground(elementType) ||
        targetElements.some((element) => hasBackground(element.type))) && (
        <>
          {renderAction("changeBackgroundColor")}

          {renderAction("changeFillStyle")}
        </>
      )}

      {(hasStroke(elementType) ||
        targetElements.some((element) => hasStroke(element.type))) && (
        <>
          {renderAction("changeStrokeWidth")}

          {renderAction("changeSloppiness")}
        </>
      )}

      {(hasText(elementType) ||
        targetElements.some((element) => hasText(element.type))) && (
        <>
          {renderAction("changeFontSize")}

          {renderAction("changeFontFamily")}

          {renderAction("changeTextAlign")}
        </>
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
      {!isMobile && !isEditing && targetElements.length > 0 && (
        <fieldset>
          <legend>{t("labels.actions")}</legend>
          <div className="buttonList">
            {renderAction("duplicateSelection")}
            {renderAction("deleteSelectedElements")}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function ShapesSwitcher({
  elementType,
  setAppState,
}: {
  elementType: ExcalidrawElement["type"];
  setAppState: any;
}) {
  return (
    <>
      {SHAPES.map(({ value, icon, key }, index) => {
        const label = t(`toolBar.${value}`);
        const shortcut = `${capitalizeString(key)} ${t("shortcutsDialog.or")} ${
          index + 1
        }`;
        return (
          <ToolButton
            key={value}
            type="radio"
            icon={icon}
            checked={elementType === value}
            name="editor-current-shape"
            title={`${capitalizeString(label)} — ${shortcut}`}
            keyBindingLabel={`${index + 1}`}
            aria-label={capitalizeString(label)}
            aria-keyshortcuts={`${key} ${index + 1}`}
            data-testid={value}
            onChange={() => {
              setAppState({
                elementType: value,
                multiElement: null,
                selectedElementIds: {},
              });
              setCursorForShape(value);
              setAppState({});
            }}
          ></ToolButton>
        );
      })}
    </>
  );
}

export function ZoomActions({
  renderAction,
  zoom,
}: {
  renderAction: ActionManager["renderAction"];
  zoom: number;
}) {
  return (
    <Stack.Col gap={1}>
      <Stack.Row gap={1} align="center">
        {renderAction("zoomIn")}
        {renderAction("zoomOut")}
        {renderAction("resetZoom")}
        <div style={{ marginInlineStart: 4 }}>{(zoom * 100).toFixed(0)}%</div>
      </Stack.Row>
    </Stack.Col>
  );
}
