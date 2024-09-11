import { KEYS } from "../keys";
import { register } from "./register";
import type { AppState } from "../types";
import { searchIcon } from "../components/icons";
import { StoreAction } from "../store";
import { CANVAS_SEARCH_TAB, CLASSES, DEFAULT_SIDEBAR } from "../constants";

export const actionToggleSearchMenu = register({
  name: "searchMenu",
  icon: searchIcon,
  keywords: ["search", "find"],
  label: "search.title",
  viewMode: true,
  trackEvent: {
    category: "search_menu",
    action: "toggle",
    predicate: (appState) => appState.gridModeEnabled,
  },
  perform(elements, appState, _, app) {
    if (
      appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
      appState.openSidebar.tab === CANVAS_SEARCH_TAB
    ) {
      const searchInput =
        app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
          `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
        );

      if (searchInput?.matches(":focus")) {
        return {
          appState: { ...appState, openSidebar: null },
          storeAction: StoreAction.NONE,
        };
      }

      searchInput?.focus();
      searchInput?.select();
      return false;
    }

    return {
      appState: {
        ...appState,
        openSidebar: { name: DEFAULT_SIDEBAR.name, tab: CANVAS_SEARCH_TAB },
        openDialog: null,
      },
      storeAction: StoreAction.NONE,
    };
  },
  checked: (appState: AppState) => appState.gridModeEnabled,
  predicate: (element, appState, props) => {
    return props.gridModeEnabled === undefined;
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.F,
});
