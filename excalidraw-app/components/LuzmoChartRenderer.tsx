import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";

import { LuzmoVizItemComponent } from "@luzmo/react-embed";

import {
  LUZMO_CHART_TYPES,
  getChartTypeInfo,
  FONT_FAMILY,
  applyDarkModeFilter,
  isTransparent,
} from "@excalidraw/common";

import { THEME, Spinner } from "@excalidraw/excalidraw";

import type { ExcalidrawLuzmoChartElement } from "@excalidraw/element/types";

import { getLuzmoAuthConfig } from "../luzmo.config";
import { useLuzmoChartContext } from "../context/LuzmoChartContext";
import { buildDefaultTitleFromSlots } from "../utils/luzmoChartTitle";

// Re-export for backwards compatibility
export { LUZMO_CHART_TYPES, getChartTypeInfo };
export { getChartSlots } from "@excalidraw/common";

// Map Excalidraw font family values to CSS font family strings for Luzmo
const getFontFamilyName = (fontFamily: number): string => {
  for (const [name, value] of Object.entries(FONT_FAMILY)) {
    if (value === fontFamily) {
      // Map Excalidraw font names to web-safe equivalents for Luzmo
      switch (name) {
        case "Excalifont":
        case "Virgil":
          return "Virgil, Segoe UI, system-ui, sans-serif"; // Hand-drawn style
        case "Nunito":
        case "Helvetica":
          return "Nunito, Helvetica, Arial, sans-serif"; // Normal style
        case "Cascadia":
        case "Comic Shanns":
          return "Cascadia Code, Consolas, Monaco, monospace"; // Code style
        case "Lilita One":
          return "Lilita One, Impact, sans-serif";
        case "Liberation Sans":
          return "Liberation Sans, Arial, sans-serif";
        case "Assistant":
          return "Assistant, Helvetica, sans-serif";
        default:
          return `${name}, sans-serif`;
      }
    }
  }
  return "sans-serif";
};

// Built-in Luzmo theme IDs
export const LUZMO_THEMES = [
  { id: "default", label: "Default" },
  { id: "default_dark", label: "Default Dark" },
  { id: "vivid", label: "Vivid" },
  { id: "seasonal", label: "Seasonal" },
  { id: "orion", label: "Orion" },
  { id: "royale", label: "Royale" },
  { id: "urban", label: "Urban" },
  { id: "pinky", label: "Pinky" },
  { id: "bliss", label: "Bliss" },
  { id: "radiant", label: "Radiant" },
  { id: "classic", label: "Classic" },
  { id: "classic_dark", label: "Classic Dark" },
] as const;

// Luzmo supported language codes
// See: https://developer.luzmo.com/guide/embedding--component-api-reference--properties.md
const LUZMO_SUPPORTED_LANGUAGES = [
  "en",
  "cs",
  "da",
  "de",
  "es",
  "fi",
  "fr",
  "he",
  "hu",
  "it",
  "ja",
  "ko",
  "mk",
  "nl",
  "pl",
  "pt",
  "ru",
  "sv",
  "zh_cn",
  "zh_tw",
] as const;

type LuzmoLanguage = typeof LUZMO_SUPPORTED_LANGUAGES[number];

/**
 * Maps Excalidraw language codes (e.g., "de-DE", "fr-FR") to Luzmo supported codes.
 * Falls back to "en" if the language is not supported by Luzmo.
 */
export const mapToLuzmoLanguage = (
  excalidrawLangCode: string,
): LuzmoLanguage => {
  // Extract base language code (e.g., "de-DE" -> "de", "zh-CN" -> "zh")
  const baseLang = excalidrawLangCode.split("-")[0].toLowerCase();

  // Handle Chinese variants specially
  if (baseLang === "zh") {
    const fullCode = excalidrawLangCode.toLowerCase();
    if (fullCode === "zh-tw") {
      return "zh_tw";
    }
    return "zh_cn";
  }

  // Check if base language is supported
  if (LUZMO_SUPPORTED_LANGUAGES.includes(baseLang as LuzmoLanguage)) {
    return baseLang as LuzmoLanguage;
  }

  // Default to English
  return "en";
};

export type LuzmoChartRendererProps = {
  element: ExcalidrawLuzmoChartElement;
  width: number;
  height: number;
  theme: typeof THEME.DARK | typeof THEME.LIGHT;
  langCode: string;
};

/**
 * LuzmoChartRenderer - Renders a Luzmo Flex SDK chart
 *
 * IMPORTANT: Per Luzmo guidelines:
 * - Each contextId must be unique across all chart instances
 * - Charts require explicit width and height to render
 * - Dark themes require dark background on container
 */
export const LuzmoChartRenderer: React.FC<LuzmoChartRendererProps> = ({
  element,
  width,
  height,
  theme,
  langCode,
}) => {
  // Get auth config from centralized config file
  const authConfig = useMemo(() => getLuzmoAuthConfig(), []);

  // Map Excalidraw language code to Luzmo supported language
  const luzmoLanguage = useMemo(() => mapToLuzmoLanguage(langCode), [langCode]);
  // Ref to LuzmoVizItemComponent - must match LuzmoEmbedVizItem for type compatibility
  const chartRef = useRef<import("@luzmo/embed").LuzmoEmbedVizItem | null>(
    null,
  );
  const luzmoChartContext = useLuzmoChartContext();

  // Loading state - shows spinner until chart renders
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state only when chart type changes (significant re-render)
  // Slot changes are incremental updates handled by Luzmo internally
  const prevChartTypeRef = useRef(element.chartType);
  useEffect(() => {
    if (prevChartTypeRef.current !== element.chartType) {
      setIsLoading(true);
      prevChartTypeRef.current = element.chartType;
    }
  }, [element.chartType]);

  /**
   * On "rendered" event: call getData(), signal chart-ready, and register getData
   * for SummaryManager to refresh summaries when filters change.
   *
   * IMPORTANT: This event fires AFTER the chart has finished rendering with current data.
   * When filters change, charts re-render and this event fires again with fresh data.
   */
  const handleRendered = useCallback(() => {
    setIsLoading(false);
    if (!luzmoChartContext) {
      return;
    }
    try {
      const vizItem = chartRef.current;
      if (vizItem?.getData) {
        const data = vizItem.getData();

        // Notify context that this chart has rendered - resolves any pending getData calls
        // that were waiting for fresh data after a filter change
        luzmoChartContext.notifyChartRendered(element.id, data);

        // Register getData BEFORE setChartReady so SummaryManager can access it
        // when the effect re-runs due to chartReadyMap change
        luzmoChartContext.registerChartGetData(element.id, async () => {
          const v = chartRef.current;
          if (!v?.getData) {
            return [];
          }
          const result = v.getData();
          return Promise.resolve(result);
        });
        luzmoChartContext.setChartReady(element.id);
      }
    } catch (err) {
      console.error("[LuzmoChartRenderer] Error in handleRendered:", err);
    }
  }, [element.id, luzmoChartContext]);

  // Track last known filters for this chart - only notify when they actually change
  const lastFiltersRef = useRef<string>("[]");

  /** Notify context when this chart emits changedFilters (e.g. date filter change).
   * Only notifies when filters have actually changed (avoids redundant updates). */
  const handleChangedFilters = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent<{ filters?: unknown[] }>)?.detail;
      const filters = detail?.filters ?? [];
      const filtersKey = JSON.stringify(filters);
      if (lastFiltersRef.current === filtersKey) {
        return;
      }
      lastFiltersRef.current = filtersKey;
      luzmoChartContext?.notifyChangedFilters(element.id);
    },
    [element.id, luzmoChartContext],
  );

  // Store context in ref to avoid stale closure in cleanup
  const contextRef = useRef(luzmoChartContext);
  contextRef.current = luzmoChartContext;

  useEffect(() => {
    return () => {
      contextRef.current?.unregisterChartGetData(element.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id]); // Only re-run when element.id changes, not on every context change

  /**
   * Prevents keyboard events from bubbling up to Excalidraw's global handlers.
   * This ensures any interactive elements within the chart (tooltips, inputs, etc.)
   * work correctly without triggering canvas shortcuts.
   */
  const stopKeyboardPropagation = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Determine theme to use
  const chartTheme = useMemo(() => {
    if (element.themeId) {
      return element.themeId;
    }
    // Auto-select based on app theme
    return theme === THEME.DARK ? "default_dark" : "default";
  }, [element.themeId, theme]);

  // Get background color - must match Excalidraw canvas element rendering:
  // - Transparent: use theme-based default (CSS var for our div, hex for Luzmo options)
  // - Non-transparent + dark: Excalidraw applies applyDarkModeFilter to the fill
  const DEFAULT_BG_LIGHT = "#ffffff";
  const DEFAULT_BG_DARK = "#232329"; // matches Excalidraw --island-bg-color
  const backgroundColor = useMemo(() => {
    if (!isTransparent(element.backgroundColor)) {
      return theme === THEME.DARK
        ? applyDarkModeFilter(element.backgroundColor)
        : element.backgroundColor;
    }
    return theme === THEME.DARK ? DEFAULT_BG_DARK : DEFAULT_BG_LIGHT;
  }, [element.backgroundColor, theme]);

  // Container uses CSS var so it always matches Excalidraw theme (handles custom themes)
  const containerBackground = isTransparent(element.backgroundColor)
    ? "var(--island-bg-color)"
    : backgroundColor;

  // Get font family string for Luzmo theme
  const fontFamilyString = useMemo(() => {
    return getFontFamilyName(element.fontFamily);
  }, [element.fontFamily]);

  // Spinner color based on theme
  const spinnerColor = theme === THEME.DARK ? "#e0e0e0" : "#6965db";

  // Render actual Luzmo chart
  // Use stable key (contextId) so component stays mounted and receives prop updates.
  // LuzmoVizItemComponent handles slots/options changes via props and re-renders internally.
  // IMPORTANT: Luzmo Flex charts require explicit pixel dimensions on BOTH container AND component
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: containerBackground,
        overflow: "hidden",
      }}
      onKeyDown={stopKeyboardPropagation}
      onKeyUp={stopKeyboardPropagation}
      onKeyPress={stopKeyboardPropagation}
    >
      {/* Loading overlay - shows until chart emits "rendered" event */}
      {/* High z-index to overlay Luzmo's internal loader elements */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: containerBackground,
            zIndex: 9999,
            // Set spinner color via CSS custom property
            ["--spinner-color" as string]: spinnerColor,
          }}
        >
          <Spinner size={Math.min(width, height) * 0.15} />
        </div>
      )}
      <LuzmoVizItemComponent
        ref={chartRef}
        key={element.contextId}
        contextId={element.contextId}
        appServer={authConfig.appServer}
        rendered={handleRendered}
        changedFilters={handleChangedFilters}
        apiHost={authConfig.apiHost}
        authKey={authConfig.authKey}
        authToken={authConfig.authToken}
        type={element.chartType}
        canFilter="all"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slots={element.slots ?? ([] as any)}
        options={{
          ...element.options,
          // Use default title from slots when title hasn't been set manually
          ...(element.options?.title?.en?.trim()
            ? {}
            : (() => {
                const def = buildDefaultTitleFromSlots(element.slots);
                return def ? { title: { en: def } } : {};
              })()),
          locale: luzmoLanguage,
          theme: {
            ...element.options?.theme,
            id: chartTheme,
            itemsBackground: backgroundColor,
            font: {
              ...element.options?.theme?.font,
              fontFamily: fontFamilyString,
            },
          },
          loader: (() => {
            const existingLoader = element.options?.loader as
              | { spinnerBackground?: string; spinnerColor?: string }
              | undefined;
            return {
              ...existingLoader,
              spinnerBackground:
                existingLoader?.spinnerBackground ?? backgroundColor,
              spinnerColor:
                existingLoader?.spinnerColor ??
                (theme === THEME.DARK ? "#e0e0e0" : "#333333"),
            };
          })(),
        }}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      />
    </div>
  );
};

export default LuzmoChartRenderer;
