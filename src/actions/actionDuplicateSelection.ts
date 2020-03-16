import nanoid from "nanoid";
import { KEYS } from "../keys";
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";

export const actionDuplicateSelection = register({
  name: "duplicateSelection",
  perform: (elements, appState) => {
    return {
      appState,
      elements: elements.reduce(
        (acc: Array<ExcalidrawElement>, element: ExcalidrawElement) => {
          if (appState.selectedElementIds[element.id]) {
            const newElement = {
              ...element,
              id: nanoid(),
              x: element.x + 10,
              y: element.y + 10,
            };
            return acc.concat([element, newElement]);
          }
          return acc.concat(element);
        },
        [],
      ),
    };
  },
  contextItemLabel: "labels.duplicateSelection",
  keyTest: event => event[KEYS.CTRL_OR_CMD] && event.code === "KeyD",
});
