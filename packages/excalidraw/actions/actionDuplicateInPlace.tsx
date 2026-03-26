import { register } from "./register";
import { actionDuplicateSelection } from "./actionDuplicateSelection";

export const actionDuplicateInPlace = register({
  name: "duplicateInPlace",
  label: "labels.duplicateInPlace",
  trackEvent: { category: "element" },
  perform: (elements, appState, data, app) => {
    return actionDuplicateSelection.perform(elements, appState, data, app);
  },
});
