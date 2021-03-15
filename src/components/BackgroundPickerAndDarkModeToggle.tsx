import React from "react";
import { ActionManager } from "../actions/manager";
import { AppState } from "../types";
import { DarkModeToggle } from "./DarkModeToggle";

export const BackgroundPickerAndDarkModeToggle = ({
  appState,
  setAppState,
  actionManager,
  showThemeBtn,
}: {
  actionManager: ActionManager;
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  showThemeBtn: boolean;
}) => (
  <div style={{ display: "flex" }}>
    {actionManager.renderAction("changeViewBackgroundColor")}
    {showThemeBtn && (
      <div style={{ marginInlineStart: "0.25rem" }}>
        <DarkModeToggle
          value={appState.theme}
          onChange={(theme) => {
            setAppState({ theme });
          }}
        />
      </div>
    )}
  </div>
);
