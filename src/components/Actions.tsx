import React from "react";
import { ActionManager } from "../actions/manager";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import {
  canChangeSharpness,
  canHaveArrowheads,
  getTargetElements,
  hasBackground,
  hasStroke,
  hasText,
} from "../scene";
import { SHAPES } from "../shapes";
import { AppState, Zoom } from "../types";
import { capitalizeString, isTransparent, setCursorForShape } from "../utils";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";

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

  return (
    <div className="panelColumn">
      {renderAction("changeStrokeColor")}
      {showChangeBackgroundIcons && renderAction("changeBackgroundColor")}
      {showFillIcons && renderAction("changeFillStyle")}

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
      const shortcut = `${capitalizeString(letter)} ${t("helpDialog.or")} ${
        index + 1
      }`;
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
          aria-keyshortcuts={shortcut}
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
      className="Shape ToolIcon_type_button__library"
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
  zoom: Zoom;
}) => (
  <Stack.Col gap={1}>
    <Stack.Row gap={1} align="center">
      {renderAction("zoomIn")}
      {renderAction("zoomOut")}
      {renderAction("resetZoom")}
      <div style={{ marginInlineStart: 4 }}>
        {(zoom.value * 100).toFixed(0)}%
      </div>
    </Stack.Row>
  </Stack.Col>
);
