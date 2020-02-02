import { Action } from "./types";

export const actionToggleHints: Action = {
  name: "toggleHints",
  perform: (_, appState) => {
    return {
      appState: { ...appState, showHints: !appState.showHints },
    };
  },
  keyTest: event => event.key === "h",
};
