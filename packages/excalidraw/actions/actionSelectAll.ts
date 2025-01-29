import { KEYS } from "../keys";
import { register } from "./register";
import { selectGroupsForSelectedElements } from "../groups";
import { getNonDeletedElements, isTextElement } from "../element";
import type { ExcalidrawElement } from "../element/types";
import { isLinearElement } from "../element/typeChecks";
import { LinearElementEditor } from "../element/linearElementEditor";
import { selectAllIcon } from "../components/icons";
import { StoreAction } from "../store";

export const actionSelectAll = register({
  name: "selectAll",
  label: "labels.selectAll",
  icon: selectAllIcon,
  trackEvent: { category: "canvas" },
  viewMode: false,
  perform: (elements, appState, value, app) => {
    if (appState.editingLinearElement) {
      return false;
    }

    const selectedElementIds = elements
      .filter(
        (element) =>
          !element.isDeleted &&
          !(isTextElement(element) && element.containerId) &&
          !element.locked,
      )
      .reduce((map: Record<ExcalidrawElement["id"], true>, element) => {
        map[element.id] = true;
        return map;
      }, {});

    return {
      appState: {
        ...appState,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: null,
            selectedElementIds,
          },
          getNonDeletedElements(elements),
          appState,
          app,
        ),
        selectedLinearElement:
          // single linear element selected
          Object.keys(selectedElementIds).length === 1 &&
          isLinearElement(elements[0])
            ? new LinearElementEditor(elements[0])
            : null,
      },
      storeAction: StoreAction.CAPTURE,
    };
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.A,
});
