import { register } from "./register";

export const actionToggleStats = register({
  name: "stats",
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
});
