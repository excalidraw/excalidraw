import { register } from "./register";
import { CODES, KEYS } from "../keys";
import { abacusIcon } from "../components/icons";
import { CaptureIncrementAction } from "../store";

export const actionToggleStats = register({
  name: "stats",
  label: "stats.fullTitle",
  icon: abacusIcon,
  paletteName: "Toggle stats",
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["edit", "attributes", "customize"],
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        stats: { ...appState.stats, open: !this.checked!(appState) },
      },
      captureIncrement: CaptureIncrementAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.stats.open,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.SLASH,
});
