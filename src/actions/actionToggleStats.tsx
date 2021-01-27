import { register } from "./register";

export const actionToggleStats = register({
  name: "stats",
  perform(elements, appState) {
    this.checked = !this.checked;
    return {
      appState: {
        ...appState,
        showStats: !appState.showStats,
      },
      commitToHistory: false,
    };
  },
  checked: false,
  contextItemLabel: "stats.title",
});
