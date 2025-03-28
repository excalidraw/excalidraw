import { Random } from "roughjs/bin/math";
import { nanoid } from "nanoid";

import type {
  AppState,
  ObservedAppState,
  ElementsMap,
  ExcalidrawElement,
  ElementUpdate,
} from "../excalidraw-types";

/**
 * Transform array into an object, use only when array order is irrelevant.
 */
export const arrayToObject = <T>(
  array: readonly T[],
  groupBy?: (value: T) => string | number,
) =>
  array.reduce((acc, value) => {
    acc[groupBy ? groupBy(value) : String(value)] = value;
    return acc;
  }, {} as { [key: string]: T });

/**
 * Transforms array of elements with `id` property into into a Map grouped by `id`.
 */
export const elementsToMap = <T extends { id: string }>(
  items: readonly T[],
) => {
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(element.id, element);
    return acc;
  }, new Map());
};

// --

// hidden non-enumerable property for runtime checks
const hiddenObservedAppStateProp = "__observedAppState";

export const getObservedAppState = (appState: AppState): ObservedAppState => {
  const observedAppState = {
    name: appState.name,
    editingGroupId: appState.editingGroupId,
    viewBackgroundColor: appState.viewBackgroundColor,
    selectedElementIds: appState.selectedElementIds,
    selectedGroupIds: appState.selectedGroupIds,
    editingLinearElementId: appState.editingLinearElement?.elementId || null,
    selectedLinearElementId: appState.selectedLinearElement?.elementId || null,
    croppingElementId: appState.croppingElementId,
  };

  Reflect.defineProperty(observedAppState, hiddenObservedAppStateProp, {
    value: true,
    enumerable: false,
  });

  return observedAppState;
};

// ------------------------------------------------------------

export const assertNever = (value: never, message: string): never => {
  throw new Error(`${message}: "${value}".`);
};

// ------------------------------------------------------------

export const getNonDeletedGroupIds = (elements: ElementsMap) => {
  const nonDeletedGroupIds = new Set<string>();

  for (const [, element] of elements) {
    // defensive check
    if (element.isDeleted) {
      continue;
    }

    // defensive fallback
    for (const groupId of element.groupIds ?? []) {
      nonDeletedGroupIds.add(groupId);
    }
  }

  return nonDeletedGroupIds;
};

// ------------------------------------------------------------

export const isTestEnv = () => import.meta.env.MODE === "test";

export const isDevEnv = () => import.meta.env.MODE === "development";

export const isServerEnv = () => import.meta.env.MODE === "server";

export const shouldThrow = () => isDevEnv() || isTestEnv() || isServerEnv();

// ------------------------------------------------------------

let random = new Random(Date.now());
let testIdBase = 0;

export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

export const reseed = (seed: number) => {
  random = new Random(seed);
  testIdBase = 0;
};

export const randomId = () => (isTestEnv() ? `id${testIdBase++}` : nanoid());

// ------------------------------------------------------------

export const getUpdatedTimestamp = () => (isTestEnv() ? 1 : Date.now());

// ------------------------------------------------------------

export const newElementWith = <TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  /** pass `true` to always regenerate */
  force = false,
): TElement => {
  let didChange = false;
  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      if (
        (element as any)[key] === value &&
        // if object, always update because its attrs could have changed
        (typeof value !== "object" || value === null)
      ) {
        continue;
      }
      didChange = true;
    }
  }

  if (!didChange && !force) {
    return element;
  }

  return {
    ...element,
    ...updates,
    updated: getUpdatedTimestamp(),
    version: element.version + 1,
    versionNonce: randomInteger(),
  };
};
