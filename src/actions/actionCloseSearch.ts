import { register } from "./register";

export const actionCloseSearch = register({
  name: "closeSearch",
  trackEvent: { category: "menu" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        showSearch: false,
      },
      commitToHistory: false,
    };
  },
  checked: (appState) => appState.showSearch,
  contextItemLabel: "search.close",
});
