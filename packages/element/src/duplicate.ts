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
  isArrowElement,
  isBoundToContainer,
  isFrameLikeElement,
} from "./typeChecks";

import { getBoundTextElement, getContainerElement } from "./textElement";

import { fixDuplicatedBindingsAfterDuplication } from "./binding";

import { ShapeCache } from "./shape";

import { isNonDeletedElement } from ".";

import type { ElementUpdate } from "./mutateElement";

import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawElement,
  GroupId,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "./types";

/**
 * Lookups supplied to the host's `props.onDuplicate`, covering just the
 * elements taking part in the duplication.
 */
export type OnDuplicateData = {
  /** the duplicates, by their id */
  duplicateElements: ReadonlyMap<ExcalidrawElement["id"], ExcalidrawElement>;
  /**
   * The elements the duplicates were made from, by their id.
   *
   * On paste and library insert these are the inserted elements, which aren't
   * part of the scene (though they may share ids with the scene elements they
   * were copied from).
   */
  originalElements: ReadonlyMap<ExcalidrawElement["id"], ExcalidrawElement>;
  /**
   * id of an original -> id of its duplicate (e.g. to remap element ids you
   * keep in `customData`, which the duplicate copied from its original)
   */
  origIdToDuplicateId: ReadonlyMap<
    ExcalidrawElement["id"],
    ExcalidrawElement["id"]
  >;
  /**
   * id of a duplicate -> id of its original (e.g. to look up the original in
   * `originalElements` while modifying the duplicate)
   */
  duplicateIdToOrigId: ReadonlyMap<
    ExcalidrawElement["id"],
    ExcalidrawElement["id"]
  >;
};

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
  copy.created = copy.updated;
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
        // TODO remove/review this once we add frame children order migration
        // and invariant checks
        preserveFrameChildrenOrder?: boolean;
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
  const duplicatedElements: NonDeletedExcalidrawElement[] = [];
  const origElements: ExcalidrawElement[] = [];
  const origIdToDuplicateId = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement["id"]
  >();
  const duplicateIdToOrigId = new Map<
    ExcalidrawElement["id"],
    ExcalidrawElement["id"]
  >();
  const duplicateElementsMap = new Map<string, NonDeletedExcalidrawElement>();
  const origElementsMap = new Map<ExcalidrawElement["id"], ExcalidrawElement>();
  const elementsMap = arrayToMap(elements) as ElementsMap;
  const _idsOfElementsToDuplicate =
    opts.type === "in-place"
      ? opts.idsOfElementsToDuplicate
      : new Map(elements.map((el) => [el.id, el]));
  const preserveFrameChildrenOrder =
    opts.type === "everything" && opts.preserveFrameChildrenOrder;

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

        // SAFETY: this should never happen, but we
        // want to make sure we log it if it does
        if (!isNonDeletedElement(element)) {
          console.error(
            "[NONDELETED][INVARIANT] Element to duplicate should be non-deleted",
          );
        }

        const newElement = duplicateElement(
          appState.editingGroupId,
          groupIdMap,
          element,
          opts.randomizeSeed,
        ) as NonDeletedExcalidrawElement;

        processedIds.set(newElement.id, true);

        duplicateElementsMap.set(newElement.id, newElement);
        origElementsMap.set(element.id, element);
        origIdToDuplicateId.set(element.id, newElement.id);
        duplicateIdToOrigId.set(newElement.id, element.id);

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

  // main
  // ---------------------------------------------------------------------------

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
          isFrameLikeElement(element) && !preserveFrameChildrenOrder
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

    if (
      !preserveFrameChildrenOrder &&
      element.frameId &&
      frameIdsToDuplicate.has(element.frameId)
    ) {
      continue;
    }

    if (isFrameLikeElement(element)) {
      const frameId = element.id;

      if (preserveFrameChildrenOrder) {
        insertBeforeOrAfterIndex(
          findLastIndex(elementsWithDuplicates, (el) => el.id === frameId),
          copyElements(element),
        );
        continue;
      }

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
      const origElement = origElementsMap.get(
        duplicateIdToOrigId.get(duplicateElement.id)!,
      );
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
    origElementsMap,
    elementsWithDuplicates,
    origIdToDuplicateId,
    duplicateIdToOrigId,
  };
};

/**
 * Folds the elements returned by the host (`props.onDuplicate`) back into the
 * duplicates the editor created, so that everything that follows (frame
 * assignment, bound text redraw, selection, alt-drag handover) can keep
 * working with the editor's own objects, whether the host mutated the
 * duplicates or returned new objects for them.
 *
 * - A returned element with a duplicate's id is shallow-merged into that
 *   duplicate, which takes its place in the returned array. Properties the
 *   host omits are kept, so that a partial element can't invalidate the
 *   duplicate. Safe only because the duplicates are fresh (not in the scene or
 *   the store snapshot yet), which is why nothing but the passed duplicates is
 *   ever merged into. Since the merge goes around `mutateElement`, what may
 *   have been cached for the duplicate by then is invalidated here.
 * - A duplicate missing from the returned array (or returned as deleted) is
 *   vetoed. So is the bound text of a vetoed container. What the remaining
 *   duplicates reference of the vetoed ones is cleared, as if those were never
 *   part of the duplication (see `fixDuplicatedBindingsAfterDuplication`).
 * - Any other returned element is used as is (existing elements must not be
 *   mutated, so the host replaces them).
 * - `false` vetoes all the duplicates.
 *
 * @returns next elements, and the duplicates that weren't vetoed
 */
export const reconcileDuplicatedElements = <
  TDuplicate extends ExcalidrawElement,
>(
  /** what the host returned from `props.onDuplicate`, if anything */
  hostElements: readonly ExcalidrawElement[] | void | false,
  /** elements that were passed to the host */
  nextElements: ExcalidrawElement[],
  duplicatedElements: TDuplicate[],
): {
  elements: ExcalidrawElement[];
  duplicatedElements: TDuplicate[];
} => {
  if (hostElements === false) {
    return { elements: nextElements, duplicatedElements: [] };
  }

  if (!hostElements) {
    return { elements: nextElements, duplicatedElements };
  }

  const duplicatesMap = arrayToMap(duplicatedElements);
  // (if a duplicate is returned more than once, the last one wins)
  const hostDuplicates = new Map<ExcalidrawElement["id"], ExcalidrawElement>();

  for (const element of hostElements) {
    if (duplicatesMap.has(element.id)) {
      hostDuplicates.set(element.id, element);
    }
  }

  // merge first, so that everything below sees the duplicates as the host
  // wants them (what the host returned may be partial)
  const survivedIds = new Set<ExcalidrawElement["id"]>();

  for (const [id, element] of hostDuplicates) {
    const duplicate = duplicatesMap.get(id)!;

    if (element !== duplicate) {
      Object.assign(duplicate, element);
      // The duplicate may have been measured already (e.g. to resolve the
      // frame it's pasted into), and we're going around `mutateElement`.
      // The shape is cached by identity, the bounds by version.
      ShapeCache.delete(duplicate);
      bumpVersion(duplicate);
    }

    if (!duplicate.isDeleted) {
      survivedIds.add(id);
    }
  }

  const isVetoed = (id: ExcalidrawElement["id"]) =>
    duplicatesMap.has(id) && !survivedIds.has(id);

  for (const id of survivedIds) {
    const duplicate = duplicatesMap.get(id)!;
    if (isBoundToContainer(duplicate) && isVetoed(duplicate.containerId)) {
      survivedIds.delete(id);
    }
  }

  const elements: ExcalidrawElement[] = [];

  for (const element of hostElements) {
    const duplicate = duplicatesMap.get(element.id);

    if (!duplicate) {
      elements.push(element);
    } else if (
      survivedIds.has(element.id) &&
      hostDuplicates.get(element.id) === element
    ) {
      elements.push(duplicate);
    }
  }

  if (survivedIds.size === duplicatedElements.length) {
    return { elements, duplicatedElements };
  }

  const survivedDuplicates = duplicatedElements.filter((duplicate) =>
    survivedIds.has(duplicate.id),
  );

  for (const duplicate of survivedDuplicates) {
    const updates: Mutable<ElementUpdate<ExcalidrawArrowElement>> = {};

    if (duplicate.boundElements?.some((binding) => isVetoed(binding.id))) {
      updates.boundElements = duplicate.boundElements.filter(
        (binding) => !isVetoed(binding.id),
      );
    }
    if (duplicate.frameId && isVetoed(duplicate.frameId)) {
      updates.frameId = null;
    }
    if (isArrowElement(duplicate)) {
      if (
        duplicate.startBinding &&
        isVetoed(duplicate.startBinding.elementId)
      ) {
        updates.startBinding = null;
      }
      if (duplicate.endBinding && isVetoed(duplicate.endBinding.elementId)) {
        updates.endBinding = null;
      }
    }

    Object.assign(duplicate, updates);
  }

  return { elements, duplicatedElements: survivedDuplicates };
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
