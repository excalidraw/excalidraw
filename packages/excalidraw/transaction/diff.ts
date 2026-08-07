import { type StoreDelta } from "@excalidraw/element";

import type { Delta } from "@excalidraw/element";

import type { Mutable } from "@excalidraw/common/utility-types";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import type {
  ElementChange,
  ElementPropName,
  TouchedElementProps,
} from "./types";

const LEDGER_IGNORED_PROPS = new Set([
  "version",
  "versionNonce",
  "seed",
  "updated",
  "index",
]);

export const TX_UNDO_OVERRIDE_IGNORED_PROPS = new Set([
  "version",
  "versionNonce",
  "isDeleted",
]);

type ElementRecord = Record<string, unknown>;
export type ElementUpdatedProps = Omit<
  Partial<OrderedExcalidrawElement>,
  "id" | "updated" | "seed"
>;
export type ElementUpdatedPropName = Extract<keyof ElementUpdatedProps, string>;
type ElementPropValueMap = ElementUpdatedProps;

export type ElementUpdatedEntry = Delta<ElementPropValueMap>;
export type ElementUpdatedEntryMap = Record<string, ElementUpdatedEntry>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const getElementProp = <TProp extends ElementPropName>(
  element: ExcalidrawElement,
  prop: TProp,
): ExcalidrawElement[TProp] =>
  (element as ElementRecord)[prop] as ExcalidrawElement[TProp];

export const setOrderedElementProp = <TProp extends ElementPropName>(
  element: Mutable<OrderedExcalidrawElement>,
  prop: TProp,
  value: OrderedExcalidrawElement[TProp],
) => {
  (element as ElementRecord)[prop] = value;
};

/** Deep equality used by ledger conflict/touched-prop detection. */
export const isLedgerValueEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!isLedgerValueEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false;
      }
      if (!isLedgerValueEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
};

/** Shallow-copies a scene map. Entries share references with the original. */
export const shallowCopySceneElements = (
  elements: ReadonlyMap<string, ExcalidrawElement>,
): SceneElementsMap => new Map(elements) as SceneElementsMap;

export const createAllTouchedElementProps = (): TouchedElementProps => ({
  kind: "all",
});

export const createPartialTouchedElementProps = (
  props: Iterable<ElementPropName> = [],
): TouchedElementProps => ({
  kind: "partial",
  props: new Set(props),
});

export const hasTouchedProps = (touchedProps: TouchedElementProps): boolean =>
  touchedProps.kind === "all" || touchedProps.props.size > 0;

export const touchesWholeElement = (
  touchedProps: TouchedElementProps,
): boolean => touchedProps.kind === "all";

export const isPartialTouchedProps = (
  touchedProps: TouchedElementProps,
): touchedProps is Extract<TouchedElementProps, { kind: "partial" }> =>
  touchedProps.kind === "partial";

export const hasTouchedProp = (
  touchedProps: TouchedElementProps,
  prop: ElementPropName,
): boolean => touchedProps.kind === "all" || touchedProps.props.has(prop);

export const mergeTouchedProps = (
  left: TouchedElementProps,
  right: TouchedElementProps,
): TouchedElementProps => {
  if (left.kind === "all" || right.kind === "all") {
    return createAllTouchedElementProps();
  }

  return createPartialTouchedElementProps([...left.props, ...right.props]);
};

/** Returns changed property names between two element snapshots. */
export const collectTouchedProps = (
  before: ExcalidrawElement | null,
  after: ExcalidrawElement | null,
): TouchedElementProps => {
  if (!before || !after) {
    return createAllTouchedElementProps();
  }

  const touchedProps = new Set<ElementPropName>();
  const keys = new Set<ElementPropName>([
    ...(Object.keys(before) as ElementPropName[]),
    ...(Object.keys(after) as ElementPropName[]),
  ]);

  for (const key of keys) {
    if (LEDGER_IGNORED_PROPS.has(key)) {
      continue;
    }
    if (
      !isLedgerValueEqual(
        getElementProp(before, key),
        getElementProp(after, key),
      )
    ) {
      touchedProps.add(key);
    }
  }

  return createPartialTouchedElementProps(touchedProps);
};

/** Returns ids whose element snapshot changed between two points in time. */
export const collectChangedElementIds = (
  before: ReadonlyMap<string, ExcalidrawElement>,
  after: ReadonlyMap<string, ExcalidrawElement>,
) => collectElementChanges(before, after).map((change) => change.id);

export const collectElementChanges = (
  before: ReadonlyMap<string, ExcalidrawElement>,
  after: ReadonlyMap<string, ExcalidrawElement>,
): ElementChange[] => {
  const changes: ElementChange[] = [];
  const candidateIds = new Set<string>([...before.keys(), ...after.keys()]);

  for (const id of candidateIds) {
    const beforeElement = before.get(id) ?? null;
    const afterElement = after.get(id) ?? null;
    const touchedProps = collectTouchedProps(beforeElement, afterElement);
    if (!hasTouchedProps(touchedProps)) {
      continue;
    }

    changes.push({
      id,
      before: beforeElement,
      after: afterElement,
      touchedProps,
    });
  }

  return changes;
};

export const serializeConsumedPropKey = (
  elementId: string,
  prop: ElementPropName,
) => `${elementId}\u0000${prop}`;

export const getUpdatedElementEntries = (delta: StoreDelta) =>
  delta.elements.updated as ElementUpdatedEntryMap;

export const getElementPropEntries = (props: ElementPropValueMap) =>
  Object.entries(props) as [
    ElementUpdatedPropName,
    ElementUpdatedProps[ElementUpdatedPropName],
  ][];

export const hasUpdatedElementEntries = (delta: StoreDelta) =>
  Object.keys(getUpdatedElementEntries(delta)).length > 0;

export const serializeIntermediateValue = (value: unknown): string => {
  const serialize = (input: unknown, seen: WeakSet<object>): string => {
    if (input === null) {
      return "null";
    }

    switch (typeof input) {
      case "undefined":
        return "undefined";
      case "boolean":
        return input ? "boolean:true" : "boolean:false";
      case "number":
        if (Number.isNaN(input)) {
          return "number:NaN";
        }
        if (Object.is(input, -0)) {
          return "number:-0";
        }
        return `number:${input}`;
      case "bigint":
        return `bigint:${input.toString()}`;
      case "string":
        return `string:${JSON.stringify(input)}`;
      case "symbol":
        return `symbol:${String(input)}`;
      case "function":
        return `function:${input.name}`;
      case "object":
        break;
      default:
        return `unknown:${String(input)}`;
    }

    if (Array.isArray(input)) {
      if (seen.has(input)) {
        return "[CircularArray]";
      }
      seen.add(input);
      const serialized = `[${input
        .map((item) => serialize(item, seen))
        .join(",")}]`;
      seen.delete(input);
      return serialized;
    }

    if (isPlainObject(input)) {
      if (seen.has(input)) {
        return "{CircularObject}";
      }
      seen.add(input);
      const serialized = `{${Object.keys(input)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${serialize(input[key], seen)}`)
        .join(",")}}`;
      seen.delete(input);
      return serialized;
    }

    try {
      return `object:${JSON.stringify(input)}`;
    } catch {
      return `object:${Object.prototype.toString.call(input)}`;
    }
  };

  return serialize(value, new WeakSet<object>());
};
