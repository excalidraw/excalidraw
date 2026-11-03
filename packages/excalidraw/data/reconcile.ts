import throttle from "lodash.throttle";

import { arrayToMap, isDevEnv, isTestEnv } from "@excalidraw/common";

import {
  orderByFractionalIndex,
  syncInvalidIndices,
  validateFractionalIndices,
  ShapeCache,
} from "@excalidraw/element";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import type { MakeBrand } from "@excalidraw/common/utility-types";

import type { AppState } from "../types";

export type ReconciledExcalidrawElement = OrderedExcalidrawElement &
  MakeBrand<"ReconciledElement">;

export type RemoteExcalidrawElement = OrderedExcalidrawElement &
  MakeBrand<"RemoteExcalidrawElement">;

export const shouldDiscardRemoteElement = (
  localAppState: AppState,
  local: OrderedExcalidrawElement | undefined,
  remote: RemoteExcalidrawElement,
): boolean => {
  if (
    local &&
    // local element is being edited
    (local.id === localAppState.editingTextElement?.id ||
      local.id === localAppState.resizingElement?.id ||
      local.id === localAppState.newElement?.id ||
      // local element is newer
      local.version > remote.version ||
      // resolve conflicting edits deterministically by taking the one with
      // the lowest versionNonce
      (local.version === remote.version &&
        local.versionNonce <= remote.versionNonce))
  ) {
    return true;
  }
  return false;
};

const SHAPE_IRRELEVANT_ELEMENT_KEYS = new Set<string>([
  "x",
  "y",
  "version",
  "versionNonce",
  "updated",
]);

/**
 * Whether `a` and `b` are equal in every property that can affect the
 * rough.js/perfect-freehand shape ShapeCache generates for an element —
 * i.e. everything except position and version bookkeeping. Used to decide
 * whether a cached shape can be carried over to a new element instance
 * instead of being regenerated from scratch (see reconcileElements below).
 */
const hasEquivalentShape = (
  a: OrderedExcalidrawElement,
  b: OrderedExcalidrawElement,
): boolean => {
  if (a.type !== b.type) {
    return false;
  }

  const aKeys = Object.keys(a);

  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }

  for (const key of aKeys) {
    if (SHAPE_IRRELEVANT_ELEMENT_KEYS.has(key)) {
      continue;
    }

    const aValue = (a as Record<string, unknown>)[key];
    const bValue = (b as Record<string, unknown>)[key];

    if (aValue === bValue) {
      continue;
    }

    if (
      typeof aValue !== "object" ||
      aValue === null ||
      typeof bValue !== "object" ||
      bValue === null
    ) {
      return false;
    }

    if (JSON.stringify(aValue) !== JSON.stringify(bValue)) {
      return false;
    }
  }

  return true;
};

const validateIndicesThrottled = throttle(
  (
    orderedElements: readonly OrderedExcalidrawElement[],
    localElements: readonly OrderedExcalidrawElement[],
    remoteElements: readonly RemoteExcalidrawElement[],
  ) => {
    if (isDevEnv() || isTestEnv() || window?.DEBUG_FRACTIONAL_INDICES) {
      // create new instances due to the mutation
      const elements = syncInvalidIndices(
        orderedElements.map((x) => ({ ...x })),
      );

      validateFractionalIndices(elements, {
        // throw in dev & test only, to remain functional on `DEBUG_FRACTIONAL_INDICES`
        shouldThrow: isTestEnv() || isDevEnv(),
        includeBoundTextValidation: true,
        reconciliationContext: {
          localElements,
          remoteElements,
        },
      });
    }
  },
  1000 * 60,
  { leading: true, trailing: false },
);

export const reconcileElements = (
  localElements: readonly OrderedExcalidrawElement[],
  remoteElements: readonly RemoteExcalidrawElement[],
  localAppState: AppState,
): ReconciledExcalidrawElement[] => {
  const localElementsMap = arrayToMap(localElements);
  const reconciledElements: OrderedExcalidrawElement[] = [];
  const added = new Set<string>();

  // process remote elements
  for (const remoteElement of remoteElements) {
    if (!added.has(remoteElement.id)) {
      const localElement = localElementsMap.get(remoteElement.id);
      const discardRemoteElement = shouldDiscardRemoteElement(
        localAppState,
        localElement,
        remoteElement,
      );

      if (localElement && discardRemoteElement) {
        reconciledElements.push(localElement);
        added.add(localElement.id);
      } else {
        if (localElement && hasEquivalentShape(localElement, remoteElement)) {
          // Avoid an unnecessary shape regeneration (expensive for
          // rough.js/perfect-freehand elements) when the remote update only
          // moved the element — e.g. a live collaborative drag broadcasts a
          // fresh element instance per frame, and ShapeCache is keyed by
          // instance identity, so every such instance is otherwise a cache
          // miss even though the geometry hasn't changed.
          ShapeCache.copy(localElement, remoteElement);
        }
        reconciledElements.push(remoteElement);
        added.add(remoteElement.id);
      }
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      reconciledElements.push(localElement);
      added.add(localElement.id);
    }
  }

  const orderedElements = orderByFractionalIndex(reconciledElements);

  validateIndicesThrottled(orderedElements, localElements, remoteElements);

  // de-duplicate indices
  syncInvalidIndices(orderedElements);

  return orderedElements as ReconciledExcalidrawElement[];
};
