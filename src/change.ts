import { newElementWith } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import {
  AppState,
  ObservedAppState,
  ObservedElementsAppState,
  ObservedStandaloneAppState,
} from "./types";
import { SubtypeOf } from "./utility-types";
import { isShallowEqual } from "./utils";

/**
 * Represents the difference between two `T` objects.
 *
 * Keeping it as pure object (without transient state, side-effects, etc.), so we don't have to instantiate it on load.
 */
class Delta<T> {
  private constructor(
    public readonly from: Partial<T>,
    public readonly to: Partial<T>,
  ) {}

  public static create<T>(
    from: Partial<T>,
    to: Partial<T>,
    modifier?: (delta: Partial<T>) => Partial<T>,
    modifierOptions?: "from" | "to",
  ) {
    const modifiedFrom =
      modifier && modifierOptions !== "to" ? modifier(from) : from;
    const modifiedTo =
      modifier && modifierOptions !== "from" ? modifier(to) : to;

    return new Delta(modifiedFrom, modifiedTo);
  }

  /**
   * Calculates the delta between two objects.
   *
   * @param prevObject - The previous state of the object.
   * @param nextObject - The next state of the object.
   *
   * @returns new Delta instance.
   */
  public static calculate<T extends Object>(
    prevObject: T,
    nextObject: T,
    modifier?: (delta: Partial<T>) => Partial<T>,
  ): Delta<T> {
    if (prevObject === nextObject) {
      return Delta.empty();
    }

    const from = {} as Partial<T>;
    const to = {} as Partial<T>;

    const unionOfKeys = new Set([
      ...Object.keys(prevObject),
      ...Object.keys(nextObject),
    ]);

    for (const key of unionOfKeys) {
      const prevValue = prevObject[key as keyof T];
      const nextValue = nextObject[key as keyof T];

      if (prevValue !== nextValue) {
        from[key as keyof T] = prevValue;
        to[key as keyof T] = nextValue;
      }
    }
    return Delta.create(from, to, modifier);
  }

  public static empty() {
    return new Delta({}, {});
  }

  public static isEmpty<T>(delta: Delta<T>): boolean {
    return !Object.keys(delta.from).length && !Object.keys(delta.to).length;
  }

  /**
   * Compares if the delta contains any different values compared to the object.
   *
   * WARN: it's based on shallow compare performed only on the first level, won't work for objects with deeper props.
   */
  public static containsDifference<T>(delta: Partial<T>, object: T): boolean {
    const anyDistinctKey = this.distinctKeysIterator(delta, object).next()
      .value;
    return !!anyDistinctKey;
  }

  /**
   * Returns all the keys that have distinct values.
   *
   * WARN: it's based on shallow compare performed only on the first level, won't work for objects with deeper props.
   */
  public static gatherDifferences<T>(delta: Partial<T>, object: T) {
    const distinctKeys = new Set<string>();

    for (const key of this.distinctKeysIterator(delta, object)) {
      distinctKeys.add(key);
    }

    return Array.from(distinctKeys);
  }

  private static *distinctKeysIterator<T>(delta: Partial<T>, object: T) {
    for (const [key, deltaValue] of Object.entries(delta)) {
      const objectValue = object[key as keyof T];

      if (deltaValue !== objectValue) {
        // TODO_UNDO: staticly fail (typecheck) on deeper objects?
        if (
          typeof deltaValue === "object" &&
          typeof objectValue === "object" &&
          deltaValue !== null &&
          objectValue !== null &&
          isShallowEqual(
            deltaValue as Record<string, any>,
            objectValue as Record<string, any>,
          )
        ) {
          continue;
        }

        yield key;
      }
    }
  }
}

/**
 * Encapsulates the modifications captured as `Delta`/s.
 */
interface Change<T> {
  /**
   * Inverses the `Delta`s inside while creating a new `Change`.
   */
  inverse(): Change<T>;

  /**
   * Applies the `Change` to the previous object.
   *
   * @returns new object instance and boolean, indicating if there was any visible change made.
   */
  applyTo(previous: Readonly<T>, ...options: unknown[]): [T, boolean];

  /**
   * Checks whether there are actually `Delta`s.
   */
  isEmpty(): boolean;
}

export class AppStateChange implements Change<AppState> {
  private constructor(private readonly delta: Delta<ObservedAppState>) {}

  public static calculate<T extends Partial<ObservedAppState>>(
    prevAppState: T,
    nextAppState: T,
  ): AppStateChange {
    const delta = Delta.calculate(prevAppState, nextAppState);
    return new AppStateChange(delta);
  }

  public static empty() {
    return new AppStateChange(Delta.create({}, {}));
  }

  public inverse(): AppStateChange {
    const inversedDelta = Delta.create(this.delta.to, this.delta.from);
    return new AppStateChange(inversedDelta);
  }

  public applyTo(
    appState: Readonly<AppState>,
    elements: Readonly<Map<string, ExcalidrawElement>>,
  ): [AppState, boolean] {
    const constainsVisibleChanges = this.checkForVisibleChanges(
      appState,
      elements,
    );

    const newAppState = {
      ...appState,
      ...this.delta.to, // TODO_UNDO: probably shouldn't apply element related changes
    };

    return [newAppState, constainsVisibleChanges];
  }

  public isEmpty(): boolean {
    return Delta.isEmpty(this.delta);
  }

  private checkForVisibleChanges(
    appState: ObservedAppState,
    elements: Map<string, ExcalidrawElement>,
  ): boolean {
    const containsStandaloneDifference = Delta.containsDifference(
      AppStateChange.stripElementsProps(this.delta.to),
      appState,
    );

    if (containsStandaloneDifference) {
      // We detected a a difference which is unrelated to the elements
      return true;
    }

    const containsElementsDifference = Delta.containsDifference(
      AppStateChange.stripStandaloneProps(this.delta.to),
      appState,
    );

    if (!containsStandaloneDifference && !containsElementsDifference) {
      // There is no difference detected at all
      return false;
    }

    // We need to handle elements differences separately,
    // as they could be related to deleted elements and/or they could on their own result in no visible action
    const changedDeltaKeys = Delta.gatherDifferences(
      AppStateChange.stripStandaloneProps(this.delta.to),
      appState,
    ) as Array<keyof ObservedElementsAppState>;

    // Check whether delta properties are related to the existing non-deleted elements
    for (const key of changedDeltaKeys) {
      switch (key) {
        case "selectedElementIds":
          if (
            AppStateChange.checkForSelectedElementsDifferences(
              this.delta.to[key],
              appState,
              elements,
            )
          ) {
            return true;
          }
          break;
        case "selectedLinearElement":
        case "editingLinearElement":
          if (
            AppStateChange.checkForLinearElementDifferences(
              this.delta.to[key],
              elements,
            )
          ) {
            return true;
          }
          break;
        case "editingGroupId":
        case "selectedGroupIds":
          return AppStateChange.checkForGroupsDifferences();
        default: {
          // WARN: this exhaustive check in the switch statement is here to catch unexpected future changes
          // TODO_UNDO: use assertNever
          const exhaustiveCheck: never = key;
          throw new Error(
            `Unknown ObservedElementsAppState key '${exhaustiveCheck}'.`,
          );
        }
      }
    }

    return false;
  }

  private static checkForSelectedElementsDifferences(
    deltaIds: ObservedElementsAppState["selectedElementIds"] | undefined,
    appState: Pick<AppState, "selectedElementIds">,
    elements: Map<string, ExcalidrawElement>,
  ) {
    if (!deltaIds) {
      // There are no selectedElementIds in the delta
      return;
    }

    // TODO_UNDO: it could have been visible before (and now it's not)
    // TODO_UNDO: it could have been selected 
    for (const id of Object.keys(deltaIds)) {
      const element = elements.get(id);

      if (element && !element.isDeleted) {
        // // TODO_UNDO: breaks multi selection
        // if (appState.selectedElementIds[id]) {
        //   // Element is already selected
        //   return;
        // }

        // Found related visible element!
        return true;
      }
    }
  }

  private static checkForLinearElementDifferences(
    linearElement:
      | ObservedElementsAppState["editingLinearElement"]
      | ObservedAppState["selectedLinearElement"]
      | undefined,
    elements: Map<string, ExcalidrawElement>,
  ) {
    if (!linearElement) {
      return;
    }

    const element = elements.get(linearElement.elementId);

    if (element && !element.isDeleted) {
      // Found related visible element!
      return true;
    }
  }

  // Currently we don't have an index of elements by groupIds, which means
  // the calculation for getting the visible elements based on the groupIds stored in delta
  // is not worth performing - due to perf. and dev. complexity.
  //
  // Therefore we are accepting in these cases empty undos / redos, which should be pretty rare:
  // - only when one of these (or both) are in delta and the are no non deleted elements containing these group ids
  private static checkForGroupsDifferences() {
    return true;
  }

  private static stripElementsProps(
    delta: Partial<ObservedAppState>,
  ): Partial<ObservedStandaloneAppState> {
    // WARN: Do not remove the type-casts as they here for exhaustive type checks
    const {
      editingGroupId,
      selectedGroupIds,
      selectedElementIds,
      editingLinearElement,
      selectedLinearElement,
      ...standaloneProps
    } = delta as ObservedAppState;

    return standaloneProps as SubtypeOf<
      typeof standaloneProps,
      ObservedStandaloneAppState
    >;
  }

  private static stripStandaloneProps(
    delta: Partial<ObservedAppState>,
  ): Partial<ObservedElementsAppState> {
    // WARN: Do not remove the type-casts as they here for exhaustive type checks
    const { name, viewBackgroundColor, ...elementsProps } =
      delta as ObservedAppState;

    return elementsProps as SubtypeOf<
      typeof elementsProps,
      ObservedElementsAppState
    >;
  }
}

/**
 * Elements change is a low level primitive to capture a change between two sets of elements.
 * It does so by encapsulating forward and backward `Delta`s, which allow to travel in both directions.
 *
 * We could be smarter about the change in the future, ideas for improvements are:
 * - for memory, share the same delta instances between different deltas (flyweight-like)
 * - for serialization, compress the deltas into a tree-like structures with custom pointers or let one delta instance contain multiple element ids
 * - for performance, emit the changes directly by the user actions, then apply them in from store into the state (no diffing!)
 * - for performance, add operations in addition to deltas, which increment (decrement) properties by given value (could be used i.e. for presence-like move)
 */
export class ElementsChange implements Change<Map<string, ExcalidrawElement>> {
  private constructor(
    // TODO_UNDO: re-think the possible need for added/ remove/ updated deltas (possibly for handling edge cases with deletion, fixing bindings for deletion, showing changes added/modified/updated for version end etc.)
    private readonly deltas: Map<string, Delta<ExcalidrawElement>>,
  ) {}

  public static create(deltas: Map<string, Delta<ExcalidrawElement>>) {
    return new ElementsChange(deltas);
  }

  /**
   * Calculates the `Delta`s between the previous and next set of elements.
   *
   * @param prevElements - Map representing the previous state of elements.
   * @param nextElements - Map representing the next state of elements.
   *
   * @returns `ElementsChange` instance representing the `Delta` changes between the two sets of elements.
   */
  public static calculate<T extends ExcalidrawElement>(
    prevElements: Map<string, ExcalidrawElement>,
    nextElements: Map<string, ExcalidrawElement>,
  ): ElementsChange {
    if (prevElements === nextElements) {
      return ElementsChange.empty();
    }

    const deltas = new Map<string, Delta<T>>();

    // This might be needed only in same edge cases, like during collab, when `isDeleted` elements get removed
    for (const prevElement of prevElements.values()) {
      const nextElement = nextElements.get(prevElement.id);

      // Element got removed
      if (!nextElement) {
        const from = { ...prevElement, isDeleted: false } as T;
        const to = { isDeleted: true } as T;

        const delta = Delta.create(
          from,
          to,
          ElementsChange.stripIrrelevantProps,
        );

        deltas.set(prevElement.id, delta as Delta<T>);
      }
    }

    for (const nextElement of nextElements.values()) {
      const prevElement = prevElements.get(nextElement.id);

      // Element got added
      if (!prevElement) {
        if (nextElement.isDeleted) {
          // Special case when an element is added as deleted (i.e. through the API).
          // Creating a delta for it wouldn't make sense, as it would go from isDeleted `true` into `true` again.
          // We are going to skip it for now, later we could be have separate `added` & `removed` entries in the elements change,
          // so that we would distinguish between actual addition, removal and "soft" (un)deletion.
          continue;
        }

        const from = { isDeleted: true } as T;
        const to = { ...nextElement, isDeleted: false } as T;

        const delta = Delta.create(
          from,
          to,
          ElementsChange.stripIrrelevantProps,
        );

        deltas.set(nextElement.id, delta as Delta<T>);

        continue;
      }

      // Element got updated
      if (prevElement.versionNonce !== nextElement.versionNonce) {
        // O(n^2) here, but it's not as bad as it looks:
        // - we do this only on history recordings, not on every frame
        // - we do this only on changed elements
        // - # of element's properties is reasonably small
        // - otherwise we would have to emit deltas on user actions & apply them on every frame
        const delta = Delta.calculate<ExcalidrawElement>(
          prevElement,
          nextElement,
          ElementsChange.stripIrrelevantProps,
        );

        // Make sure there are at least some changes (except changes to irrelevant data)
        if (!Delta.isEmpty(delta)) {
          deltas.set(nextElement.id, delta as Delta<T>);
        }
      }
    }

    return new ElementsChange(deltas);
  }

  public static empty() {
    return new ElementsChange(new Map());
  }

  public inverse(): ElementsChange {
    const deltas = new Map<string, Delta<ExcalidrawElement>>();

    for (const [id, delta] of this.deltas.entries()) {
      deltas.set(id, Delta.create(delta.to, delta.from));
    }

    return new ElementsChange(deltas);
  }

  public applyTo(
    elements: Readonly<Map<string, ExcalidrawElement>>,
  ): [Map<string, ExcalidrawElement>, boolean] {
    let containsVisibleDifference = false;

    for (const [id, delta] of this.deltas.entries()) {
      const existingElement = elements.get(id);

      if (existingElement) {
        // Check if there was actually any visible change before applying
        if (!containsVisibleDifference) {
          // Special case, when delta deletes element, it results in a visible change
          if (existingElement.isDeleted && delta.to.isDeleted === false) {
            containsVisibleDifference = true;
          } else if (!existingElement.isDeleted) {
            // Check for any difference on a visible element
            containsVisibleDifference = Delta.containsDifference(
              delta.to,
              existingElement,
            );
          }
        }

        elements.set(id, newElementWith(existingElement, delta.to, true));
      }
    }

    return [elements, containsVisibleDifference];
  }

  public isEmpty(): boolean {
    // TODO_UNDO: might need to go through all deltas and check for emptiness
    return this.deltas.size === 0;
  }

  /**
   * Update the delta/s based on the existing elements.
   *
   * @param elements current elements
   * @param modifierOptions defines which of the delta (`from` or `to`) will be updated
   * @returns new instance with modified delta/s
   */
  public applyLatestChanges(
    elements: Map<string, ExcalidrawElement>,
    modifierOptions: "from" | "to",
  ): ElementsChange {
    const modifier =
      (element: ExcalidrawElement) => (partial: Partial<ExcalidrawElement>) => {
        const modifiedPartial: { [key: string]: unknown } = {};

        for (const key of Object.keys(partial)) {
          modifiedPartial[key] = element[key as keyof ExcalidrawElement];
        }

        return modifiedPartial;
      };

    const deltas = new Map<string, Delta<ExcalidrawElement>>();

    for (const [id, delta] of this.deltas.entries()) {
      const existingElement = elements.get(id);

      if (existingElement) {
        const modifiedDelta = Delta.create(
          delta.from,
          delta.to,
          modifier(existingElement),
          modifierOptions,
        );

        deltas.set(id, modifiedDelta);
      } else {
        // Keep whatever we had
        deltas.set(id, delta);
      }
    }

    return ElementsChange.create(deltas);
  }

  private static stripIrrelevantProps(delta: Partial<ExcalidrawElement>) {
    // TODO_UNDO: is seed correctly stripped?
    const { id, updated, version, versionNonce, seed, ...strippedDelta } =
      delta;

    return strippedDelta;
  }
}
