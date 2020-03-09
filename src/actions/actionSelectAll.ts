import { KEYS } from "../keys";
import { register } from "./register";

export const actionSelectAll = register({
  name: "selectAll",
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(
          elements.map(element => [element.id, true]),
        ),
      },
    };
  },
  contextItemLabel: "labels.selectAll",
  keyTest: event => event[KEYS.CTRL_OR_CMD] && event.key === "a",
});
