import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";

import {
  CLASSES,
  KEYS,
  capitalizeString,
  isTransparent,
  LUZMO_CHART_CATEGORIES,
  LUZMO_CHART_TYPES,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  shouldAllowVerticalAlign,
  suppportsHorizontalAlign,
  hasBoundTextElement,
  isElbowArrow,
  isImageElement,
  isLinearElement,
  isTextElement,
  isArrowElement,
  hasStrokeColor,
  toolIsArrow,
  isLuzmoChartElement,
  isFrameLikeElement,
} from "@excalidraw/element";

import type {
  LuzmoChartType,
  FontFamilyValues,
} from "@excalidraw/element/types";

import type { ExcalidrawLuzmoChartElement } from "@excalidraw/element/types";

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

import { actionToggleViewMode } from "../actions/actionToggleViewMode";

import { getToolbarTools } from "./shapes";
import { FontPicker } from "./FontPicker/FontPicker";

import "./Actions.scss";

import {
  useEditorInterface,
  useStylesPanelMode,
  useExcalidrawContainer,
  useAppProps,
} from "./App";
import Stack from "./Stack";
import { ToolButton } from "./ToolButton";
import { ToolPopover } from "./ToolPopover";
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
  SelectionIcon,
  pencilIcon,
} from "./icons";

import { Island } from "./Island";
import Spinner from "./Spinner";

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

/**
 * Prevents keyboard events from bubbling up to Excalidraw's global handlers.
 * This ensures typing in inputs/textareas works correctly without triggering
 * canvas shortcuts (like Delete, Backspace, arrow keys, etc.)
 */
const stopKeyboardPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

// Compact font picker for Luzmo charts - uses element.id to avoid stale closure
const CompactLuzmoFontPicker = ({
  element,
  app,
}: {
  element: ExcalidrawLuzmoChartElement;
  app: AppClassProperties;
}) => {
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const handleFontFamilyChange = useCallback(
    (fontFamily: FontFamilyValues) => {
      const currentElement = app.scene.getElement(element.id);
      if (currentElement && isLuzmoChartElement(currentElement)) {
        app.scene.mutateElement(currentElement, { fontFamily });
        app.store.scheduleCapture();
      }
      // Persist as default for newly created Luzmo charts
      app.syncActionResult({
        appState: { currentItemFontFamily: fontFamily },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setIsFontPickerOpen(false);
    },
    [element.id, app.scene, app.store],
  );
  return (
    <FontPicker
      isOpened={isFontPickerOpen}
      selectedFontFamily={element.fontFamily}
      hoveredFontFamily={null}
      onSelect={handleFontFamilyChange}
      onHover={() => {}}
      onLeave={() => {}}
      onPopupChange={setIsFontPickerOpen}
      compactMode
    />
  );
};

// Custom properties component for Luzmo Chart elements
const LuzmoChartProperties = ({
  element,
  appState,
  renderAction,
  app,
  isSummaryFrameSelected = false,
}: {
  element: ExcalidrawLuzmoChartElement;
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  app: AppClassProperties;
  /** When true, the summary frame is selected; show frame-like native props only */
  isSummaryFrameSelected?: boolean;
}) => {
  const editorInterface = useEditorInterface();
  const appProps = useAppProps();

  // State for font picker popup
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);

  // Loading state for chart type changes (switchItem API call)
  const [isChangingChartType, setIsChangingChartType] = useState(false);

  // Subscribe to scene updates to force re-render when element is mutated
  // This is necessary because Excalidraw mutates elements in place, and React
  // doesn't detect changes to object properties when the reference stays the same
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const unsubscribe = app.scene.onUpdate(() => {
      // Force re-render when scene updates (element might have been mutated)
      forceUpdate({});
    });
    return unsubscribe;
  }, [app.scene]);

  // Update chart type - uses onLuzmoChartTypeChange if provided to handle
  // slot/options conversion via switchItem, otherwise falls back to simple reset
  const handleChartTypeChange = useCallback(
    async (newChartType: LuzmoChartType) => {
      // Skip if same type
      if (element.chartType === newChartType) {
        return;
      }

      setIsChangingChartType(true);
      try {
        // If app provides onLuzmoChartTypeChange, use it to convert slots/options
        if (appProps.onLuzmoChartTypeChange) {
          try {
            const updates = await appProps.onLuzmoChartTypeChange(
              element,
              newChartType,
            );
            app.scene.mutateElement(element, updates);
          } catch (error) {
            console.error("Error switching chart type:", error);
            // Fallback: just change the type and reset slots/options
            app.scene.mutateElement(element, {
              chartType: newChartType,
              slots: [],
              options: {},
            });
          }
        } else {
          // No handler provided - simple reset
          app.scene.mutateElement(element, {
            chartType: newChartType,
            slots: [],
            options: {},
          });
        }
        // Schedule history capture for undo/redo support
        app.store.scheduleCapture();
      } finally {
        setIsChangingChartType(false);
      }
    },
    [element, app.scene, app.store, appProps],
  );

  // Handle font family change - always get current element from scene to avoid
  // stale closure when element is replaced (e.g. after stroke/sloppiness change)
  const handleFontFamilyChange = useCallback(
    (fontFamily: FontFamilyValues) => {
      const currentElement = app.scene.getElement(element.id);
      if (currentElement && isLuzmoChartElement(currentElement)) {
        app.scene.mutateElement(currentElement, { fontFamily });
        app.store.scheduleCapture();
      }
      // Persist as default for newly created Luzmo charts (same as text/rectangles)
      app.syncActionResult({
        appState: { currentItemFontFamily: fontFamily },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setIsFontPickerOpen(false);
    },
    [element.id, app.scene, app.store],
  );

  // Generic onChange handler for the render prop.
  // Always get current element from scene to avoid stale closure (e.g. when frame
  // is selected and we resolve the chart via customData; mutations must target
  // the actual scene element).
  const handleElementChange = useCallback(
    (updates: Partial<ExcalidrawLuzmoChartElement>) => {
      const currentElement = app.scene.getElement(element.id);
      if (currentElement && isLuzmoChartElement(currentElement)) {
        app.scene.mutateElement(currentElement, updates);
        app.store.scheduleCapture();
      }
    },
    [element.id, app.scene, app.store],
  );

  // Check if custom render prop is provided
  const renderLuzmoChartProperties = appProps.renderLuzmoChartProperties;

  return (
    <div
      className="selected-shape-actions"
      onKeyDown={stopKeyboardPropagation}
      onKeyUp={stopKeyboardPropagation}
    >
      {/* Stroke color first, then background - same order as other elements */}
      <div>{renderAction("changeStrokeColor")}</div>
      <div>{renderAction("changeBackgroundColor")}</div>

      {/* Font Family Picker - chart only; native frames don't have font */}
      {!isSummaryFrameSelected && (
        <fieldset>
          <legend>{t("labels.fontFamily")}</legend>
          <FontPicker
            isOpened={isFontPickerOpen}
            selectedFontFamily={element.fontFamily}
            hoveredFontFamily={null}
            onSelect={handleFontFamilyChange}
            onHover={() => {}}
            onLeave={() => {}}
            onPopupChange={setIsFontPickerOpen}
          />
        </fieldset>
      )}

      {/* Border Style Options (Sloppiness & Roundness) - frame or chart */}
      <fieldset>
        <legend>{t("labels.stroke")}</legend>
        {renderAction("changeStrokeStyle")}
        {renderAction("changeSloppiness")}
        {renderAction("changeRoundness")}
      </fieldset>

      {/* Chart-specific configs (theme, slots, options) */}
      <fieldset>
        <legend>{t("labels.luzmochart")}</legend>

        <div
          className="luzmo-chart-properties"
          style={{ position: "relative" }}
        >
          {/* Loading overlay - same as mobile CompactProperties */}
          {isChangingChartType && (
            <div
              className="luzmo-chart-properties__loading-overlay"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--island-bg-color, #fff)",
                opacity: 0.85,
                zIndex: 10,
                borderRadius: "var(--border-radius-md, 4px)",
              }}
            >
              <Spinner size="1.5rem" />
            </div>
          )}
          {/* Chart Type Selector - matches other property selects */}
          <div className="luzmo-chart-properties__item">
            <label
              className="luzmo-chart-properties__label"
              htmlFor="luzmo-chart-type-select"
            >
              {t("labels.chartType") || "Chart type"}
            </label>
            <select
              id="luzmo-chart-type-select"
              className="luzmo-chart-properties__select"
              value={element.chartType}
              disabled={isChangingChartType}
              onChange={(e) =>
                handleChartTypeChange(e.target.value as LuzmoChartType)
              }
            >
              {LUZMO_CHART_CATEGORIES.map((category) => (
                <optgroup key={category.id} label={category.label}>
                  {LUZMO_CHART_TYPES.filter(
                    (ct) => ct.category === category.id,
                  ).map((chartType) => (
                    <option key={chartType.type} value={chartType.type}>
                      {chartType.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Divider between chart type and options */}
          <div className="luzmo-chart-properties__divider" aria-hidden />

          {/* Custom Luzmo Components (data picker, edit item) via render prop */}
          {renderLuzmoChartProperties ? (
            <div className="luzmo-chart-properties__custom">
              {renderLuzmoChartProperties(
                element,
                appState,
                handleElementChange,
              )}
            </div>
          ) : (
            /* Fallback: show basic status when no render prop provided */
            <>
              <div className="luzmo-chart-properties__item">
                <label className="luzmo-chart-properties__label">
                  {t("labels.chartSlots") || "Data Slots"}
                </label>
                <div className="luzmo-chart-properties__value">
                  {element.slots
                    ? t("labels.chartConfigured") || "Configured"
                    : t("labels.chartNotConfigured") || "Not configured"}
                </div>
              </div>
              <div className="luzmo-chart-properties__hint">
                {t("labels.chartConfigureHint") ||
                  "Use the Chart sidebar tab to configure data and options"}
              </div>
            </>
          )}
        </div>
      </fieldset>

      {/* Keep Layers */}
      <fieldset>
        <legend>{t("labels.layers")}</legend>
        <div className="buttonList">
          {renderAction("sendToBack")}
          {renderAction("sendBackward")}
          {renderAction("bringForward")}
          {renderAction("bringToFront")}
        </div>
      </fieldset>

      {/* Actions (copy, delete, link, etc.) - below Luzmo chart config */}
      <fieldset>
        <legend>{t("labels.actions")}</legend>
        <div className="buttonList">
          {editorInterface.formFactor !== "phone" &&
            renderAction("duplicateSelection")}
          {editorInterface.formFactor !== "phone" &&
            renderAction("deleteSelectedElements")}
          {renderAction("group")}
          {renderAction("ungroup")}
          {renderAction("hyperlink")}
        </div>
      </fieldset>
    </div>
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
  const editorInterface = useEditorInterface();
  const targetElements = getTargetElements(elementsMap, appState);

  // Resolve the element to show properties for. Summary frames (AI chart summary)
  // have no own settings - we show the linked Luzmo chart's properties instead.
  const getPropertiesElement = (): ExcalidrawElement | null => {
    if (targetElements.length !== 1) {
      return null;
    }
    const el = targetElements[0];
    if (isLuzmoChartElement(el)) {
      return el;
    }
    if (isFrameLikeElement(el)) {
      const chartId = el.customData?.aiSummaryChartId as string | undefined;
      if (chartId) {
        const chart = elementsMap.get(chartId) ?? null;
        return chart && isLuzmoChartElement(chart) ? chart : null;
      }
    }
    return null;
  };

  const luzmoElementForProperties = getPropertiesElement();

  // Show Luzmo chart properties when a chart or its summary frame is selected
  if (
    luzmoElementForProperties &&
    isLuzmoChartElement(luzmoElementForProperties)
  ) {
    const isSummaryFrameSelected = isFrameLikeElement(targetElements[0]);
    return (
      <LuzmoChartProperties
        element={luzmoElementForProperties as ExcalidrawLuzmoChartElement}
        appState={appState}
        renderAction={renderAction}
        app={app}
        isSummaryFrameSelected={isSummaryFrameSelected}
      />
    );
  }

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
            {editorInterface.formFactor !== "phone" &&
              renderAction("duplicateSelection")}
            {editorInterface.formFactor !== "phone" &&
              renderAction("deleteSelectedElements")}
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

const CombinedShapeProperties = ({
  appState,
  renderAction,
  setAppState,
  targetElements,
  container,
  app,
}: {
  targetElements: ExcalidrawElement[];
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  container: HTMLDivElement | null;
  app: AppClassProperties;
}) => {
  const appProps = useAppProps();
  const renderLuzmoChartProperties = appProps.renderLuzmoChartProperties;

  const showFillIcons =
    (hasBackground(appState.activeTool.type) &&
      !isTransparent(appState.currentItemBackgroundColor)) ||
    targetElements.some(
      (element) =>
        hasBackground(element.type) && !isTransparent(element.backgroundColor),
    );

  const shouldShowCombinedProperties =
    targetElements.length > 0 ||
    (appState.activeTool.type !== "selection" &&
      appState.activeTool.type !== "eraser" &&
      appState.activeTool.type !== "hand" &&
      appState.activeTool.type !== "laser" &&
      appState.activeTool.type !== "lasso");
  const isOpen = appState.openPopup === "compactStrokeStyles";

  // Include summary frames (they show chart properties, not frame settings)
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const propertiesElement = (() => {
    if (targetElements.length !== 1 || !renderLuzmoChartProperties) {
      return null;
    }
    const el = targetElements[0];
    if (isLuzmoChartElement(el)) {
      return el as ExcalidrawLuzmoChartElement;
    }
    if (isFrameLikeElement(el)) {
      const chartId = el.customData?.aiSummaryChartId as string | undefined;
      if (chartId) {
        const chart = elementsMap.get(chartId);
        return chart && isLuzmoChartElement(chart)
          ? (chart as ExcalidrawLuzmoChartElement)
          : null;
      }
    }
    return null;
  })();

  const isSingleLuzmoChart = !!propertiesElement;
  const isSummaryFrameSelected =
    isSingleLuzmoChart && isFrameLikeElement(targetElements[0]);

  const luzmoElement = propertiesElement;

  // Force re-render when scene updates (element mutated in place)
  // Same pattern as LuzmoChartProperties - needed for UI to reflect changes
  const [, forceUpdate] = useState({});
  useEffect(() => {
    if (!isSingleLuzmoChart) {
      return;
    }
    const unsubscribe = app.scene.onUpdate(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, [isSingleLuzmoChart, app.scene]);

  // Loading state for chart type changes (switchItem API call)
  const [isChangingChartType, setIsChangingChartType] = useState(false);

  const handleLuzmoChartChange = useCallback(
    (updates: Partial<ExcalidrawLuzmoChartElement>) => {
      if (!luzmoElement) {
        return;
      }
      const currentElement = app.scene.getElement(luzmoElement.id);
      if (currentElement && isLuzmoChartElement(currentElement)) {
        app.scene.mutateElement(currentElement, updates);
        app.store.scheduleCapture();
      }
    },
    [luzmoElement?.id, app.scene, app.store],
  );

  const handleChartTypeChange = useCallback(
    async (newChartType: LuzmoChartType) => {
      if (!luzmoElement || luzmoElement.chartType === newChartType) {
        return;
      }
      const currentElement = app.scene.getElement(luzmoElement.id) as
        | ExcalidrawLuzmoChartElement
        | undefined;
      if (!currentElement || !isLuzmoChartElement(currentElement)) {
        return;
      }
      setIsChangingChartType(true);
      try {
        if (appProps.onLuzmoChartTypeChange) {
          try {
            const updates = await appProps.onLuzmoChartTypeChange(
              currentElement,
              newChartType,
            );
            app.scene.mutateElement(currentElement, updates);
          } catch (error) {
            console.error("Error switching chart type:", error);
            app.scene.mutateElement(currentElement, {
              chartType: newChartType,
              slots: [],
              options: {},
            });
          }
        } else {
          app.scene.mutateElement(currentElement, {
            chartType: newChartType,
            slots: [],
            options: {},
          });
        }
        app.store.scheduleCapture();
      } finally {
        setIsChangingChartType(false);
      }
    },
    [luzmoElement?.id, app.scene, app.store, appProps],
  );

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
            style={{
              maxWidth: isSingleLuzmoChart ? "20rem" : "13rem",
              maxHeight: isSingleLuzmoChart ? "min(70vh, 28rem)" : undefined,
              overflowY: isSingleLuzmoChart ? "auto" : undefined,
            }}
            onClose={() => {}}
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
              {isSingleLuzmoChart && luzmoElement && (
                <>
                  {!isSummaryFrameSelected && (
                    <fieldset>
                      <legend>{t("labels.fontFamily")}</legend>
                      <CompactLuzmoFontPicker
                        element={luzmoElement}
                        app={app}
                      />
                    </fieldset>
                  )}
                  <fieldset>
                    <legend>{t("labels.luzmochart")}</legend>
                    <div
                      className="luzmo-chart-properties compact-popover"
                      style={{ position: "relative" }}
                    >
                      {/* Loading overlay */}
                      {isChangingChartType && (
                        <div
                          className="luzmo-chart-properties__loading-overlay"
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "var(--island-bg-color, #fff)",
                            opacity: 0.85,
                            zIndex: 10,
                            borderRadius: "var(--border-radius-md, 4px)",
                          }}
                        >
                          <Spinner size="1.5rem" />
                        </div>
                      )}
                      {/* Chart Type Selector - same UI as LuzmoChartProperties */}
                      <div className="luzmo-chart-properties__item">
                        <label
                          className="luzmo-chart-properties__label"
                          htmlFor="luzmo-chart-type-select-popover"
                        >
                          {t("labels.chartType") || "Chart type"}
                        </label>
                        <select
                          id="luzmo-chart-type-select-popover"
                          className="luzmo-chart-properties__select"
                          value={luzmoElement.chartType}
                          disabled={isChangingChartType}
                          onChange={(e) =>
                            handleChartTypeChange(
                              e.target.value as LuzmoChartType,
                            )
                          }
                        >
                          {LUZMO_CHART_CATEGORIES.map((category) => (
                            <optgroup key={category.id} label={category.label}>
                              {LUZMO_CHART_TYPES.filter(
                                (ct) => ct.category === category.id,
                              ).map((chartType) => (
                                <option
                                  key={chartType.type}
                                  value={chartType.type}
                                >
                                  {chartType.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div
                        className="luzmo-chart-properties__divider"
                        aria-hidden
                      />
                      {renderLuzmoChartProperties?.(
                        luzmoElement,
                        appState,
                        handleLuzmoChartChange,
                      )}
                    </div>
                  </fieldset>
                </>
              )}
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
  container,
  app,
}: {
  targetElements: ExcalidrawElement[];
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  container: HTMLDivElement | null;
  app: AppClassProperties;
}) => {
  const showShowArrowProperties =
    toolIsArrow(appState.activeTool.type) ||
    targetElements.some((element) => toolIsArrow(element.type));
  const isOpen = appState.openPopup === "compactArrowProperties";

  if (!showShowArrowProperties) {
    return null;
  }

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
  targetElements,
  container,
  elementsMap,
}: {
  appState: UIAppState;
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  targetElements: ExcalidrawElement[];
  container: HTMLDivElement | null;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
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
              {(appState.activeTool.type === "text" ||
                targetElements.some(isTextElement)) &&
                renderAction("changeFontSize")}
              {(appState.activeTool.type === "text" ||
                suppportsHorizontalAlign(targetElements, elementsMap)) &&
                renderAction("changeTextAlign")}
              {shouldAllowVerticalAlign(targetElements, elementsMap) &&
                renderAction("changeVerticalAlign")}
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
  targetElements,
  setAppState,
  container,
  app,
  showDuplicate,
  showDelete,
}: {
  appState: UIAppState;
  targetElements: ExcalidrawElement[];
  renderAction: ActionManager["renderAction"];
  setAppState: React.Component<any, AppState>["setState"];
  container: HTMLDivElement | null;
  app: AppClassProperties;
  showDuplicate?: boolean;
  showDelete?: boolean;
}) => {
  const isEditingTextOrNewElement = Boolean(
    appState.editingTextElement || appState.newElement,
  );
  const showCropEditorAction =
    !appState.croppingElementId &&
    targetElements.length === 1 &&
    isImageElement(targetElements[0]);
  const showLinkIcon = targetElements.length === 1;
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
  const isOpen = appState.openPopup === "compactOtherProperties";

  if (isEditingTextOrNewElement || targetElements.length === 0) {
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
  appState,
  renderAction,
  targetElements,
}: {
  appState: UIAppState;
  targetElements: ExcalidrawElement[];
  renderAction: ActionManager["renderAction"];
}) => {
  const showLineEditorAction =
    !appState.selectedLinearElement?.isEditing &&
    targetElements.length === 1 &&
    isLinearElement(targetElements[0]) &&
    !isElbowArrow(targetElements[0]);

  if (!showLineEditorAction) {
    return null;
  }

  return (
    <div className="compact-action-item">
      {renderAction("toggleLinearEditor")}
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
  const { container } = useExcalidrawContainer();

  const isEditingTextOrNewElement = Boolean(
    appState.editingTextElement || appState.newElement,
  );

  const showLineEditorAction =
    !appState.selectedLinearElement?.isEditing &&
    targetElements.length === 1 &&
    isLinearElement(targetElements[0]) &&
    !isElbowArrow(targetElements[0]);

  return (
    <div className="compact-shape-actions">
      {/* Stroke Color */}
      {canChangeStrokeColor(appState, targetElements) && (
        <div className={clsx("compact-action-item")}>
          {renderAction("changeStrokeColor")}
        </div>
      )}

      {/* Background Color */}
      {canChangeBackgroundColor(appState, targetElements) && (
        <div className="compact-action-item">
          {renderAction("changeBackgroundColor")}
        </div>
      )}

      <CombinedShapeProperties
        appState={appState}
        renderAction={renderAction}
        setAppState={setAppState}
        targetElements={targetElements}
        container={container}
        app={app}
      />

      <CombinedArrowProperties
        appState={appState}
        renderAction={renderAction}
        setAppState={setAppState}
        targetElements={targetElements}
        container={container}
        app={app}
      />
      {/* Linear Editor */}
      {showLineEditorAction && (
        <div className="compact-action-item">
          {renderAction("toggleLinearEditor")}
        </div>
      )}

      {/* Text Properties */}
      {(appState.activeTool.type === "text" ||
        targetElements.some(isTextElement)) && (
        <>
          <div className="compact-action-item">
            {renderAction("changeFontFamily")}
          </div>
          <CombinedTextProperties
            appState={appState}
            renderAction={renderAction}
            setAppState={setAppState}
            targetElements={targetElements}
            container={container}
            elementsMap={elementsMap}
          />
        </>
      )}

      {/* Dedicated Copy Button */}
      {!isEditingTextOrNewElement && targetElements.length > 0 && (
        <div className="compact-action-item">
          {renderAction("duplicateSelection")}
        </div>
      )}

      {/* Dedicated Delete Button */}
      {!isEditingTextOrNewElement && targetElements.length > 0 && (
        <div className="compact-action-item">
          {renderAction("deleteSelectedElements")}
        </div>
      )}

      <CombinedExtraActions
        appState={appState}
        renderAction={renderAction}
        targetElements={targetElements}
        setAppState={setAppState}
        container={container}
        app={app}
      />
    </div>
  );
};

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
        {canChangeStrokeColor(appState, targetElements) && (
          <div className={clsx("compact-action-item")}>
            {renderAction("changeStrokeColor")}
          </div>
        )}
        {canChangeBackgroundColor(appState, targetElements) && (
          <div className="compact-action-item">
            {renderAction("changeBackgroundColor")}
          </div>
        )}
        <CombinedShapeProperties
          appState={appState}
          renderAction={renderAction}
          setAppState={setAppState}
          targetElements={targetElements}
          container={container}
          app={app}
        />
        {/* Combined Arrow Properties */}
        <CombinedArrowProperties
          appState={appState}
          renderAction={renderAction}
          setAppState={setAppState}
          targetElements={targetElements}
          container={container}
          app={app}
        />
        {/* Linear Editor */}
        <LinearEditorAction
          appState={appState}
          renderAction={renderAction}
          targetElements={targetElements}
        />
        {/* Text Properties */}
        {(appState.activeTool.type === "text" ||
          targetElements.some(isTextElement)) && (
          <>
            <div className="compact-action-item">
              {renderAction("changeFontFamily")}
            </div>
            <CombinedTextProperties
              appState={appState}
              renderAction={renderAction}
              setAppState={setAppState}
              targetElements={targetElements}
              container={container}
              elementsMap={elementsMap}
            />
          </>
        )}

        {/* Combined Other Actions */}
        <CombinedExtraActions
          appState={appState}
          renderAction={renderAction}
          targetElements={targetElements}
          setAppState={setAppState}
          container={container}
          app={app}
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

export const ShapesSwitcher = ({
  activeTool,
  setAppState,
  app,
  UIOptions,
}: {
  activeTool: UIAppState["activeTool"];
  setAppState: React.Component<any, AppState>["setState"];
  app: AppClassProperties;
  UIOptions: AppProps["UIOptions"];
}) => {
  const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
  const stylesPanelMode = useStylesPanelMode();
  const isFullStylesPanel = stylesPanelMode === "full";
  const isCompactStylesPanel = stylesPanelMode === "compact";

  const SELECTION_TOOLS = [
    {
      type: "selection",
      icon: SelectionIcon,
      title: capitalizeString(t("toolBar.selection")),
    },
    {
      type: "lasso",
      icon: LassoIcon,
      title: capitalizeString(t("toolBar.lasso")),
    },
  ] as const;

  const frameToolSelected = activeTool.type === "frame";
  const laserToolSelected = activeTool.type === "laser";
  const lassoToolSelected =
    isFullStylesPanel &&
    activeTool.type === "lasso" &&
    app.state.preferredSelectionTool.type !== "lasso";

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
          const shortcut =
            letter && numericKey
              ? `${letter} ${t("helpDialog.or")} ${numericKey}`
              : letter || numericKey || "";
          // when in compact styles panel mode (tablet)
          // use a ToolPopover for selection/lasso toggle as well
          if (
            (value === "selection" || value === "lasso") &&
            isCompactStylesPanel
          ) {
            return (
              <ToolPopover
                key={"selection-popover"}
                app={app}
                options={SELECTION_TOOLS}
                activeTool={activeTool}
                defaultOption={app.state.preferredSelectionTool.type}
                namePrefix="selectionType"
                title={capitalizeString(t("toolBar.selection"))}
                data-testid="toolbar-selection"
                onToolChange={(type: string) => {
                  if (type === "selection" || type === "lasso") {
                    app.setActiveTool({ type });
                    setAppState({
                      preferredSelectionTool: { type, initialized: true },
                    });
                  }
                }}
                displayedOption={
                  SELECTION_TOOLS.find(
                    (tool) =>
                      tool.type === app.state.preferredSelectionTool.type,
                  ) || SELECTION_TOOLS[0]
                }
                fillable={activeTool.type === "selection"}
              />
            );
          }

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
                if (!app.state.penDetected && pointerType === "pen") {
                  app.togglePenMode(true);
                }

                if (value === "selection") {
                  if (app.state.activeTool.type === "selection") {
                    app.setActiveTool({ type: "lasso" });
                  } else {
                    app.setActiveTool({ type: "selection" });
                  }
                }
              }}
              onChange={({ pointerType }) => {
                if (app.state.activeTool.type !== value) {
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
          onToggle={() => {
            setIsExtraToolsMenuOpen(!isExtraToolsMenuOpen);
            setAppState({ openMenu: null, openPopup: null });
          }}
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
          {isFullStylesPanel && (
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
            <DropdownMenu.Item
              onSelect={() => app.onMagicframeToolSelect()}
              icon={MagicIcon}
              data-testid="toolbar-magicframe"
              badge={<DropdownMenu.Item.Badge>AI</DropdownMenu.Item.Badge>}
            >
              {t("toolBar.magicframe")}
            </DropdownMenu.Item>
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
