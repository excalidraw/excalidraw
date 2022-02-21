import { register } from "./register";
import { CODES, KEYS } from "../keys";

export const actionToggleStats = register({
  name: "stats",
  trackEvent: { category: "canvas" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        showStats: !this.checked!(appState),
      },
      commitToHistory: false,
    };
  },
  checked: (appState) => appState.showStats,
  contextItemLabel: "stats.title",
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.SLASH,
});
