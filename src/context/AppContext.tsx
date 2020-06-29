import React from "react";
import { ActionManager } from "../actions/manager";
import { AppState } from "../types";
import { GlobalScene } from "../scene";

/** Top-level context for accessing app utilities. */
export interface AppContextValue {
  actionManager: ActionManager;
  canvas: HTMLCanvasElement | null;
  appState: AppState;
  setAppState: (value: AppState) => void;
  scene: GlobalScene;
}

export const AppContext = React.createContext<AppContextValue>(
  (null as unknown) as AppContextValue,
);
