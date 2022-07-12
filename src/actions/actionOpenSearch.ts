import { register } from "./register";
import { CODES, KEYS } from "../keys";

export const actionOpenSearch = register({
  name: "openSearch",
  trackEvent: { category: "menu" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        showSearch: true,
      },
      commitToHistory: false,
    };
  },
  checked: (appState) => appState.showSearch,
  contextItemLabel: "search.open",
  keyTest: (event) => {
    event.preventDefault();
    return event[KEYS.CTRL_OR_CMD] && !event.altKey && event.code === CODES.F;
  },
});
