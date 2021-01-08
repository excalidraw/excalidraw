import React from "react";
import { ActionManager } from "../actions/manager";
import { AppState } from "../types";
import { DarkModeToggle } from "./DarkModeToggle";

export const BackgroundPickerAndDarkModeToggle = ({
  appState,
  setAppState,
  actionManager,
}: {
  actionManager: ActionManager;
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
}) => (
  <div style={{ display: "flex" }}>
    {actionManager.renderAction("changeViewBackgroundColor")}
    <div style={{ marginInlineStart: "0.25rem" }}>
      <DarkModeToggle
        value={appState.appearance}
        onChange={(appearance) => {
          setAppState({ appearance });
        }}
      />
    </div>
  </div>
);
