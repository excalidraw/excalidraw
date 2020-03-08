import React from "react";
import { ExcalidrawElement } from "../element/types";
import { ActionManager } from "../actions/manager";
import { hasBackground, hasStroke, hasText } from "../scene";
import { t } from "../i18n";
import { SHAPES } from "../shapes";
import { ToolButton } from "./ToolButton";
import { capitalizeString } from "../utils";
import { CURSOR_TYPE } from "../constants";
import Stack from "./Stack";

export function SelectedShapeActions({
  targetElements,
  renderAction,
  elementType,
}: {
  targetElements: readonly ExcalidrawElement[];
  renderAction: ActionManager["renderAction"];
  elementType: ExcalidrawElement["type"];
}) {
  return (
    <div className="panelColumn">
      {renderAction("changeStrokeColor")}
      {(hasBackground(elementType) ||
        targetElements.some(element => hasBackground(element.type))) && (
        <>
          {renderAction("changeBackgroundColor")}

          {renderAction("changeFillStyle")}
        </>
      )}

      {(hasStroke(elementType) ||
        targetElements.some(element => hasStroke(element.type))) && (
        <>
          {renderAction("changeStrokeWidth")}

          {renderAction("changeSloppiness")}
        </>
      )}

      {(hasText(elementType) ||
        targetElements.some(element => hasText(element.type))) && (
        <>
          {renderAction("changeFontSize")}

          {renderAction("changeFontFamily")}
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
    </div>
  );
}

export function ShapesSwitcher({
  elementType,
  setAppState,
  setElements,
  elements,
}: {
  elementType: ExcalidrawElement["type"];
  setAppState: any;
  setElements: any;
  elements: readonly ExcalidrawElement[];
}) {
  return (
    <>
      {SHAPES.map(({ value, icon }, index) => {
        const label = t(`toolBar.${value}`);
        return (
          <ToolButton
            key={value}
            type="radio"
            icon={icon}
            checked={elementType === value}
            name="editor-current-shape"
            title={`${capitalizeString(label)} — ${
              capitalizeString(value)[0]
            }, ${index + 1}`}
            keyBindingLabel={`${index + 1}`}
            aria-label={capitalizeString(label)}
            aria-keyshortcuts={`${label[0]} ${index + 1}`}
            onChange={() => {
              setAppState({
                elementType: value,
                multiElement: null,
                selectedElementIds: {},
              });
              document.documentElement.style.cursor =
                value === "text" ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR;
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
        <div style={{ marginLeft: 4 }}>{(zoom * 100).toFixed(0)}%</div>
      </Stack.Row>
    </Stack.Col>
  );
}
