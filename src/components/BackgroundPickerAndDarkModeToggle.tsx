import React from "react";
import { ActionManager } from "../actions/manager";
import { EVENT_CHANGE, trackEvent } from "../analytics";
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
          // TODO: track the theme on the first load too
          trackEvent(EVENT_CHANGE, "theme", appearance);
          setAppState({ appearance });
        }}
      />
    </div>
  </div>
);
