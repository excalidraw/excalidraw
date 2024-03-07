import { register } from "./register";
import { CODES, KEYS } from "../keys";
import { StoreAction } from "./types";

export const actionToggleStats = register({
  name: "stats",
  viewMode: true,
  trackEvent: { category: "menu" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        showStats: !this.checked!(appState),
      },
      storeAction: StoreAction.NONE,
    };
  },
  checked: (appState) => appState.showStats,
  contextItemLabel: "stats.title",
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.SLASH,
});
