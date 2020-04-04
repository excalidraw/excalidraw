import { KEYS } from "../keys";
import { register } from "./register";

export const actionSelectAll = register({
  name: "selectAll",
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        selectedElementIds: elements.reduce((map, element) => {
          if (!element.isDeleted) {
            map[element.id] = true;
          }
          return map;
        }, {} as any),
      },
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.selectAll",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === "a",
});
