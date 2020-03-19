import { KEYS } from "../keys";
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";
import { duplicateElement } from "../element";

export const actionDuplicateSelection = register({
  name: "duplicateSelection",
  perform: (elements, appState) => {
    return {
      appState,
      elements: elements.reduce(
        (acc: Array<ExcalidrawElement>, element: ExcalidrawElement) => {
          if (appState.selectedElementIds[element.id]) {
            const newElement = duplicateElement(element, {
              x: element.x + 10,
              y: element.y + 10,
            });
            appState.selectedElementIds[newElement.id] = true;
            delete appState.selectedElementIds[element.id];
            return acc.concat([element, newElement]);
          }
          return acc.concat(element);
        },
        [],
      ),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.duplicateSelection",
  keyTest: event => event[KEYS.CTRL_OR_CMD] && event.key === "d",
});
