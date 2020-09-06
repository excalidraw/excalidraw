import { ExcalidrawElement } from "../../element/types";

const { h } = window;

export class API {
  static getSelectedElements = (): ExcalidrawElement[] => {
    return h.elements.filter(
      (element) => h.state.selectedElementIds[element.id],
    );
  };

  static getSelectedElement = (): ExcalidrawElement => {
    const selectedElements = API.getSelectedElements();
    if (selectedElements.length !== 1) {
      throw new Error(
        `expected 1 selected element; got ${selectedElements.length}`,
      );
    }
    return selectedElements[0];
  };

  static getStateHistory = () => {
    // @ts-ignore
    return h.history.stateHistory;
  };

  static clearSelection = () => {
    // @ts-ignore
    h.app.clearSelection(null);
    expect(API.getSelectedElements().length).toBe(0);
  };
}
