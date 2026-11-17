// React contexts the editor provides, and the hooks components use to read them.
// Kept out of App.tsx so components can use them without importing the editor.

import React, { useContext } from "react";
import {
  createUserAgentDescriptor,
  deriveStylesPanelMode,
  type EditorInterface,
} from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";

import type { ActionManager } from "../actions/manager";

import type {
  AppClassProperties,
  AppProps,
  AppState,
  ExcalidrawImperativeAPI,
} from "../types";

export const AppContext = React.createContext<AppClassProperties>(null!);

export const AppPropsContext = React.createContext<AppProps>(null!);

export const editorInterfaceContextInitialValue: EditorInterface = {
  formFactor: "desktop",
  desktopUIMode: "full",
  userAgent: createUserAgentDescriptor(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  ),
  isTouchScreen: false,
  canFitSidebar: false,
  isLandscape: true,
};

export const EditorInterfaceContext = React.createContext<EditorInterface>(
  editorInterfaceContextInitialValue,
);

export const ExcalidrawContainerContext = React.createContext<{
  container: HTMLDivElement | null;
  id: string | null;
}>({ container: null, id: null });

export const ExcalidrawElementsContext = React.createContext<
  readonly NonDeletedExcalidrawElement[]
>([]);

export const ExcalidrawAppStateContext = React.createContext<AppState>({
  ...getDefaultAppState(),
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
});

export const ExcalidrawSetAppStateContext = React.createContext<
  React.Component<any, AppState>["setState"]
>(() => {
  console.warn("Uninitialized ExcalidrawSetAppStateContext context!");
});

export const ExcalidrawActionManagerContext =
  React.createContext<ActionManager>(null!);

export const ExcalidrawAPIContext =
  React.createContext<ExcalidrawImperativeAPI | null>(null);

export const ExcalidrawAPISetContext = React.createContext<
  ((api: ExcalidrawImperativeAPI | null) => void) | null
>(null);

export const useApp = () => useContext(AppContext);

export const useAppProps = () => useContext(AppPropsContext);

export const useEditorInterface = () =>
  useContext<EditorInterface>(EditorInterfaceContext);

export const useStylesPanelMode = () =>
  deriveStylesPanelMode(useEditorInterface());

export const useExcalidrawContainer = () =>
  useContext(ExcalidrawContainerContext);

export const useExcalidrawElements = () =>
  useContext(ExcalidrawElementsContext);

export const useExcalidrawAppState = () =>
  useContext(ExcalidrawAppStateContext);

export const useExcalidrawSetAppState = () =>
  useContext(ExcalidrawSetAppStateContext);

export const useExcalidrawActionManager = () =>
  useContext(ExcalidrawActionManagerContext);

/**
 * Requires wrapping your component in <ExcalidrawAPIContext.Provider>
 */
export const useExcalidrawAPI = () => useContext(ExcalidrawAPIContext);

EditorInterfaceContext.displayName = "EditorInterfaceContext";
ExcalidrawContainerContext.displayName = "ExcalidrawContainerContext";
ExcalidrawElementsContext.displayName = "ExcalidrawElementsContext";
ExcalidrawAppStateContext.displayName = "ExcalidrawAppStateContext";
ExcalidrawSetAppStateContext.displayName = "ExcalidrawSetAppStateContext";
ExcalidrawActionManagerContext.displayName = "ExcalidrawActionManagerContext";
ExcalidrawAPIContext.displayName = "ExcalidrawAPIContext";
ExcalidrawAPISetContext.displayName = "ExcalidrawAPISetContext";
