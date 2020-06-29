import { register } from "./register";
import { NonDeletedExcalidrawElement } from "../element/types";
import { duplicateElement, getSelectedIdsMapping } from "../element";
import { getAveragePosition } from "../math";
import { Point } from "../types";

export type AddToSceneActionData = {
  sceneCenter: Point;
  elementsToAdd: readonly NonDeletedExcalidrawElement[];
};

export const actionAddToScene = register<AddToSceneActionData>({
  name: "addLibraryItemToScene",
  perform: (
    elements,
    appState,
    { sceneCenter: [centerX, centerY], elementsToAdd },
  ) => {
    // When adding a drawing to the current scene, align the
    // drawing center (average element position) with the viewport
    // center.
    const [averageElementX, averageElementY] = getAveragePosition(
      elementsToAdd.map((element) => [element.x, element.y]),
    );
    const groupIdMap = new Map();
    const clonedElements = elementsToAdd.map((element) =>
      duplicateElement(/* editingGroupId= */ null, groupIdMap, element, {
        x: centerX + (element.x - averageElementX),
        y: centerY + (element.y - averageElementY),
      }),
    );
    return {
      appState: {
        ...appState,
        isLibraryOpen: false,
        elementType: "selection",
        multiElement: null,
        selectedGroupIds: {},
        selectedElementIds: getSelectedIdsMapping(clonedElements),
      },
      elements: [...clonedElements, ...elements],
      commitToHistory: true,
    };
  },
});
