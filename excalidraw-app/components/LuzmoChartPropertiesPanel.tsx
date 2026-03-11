import React, { useCallback, useMemo, useRef, useEffect } from "react";

import {
  LuzmoItemDataPickerPanel,
  LuzmoEditItem,
} from "@luzmo/analytics-components-kit/react";

import { Switch } from "@excalidraw/excalidraw/components/Switch";
import { TextField } from "@excalidraw/excalidraw/components/TextField";

import type {
  ExcalidrawLuzmoChartElement,
  LuzmoSlots,
} from "@excalidraw/element/types";

import type { UIAppState } from "@excalidraw/excalidraw/types";

import { getLuzmoAuthConfig } from "../luzmo.config";

import { useLuzmoChartContext } from "../context/LuzmoChartContext";

import { buildDefaultTitleFromSlots } from "../utils/luzmoChartTitle";

import { LUZMO_THEMES, mapToLuzmoLanguage } from "./LuzmoChartRenderer";

import "./LuzmoChartPropertiesPanel.scss";

import type { VizItemSlot } from "@luzmo/dashboard-contents-types";

/** Chart types that are filters (date picker, slicer, slider, dropdown) — no AI summary */
const LUZMO_FILTER_CHART_TYPES: readonly string[] = [
  "date-filter",
  "dropdown-filter",
  "slicer-filter",
  "slider-filter",
];

/** Per-element debounce for notifySlotsChanged - avoids API overload when typing slot labels */
const SLOTS_NOTIFY_DEBOUNCE_MS = 6000;
const slotsNotifyTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

interface LuzmoChartPropertiesPanelProps {
  element: ExcalidrawLuzmoChartElement;
  appState: UIAppState;
  onChange: (updates: Partial<ExcalidrawLuzmoChartElement>) => void;
  langCode: string;
}

export const LuzmoChartPropertiesPanel: React.FC<
  LuzmoChartPropertiesPanelProps
> = ({ element, appState, onChange, langCode }) => {
  const context = useLuzmoChartContext();

  const luzmoLanguage = useMemo(() => mapToLuzmoLanguage(langCode), [langCode]);

  const authConfig = useMemo(() => getLuzmoAuthConfig(), []);

  const { chartType, slots, options, themeId, aiSummaryEnabled } = element;

  const handleSlotsChange = useCallback(
    (event: CustomEvent) => {
      const newSlots = (event.detail?.slotsContents || []) as LuzmoSlots;
      onChange({
        slots: newSlots.length > 0 ? newSlots : null,
      });
      const elementId = element.id;
      const existingTimeout = slotsNotifyTimeouts.get(elementId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      slotsNotifyTimeouts.set(
        elementId,
        setTimeout(() => {
          slotsNotifyTimeouts.delete(elementId);
          context?.notifySlotsChanged(elementId);
        }, SLOTS_NOTIFY_DEBOUNCE_MS),
      );
    },
    [onChange, context, element.id],
  );

  const handleOptionsChange = useCallback(
    (event: CustomEvent) => {
      const newOptions = event.detail?.options as Record<string, unknown>;
      if (newOptions) {
        onChange({
          options: {
            ...options,
            ...newOptions,
          },
        });
      }
    },
    [options, onChange],
  );

  const handleThemeChange = useCallback(
    (newThemeId: string) => {
      onChange({
        themeId: newThemeId || undefined,
      });
    },
    [onChange],
  );

  const currentSlotsContents = useMemo(
    (): VizItemSlot[] => slots ?? [],
    [slots],
  );

  /** First dataset ID found in slots; used to pre-select dataset in picker when slots are populated */
  const selectedDatasetIdFromSlots = useMemo(() => {
    if (!currentSlotsContents || currentSlotsContents.length === 0) {
      return undefined;
    }
    for (const slot of currentSlotsContents) {
      const content = (slot as { content?: Array<{ datasetId?: string }> })
        ?.content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const item of content) {
        const datasetId = item?.datasetId;
        if (datasetId && typeof datasetId === "string") {
          return datasetId;
        }
      }
    }
    return undefined;
  }, [currentSlotsContents]);

  const isAiEnabled = aiSummaryEnabled ?? false;

  const dataPickerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = dataPickerContainerRef.current;
    if (!container) {
      return;
    }

    const SHADOW_STYLE = `.select-container:has(div.controls) luzmo-data-fields-select { max-width: 75%; }`;

    const injectIntoShadowRoot = (root: ShadowRoot) => {
      if (root.querySelector("style[data-luzmo-data-fields-select-override]")) {
        return;
      }
      const style = document.createElement("style");
      style.setAttribute("data-luzmo-data-fields-select-override", "");
      style.textContent = SHADOW_STYLE;
      root.appendChild(style);
    };

    const collectAndInject = (host: Element) => {
      const root = (host as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
      if (!root) {
        return;
      }
      injectIntoShadowRoot(root);
      root.querySelectorAll("luzmo-slot-contents-picker").forEach((el) => {
        const sr = (el as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
        if (sr) {
          injectIntoShadowRoot(sr);
        }
      });
    };

    const tryInject = () => {
      const picker = container.querySelector("luzmo-item-data-picker-panel");
      if (picker) {
        collectAndInject(picker);
      }
    };

    tryInject();
    const t1 = setTimeout(tryInject, 100);
    const t2 = setTimeout(tryInject, 400);
    const t3 = setTimeout(tryInject, 1000);
    const observer = new MutationObserver(tryInject);
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      observer.disconnect();
    };
  }, []);

  const titleManuallySet = !!options?.title?.en?.trim();
  const defaultTitle = useMemo(
    () => buildDefaultTitleFromSlots(currentSlotsContents),
    [currentSlotsContents],
  );
  const chartTitle = titleManuallySet
    ? options?.title?.en ?? ""
    : defaultTitle || "";

  const handleTitleChange = useCallback(
    (value: string) => {
      onChange({
        options: {
          ...options,
          title: value.trim() ? { en: value } : undefined,
        },
      });
    },
    [options, onChange],
  );

  return (
    <div className="luzmo-chart-properties-panel">
      {/* Data Slots */}
      <div className="luzmo-chart-properties__item">
        <label className="luzmo-chart-properties__label">Data slots</label>
        <div
          ref={dataPickerContainerRef}
          className="luzmo-chart-properties-panel__luzmo-component"
        >
          <LuzmoItemDataPickerPanel
            itemType={chartType}
            language={luzmoLanguage}
            contentLanguage={luzmoLanguage}
            datasetIds={authConfig.datasetIds}
            selectedDatasetId={selectedDatasetIdFromSlots}
            slotsContents={currentSlotsContents}
            datasetPicker={true}
            apiUrl={authConfig.apiHost}
            authKey={authConfig.authKey}
            authToken={authConfig.authToken}
            grows={true}
            onLuzmoSlotsContentsChanged={handleSlotsChange}
            selects={"single"}
          />
        </div>
      </div>

      {/* Chart Title */}
      {options?.display?.title !== false && (
        <div className="luzmo-chart-properties__item">
          <label className="luzmo-chart-properties__label">Chart title</label>
          <TextField
            className="luzmo-chart-properties-panel__title-input"
            value={chartTitle}
            placeholder="Enter chart title"
            fullWidth
            onChange={handleTitleChange}
          />
        </div>
      )}

      {/* AI Chart Summary */}
      {!LUZMO_FILTER_CHART_TYPES.includes(chartType) && (
        <div className="luzmo-chart-properties__item">
          <div className="luzmo-chart-properties-panel__setting-row">
            <label
              className="luzmo-chart-properties-panel__setting-label"
              htmlFor="ai-summary-toggle"
            >
              AI chart summary
            </label>
            <Switch
              name="ai-summary-toggle"
              checked={isAiEnabled}
              onChange={(checked) => onChange({ aiSummaryEnabled: checked })}
            />
          </div>
        </div>
      )}

      {/* Theme - below title & AI summary */}
      <div className="luzmo-chart-properties__item">
        <label className="luzmo-chart-properties__label" htmlFor="chart-theme">
          Theme
        </label>
        <select
          id="chart-theme"
          className="luzmo-chart-properties__select"
          value={themeId ?? ""}
          onChange={(e) => handleThemeChange(e.target.value)}
        >
          <option value="">Auto (based on app theme)</option>
          {LUZMO_THEMES.map((luzmoTheme) => (
            <option key={luzmoTheme.id} value={luzmoTheme.id}>
              {luzmoTheme.label}
            </option>
          ))}
        </select>
      </div>

      {/* Chart Options */}
      <div className="luzmo-chart-properties__item">
        <label className="luzmo-chart-properties__label">Chart options</label>
        <div className="luzmo-chart-properties-panel__luzmo-component">
          <LuzmoEditItem
            itemType={chartType}
            language={luzmoLanguage}
            options={options || {}}
            slots={currentSlotsContents}
            size="s"
            apiUrl={authConfig.apiHost}
            authKey={authConfig.authKey}
            authToken={authConfig.authToken}
            onLuzmoOptionsChanged={handleOptionsChange}
          />
        </div>
      </div>
    </div>
  );
};
