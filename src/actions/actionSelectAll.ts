import { KEYS } from "../keys";
import { register } from "./register";
import { selectGroupsForSelectedElements } from "../groups";
import { getNonDeletedElements, isTextElement } from "../element";
import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "../element/types";
import { isLinearElement } from "../element/typeChecks";
import { LinearElementEditor } from "../element/linearElementEditor";

export const actionSelectAll = register({
  name: "selectAll",
  trackEvent: { category: "canvas" },
  perform: (elements, appState, value, app) => {
    if (appState.editingLinearElement) {
      return false;
    }
    let selectedElementsCount = 0;
    const selectedElementIds = elements.reduce(
      (map: Record<ExcalidrawElement["id"], true>, element) => {
        if (
          !element.isDeleted &&
          !(isTextElement(element) && element.containerId) &&
          !element.locked
        ) {
          map[element.id] = true;
          selectedElementsCount++;
        }
        return map;
      },
      {},
    );
    const isSingleLinearElementSelected =
      selectedElementsCount === 1 && isLinearElement(elements[0]);

    return {
      appState: selectGroupsForSelectedElements(
        {
          ...appState,
          selectedLinearElement: isSingleLinearElementSelected
            ? new LinearElementEditor(
                elements[0] as NonDeleted<ExcalidrawLinearElement>,
                app.scene,
              )
            : null,
          editingGroupId: null,
          selectedElementIds,
        },
        getNonDeletedElements(elements),
      ),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.selectAll",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.A,
});
