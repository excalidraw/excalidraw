import { KEYS } from "../keys";
import { register } from "./register";
import { selectGroupsForSelectedElements } from "../groups";
import { getNonDeletedElements, isTextElement } from "../element";
import { ExcalidrawElement } from "../element/types";

export const actionSelectAll = register({
  name: "selectAll",
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => {
    if (appState.editingLinearElement) {
      return false;
    }
    return {
      appState: selectGroupsForSelectedElements(
        {
          ...appState,
          editingGroupId: null,
          selectedElementIds: elements.reduce(
            (map: Record<ExcalidrawElement["id"], true>, element) => {
              if (
                !element.isDeleted &&
                !(isTextElement(element) && element.containerId) &&
                !element.locked
              ) {
                map[element.id] = true;
              }
              return map;
            },
            {},
          ),
        },
        getNonDeletedElements(elements),
      ),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.selectAll",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.A,
});
