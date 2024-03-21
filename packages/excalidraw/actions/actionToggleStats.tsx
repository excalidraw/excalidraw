import { register } from "./register";
import { CODES, KEYS } from "../keys";

export const actionToggleStats = register({
  name: "stats",
  label: "stats.title",
  paletteName: "Toggle stats",
  viewMode: true,
  trackEvent: { category: "menu" },
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
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.SLASH,
});
