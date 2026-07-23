import clsx from "clsx";
import { useRef } from "react";
import { Popover } from "radix-ui";

import { CLASSES } from "@excalidraw/common";

import { isArrowElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { actionToggleZenMode } from "../actions";

import { t } from "../i18n";
import { getTargetElements } from "../scene";

import { getFormValue } from "../actions/actionProperties";

import { useTextEditorFocus } from "../hooks/useTextEditorFocus";

import { actionToggleViewMode } from "../actions/actionToggleViewMode";

import "./Actions.scss";

import { useExcalidrawContainer } from "./App";
import Stack from "./Stack";
import { Tooltip } from "./Tooltip";
import { PropertiesPopover } from "./PropertiesPopover";
import {
  sharpArrowIcon,
  roundArrowIcon,
  elbowArrowIcon,
  TextSizeIcon,
  adjustmentsIcon,
  DotsHorizontalIcon,
  pencilIcon,
} from "./icons";

import { Island } from "./Island";

import { getShapeActionPredicates } from "./shapeActionPredicates";

import type { ShapeActionPredicates } from "./shapeActionPredicates";
import type { AppClassProperties, UIAppState, AppState } from "../types";
import type { ActionManager } from "../actions/manager";

// re-exported for consumers outside the styles panel (e.g. CommandPalette)
export {
  canChangeStrokeColor,
  canChangeBackgroundColor,
} from "./shapeActionPredicates";

// Common CSS class combinations
const PROPERTIES_CLASSES = clsx([
  CLASSES.SHAPE_ACTIONS_THEME_SCOPE,
  "properties-content",
]);

/**
 * The "arrange" (z-order) fieldset, identical across every styles-panel layout.
 */
const LayersFieldset = ({
  renderAction,
}: {
  renderAction: ActionManager["renderAction"];
}) => (
  <fieldset>
    <legend>{t("labels.layers")}</legend>
    <div className="buttonList">
      {renderAction("sendToBack")}
      {renderAction("sendBackward")}
      {renderAction("bringForward")}
      {renderAction("bringToFront")}
    </div>
  </fieldset>
);

/**
 * The align + distribute fieldset, identical across every styles-panel layout.
 * Button order is mirrored for RTL so the leftmost button always aligns left.
 */
const AlignFieldset = ({
  renderAction,
  showDistribute,
}: {
  renderAction: ActionManager["renderAction"];
  showDistribute: boolean;
}) => {
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  return (
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
        {showDistribute && renderAction("distributeHorizontally")}
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
          {showDistribute && renderAction("distributeVertically")}
        </div>
      </div>
    </fieldset>
  );
};

/**
 * Full styles panel: the wide, always-expanded layout used on desktop when the
 * UI is in "full" mode.
 */
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
  const predicates = getShapeActionPredicates(
    appState,
    targetElements,
    elementsMap,
    app,
  );

  return (
    <div className="selected-shape-actions">
      <div>{predicates.strokeColor && renderAction("changeStrokeColor")}</div>
      {predicates.backgroundColor && (
        <div>{renderAction("changeBackgroundColor")}</div>
      )}
      {predicates.fill && renderAction("changeFillStyle")}

      {predicates.strokeWidth && renderAction("changeStrokeWidth")}

      {predicates.strokeStyle && <>{renderAction("changeStrokeStyle")}</>}

      {predicates.freedrawMode && renderAction("changeFreedrawMode")}

      {predicates.sloppiness && <>{renderAction("changeSloppiness")}</>}

      {predicates.roundness && <>{renderAction("changeRoundness")}</>}

      {predicates.arrowType && <>{renderAction("changeArrowType")}</>}

      {predicates.text && (
        <>
          <fieldset>{renderAction("changeFontFamily")}</fieldset>
          {renderAction("changeFontSize")}
          {predicates.textAlign && renderAction("changeTextAlign")}
        </>
      )}

      {predicates.verticalAlign && renderAction("changeVerticalAlign")}
      {predicates.arrowheads && <>{renderAction("changeArrowhead")}</>}

      {predicates.opacity && renderAction("changeOpacity")}

      {predicates.layers && <LayersFieldset renderAction={renderAction} />}

      {predicates.align && (
        <AlignFieldset
          renderAction={renderAction}
          showDistribute={predicates.distribute}
        />
      )}
      {predicates.showExtraActions && (
        <fieldset>
          <legend>{t("labels.actions")}</legend>
          <div className="buttonList">
            {renderAction("duplicateSelection")}
            {renderAction("deleteSelectedElements")}
            {renderAction("group")}
            {renderAction("ungroup")}
            {predicates.link && renderAction("hyperlink")}
            {predicates.cropEditor && renderAction("cropEditor")}
            {predicates.lineEditor && renderAction("toggleLinearEditor")}
          </div>
        </fieldset>
      )}
    </div>
  );
};

const CombinedShapeProperties = ({
  appState,
  renderAction,
  setAppState,
  predicates,
  container,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  predicates: ShapeActionPredicates;
  container: HTMLDivElement | null;
}) => {
  const shouldShowCombinedProperties =
    predicates.hasSelection ||
    (appState.activeTool.type !== "selection" &&
      appState.activeTool.type !== "eraser" &&
      appState.activeTool.type !== "hand" &&
      appState.activeTool.type !== "laser" &&
      appState.activeTool.type !== "lasso");
  const isOpen = appState.openPopup === "compactStrokeStyles";

  if (!shouldShowCombinedProperties) {
    return null;
  }

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setAppState({ openPopup: "compactStrokeStyles" });
          } else {
            setAppState({ openPopup: null });
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.stroke")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              setAppState({
                openPopup: isOpen ? null : "compactStrokeStyles",
              });
            }}
          >
            {adjustmentsIcon}
          </button>
        </Popover.Trigger>
        {isOpen && (
          <PropertiesPopover
            className={PROPERTIES_CLASSES}
            container={container}
            style={{ maxWidth: "13rem" }}
            onClose={() => {}}
          >
            <div className="selected-shape-actions">
              {predicates.fill && renderAction("changeFillStyle")}
              {predicates.strokeWidth && renderAction("changeStrokeWidth")}
              {
                /* in compact UI the freedraw pressure setting is rendered as a
                  standalone cycle button in the compact actions list; we render
                  it in the combined properties popup as well for clarity
                */
                predicates.freedrawMode && renderAction("changeFreedrawMode")
              }
              {predicates.strokeStyle && (
                <>{renderAction("changeStrokeStyle")}</>
              )}
              {predicates.sloppiness && <>{renderAction("changeSloppiness")}</>}
              {predicates.roundness && renderAction("changeRoundness")}
              {predicates.opacity && renderAction("changeOpacity")}
            </div>
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const CombinedArrowProperties = ({
  appState,
  renderAction,
  setAppState,
  targetElements,
  predicates,
  container,
  app,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  targetElements: ExcalidrawElement[];
  predicates: ShapeActionPredicates;
  container: HTMLDivElement | null;
  app: AppClassProperties;
}) => {
  if (!predicates.arrowType) {
    return null;
  }

  const isOpen = appState.openPopup === "compactArrowProperties";

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setAppState({ openPopup: "compactArrowProperties" });
          } else {
            setAppState({ openPopup: null });
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.arrowtypes")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              setAppState({
                openPopup: isOpen ? null : "compactArrowProperties",
              });
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
              return sharpArrowIcon;
            })()}
          </button>
        </Popover.Trigger>
        {isOpen && (
          <PropertiesPopover
            container={container}
            className="properties-content"
            style={{ maxWidth: "13rem" }}
            onClose={() => {}}
          >
            {renderAction("changeArrowProperties")}
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const CombinedTextProperties = ({
  appState,
  renderAction,
  setAppState,
  predicates,
  container,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  predicates: ShapeActionPredicates;
  container: HTMLDivElement | null;
}) => {
  const { saveCaretPosition, restoreCaretPosition } = useTextEditorFocus();
  const isOpen = appState.openPopup === "compactTextProperties";

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            if (appState.editingTextElement) {
              saveCaretPosition();
            }
            setAppState({ openPopup: "compactTextProperties" });
          } else {
            setAppState({ openPopup: null });
            if (appState.editingTextElement) {
              restoreCaretPosition();
            }
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.textAlign")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              if (isOpen) {
                setAppState({ openPopup: null });
              } else {
                if (appState.editingTextElement) {
                  saveCaretPosition();
                }
                setAppState({ openPopup: "compactTextProperties" });
              }
            }}
          >
            {TextSizeIcon}
          </button>
        </Popover.Trigger>
        {appState.openPopup === "compactTextProperties" && (
          <PropertiesPopover
            className={PROPERTIES_CLASSES}
            container={container}
            style={{ maxWidth: "13rem" }}
            // Improve focus handling for text editing scenarios
            preventAutoFocusOnTouch={!!appState.editingTextElement}
            onClose={() => {
              // Refocus text editor when popover closes with caret restoration
              if (appState.editingTextElement) {
                restoreCaretPosition();
              }
            }}
          >
            <div className="selected-shape-actions">
              {predicates.text && renderAction("changeFontSize")}
              {predicates.textAlign && renderAction("changeTextAlign")}
              {predicates.verticalAlign && renderAction("changeVerticalAlign")}
            </div>
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const CombinedExtraActions = ({
  appState,
  renderAction,
  predicates,
  setAppState,
  container,
  showDuplicate,
  showDelete,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  predicates: ShapeActionPredicates;
  setAppState: React.Component<any, AppState>["setState"];
  container: HTMLDivElement | null;
  showDuplicate?: boolean;
  showDelete?: boolean;
}) => {
  const isOpen = appState.openPopup === "compactOtherProperties";

  if (!predicates.showExtraActions) {
    return null;
  }

  return (
    <div className="compact-action-item">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setAppState({ openPopup: "compactOtherProperties" });
          } else {
            setAppState({ openPopup: null });
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={clsx("compact-action-button properties-trigger", {
              active: isOpen,
            })}
            title={t("labels.actions")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAppState({
                openPopup: isOpen ? null : "compactOtherProperties",
              });
            }}
          >
            {DotsHorizontalIcon}
          </button>
        </Popover.Trigger>
        {isOpen && (
          <PropertiesPopover
            className={PROPERTIES_CLASSES}
            container={container}
            style={{
              maxWidth: "12rem",
              justifyContent: "center",
              alignItems: "center",
            }}
            onClose={() => {}}
          >
            <div className="selected-shape-actions">
              {predicates.layers && (
                <LayersFieldset renderAction={renderAction} />
              )}

              {predicates.align && (
                <AlignFieldset
                  renderAction={renderAction}
                  showDistribute={predicates.distribute}
                />
              )}
              <fieldset>
                <legend>{t("labels.actions")}</legend>
                <div className="buttonList">
                  {renderAction("group")}
                  {renderAction("ungroup")}
                  {predicates.linkSingleOnly && renderAction("hyperlink")}
                  {predicates.cropEditor && renderAction("cropEditor")}
                  {showDuplicate && renderAction("duplicateSelection")}
                  {showDelete && renderAction("deleteSelectedElements")}
                </div>
              </fieldset>
            </div>
          </PropertiesPopover>
        )}
      </Popover.Root>
    </div>
  );
};

const LinearEditorAction = ({
  renderAction,
  predicates,
}: {
  renderAction: ActionManager["renderAction"];
  predicates: ShapeActionPredicates;
}) => {
  if (!predicates.lineEditor) {
    return null;
  }

  return (
    <div className="compact-action-item">
      {renderAction("toggleLinearEditor")}
    </div>
  );
};

/**
 * Compact styles panel — the collapsed, popover-driven layout used on tablets
 * and on desktop when the UI is in "compact" mode.
 */
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
  const predicates = getShapeActionPredicates(
    appState,
    targetElements,
    elementsMap,
    app,
  );
  const { container } = useExcalidrawContainer();

  return (
    <div className="compact-shape-actions">
      {/* Stroke Color */}
      {predicates.strokeColor && (
        <div className={clsx("compact-action-item")}>
          {renderAction("changeStrokeColor")}
        </div>
      )}

      {/* Background Color */}
      {predicates.backgroundColor && (
        <div className="compact-action-item">
          {renderAction("changeBackgroundColor")}
        </div>
      )}

      {/* Freedraw pressure: standalone button cycling the variability mode */}
      {predicates.freedrawMode && (
        <div className="compact-action-item">
          {renderAction("changeFreedrawMode", { cycle: true })}
        </div>
      )}

      <CombinedShapeProperties
        appState={appState}
        renderAction={renderAction}
        setAppState={setAppState}
        predicates={predicates}
        container={container}
      />

      <CombinedArrowProperties
        appState={appState}
        renderAction={renderAction}
        setAppState={setAppState}
        targetElements={targetElements}
        predicates={predicates}
        container={container}
        app={app}
      />
      {/* Linear Editor */}
      {predicates.lineEditor && (
        <div className="compact-action-item">
          {renderAction("toggleLinearEditor")}
        </div>
      )}

      {/* Text Properties */}
      {predicates.text && (
        <>
          <div className="compact-action-item">
            {renderAction("changeFontFamily")}
          </div>
          <CombinedTextProperties
            appState={appState}
            renderAction={renderAction}
            setAppState={setAppState}
            predicates={predicates}
            container={container}
          />
        </>
      )}

      {/* Dedicated Copy Button */}
      {predicates.showExtraActions && (
        <div className="compact-action-item">
          {renderAction("duplicateSelection")}
        </div>
      )}

      {/* Dedicated Delete Button */}
      {predicates.showExtraActions && (
        <div className="compact-action-item">
          {renderAction("deleteSelectedElements")}
        </div>
      )}

      <CombinedExtraActions
        appState={appState}
        renderAction={renderAction}
        predicates={predicates}
        setAppState={setAppState}
        container={container}
      />
    </div>
  );
};

/**
 * Mobile styles panel — the horizontal action bar used on phones, with an
 * overflow measurement that promotes duplicate/delete out of the popover when
 * there is room.
 */
export const MobileShapeActions = ({
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
  const predicates = getShapeActionPredicates(
    appState,
    targetElements,
    elementsMap,
    app,
  );
  const { container } = useExcalidrawContainer();
  const mobileActionsRef = useRef<HTMLDivElement>(null);

  const ACTIONS_WIDTH =
    mobileActionsRef.current?.getBoundingClientRect()?.width ?? 0;

  // 7 actions + 2 for undo/redo
  const MIN_ACTIONS = 9;

  const GAP = 6;
  const WIDTH = 32;

  const MIN_WIDTH = MIN_ACTIONS * WIDTH + (MIN_ACTIONS - 1) * GAP;

  const ADDITIONAL_WIDTH = WIDTH + GAP;

  const showDeleteOutside = ACTIONS_WIDTH >= MIN_WIDTH + ADDITIONAL_WIDTH;
  const showDuplicateOutside =
    ACTIONS_WIDTH >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH;

  return (
    <Island
      className="compact-shape-actions mobile-shape-actions"
      style={{
        flexDirection: "row",
        boxShadow: "none",
        padding: 0,
        zIndex: 2,
        backgroundColor: "transparent",
        height: WIDTH * 1.35,
        marginBottom: 4,
        alignItems: "center",
        gap: GAP,
        pointerEvents: "none",
      }}
      ref={mobileActionsRef}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: GAP,
          flex: 1,
        }}
      >
        {predicates.strokeColor && (
          <div className={clsx("compact-action-item")}>
            {renderAction("changeStrokeColor")}
          </div>
        )}
        {predicates.backgroundColor && (
          <div className="compact-action-item">
            {renderAction("changeBackgroundColor")}
          </div>
        )}
        <CombinedShapeProperties
          appState={appState}
          renderAction={renderAction}
          setAppState={setAppState}
          predicates={predicates}
          container={container}
        />
        {/* Combined Arrow Properties */}
        <CombinedArrowProperties
          appState={appState}
          renderAction={renderAction}
          setAppState={setAppState}
          targetElements={targetElements}
          predicates={predicates}
          container={container}
          app={app}
        />
        {/* Linear Editor */}
        <LinearEditorAction
          renderAction={renderAction}
          predicates={predicates}
        />
        {/* Text Properties */}
        {predicates.text && (
          <>
            <div className="compact-action-item">
              {renderAction("changeFontFamily")}
            </div>
            <CombinedTextProperties
              appState={appState}
              renderAction={renderAction}
              setAppState={setAppState}
              predicates={predicates}
              container={container}
            />
          </>
        )}

        {/* Combined Other Actions */}
        <CombinedExtraActions
          appState={appState}
          renderAction={renderAction}
          predicates={predicates}
          setAppState={setAppState}
          container={container}
          showDuplicate={!showDuplicateOutside}
          showDelete={!showDeleteOutside}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: GAP,
        }}
      >
        <div className="compact-action-item">{renderAction("undo")}</div>
        <div className="compact-action-item">{renderAction("redo")}</div>
        {showDuplicateOutside && (
          <div className="compact-action-item">
            {renderAction("duplicateSelection")}
          </div>
        )}
        {showDeleteOutside && (
          <div className="compact-action-item">
            {renderAction("deleteSelectedElements")}
          </div>
        )}
      </div>
    </Island>
  );
};

export const ZoomActions = ({
  renderAction,
}: {
  renderAction: ActionManager["renderAction"];
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

export const ExitZenModeButton = ({
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

export const ExitViewModeButton = ({
  actionManager,
}: {
  actionManager: ActionManager;
}) => (
  <button
    type="button"
    className="disable-view-mode"
    onClick={() => actionManager.executeAction(actionToggleViewMode)}
  >
    {pencilIcon}
  </button>
);
