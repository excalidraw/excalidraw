import React from "react";
import { AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { ActionManager } from "../actions/manager";
import {
  hasBackground,
  hasStroke,
  canChangeSharpness,
  hasText,
  getTargetElement,
} from "../scene";
import { t } from "../i18n";
import { SHAPES } from "../shapes";
import { ToolButton } from "./ToolButton";
import { capitalizeString, setCursorForShape } from "../utils";
import Stack from "./Stack";
import useIsMobile from "../is-mobile";
import { getNonDeletedElements } from "../element";

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
            {renderAction("group")}
            {renderAction("ungroup")}
          </div>
        </fieldset>
      )}
    </div>
  );
};

const LIBRARY_ICON = (
  // fa-th-large
  <svg viewBox="0 0 512 512">
    <path d="M296 32h192c13.255 0 24 10.745 24 24v160c0 13.255-10.745 24-24 24H296c-13.255 0-24-10.745-24-24V56c0-13.255 10.745-24 24-24zm-80 0H24C10.745 32 0 42.745 0 56v160c0 13.255 10.745 24 24 24h192c13.255 0 24-10.745 24-24V56c0-13.255-10.745-24-24-24zM0 296v160c0 13.255 10.745 24 24 24h192c13.255 0 24-10.745 24-24V296c0-13.255-10.745-24-24-24H24c-13.255 0-24 10.745-24 24zm296 184h192c13.255 0 24-10.745 24-24V296c0-13.255-10.745-24-24-24H296c-13.255 0-24 10.745-24 24v160c0 13.255 10.745 24 24 24z" />
  </svg>
);

export const ShapesSwitcher = ({
  elementType,
  setAppState,
  isLibraryOpen,
}: {
  elementType: ExcalidrawElement["type"];
  setAppState: React.Component<any, AppState>["setState"];
  isLibraryOpen: boolean;
}) => (
  <>
    {SHAPES.map(({ value, icon, key }, index) => {
      const label = t(`toolBar.${value}`);
      const letter = typeof key === "string" ? key : key[0];
      const letterShortcut = /[a-z]/.test(letter) ? letter : `Shift+${letter}`;
      const shortcut = `${capitalizeString(letterShortcut)} ${t(
        "shortcutsDialog.or",
      )} ${index + 1}`;
      return (
        <ToolButton
          className="Shape"
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
        />
      );
    })}
    <ToolButton
      className="Shape"
      type="button"
      icon={LIBRARY_ICON}
      name="editor-library"
      keyBindingLabel="9"
      aria-keyshortcuts="9"
      title={`${capitalizeString(t("toolBar.library"))} — 9`}
      aria-label={capitalizeString(t("toolBar.library"))}
      onClick={() => {
        setAppState({ isLibraryOpen: !isLibraryOpen });
      }}
    />
  </>
);

export const ZoomActions = ({
  renderAction,
  zoom,
}: {
  renderAction: ActionManager["renderAction"];
  zoom: number;
}) => (
  <Stack.Col gap={1}>
    <Stack.Row gap={1} align="center">
      {renderAction("zoomIn")}
      {renderAction("zoomOut")}
      {renderAction("resetZoom")}
      <div style={{ marginInlineStart: 4 }}>{(zoom * 100).toFixed(0)}%</div>
    </Stack.Row>
  </Stack.Col>
);
