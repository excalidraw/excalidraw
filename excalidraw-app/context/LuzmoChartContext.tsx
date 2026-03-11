import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface LuzmoChartContextValue {
  /** Map of element id -> true when chart has rendered and getData was called */
  chartReadyMap: Record<string, boolean>;
  setChartReady: (elementId: string) => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  /** Register a chart's getData function for summary refresh on filter changes */
  registerChartGetData: (
    elementId: string,
    getData: () => Promise<unknown>,
  ) => void;
  /** Unregister when chart unmounts */
  unregisterChartGetData: (elementId: string) => void;
  /** Get a chart's getData function (for SummaryManager to call after changedFilters) */
  getChartGetData: (elementId: string) => (() => Promise<unknown>) | undefined;
  /** Called when a chart emits changedFilters – source is the chart that originated the event */
  notifyChangedFilters: (sourceElementId: string) => void;
  /** Set by LuzmoChartSummaryManager to react to changedFilters */
  setOnChangedFiltersCallback: (
    cb: ((sourceElementId: string) => void) | null,
  ) => void;
  /** Version counter that increments when getData is registered - use as effect dependency */
  getDataVersion: number;
  /**
   * Register a callback to get fresh data after the chart re-renders.
   * Use this instead of getChartGetData when you need data AFTER a filter change.
   */
  registerPendingGetData: (
    elementId: string,
    resolver: (data: unknown) => void,
  ) => void;
  /** Notify that a chart has rendered (called by LuzmoChartRenderer) - resolves pending getData */
  notifyChartRendered: (elementId: string, data: unknown) => void;
  /** Called when a chart's slots configuration changes */
  notifySlotsChanged: (elementId: string) => void;
  /** Set by LuzmoChartSummaryManager to react to slots changes */
  setOnSlotsChangedCallback: (cb: ((elementId: string) => void) | null) => void;
}

const LuzmoChartContext = createContext<LuzmoChartContextValue | null>(null);

// Use module-level storage to persist across React Strict Mode remounts
const globalChartGetDataMap = new Map<string, () => Promise<unknown>>();
// Payload type for Luzmo changedFilters event
type ChangedFiltersPayload = {
  changed?: unknown[];
  filters?: unknown[];
  itemId?: string;
  item?: string;
  origin?: string;
};

// Ref-based callback so we never clear it - handler updates the ref, avoiding race when effect re-runs
let globalChangedFiltersHandlerRef:
  | ((sourceElementId: string, payload?: ChangedFiltersPayload) => void)
  | null = null;
const globalChangedFiltersCallback = (
  sourceElementId: string,
  payload?: ChangedFiltersPayload,
) => {
  globalChangedFiltersHandlerRef?.(sourceElementId, payload);
};
// Ref-based callback for slots changes
let globalSlotsChangedHandlerRef: ((elementId: string) => void) | null = null;
const globalSlotsChangedCallback = (elementId: string) => {
  globalSlotsChangedHandlerRef?.(elementId);
};
// Deferred unregistration: cancel on re-register to survive Strict Mode mount/unmount/remount
const pendingUnregisters = new Map<string, ReturnType<typeof setTimeout>>();
// Pending getData resolvers - waiting for chart to re-render after filter change
const globalPendingGetDataResolvers = new Map<
  string,
  Array<(data: unknown) => void>
>();

export const LuzmoChartProvider: React.FC<{
  children: React.ReactNode;
  excalidrawAPI?: ExcalidrawImperativeAPI | null;
}> = ({ children, excalidrawAPI = null }) => {
  const [chartReadyMap, setChartReadyMap] = useState<Record<string, boolean>>(
    {},
  );
  const [getDataVersion, setGetDataVersion] = useState(0);

  const setChartReady = useCallback((elementId: string) => {
    setChartReadyMap((prev) =>
      prev[elementId] ? prev : { ...prev, [elementId]: true },
    );
  }, []);

  // Use global map directly to avoid stale closure issues with React Strict Mode
  // Also increment version to trigger re-renders in consumers
  const registerChartGetData = useCallback(
    (elementId: string, getData: () => Promise<unknown>) => {
      // Cancel any pending unregister (Strict Mode remount - chart unmounted then remounted)
      const pending = pendingUnregisters.get(elementId);
      if (pending) {
        clearTimeout(pending);
        pendingUnregisters.delete(elementId);
      }
      globalChartGetDataMap.set(elementId, getData);
      setGetDataVersion((v) => v + 1);
    },
    [],
  );

  const unregisterChartGetData = useCallback((elementId: string) => {
    // Defer unregistration so Strict Mode remount can re-register before we clear
    const id = setTimeout(() => {
      globalChartGetDataMap.delete(elementId);
      pendingUnregisters.delete(elementId);
      setGetDataVersion((v) => v + 1);
    }, 50);
    pendingUnregisters.set(elementId, id);
  }, []);

  const getChartGetData = useCallback((elementId: string) => {
    const fn = globalChartGetDataMap.get(elementId);
    return fn;
  }, []);

  const notifyChangedFilters = useCallback((sourceElementId: string) => {
    globalChangedFiltersCallback(sourceElementId);
  }, []);

  const setOnChangedFiltersCallback = useCallback(
    (cb: ((sourceElementId: string) => void) | null) => {
      globalChangedFiltersHandlerRef = cb;
    },
    [],
  );

  const notifySlotsChanged = useCallback((elementId: string) => {
    globalSlotsChangedCallback(elementId);
  }, []);

  const setOnSlotsChangedCallback = useCallback(
    (cb: ((elementId: string) => void) | null) => {
      globalSlotsChangedHandlerRef = cb;
    },
    [],
  );

  const registerPendingGetData = useCallback(
    (elementId: string, resolver: (data: unknown) => void) => {
      const existing = globalPendingGetDataResolvers.get(elementId) || [];
      existing.push(resolver);
      globalPendingGetDataResolvers.set(elementId, existing);
    },
    [],
  );

  const notifyChartRendered = useCallback(
    (elementId: string, data: unknown) => {
      const resolvers = globalPendingGetDataResolvers.get(elementId);
      if (resolvers && resolvers.length > 0) {
        resolvers.forEach((resolve) => resolve(data));
        globalPendingGetDataResolvers.delete(elementId);
      }
    },
    [],
  );

  const value: LuzmoChartContextValue = useMemo(
    () => ({
      chartReadyMap,
      setChartReady,
      excalidrawAPI: excalidrawAPI ?? null,
      registerChartGetData,
      unregisterChartGetData,
      getChartGetData,
      notifyChangedFilters,
      setOnChangedFiltersCallback,
      getDataVersion,
      registerPendingGetData,
      notifyChartRendered,
      notifySlotsChanged,
      setOnSlotsChangedCallback,
    }),
    [
      chartReadyMap,
      setChartReady,
      excalidrawAPI,
      registerChartGetData,
      unregisterChartGetData,
      getChartGetData,
      notifyChangedFilters,
      setOnChangedFiltersCallback,
      getDataVersion,
      registerPendingGetData,
      notifyChartRendered,
      notifySlotsChanged,
      setOnSlotsChangedCallback,
    ],
  );

  return (
    <LuzmoChartContext.Provider value={value}>
      {children}
    </LuzmoChartContext.Provider>
  );
};

export const useLuzmoChartContext = (): LuzmoChartContextValue | null => {
  return useContext(LuzmoChartContext);
};
