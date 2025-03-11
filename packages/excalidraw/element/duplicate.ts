import { ORIG_ID } from "../constants";
import { getNewGroupIdsForDuplication } from "../groups";
import { randomId, randomInteger } from "../random";
import type { AppState } from "../types";
import type { Mutable } from "../utility-types";
import {
  arrayToMap,
  castArray,
  getUpdatedTimestamp,
  invariant,
  isTestEnv,
} from "../utils";
import { bumpVersion } from "./mutateElement";
import type { ExcalidrawElement, GroupId } from "./types";

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
 * @param overrides Any element properties to override
 */
export const duplicateElement = <TElement extends ExcalidrawElement>(
  editingGroupId: AppState["editingGroupId"],
  groupIdMapForOperation: Map<GroupId, GroupId>,
  element: TElement,
  overrides?: Partial<TElement>,
): Readonly<TElement> => {
  let copy = deepCopyElement(element);

  if (isTestEnv()) {
    __test__defineOrigId(copy, element.id);
  }

  copy.id = randomId();
  copy.updated = getUpdatedTimestamp();
  copy.seed = randomInteger();
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
  if (overrides) {
    copy = Object.assign(copy, overrides);
  }
  return copy;
};

/**
 * Clones elements, regenerating their ids (including bindings) and group ids.
 *
 * If bindings don't exist in the elements array, they are removed. Therefore,
 * it's advised to supply the whole elements array, or sets of elements that
 * are encapsulated (such as library items), if the purpose is to retain
 * bindings to the cloned elements intact.
 *
 * NOTE by default does not randomize or regenerate anything except the id.
 */
export const duplicateElements = (
  elements: readonly ExcalidrawElement[],
  opts?: {
    /** NOTE also updates version flags and `updated` */
    randomizeSeed?: boolean;
    overrides?: (element: ExcalidrawElement) => Partial<ExcalidrawElement>;
  },
) => {
  const clonedElements: ExcalidrawElement[] = [];

  const origElementsMap = arrayToMap(elements);

  // used for for migrating old ids to new ids
  const elementNewIdsMap = new Map<
    /* orig */ ExcalidrawElement["id"],
    /* new */ ExcalidrawElement["id"]
  >();

  const maybeGetNewIdFor = (id: ExcalidrawElement["id"]) => {
    // if we've already migrated the element id, return the new one directly
    if (elementNewIdsMap.has(id)) {
      return elementNewIdsMap.get(id)!;
    }
    // if we haven't migrated the element id, but an old element with the same
    // id exists, generate a new id for it and return it
    if (origElementsMap.has(id)) {
      const newId = randomId();
      elementNewIdsMap.set(id, newId);
      return newId;
    }
    // if old element doesn't exist, return null to mark it for removal
    return null;
  };

  const groupNewIdsMap = new Map</* orig */ GroupId, /* new */ GroupId>();

  for (const element of elements) {
    let clonedElement: Mutable<ExcalidrawElement> = _deepCopyElement(element);

    if (opts?.overrides) {
      clonedElement = Object.assign(
        clonedElement,
        opts.overrides(clonedElement),
      );
    }

    clonedElement.id = maybeGetNewIdFor(element.id)!;
    if (isTestEnv()) {
      __test__defineOrigId(clonedElement, element.id);
    }

    if (opts?.randomizeSeed) {
      clonedElement.seed = randomInteger();
      bumpVersion(clonedElement);
    }

    if (clonedElement.groupIds) {
      clonedElement.groupIds = clonedElement.groupIds.map((groupId) => {
        if (!groupNewIdsMap.has(groupId)) {
          groupNewIdsMap.set(groupId, randomId());
        }
        return groupNewIdsMap.get(groupId)!;
      });
    }

    if ("containerId" in clonedElement && clonedElement.containerId) {
      const newContainerId = maybeGetNewIdFor(clonedElement.containerId);
      clonedElement.containerId = newContainerId;
    }

    if ("boundElements" in clonedElement && clonedElement.boundElements) {
      clonedElement.boundElements = clonedElement.boundElements.reduce(
        (
          acc: Mutable<NonNullable<ExcalidrawElement["boundElements"]>>,
          binding,
        ) => {
          const newBindingId = maybeGetNewIdFor(binding.id);
          if (newBindingId) {
            acc.push({ ...binding, id: newBindingId });
          }
          return acc;
        },
        [],
      );
    }

    if ("endBinding" in clonedElement && clonedElement.endBinding) {
      const newEndBindingId = maybeGetNewIdFor(
        clonedElement.endBinding.elementId,
      );
      clonedElement.endBinding = newEndBindingId
        ? {
            ...clonedElement.endBinding,
            elementId: newEndBindingId,
          }
        : null;
    }
    if ("startBinding" in clonedElement && clonedElement.startBinding) {
      const newEndBindingId = maybeGetNewIdFor(
        clonedElement.startBinding.elementId,
      );
      clonedElement.startBinding = newEndBindingId
        ? {
            ...clonedElement.startBinding,
            elementId: newEndBindingId,
          }
        : null;
    }

    if (clonedElement.frameId) {
      clonedElement.frameId = maybeGetNewIdFor(clonedElement.frameId);
    }

    insertAfterIndex();

    clonedElements.push(clonedElement);
  }

  return clonedElements;
};

const insertAfterIndex = (
  elementsWithClones: ExcalidrawElement[],
  index: number,
  elements: ExcalidrawElement | null | ExcalidrawElement[],
) => {
  invariant(index !== -1, "targetIndex === -1 ");

  if (!Array.isArray(elements) && !elements) {
    return;
  }

  return elementsWithClones.splice(index + 1, 0, ...castArray(elements));
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
