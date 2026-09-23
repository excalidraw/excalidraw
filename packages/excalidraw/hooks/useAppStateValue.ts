import { useEffect, useRef, useState } from "react";

import { useExcalidrawAPI } from "../components/App";

import { getDefaultAppState } from "../appState";

import type { AppState } from "../types";

type AppStateSelector =
  | keyof AppState
  | (keyof AppState)[]
  | ((appState: AppState) => unknown);

const getSelectedValue = (appState: AppState, selector: AppStateSelector) => {
  if (typeof selector === "function") {
    return selector(appState);
  }
  if (Array.isArray(selector)) {
    return appState;
  }
  return appState[selector];
};

const getLatestValue = (
  api: ReturnType<typeof useExcalidrawAPI>,
  selector: AppStateSelector,
  _internal: boolean,
) => {
  if (api?.isDestroyed) {
    return;
  }

  let appState = api?.getAppState();
  if (!appState) {
    if (!_internal) {
      return undefined;
    }

    console.warn(
      "useAppStateValue: excalidrawAPI not defined yet for internal component while it should always be defined. Are you sure you're rendering inside of <Excalidraw/> component tree?",
    );
    // fall back in case there's a bug so we don't break the app
    // (internal components using this internal useAppStateValue expect
    //  non-undefined values on init)
    appState = Object.assign(
      { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 },
      getDefaultAppState(),
    );
  }

  return getSelectedValue(appState, selector);
};

/**
 * Subscribes to specific appState changes. The component re-renders
 * only when the specified prop(s) change — not on every appState update.
 *
 * Works both inside and outside the <Excalidraw> tree, as long as
 * ExcalidrawAPIContext.Provider is an ancestor (automatically provided
 * inside <Excalidraw>, or manually by the host app).
 *
 * Returns the narrowed value depending on prop form:
 *  - `keyof AppState` → `AppState[K]`
 *  - `(keyof AppState)[]` → whole `AppState`
 *  - selector function → selector's return type `T`
 *
 * If excalidrawAPI is not ready yet (host apps), hook is rerendered with latest
 * value once available.
 */
export function useAppStateValue<K extends keyof AppState>(
  prop: K,
  _internal?: boolean,
): AppState[K];
export function useAppStateValue(
  props: (keyof AppState)[],
  _internal?: boolean,
): AppState;
export function useAppStateValue<T>(
  selector: (appState: AppState) => T,
  _internal?: boolean,
): T;
export function useAppStateValue(
  selector: AppStateSelector,
  _internal: boolean = true,
): unknown {
  const api = useExcalidrawAPI();
  const [, rerender] = useState(0);

  const stateRef = useRef<{
    selector: AppStateSelector;
    isInitialized: boolean;
    latestValue: unknown;
  } | null>(null);
  if (!stateRef.current) {
    stateRef.current = {
      selector,
      isInitialized: !!api,
      latestValue: getLatestValue(api, selector, _internal),
    };
  }
  stateRef.current.selector = selector;
  if (!stateRef.current.isInitialized && api && !api.isDestroyed) {
    stateRef.current.isInitialized = true;
    stateRef.current.latestValue = getLatestValue(api, selector, _internal);
  }

  useEffect(() => {
    const currentStateRef = stateRef.current;
    if (!api || api.isDestroyed || !currentStateRef) {
      return;
    }

    return api.onStateChange(currentStateRef.selector, (newValue: any) => {
      currentStateRef.latestValue = newValue;
      rerender((value) => value + 1);
    });
  }, [api]);

  return stateRef.current.latestValue;
}

/**
 * Subscribes to specific appState changes without causing component rerenders.
 *
 * The callback is called on every matching change, but also on initial render
 * so you can initialize your state.
 */
export function useOnAppStateChange<K extends keyof AppState>(
  prop: K,
  callback: (value: AppState[K], appState: AppState) => void,
): undefined;
export function useOnAppStateChange(
  props: (keyof AppState)[],
  callback: (props: AppState, appState: AppState) => void,
): undefined;
export function useOnAppStateChange<T>(
  selector: (appState: AppState) => T,
  callback: (value: T, appState: AppState) => void,
): undefined;
export function useOnAppStateChange(
  selector: AppStateSelector,
  callback: (value: any, appState: AppState) => void,
): undefined {
  const api = useExcalidrawAPI();

  const stateRef = useRef({
    selector,
    callback,
  });
  stateRef.current.selector = selector;
  stateRef.current.callback = callback;

  useEffect(() => {
    if (!api || api.isDestroyed) {
      return;
    }

    stateRef.current.callback(
      getLatestValue(api, stateRef.current.selector, true),
      api.getAppState(),
    );

    return api.onStateChange(
      stateRef.current.selector,
      (newValue: any, state: AppState) => {
        stateRef.current.callback(newValue, state);
      },
    );
  }, [api]);

  return undefined;
}
