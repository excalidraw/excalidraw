import { useEffect, useRef, useState } from "react";

import { useExcalidrawAPI } from "../components/App";

import { getDefaultAppState } from "../appState";

import type { AppState } from "../types";

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
 * Calls the optional callback with the latest value on every change (not called
 * on initial render).
 *
 * If excalidrawAPI is not ready yet (host apps), hook is rerendered with latest
 * value once available.
 */
export function useAppStateValue<K extends keyof AppState>(
  prop: K,
  callback?: (value: AppState[K], appState: AppState) => void,
  _internal?: boolean,
): AppState[K];
export function useAppStateValue(
  props: (keyof AppState)[],
  callback?: (props: AppState, appState: AppState) => void,
  _internal?: boolean,
): AppState;
export function useAppStateValue<T>(
  selector: (appState: AppState) => T,
  callback?: (value: T, appState: AppState) => void,
  _internal?: boolean,
): T;
export function useAppStateValue(
  selector:
    | keyof AppState
    | (keyof AppState)[]
    | ((appState: AppState) => unknown),
  callback?: (value: any, appState: AppState) => void,
  _internal: boolean = true,
): unknown {
  const api = useExcalidrawAPI();

  const getLatestValue = () => {
    let appState = api?.getAppState();
    if (!appState) {
      if (!_internal) {
        return undefined;
      }
      console.warn(
        "useAppStateValue: excalidrawAPI not defined yet for internal component in which case it should always be defined. Are you sure you're rendering inside of <Excalidraw/> component tree?",
      );
      // fall back in case there's a bug so we don't break the app
      // (internal components using this internal useAppStateValue expect
      //  non-undefined values on init)
      appState = Object.assign(
        { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 },
        getDefaultAppState(),
      );
    }
    if (typeof selector === "function") {
      return selector(appState);
    }
    if (Array.isArray(selector)) {
      return appState;
    }
    return appState[selector];
  };

  const [value, setValue] = useState<unknown>(getLatestValue);

  const stateRef = useRef({
    selector,
    callback,
    isInitialized: !!api,
    latestValue: value,
  });
  stateRef.current.selector = selector;
  stateRef.current.callback = callback;
  if (!stateRef.current.isInitialized && api) {
    stateRef.current.isInitialized = true;
    stateRef.current.latestValue = getLatestValue();
  }

  useEffect(() => {
    if (!api) {
      return;
    }

    return api.onStateChange(
      stateRef.current.selector,
      (newValue: any, state: AppState) => {
        stateRef.current.latestValue = newValue;
        stateRef.current.callback?.(newValue, state);
        setValue(newValue);
      },
    );
  }, [api]);

  return stateRef.current.latestValue;
}
