import { register } from "./register";
import { CODES, KEYS } from "../keys";
import { abacusIcon } from "../components/icons";
import { StoreAction } from "../store";

export const actionToggleStats = register({
  name: "stats",
  label: "stats.title",
  icon: abacusIcon,
  paletteName: "Toggle stats",
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
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.SLASH,
});
