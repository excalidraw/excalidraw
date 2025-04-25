import {
  ORIG_ID,
  randomId,
  randomInteger,
  arrayToMap,
  castArray,
  findLastIndex,
  getUpdatedTimestamp,
  isTestEnv,
} from "@excalidraw/common";

import type { Mutable } from "@excalidraw/common/utility-types";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  getElementsInGroup,
  getNewGroupIdsForDuplication,
  getSelectedGroupForElement,
} from "./groups";

import {
  bindElementsToFramesAfterDuplication,
  getFrameChildren,
} from "./frame";

import { normalizeElementOrder } from "./sortElements";

import { bumpVersion } from "./mutateElement";

import {
  hasBoundTextElement,
  isBoundToContainer,
  isFrameLikeElement,
} from "./typeChecks";

import { getBoundTextElement, getContainerElement } from "./textElement";

import { fixDuplicatedBindingsAfterDuplication } from "./binding";

import type {
  ElementsMap,
  ExcalidrawElement,
  GroupId,
  NonDeletedSceneElementsMap,
} from "./types";

/**
 * Duplicate an element, often used in the alt-drag operation.
 * Note that this method has gotten a bit complicated since the
 * introduction of gruoping/ungrouping elements.
 * @param editingGroupId The current group being edited. The new
 *                       element will inherit this group and its
 *                       parents.
 * @param groupIdMapForOperation A Map that maps old group IDs to
 *                               duplicated ones. If you are duplicating
 *                               multiple elements at once, share this map
 *                               amongst all of them
 * @param element Element to duplicate
 */
export const duplicateElement = <TElement extends ExcalidrawElement>(
  editingGroupId: AppState["editingGroupId"],
  groupIdMapForOperation: Map<GroupId, GroupId>,
  element: TElement,
  randomizeSeed?: boolean,
): Readonly<TElement> => {
  const copy = deepCopyElement(element);

  if (isTestEnv()) {
    __test__defineOrigId(copy, element.id);
  }

  copy.id = randomId();
  copy.updated = getUpdatedTimestamp();
  if (randomizeSeed) {
    copy.seed = randomInteger();
    bumpVersion(copy);
  }

  copy.groupIds = getNewGroupIdsForDuplication(
    copy.groupIds,
    editingGroupId,
    (groupId) => {
      if (!groupIdMapForOperation.has(groupId)) {
        groupIdMapForOperation.set(groupId, randomId());
      }
      return groupIdMapForOperation.get(groupId)!;
    },
  );
  return copy;
};

export const duplicateElements = (
  opts: {
    elements: readonly ExcalidrawElement[];
    randomizeSeed?: boolean;
    overrides?: (data: {
      duplicateElement: ExcalidrawElement;
      origElement: ExcalidrawElement;
      origIdToDuplicateId: Map<
        ExcalidrawElement["id"],
        ExcalidrawElement["id"]
      >;
    }) => Partial<ExcalidrawElement>;
  } & (
    | {
        /**
         * Duplicates all elements in array.
         *
         * Use this when programmaticaly duplicating elements, without direct
         * user interaction.
         */
        type: "everything";
      }
    | {
        /**
         * Duplicates specified elements and inserts them back into the array
         * in specified order.
         *
         * Use this when duplicating Scene elements, during user interaction
         * such as alt-drag or on duplicate action.
         */
        type: "in-place";
        idsOfElementsToDuplicate: Map<
          ExcalidrawElement["id"],
          ExcalidrawElement
        >;
        appState: {
          editingGroupId: AppState["editingGroupId"];
          selectedGroupIds: AppState["selectedGroupIds"];
        };
      }
  ),
) => {
  let { elements } = opts;

  const appState =
    "appState" in opts
      ? opts.appState
      : ({
          editingGroupId: null,
          selectedGroupIds: {},
        } as const);

  // Ids of elements that have already been processed so we don't push them
  // into the array twice if we end up backtracking when retrieving
  // discontiguous group of elements (can happen due to a bug, or in edge
  // cases such as a group containing deleted elements which were not selected).
  //
  // This is not enough to prevent duplicates, so we do a second loop afterwards
  // to remove them.
  //
  // For convenience we mark even the newly created ones even though we don't
  // loop over them.
  const processedIds = new Map<ExcalidrawElement["id"], true>();
  const groupIdMap = new Map();
  const duplicatedElements: ExcalidrawElement[] = [];
  const origElements: ExcalidrawElement[] = [];
  const origIdToDuplicateId = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement["id"]
  >();
  const duplicateIdToOrigElement = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >();
  const duplicateElementsMap = new Map<string, ExcalidrawElement>();
  const elementsMap = arrayToMap(elements) as ElementsMap;
  const _idsOfElementsToDuplicate =
    opts.type === "in-place"
      ? opts.idsOfElementsToDuplicate
      : new Map(elements.map((el) => [el.id, el]));

  // For sanity
  if (opts.type === "in-place") {
    for (const groupId of Object.keys(opts.appState.selectedGroupIds)) {
      elements
        .filter((el) => el.groupIds?.includes(groupId))
        .forEach((el) => _idsOfElementsToDuplicate.set(el.id, el));
    }
  }

  elements = normalizeElementOrder(elements);

  const elementsWithDuplicates: ExcalidrawElement[] = elements.slice();

  // helper functions
  // -------------------------------------------------------------------------

  // Used for the heavy lifing of copying a single element, a group of elements
  // an element with bound text etc.
  const copyElements = <T extends ExcalidrawElement | ExcalidrawElement[]>(
    element: T,
  ): T extends ExcalidrawElement[]
    ? ExcalidrawElement[]
    : ExcalidrawElement | null => {
    const elements = castArray(element);

    const _newElements = elements.reduce(
      (acc: ExcalidrawElement[], element) => {
        if (processedIds.has(element.id)) {
          return acc;
        }

        processedIds.set(element.id, true);

        const newElement = duplicateElement(
          appState.editingGroupId,
          groupIdMap,
          element,
          opts.randomizeSeed,
        );

        processedIds.set(newElement.id, true);

        duplicateElementsMap.set(newElement.id, newElement);
        origIdToDuplicateId.set(element.id, newElement.id);
        duplicateIdToOrigElement.set(newElement.id, element);

        origElements.push(element);
        duplicatedElements.push(newElement);

        acc.push(newElement);
        return acc;
      },
      [],
    );

    return (
      Array.isArray(element) ? _newElements : _newElements[0] || null
    ) as T extends ExcalidrawElement[]
      ? ExcalidrawElement[]
      : ExcalidrawElement | null;
  };

  // Helper to position cloned elements in the Z-order the product needs it
  const insertBeforeOrAfterIndex = (
    index: number,
    elements: ExcalidrawElement | null | ExcalidrawElement[],
  ) => {
    if (!elements) {
      return;
    }

    if (index > elementsWithDuplicates.length - 1) {
      elementsWithDuplicates.push(...castArray(elements));
      return;
    }

    elementsWithDuplicates.splice(index + 1, 0, ...castArray(elements));
  };

  const frameIdsToDuplicate = new Set(
    elements
      .filter(
        (el) => _idsOfElementsToDuplicate.has(el.id) && isFrameLikeElement(el),
      )
      .map((el) => el.id),
  );

  for (const element of elements) {
    if (processedIds.has(element.id)) {
      continue;
    }

    if (!_idsOfElementsToDuplicate.has(element.id)) {
      continue;
    }

    // groups
    // -------------------------------------------------------------------------

    const groupId = getSelectedGroupForElement(appState, element);
    if (groupId) {
      const groupElements = getElementsInGroup(elements, groupId).flatMap(
        (element) =>
          isFrameLikeElement(element)
            ? [...getFrameChildren(elements, element.id), element]
            : [element],
      );

      const targetIndex = findLastIndex(elementsWithDuplicates, (el) => {
        return el.groupIds?.includes(groupId);
      });

      insertBeforeOrAfterIndex(targetIndex, copyElements(groupElements));
      continue;
    }

    // frame duplication
    // -------------------------------------------------------------------------

    if (element.frameId && frameIdsToDuplicate.has(element.frameId)) {
      continue;
    }

    if (isFrameLikeElement(element)) {
      const frameId = element.id;

      const frameChildren = getFrameChildren(elements, frameId);

      const targetIndex = findLastIndex(elementsWithDuplicates, (el) => {
        return el.frameId === frameId || el.id === frameId;
      });

      insertBeforeOrAfterIndex(
        targetIndex,
        copyElements([...frameChildren, element]),
      );
      continue;
    }

    // text container
    // -------------------------------------------------------------------------

    if (hasBoundTextElement(element)) {
      const boundTextElement = getBoundTextElement(element, elementsMap);

      const targetIndex = findLastIndex(elementsWithDuplicates, (el) => {
        return (
          el.id === element.id ||
          ("containerId" in el && el.containerId === element.id)
        );
      });

      if (boundTextElement) {
        insertBeforeOrAfterIndex(
          targetIndex,
          copyElements([element, boundTextElement]),
        );
      } else {
        insertBeforeOrAfterIndex(targetIndex, copyElements(element));
      }

      continue;
    }

    if (isBoundToContainer(element)) {
      const container = getContainerElement(element, elementsMap);

      const targetIndex = findLastIndex(elementsWithDuplicates, (el) => {
        return el.id === element.id || el.id === container?.id;
      });

      if (container) {
        insertBeforeOrAfterIndex(
          targetIndex,
          copyElements([container, element]),
        );
      } else {
        insertBeforeOrAfterIndex(targetIndex, copyElements(element));
      }

      continue;
    }

    // default duplication (regular elements)
    // -------------------------------------------------------------------------

    insertBeforeOrAfterIndex(
      findLastIndex(elementsWithDuplicates, (el) => el.id === element.id),
      copyElements(element),
    );
  }

  // ---------------------------------------------------------------------------

  fixDuplicatedBindingsAfterDuplication(
    duplicatedElements,
    origIdToDuplicateId,
    duplicateElementsMap as NonDeletedSceneElementsMap,
  );

  bindElementsToFramesAfterDuplication(
    elementsWithDuplicates,
    origElements,
    origIdToDuplicateId,
  );

  if (opts.overrides) {
    for (const duplicateElement of duplicatedElements) {
      const origElement = duplicateIdToOrigElement.get(duplicateElement.id);
      if (origElement) {
        Object.assign(
          duplicateElement,
          opts.overrides({
            duplicateElement,
            origElement,
            origIdToDuplicateId,
          }),
        );
      }
    }
  }

  return {
    duplicatedElements,
    duplicateElementsMap,
    elementsWithDuplicates,
    origIdToDuplicateId,
  };
};

// Simplified deep clone for the purpose of cloning ExcalidrawElement.
//
// Only clones plain objects and arrays. Doesn't clone Date, RegExp, Map, Set,
// Typed arrays and other non-null objects.
//
// Adapted from https://github.com/lukeed/klona
//
// The reason for `deepCopyElement()` wrapper is type safety (only allow
// passing ExcalidrawElement as the top-level argument).
const _deepCopyElement = (val: any, depth: number = 0) => {
  // only clone non-primitives
  if (val == null || typeof val !== "object") {
    return val;
  }

  const objectType = Object.prototype.toString.call(val);

  if (objectType === "[object Object]") {
    const tmp =
      typeof val.constructor === "function"
        ? Object.create(Object.getPrototypeOf(val))
        : {};
    for (const key in val) {
      if (val.hasOwnProperty(key)) {
        // don't copy non-serializable objects like these caches. They'll be
        // populated when the element is rendered.
        if (depth === 0 && (key === "shape" || key === "canvas")) {
          continue;
        }
        tmp[key] = _deepCopyElement(val[key], depth + 1);
      }
    }
    return tmp;
  }

  if (Array.isArray(val)) {
    let k = val.length;
    const arr = new Array(k);
    while (k--) {
      arr[k] = _deepCopyElement(val[k], depth + 1);
    }
    return arr;
  }

  // we're not cloning non-array & non-plain-object objects because we
  // don't support them on excalidraw elements yet. If we do, we need to make
  // sure we start cloning them, so let's warn about it.
  if (import.meta.env.DEV) {
    if (
      objectType !== "[object Object]" &&
      objectType !== "[object Array]" &&
      objectType.startsWith("[object ")
    ) {
      console.warn(
        `_deepCloneElement: unexpected object type ${objectType}. This value will not be cloned!`,
      );
    }
  }

  return val;
};

/**
 * Clones ExcalidrawElement data structure. Does not regenerate id, nonce, or
 * any value. The purpose is to to break object references for immutability
 * reasons, whenever we want to keep the original element, but ensure it's not
 * mutated.
 *
 * Only clones plain objects and arrays. Doesn't clone Date, RegExp, Map, Set,
 * Typed arrays and other non-null objects.
 */
export const deepCopyElement = <T extends ExcalidrawElement>(
  val: T,
): Mutable<T> => {
  return _deepCopyElement(val);
};

const __test__defineOrigId = (clonedObj: object, origId: string) => {
  Object.defineProperty(clonedObj, ORIG_ID, {
    value: origId,
    writable: false,
    enumerable: false,
  });
};
