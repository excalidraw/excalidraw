import { CODES, GRID_TYPE, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { gridIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleGridMode = register({
  name: "gridMode",
  icon: gridIcon,
  keywords: ["snap"],
  label: "labels.toggleGrid",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.gridModeEnabled,
  },
  perform(elements, appState) {
    let nextGridModeEnabled = appState.gridModeEnabled;
    let nextGridType = appState.gridType;

    if (!appState.gridModeEnabled) {
      nextGridModeEnabled = true;
      nextGridType = GRID_TYPE.MESH;
    } else if (appState.gridType === GRID_TYPE.MESH) {
      nextGridModeEnabled = true;
      nextGridType = GRID_TYPE.DOTS;
    } else {
      nextGridModeEnabled = false;
      nextGridType = GRID_TYPE.MESH;
    }

    return {
      appState: {
        ...appState,
        gridModeEnabled: nextGridModeEnabled,
        gridType: nextGridType,
        objectsSnapModeEnabled: false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.gridModeEnabled,
  predicate: (element, appState, props) => {
    return props.gridModeEnabled === undefined;
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
