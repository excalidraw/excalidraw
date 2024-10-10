/* eslint-disable prettier/prettier */
import { mutateElement } from "./mutateElement";
import { isBindingElement } from "./typeChecks";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  PointBinding,
} from "./types";

// We need to:
// 1: Update elements not selected to point to duplicated elements
// 2: Update duplicated elements to point to other duplicated elements
export const fixBindingsAfterDuplication2 = (
  sceneElements: readonly ExcalidrawElement[],
  oldElements: readonly ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
  // There are three copying mechanisms: Copy-paste, duplication and alt-drag.
  // Only when alt-dragging the new "duplicates" act as the "old", while
  // the "old" elements act as the "new copy" - essentially working reverse
  // to the other two.
  duplicatesServeAsOld?: "duplicatesServeAsOld" | undefined,
): void => {
  // First collect all the binding/bindable elements, so we only update
  // each once, regardless of whether they were duplicated or not.
  const allBoundElementIds: Set<ExcalidrawElement["id"]> = new Set(); // arrow and linearElement
  const allBindableElementIds: Set<ExcalidrawElement["id"]> = new Set(); // shapes like rectange and squares and dimond and circle

  // old shapes collection with types
  const linearShapesIds: Set<ExcalidrawElement["id"]> = new Set();
  const basicShapesIds: Set<ExcalidrawElement["id"]> = new Set();

  const shouldReverseRoles = duplicatesServeAsOld === "duplicatesServeAsOld";
  const duplicateIdToOldId = new Map(
    [...oldIdToDuplicatedId].map(([key, value]) => [value, key]),
  );

  oldElements.forEach((oldElement) => {
    const { boundElements } = oldElement;
    if (boundElements != null && boundElements.length > 0) {
      boundElements.forEach((boundElement) => {
        if (shouldReverseRoles && !oldIdToDuplicatedId.has(boundElement.id)) {
          allBoundElementIds.add(boundElement.id);
        }
      });
      basicShapesIds.add(oldElement.id); // this is for geting the old shapes from all shapes and then updated them
      allBindableElementIds.add(oldIdToDuplicatedId.get(oldElement.id)!);
    }
    if (isBindingElement(oldElement)) {
      if (oldElement.startBinding != null) {
        const { elementId } = oldElement.startBinding;
        if (shouldReverseRoles && !oldIdToDuplicatedId.has(elementId)) {
          allBindableElementIds.add(elementId);
        }
      }
      if (oldElement.endBinding != null) {
        const { elementId } = oldElement.endBinding;
        if (shouldReverseRoles && !oldIdToDuplicatedId.has(elementId)) {
          allBindableElementIds.add(elementId);
        }
      }
      // why (or) condition below and what is it doing ?
      if (oldElement.startBinding != null || oldElement.endBinding != null) {
        allBoundElementIds.add(oldIdToDuplicatedId.get(oldElement.id)!);
        linearShapesIds.add(oldElement.id); // we have to update the old linear element as well
      }
    }
  });

  // Update the linear elements
  (
    sceneElements.filter(({ id }) =>
      allBoundElementIds.has(id),
    ) as ExcalidrawLinearElement[]
  ).forEach((element) => {
    const { startBinding, endBinding } = element;
    mutateElement(element, {
      startBinding: newBindingAfterDuplication(
        startBinding,
        oldIdToDuplicatedId,
      ),
      endBinding: newBindingAfterDuplication(endBinding, oldIdToDuplicatedId),
    });
  });

  // update the origial linear element

  (
    sceneElements.filter(({ id }) =>
      linearShapesIds.has(id),
    ) as ExcalidrawLinearElement[]
  ).forEach((element) => {
    const { startBinding, endBinding } = element;
    // if startBinding and endBinding ids exsist in the selected list (oldIdToDuplicatedId) then we are not going to change else change
    // because if that in the list then we know it's going to get duplicated and the duplicate one is going to get connected to the duplicate arrow
    // so no need to chnage
    // Track if we need to mutate the element
    let updatedStartBinding = startBinding;
    let updatedEndBinding = endBinding;

    // Check if startBinding needs to be changed
    if (
      startBinding != null &&
      !oldIdToDuplicatedId.has(startBinding.elementId)
    ) {
      updatedStartBinding = null;
      //
      sceneElements
        .filter((ele) => ele.id === startBinding.elementId)
        .forEach((ele) => {
          const newBoundElements = ele.boundElements?.map((boundEle) => {
            if (boundEle.id === element.id) {
              return {
                id: oldIdToDuplicatedId.get(element.id),
                type: element.type,
              } as Readonly<{
                id: ExcalidrawLinearElement["id"];
                type: "arrow" | "text";
              }>;
            }
            return boundEle;
          });
          mutateElement(ele, {
            boundElements: newBoundElements,
          });
        });
    }

    // Check if endBinding needs to be changed
    if (endBinding != null && !oldIdToDuplicatedId.has(endBinding.elementId)) {
      updatedEndBinding = null;

      sceneElements
      .filter((ele) => ele.id === endBinding.elementId)
      .forEach((ele) => {
        const newBoundElements = ele.boundElements?.map((boundEle) => {
          if (boundEle.id === element.id) {
            return {
              id: oldIdToDuplicatedId.get(element.id),
              type: element.type,
            } as Readonly<{
              id: ExcalidrawLinearElement["id"];
              type: "arrow" | "text";
            }>;
          }
          return boundEle;
        });
        mutateElement(ele, {
          boundElements: newBoundElements,
        });
      });
    }

    // Mutate only if there are changes to either binding
    if (
      updatedStartBinding !== startBinding ||
      updatedEndBinding !== endBinding
    ) {
      mutateElement(element, {
        startBinding: updatedStartBinding,
        endBinding: updatedEndBinding,
      });
    }
  });

  // Update the bindable shapes
  sceneElements
    .filter(({ id }) => allBindableElementIds.has(id))
    .forEach((bindableElement) => {
      const oldElementId = duplicateIdToOldId.get(bindableElement.id);
      const boundElements = sceneElements.find(
        ({ id }) => id === oldElementId,
      )?.boundElements;

      if (boundElements && boundElements.length > 0) {
        // i gess we are changing the new duplicated one here but the issue is that we have to change the original as well
        mutateElement(bindableElement, {
          boundElements: boundElements.map((boundElement) =>
            oldIdToDuplicatedId.has(boundElement.id)
              ? {
                  id: oldIdToDuplicatedId.get(boundElement.id)!,
                  type: boundElement.type,
                }
              : boundElement,
          ),
        });
      }
    });

  // change the orignal basic_shapes as well
  sceneElements
    .filter(({ id }) => {
      return basicShapesIds.has(id);
    })
    .forEach((element) => {
      const { boundElements } = element;
      if (boundElements != null && boundElements.length > 0) {
        const newBoundElements = boundElements.filter(
          (ele) => oldIdToDuplicatedId.has(ele.id), // if the element is also get duplicated with the shapes then we want only that one else not
        );
        mutateElement(element, {
          boundElements: newBoundElements,
        });
      }
    });
};

const newBindingAfterDuplication = (
  binding: PointBinding | null,
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
): PointBinding | null => {
  if (binding == null) {
    return null;
  }
  return {
    ...binding,
    elementId: oldIdToDuplicatedId.get(binding.elementId) ?? binding.elementId,
  };
};

// issue in the fixBindingsAfterDuplication() function

/*
1. when arrow is linear {and not elbow_Arrow}, and if that arrow is connected with something then we still got the both {startBinding, endBinding} to be null
which is why when we duplicate the arrow only the connection got lost

2. after when we connected the duplicate basic_shapes {squares, dimond, circle} we got updated the duplicated one but not the original one which we need to update as well

3. after duplication of the arrow {elbow_Arrow} we again updated the duplicated one but not the original one so we cannot move the original one

4. when 2 elbow_Arrow is connected to one element then {startBinding,endBinding} both are null very odd behaviour but when only one element is connected then it's fine

5. now if the arrow is duplicated then we have to attach the duplicate one to the shapes
*/
