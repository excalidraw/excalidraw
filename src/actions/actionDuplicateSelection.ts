import nanoid from "nanoid";
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
            const newElement = duplicateElement(element);
            newElement.x = newElement.x + 10;
            newElement.y = newElement.y + 10;
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
