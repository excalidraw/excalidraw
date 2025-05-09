import {
  arrayToMap,
  arrayToObject,
  assertNever,
  isDevEnv,
  isShallowEqual,
  isTestEnv,
} from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeleted,
  Ordered,
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import type { DTO, SubtypeOf, ValueOf } from "@excalidraw/common/utility-types";

import type {
  AppState,
  ObservedAppState,
  ObservedElementsAppState,
  ObservedStandaloneAppState,
} from "@excalidraw/excalidraw/types";

import { getObservedAppState } from "./store";

import {
  BoundElement,
  BindableElement,
  bindingProperties,
  updateBoundElements,
} from "./binding";
import { LinearElementEditor } from "./linearElementEditor";
import { mutateElement, newElementWith } from "./mutateElement";
import { getBoundTextElementId, redrawTextBoundingBox } from "./textElement";
import {
  hasBoundTextElement,
  isBindableElement,
  isBoundToContainer,
  isTextElement,
} from "./typeChecks";

import { getNonDeletedGroupIds } from "./groups";

import { orderByFractionalIndex, syncMovedIndices } from "./fractionalIndex";

import Scene from "./Scene";

import type { BindableProp, BindingProp } from "./binding";

import type { ElementUpdate } from "./mutateElement";

/**
 * Represents the difference between two objects of the same type.
 *
 * Both `deleted` and `inserted` partials represent the same set of added, removed or updated properties, where:
 * - `deleted` is a set of all the deleted values
 * - `inserted` is a set of all the inserted (added, updated) values
 *
 * Keeping it as pure object (without transient state, side-effects, etc.), so we won't have to instantiate it on load.
 */
export class Delta<T> {
  private constructor(
    public readonly deleted: Partial<T>,
    public readonly inserted: Partial<T>,
  ) {}

  public static create<T>(
    deleted: Partial<T>,
    inserted: Partial<T>,
    modifier?: (delta: Partial<T>) => Partial<T>,
    modifierOptions?: "deleted" | "inserted",
  ) {
    const modifiedDeleted =
      modifier && modifierOptions !== "inserted" ? modifier(deleted) : deleted;
    const modifiedInserted =
      modifier && modifierOptions !== "deleted" ? modifier(inserted) : inserted;

    return new Delta(modifiedDeleted, modifiedInserted);
  }

  /**
   * Calculates the delta between two objects.
   *
   * @param prevObject - The previous state of the object.
   * @param nextObject - The next state of the object.
   *
   * @returns new delta instance.
   */
  public static calculate<T extends { [key: string]: any }>(
    prevObject: T,
    nextObject: T,
    modifier?: (partial: Partial<T>) => Partial<T>,
    postProcess?: (
      deleted: Partial<T>,
      inserted: Partial<T>,
    ) => [Partial<T>, Partial<T>],
  ): Delta<T> {
    if (prevObject === nextObject) {
      return Delta.empty();
    }

    const deleted = {} as Partial<T>;
    const inserted = {} as Partial<T>;

    // O(n^3) here for elements, but it's not as bad as it looks:
    // - we do this only on store recordings, not on every frame (not for ephemerals)
    // - we do this only on previously detected changed elements
    // - we do shallow compare only on the first level of properties (not going any deeper)
    // - # of properties is reasonably small
    for (const key of this.distinctKeysIterator(
      "full",
      prevObject,
      nextObject,
    )) {
      deleted[key as keyof T] = prevObject[key];
      inserted[key as keyof T] = nextObject[key];
    }

    const [processedDeleted, processedInserted] = postProcess
      ? postProcess(deleted, inserted)
      : [deleted, inserted];

    return Delta.create(processedDeleted, processedInserted, modifier);
  }

  public static empty() {
    return new Delta({}, {});
  }

  public static isEmpty<T>(delta: Delta<T>): boolean {
    return (
      !Object.keys(delta.deleted).length && !Object.keys(delta.inserted).length
    );
  }

  /**
   * Merges deleted and inserted object partials.
   */
  public static mergeObjects<T extends { [key: string]: unknown }>(
    prev: T,
    added: T,
    removed: T,
  ) {
    const cloned = { ...prev };

    for (const key of Object.keys(removed)) {
      delete cloned[key];
    }

    return { ...cloned, ...added };
  }

  /**
   * Merges deleted and inserted array partials.
   */
  public static mergeArrays<T>(
    prev: readonly T[] | null,
    added: readonly T[] | null | undefined,
    removed: readonly T[] | null | undefined,
    predicate?: (value: T) => string,
  ) {
    return Object.values(
      Delta.mergeObjects(
        arrayToObject(prev ?? [], predicate),
        arrayToObject(added ?? [], predicate),
        arrayToObject(removed ?? [], predicate),
      ),
    );
  }

  /**
   * Diff object partials as part of the `postProcess`.
   */
  public static diffObjects<T, K extends keyof T, V extends ValueOf<T[K]>>(
    deleted: Partial<T>,
    inserted: Partial<T>,
    property: K,
    setValue: (prevValue: V | undefined) => V,
  ) {
    if (!deleted[property] && !inserted[property]) {
      return;
    }

    if (
      typeof deleted[property] === "object" ||
      typeof inserted[property] === "object"
    ) {
      type RecordLike = Record<string, V | undefined>;

      const deletedObject: RecordLike = deleted[property] ?? {};
      const insertedObject: RecordLike = inserted[property] ?? {};

      const deletedDifferences = Delta.getLeftDifferences(
        deletedObject,
        insertedObject,
      ).reduce((acc, curr) => {
        acc[curr] = setValue(deletedObject[curr]);
        return acc;
      }, {} as RecordLike);

      const insertedDifferences = Delta.getRightDifferences(
        deletedObject,
        insertedObject,
      ).reduce((acc, curr) => {
        acc[curr] = setValue(insertedObject[curr]);
        return acc;
      }, {} as RecordLike);

      if (
        Object.keys(deletedDifferences).length ||
        Object.keys(insertedDifferences).length
      ) {
        Reflect.set(deleted, property, deletedDifferences);
        Reflect.set(inserted, property, insertedDifferences);
      } else {
        Reflect.deleteProperty(deleted, property);
        Reflect.deleteProperty(inserted, property);
      }
    }
  }

  /**
   * Diff array partials as part of the `postProcess`.
   */
  public static diffArrays<T, K extends keyof T, V extends T[K]>(
    deleted: Partial<T>,
    inserted: Partial<T>,
    property: K,
    groupBy: (value: V extends ArrayLike<infer T> ? T : never) => string,
  ) {
    if (!deleted[property] && !inserted[property]) {
      return;
    }

    if (Array.isArray(deleted[property]) || Array.isArray(inserted[property])) {
      const deletedArray = (
        Array.isArray(deleted[property]) ? deleted[property] : []
      ) as [];
      const insertedArray = (
        Array.isArray(inserted[property]) ? inserted[property] : []
      ) as [];

      const deletedDifferences = arrayToObject(
        Delta.getLeftDifferences(
          arrayToObject(deletedArray, groupBy),
          arrayToObject(insertedArray, groupBy),
        ),
      );
      const insertedDifferences = arrayToObject(
        Delta.getRightDifferences(
          arrayToObject(deletedArray, groupBy),
          arrayToObject(insertedArray, groupBy),
        ),
      );

      if (
        Object.keys(deletedDifferences).length ||
        Object.keys(insertedDifferences).length
      ) {
        const deletedValue = deletedArray.filter(
          (x) => deletedDifferences[groupBy ? groupBy(x) : String(x)],
        );
        const insertedValue = insertedArray.filter(
          (x) => insertedDifferences[groupBy ? groupBy(x) : String(x)],
        );

        Reflect.set(deleted, property, deletedValue);
        Reflect.set(inserted, property, insertedValue);
      } else {
        Reflect.deleteProperty(deleted, property);
        Reflect.deleteProperty(inserted, property);
      }
    }
  }

  /**
   * Compares if object1 contains any different value compared to the object2.
   */
  public static isLeftDifferent<T extends {}>(
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ): boolean {
    const anyDistinctKey = this.distinctKeysIterator(
      "left",
      object1,
      object2,
      skipShallowCompare,
    ).next().value;

    return !!anyDistinctKey;
  }

  /**
   * Compares if object2 contains any different value compared to the object1.
   */
  public static isRightDifferent<T extends {}>(
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ): boolean {
    const anyDistinctKey = this.distinctKeysIterator(
      "right",
      object1,
      object2,
      skipShallowCompare,
    ).next().value;

    return !!anyDistinctKey;
  }

  /**
   * Returns sorted object1 keys that have distinct values.
   */
  public static getLeftDifferences<T extends {}>(
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ) {
    return Array.from(
      this.distinctKeysIterator("left", object1, object2, skipShallowCompare),
    ).sort();
  }

  /**
   * Returns sorted object2 keys that have distinct values.
   */
  public static getRightDifferences<T extends {}>(
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ) {
    return Array.from(
      this.distinctKeysIterator("right", object1, object2, skipShallowCompare),
    ).sort();
  }

  /**
   * Iterator comparing values of object properties based on the passed joining strategy.
   *
   * @yields keys of properties with different values
   *
   * WARN: it's based on shallow compare performed only on the first level and doesn't go deeper than that.
   */
  private static *distinctKeysIterator<T extends {}>(
    join: "left" | "right" | "full",
    object1: T,
    object2: T,
    skipShallowCompare = false,
  ) {
    if (object1 === object2) {
      return;
    }

    let keys: string[] = [];

    if (join === "left") {
      keys = Object.keys(object1);
    } else if (join === "right") {
      keys = Object.keys(object2);
    } else if (join === "full") {
      keys = Array.from(
        new Set([...Object.keys(object1), ...Object.keys(object2)]),
      );
    } else {
      assertNever(
        join,
        `Unknown distinctKeysIterator's join param "${join}"`,
        true,
      );
    }

    for (const key of keys) {
      const object1Value = object1[key as keyof T];
      const object2Value = object2[key as keyof T];

      if (object1Value !== object2Value) {
        if (
          !skipShallowCompare &&
          typeof object1Value === "object" &&
          typeof object2Value === "object" &&
          object1Value !== null &&
          object2Value !== null &&
          isShallowEqual(object1Value, object2Value)
        ) {
          continue;
        }

        yield key;
      }
    }
  }
}

/**
 * Encapsulates a set of application-level `Delta`s.
 */
export interface DeltaContainer<T> {
  /**
   * Inverses the `Delta`s while creating a new `DeltaContainer` instance.
   */
  inverse(): DeltaContainer<T>;

  /**
   * Applies the `Delta`s to the previous object.
   *
   * @returns a tuple of the next object `T` with applied `Delta`s, and `boolean`, indicating whether the applied deltas resulted in a visible change.
   */
  applyTo(previous: T, ...options: unknown[]): [T, boolean];

  /**
   * Checks whether all `Delta`s are empty.
   */
  isEmpty(): boolean;
}

export class AppStateDelta implements DeltaContainer<AppState> {
  private constructor(public readonly delta: Delta<ObservedAppState>) {}

  public static calculate<T extends ObservedAppState>(
    prevAppState: T,
    nextAppState: T,
  ): AppStateDelta {
    const delta = Delta.calculate(
      prevAppState,
      nextAppState,
      // making the order of keys in deltas stable for hashing purposes
      AppStateDelta.orderAppStateKeys,
      AppStateDelta.postProcess,
    );

    return new AppStateDelta(delta);
  }

  public static restore(appStateDeltaDTO: DTO<AppStateDelta>): AppStateDelta {
    const { delta } = appStateDeltaDTO;
    return new AppStateDelta(delta);
  }

  public static empty() {
    return new AppStateDelta(Delta.create({}, {}));
  }

  public inverse(): AppStateDelta {
    const inversedDelta = Delta.create(this.delta.inserted, this.delta.deleted);
    return new AppStateDelta(inversedDelta);
  }

  public applyTo(
    appState: AppState,
    nextElements: SceneElementsMap,
  ): [AppState, boolean] {
    try {
      const {
        selectedElementIds: removedSelectedElementIds = {},
        selectedGroupIds: removedSelectedGroupIds = {},
      } = this.delta.deleted;

      const {
        selectedElementIds: addedSelectedElementIds = {},
        selectedGroupIds: addedSelectedGroupIds = {},
        selectedLinearElementId,
        editingLinearElementId,
        ...directlyApplicablePartial
      } = this.delta.inserted;

      const mergedSelectedElementIds = Delta.mergeObjects(
        appState.selectedElementIds,
        addedSelectedElementIds,
        removedSelectedElementIds,
      );

      const mergedSelectedGroupIds = Delta.mergeObjects(
        appState.selectedGroupIds,
        addedSelectedGroupIds,
        removedSelectedGroupIds,
      );

      const selectedLinearElement =
        selectedLinearElementId && nextElements.has(selectedLinearElementId)
          ? new LinearElementEditor(
              nextElements.get(
                selectedLinearElementId,
              ) as NonDeleted<ExcalidrawLinearElement>,
              nextElements,
            )
          : null;

      const editingLinearElement =
        editingLinearElementId && nextElements.has(editingLinearElementId)
          ? new LinearElementEditor(
              nextElements.get(
                editingLinearElementId,
              ) as NonDeleted<ExcalidrawLinearElement>,
              nextElements,
            )
          : null;

      const nextAppState = {
        ...appState,
        ...directlyApplicablePartial,
        selectedElementIds: mergedSelectedElementIds,
        selectedGroupIds: mergedSelectedGroupIds,
        selectedLinearElement:
          typeof selectedLinearElementId !== "undefined"
            ? selectedLinearElement // element was either inserted or deleted
            : appState.selectedLinearElement, // otherwise assign what we had before
        editingLinearElement:
          typeof editingLinearElementId !== "undefined"
            ? editingLinearElement // element was either inserted or deleted
            : appState.editingLinearElement, // otherwise assign what we had before
      };

      const constainsVisibleChanges = this.filterInvisibleChanges(
        appState,
        nextAppState,
        nextElements,
      );

      return [nextAppState, constainsVisibleChanges];
    } catch (e) {
      // shouldn't really happen, but just in case
      console.error(`Couldn't apply appstate change`, e);

      if (isTestEnv() || isDevEnv()) {
        throw e;
      }

      return [appState, false];
    }
  }

  public isEmpty(): boolean {
    return Delta.isEmpty(this.delta);
  }

  /**
   * Mutates `nextAppState` be filtering out state related to deleted elements.
   *
   * @returns `true` if a visible change is found, `false` otherwise.
   */
  private filterInvisibleChanges(
    prevAppState: AppState,
    nextAppState: AppState,
    nextElements: SceneElementsMap,
  ): boolean {
    // TODO: #7348 we could still get an empty undo/redo, as we assume that previous appstate does not contain references to deleted elements
    // which is not always true - i.e. now we do cleanup appstate during history, but we do not do it during remote updates
    const prevObservedAppState = getObservedAppState(prevAppState);
    const nextObservedAppState = getObservedAppState(nextAppState);

    const containsStandaloneDifference = Delta.isRightDifferent(
      AppStateDelta.stripElementsProps(prevObservedAppState),
      AppStateDelta.stripElementsProps(nextObservedAppState),
    );

    const containsElementsDifference = Delta.isRightDifferent(
      AppStateDelta.stripStandaloneProps(prevObservedAppState),
      AppStateDelta.stripStandaloneProps(nextObservedAppState),
    );

    if (!containsStandaloneDifference && !containsElementsDifference) {
      // no change in appstate was detected
      return false;
    }

    const visibleDifferenceFlag = {
      value: containsStandaloneDifference,
    };

    if (containsElementsDifference) {
      // filter invisible changes on each iteration
      const changedElementsProps = Delta.getRightDifferences(
        AppStateDelta.stripStandaloneProps(prevObservedAppState),
        AppStateDelta.stripStandaloneProps(nextObservedAppState),
      ) as Array<keyof ObservedElementsAppState>;

      let nonDeletedGroupIds = new Set<string>();

      if (
        changedElementsProps.includes("editingGroupId") ||
        changedElementsProps.includes("selectedGroupIds")
      ) {
        // this one iterates through all the non deleted elements, so make sure it's not done twice
        nonDeletedGroupIds = getNonDeletedGroupIds(nextElements);
      }

      // check whether delta properties are related to the existing non-deleted elements
      for (const key of changedElementsProps) {
        switch (key) {
          case "selectedElementIds":
            nextAppState[key] = AppStateDelta.filterSelectedElements(
              nextAppState[key],
              nextElements,
              visibleDifferenceFlag,
            );

            break;
          case "selectedGroupIds":
            nextAppState[key] = AppStateDelta.filterSelectedGroups(
              nextAppState[key],
              nonDeletedGroupIds,
              visibleDifferenceFlag,
            );

            break;
          case "croppingElementId": {
            const croppingElementId = nextAppState[key];
            const element =
              croppingElementId && nextElements.get(croppingElementId);

            if (element && !element.isDeleted) {
              visibleDifferenceFlag.value = true;
            } else {
              nextAppState[key] = null;
            }
            break;
          }
          case "editingGroupId":
            const editingGroupId = nextAppState[key];

            if (!editingGroupId) {
              // previously there was an editingGroup (assuming visible), now there is none
              visibleDifferenceFlag.value = true;
            } else if (nonDeletedGroupIds.has(editingGroupId)) {
              // previously there wasn't an editingGroup, now there is one which is visible
              visibleDifferenceFlag.value = true;
            } else {
              // there was assigned an editingGroup now, but it's related to deleted element
              nextAppState[key] = null;
            }

            break;
          case "selectedLinearElementId":
          case "editingLinearElementId":
            const appStateKey = AppStateDelta.convertToAppStateKey(key);
            const linearElement = nextAppState[appStateKey];

            if (!linearElement) {
              // previously there was a linear element (assuming visible), now there is none
              visibleDifferenceFlag.value = true;
            } else {
              const element = nextElements.get(linearElement.elementId);

              if (element && !element.isDeleted) {
                // previously there wasn't a linear element, now there is one which is visible
                visibleDifferenceFlag.value = true;
              } else {
                // there was assigned a linear element now, but it's deleted
                nextAppState[appStateKey] = null;
              }
            }

            break;
          default: {
            assertNever(
              key,
              `Unknown ObservedElementsAppState's key "${key}"`,
              true,
            );
          }
        }
      }
    }

    return visibleDifferenceFlag.value;
  }

  private static convertToAppStateKey(
    key: keyof Pick<
      ObservedElementsAppState,
      "selectedLinearElementId" | "editingLinearElementId"
    >,
  ): keyof Pick<AppState, "selectedLinearElement" | "editingLinearElement"> {
    switch (key) {
      case "selectedLinearElementId":
        return "selectedLinearElement";
      case "editingLinearElementId":
        return "editingLinearElement";
    }
  }

  private static filterSelectedElements(
    selectedElementIds: AppState["selectedElementIds"],
    elements: SceneElementsMap,
    visibleDifferenceFlag: { value: boolean },
  ) {
    const ids = Object.keys(selectedElementIds);

    if (!ids.length) {
      // previously there were ids (assuming related to visible elements), now there are none
      visibleDifferenceFlag.value = true;
      return selectedElementIds;
    }

    const nextSelectedElementIds = { ...selectedElementIds };

    for (const id of ids) {
      const element = elements.get(id);

      if (element && !element.isDeleted) {
        // there is a selected element id related to a visible element
        visibleDifferenceFlag.value = true;
      } else {
        delete nextSelectedElementIds[id];
      }
    }

    return nextSelectedElementIds;
  }

  private static filterSelectedGroups(
    selectedGroupIds: AppState["selectedGroupIds"],
    nonDeletedGroupIds: Set<string>,
    visibleDifferenceFlag: { value: boolean },
  ) {
    const ids = Object.keys(selectedGroupIds);

    if (!ids.length) {
      // previously there were ids (assuming related to visible groups), now there are none
      visibleDifferenceFlag.value = true;
      return selectedGroupIds;
    }

    const nextSelectedGroupIds = { ...selectedGroupIds };

    for (const id of Object.keys(nextSelectedGroupIds)) {
      if (nonDeletedGroupIds.has(id)) {
        // there is a selected group id related to a visible group
        visibleDifferenceFlag.value = true;
      } else {
        delete nextSelectedGroupIds[id];
      }
    }

    return nextSelectedGroupIds;
  }

  private static stripElementsProps(
    delta: Partial<ObservedAppState>,
  ): Partial<ObservedStandaloneAppState> {
    // WARN: Do not remove the type-casts as they here to ensure proper type checks
    const {
      editingGroupId,
      selectedGroupIds,
      selectedElementIds,
      editingLinearElementId,
      selectedLinearElementId,
      croppingElementId,
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
    // WARN: Do not remove the type-casts as they here to ensure proper type checks
    const { name, viewBackgroundColor, ...elementsProps } =
      delta as ObservedAppState;

    return elementsProps as SubtypeOf<
      typeof elementsProps,
      ObservedElementsAppState
    >;
  }

  /**
   * It is necessary to post process the partials in case of reference values,
   * for which we need to calculate the real diff between `deleted` and `inserted`.
   */
  private static postProcess<T extends ObservedAppState>(
    deleted: Partial<T>,
    inserted: Partial<T>,
  ): [Partial<T>, Partial<T>] {
    try {
      Delta.diffObjects(
        deleted,
        inserted,
        "selectedElementIds",
        // ts language server has a bit trouble resolving this, so we are giving it a little push
        (_) => true as ValueOf<T["selectedElementIds"]>,
      );
      Delta.diffObjects(
        deleted,
        inserted,
        "selectedGroupIds",
        (prevValue) => (prevValue ?? false) as ValueOf<T["selectedGroupIds"]>,
      );
    } catch (e) {
      // if postprocessing fails it does not make sense to bubble up, but let's make sure we know about it
      console.error(`Couldn't postprocess appstate change deltas.`);

      if (isTestEnv() || isDevEnv()) {
        throw e;
      }
    } finally {
      return [deleted, inserted];
    }
  }

  private static orderAppStateKeys(partial: Partial<ObservedAppState>) {
    const orderedPartial: { [key: string]: unknown } = {};

    for (const key of Object.keys(partial).sort()) {
      // relying on insertion order
      orderedPartial[key] = partial[key as keyof ObservedAppState];
    }

    return orderedPartial as Partial<ObservedAppState>;
  }
}

type ElementPartial<T extends ExcalidrawElement = ExcalidrawElement> = Omit<
  ElementUpdate<Ordered<T>>,
  "seed"
>;

/**
 * Elements change is a low level primitive to capture a change between two sets of elements.
 * It does so by encapsulating forward and backward `Delta`s, allowing to time-travel in both directions.
 */
export class ElementsDelta implements DeltaContainer<SceneElementsMap> {
  private constructor(
    public readonly added: Record<string, Delta<ElementPartial>>,
    public readonly removed: Record<string, Delta<ElementPartial>>,
    public readonly updated: Record<string, Delta<ElementPartial>>,
  ) {}

  public static create(
    added: Record<string, Delta<ElementPartial>>,
    removed: Record<string, Delta<ElementPartial>>,
    updated: Record<string, Delta<ElementPartial>>,
    options: {
      shouldRedistribute: boolean;
    } = {
      shouldRedistribute: false,
    },
  ) {
    let delta: ElementsDelta;

    if (options.shouldRedistribute) {
      const nextAdded: Record<string, Delta<ElementPartial>> = {};
      const nextRemoved: Record<string, Delta<ElementPartial>> = {};
      const nextUpdated: Record<string, Delta<ElementPartial>> = {};

      const deltas = [
        ...Object.entries(added),
        ...Object.entries(removed),
        ...Object.entries(updated),
      ];

      for (const [id, delta] of deltas) {
        if (this.satisfiesAddition(delta)) {
          nextAdded[id] = delta;
        } else if (this.satisfiesRemoval(delta)) {
          nextRemoved[id] = delta;
        } else {
          nextUpdated[id] = delta;
        }
      }

      delta = new ElementsDelta(nextAdded, nextRemoved, nextUpdated);
    } else {
      delta = new ElementsDelta(added, removed, updated);
    }

    if (isTestEnv() || isDevEnv()) {
      ElementsDelta.validate(delta, "added", this.satisfiesAddition);
      ElementsDelta.validate(delta, "removed", this.satisfiesRemoval);
      ElementsDelta.validate(delta, "updated", this.satisfiesUpdate);
    }

    return delta;
  }

  public static restore(elementsDeltaDTO: DTO<ElementsDelta>): ElementsDelta {
    const { added, removed, updated } = elementsDeltaDTO;
    return ElementsDelta.create(added, removed, updated);
  }

  private static satisfiesAddition = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) =>
    // dissallowing added as "deleted", which could cause issues when resolving conflicts
    deleted.isDeleted === true && !inserted.isDeleted;

  private static satisfiesRemoval = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) =>
    !deleted.isDeleted && inserted.isDeleted === true;

  private static satisfiesUpdate = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) => !!deleted.isDeleted === !!inserted.isDeleted;

  private static validate(
    elementsDelta: ElementsDelta,
    type: "added" | "removed" | "updated",
    satifies: (delta: Delta<ElementPartial>) => boolean,
  ) {
    for (const [id, delta] of Object.entries(elementsDelta[type])) {
      if (!satifies(delta)) {
        console.error(
          `Broken invariant for "${type}" delta, element "${id}", delta:`,
          delta,
        );
        throw new Error(`ElementsDelta invariant broken for element "${id}".`);
      }
    }
  }

  /**
   * Calculates the `Delta`s between the previous and next set of elements.
   *
   * @param prevElements - Map representing the previous state of elements.
   * @param nextElements - Map representing the next state of elements.
   *
   * @returns `ElementsDelta` instance representing the `Delta` changes between the two sets of elements.
   */
  public static calculate<T extends OrderedExcalidrawElement>(
    prevElements: Map<string, T>,
    nextElements: Map<string, T>,
  ): ElementsDelta {
    if (prevElements === nextElements) {
      return ElementsDelta.empty();
    }

    const added: Record<string, Delta<ElementPartial>> = {};
    const removed: Record<string, Delta<ElementPartial>> = {};
    const updated: Record<string, Delta<ElementPartial>> = {};

    // this might be needed only in same edge cases, like during collab, when `isDeleted` elements get removed or when we (un)intentionally remove the elements
    for (const prevElement of prevElements.values()) {
      const nextElement = nextElements.get(prevElement.id);

      if (!nextElement) {
        const deleted = { ...prevElement, isDeleted: false } as ElementPartial;
        const inserted = { isDeleted: true } as ElementPartial;

        const delta = Delta.create(
          deleted,
          inserted,
          ElementsDelta.stripIrrelevantProps,
        );

        removed[prevElement.id] = delta;
      }
    }

    for (const nextElement of nextElements.values()) {
      const prevElement = prevElements.get(nextElement.id);

      if (!prevElement) {
        const deleted = { isDeleted: true } as ElementPartial;
        const inserted = {
          ...nextElement,
          isDeleted: false,
        } as ElementPartial;

        const delta = Delta.create(
          deleted,
          inserted,
          ElementsDelta.stripIrrelevantProps,
        );

        added[nextElement.id] = delta;

        continue;
      }

      if (prevElement.versionNonce !== nextElement.versionNonce) {
        const delta = Delta.calculate<ElementPartial>(
          prevElement,
          nextElement,
          ElementsDelta.stripIrrelevantProps,
          ElementsDelta.postProcess,
        );

        if (
          // making sure we don't get here some non-boolean values (i.e. undefined, null, etc.)
          typeof prevElement.isDeleted === "boolean" &&
          typeof nextElement.isDeleted === "boolean" &&
          prevElement.isDeleted !== nextElement.isDeleted
        ) {
          // notice that other props could have been updated as well
          if (prevElement.isDeleted && !nextElement.isDeleted) {
            added[nextElement.id] = delta;
          } else {
            removed[nextElement.id] = delta;
          }

          continue;
        }

        // making sure there are at least some changes
        if (!Delta.isEmpty(delta)) {
          updated[nextElement.id] = delta;
        }
      }
    }

    return ElementsDelta.create(added, removed, updated);
  }

  public static empty() {
    return ElementsDelta.create({}, {}, {});
  }

  public inverse(): ElementsDelta {
    const inverseInternal = (deltas: Record<string, Delta<ElementPartial>>) => {
      const inversedDeltas: Record<string, Delta<ElementPartial>> = {};

      for (const [id, delta] of Object.entries(deltas)) {
        inversedDeltas[id] = Delta.create(delta.inserted, delta.deleted);
      }

      return inversedDeltas;
    };

    const added = inverseInternal(this.added);
    const removed = inverseInternal(this.removed);
    const updated = inverseInternal(this.updated);

    // notice we inverse removed with added not to break the invariants
    return ElementsDelta.create(removed, added, updated);
  }

  public isEmpty(): boolean {
    return (
      Object.keys(this.added).length === 0 &&
      Object.keys(this.removed).length === 0 &&
      Object.keys(this.updated).length === 0
    );
  }

  /**
   * Update delta/s based on the existing elements.
   *
   * @param elements current elements
   * @param modifierOptions defines which of the delta (`deleted` or `inserted`) will be updated
   * @returns new instance with modified delta/s
   */
  public applyLatestChanges(
    elements: SceneElementsMap,
    modifierOptions: "deleted" | "inserted",
  ): ElementsDelta {
    const modifier =
      (element: OrderedExcalidrawElement) => (partial: ElementPartial) => {
        const latestPartial: { [key: string]: unknown } = {};

        for (const key of Object.keys(partial) as Array<keyof typeof partial>) {
          // do not update following props:
          // - `boundElements`, as it is a reference value which is postprocessed to contain only deleted/inserted keys
          switch (key) {
            case "boundElements":
              latestPartial[key] = partial[key];
              break;
            default:
              latestPartial[key] = element[key];
          }
        }

        return latestPartial;
      };

    const applyLatestChangesInternal = (
      deltas: Record<string, Delta<ElementPartial>>,
    ) => {
      const modifiedDeltas: Record<string, Delta<ElementPartial>> = {};

      for (const [id, delta] of Object.entries(deltas)) {
        const existingElement = elements.get(id);

        if (existingElement) {
          const modifiedDelta = Delta.create(
            delta.deleted,
            delta.inserted,
            modifier(existingElement),
            modifierOptions,
          );

          modifiedDeltas[id] = modifiedDelta;
        } else {
          modifiedDeltas[id] = delta;
        }
      }

      return modifiedDeltas;
    };

    const added = applyLatestChangesInternal(this.added);
    const removed = applyLatestChangesInternal(this.removed);
    const updated = applyLatestChangesInternal(this.updated);

    return ElementsDelta.create(added, removed, updated, {
      shouldRedistribute: true, // redistribute the deltas as `isDeleted` could have been updated
    });
  }

  public applyTo(
    elements: SceneElementsMap,
    elementsSnapshot: Map<string, OrderedExcalidrawElement>,
  ): [SceneElementsMap, boolean] {
    let nextElements = new Map(elements) as SceneElementsMap;
    let changedElements: Map<string, OrderedExcalidrawElement>;

    const flags = {
      containsVisibleDifference: false,
      containsZindexDifference: false,
    };

    // mimic a transaction by applying deltas into `nextElements` (always new instance, no mutation)
    try {
      const applyDeltas = ElementsDelta.createApplier(
        nextElements,
        elementsSnapshot,
        flags,
      );

      const addedElements = applyDeltas("added", this.added);
      const removedElements = applyDeltas("removed", this.removed);
      const updatedElements = applyDeltas("updated", this.updated);

      const affectedElements = this.resolveConflicts(elements, nextElements);

      // TODO: #7348 validate elements semantically and syntactically the changed elements, in case they would result data integrity issues
      changedElements = new Map([
        ...addedElements,
        ...removedElements,
        ...updatedElements,
        ...affectedElements,
      ]);
    } catch (e) {
      console.error(`Couldn't apply elements delta`, e);

      if (isTestEnv() || isDevEnv()) {
        throw e;
      }

      // should not really happen, but just in case we cannot apply deltas, let's return the previous elements with visible change set to `true`
      // even though there is obviously no visible change, returning `false` could be dangerous, as i.e.:
      // in the worst case, it could lead into iterating through the whole stack with no possibility to redo
      // instead, the worst case when returning `true` is an empty undo / redo
      return [elements, true];
    }

    try {
      // the following reorder performs also mutations, but only on new instances of changed elements
      // (unless something goes really bad and it fallbacks to fixing all invalid indices)
      nextElements = ElementsDelta.reorderElements(
        nextElements,
        changedElements,
        flags,
      );

      // we don't have an up-to-date scene, as we can be just in the middle of applying history entry
      // we also don't have a scene on the server
      // so we are creating a temp scene just to query and mutate elements
      const tempScene = new Scene(nextElements);

      ElementsDelta.redrawTextBoundingBoxes(tempScene, changedElements);
      // Need ordered nextElements to avoid z-index binding issues
      ElementsDelta.redrawBoundArrows(tempScene, changedElements);
    } catch (e) {
      console.error(
        `Couldn't mutate elements after applying elements change`,
        e,
      );

      if (isTestEnv() || isDevEnv()) {
        throw e;
      }
    } finally {
      return [nextElements, flags.containsVisibleDifference];
    }
  }

  private static createApplier =
    (
      nextElements: SceneElementsMap,
      snapshot: Map<string, OrderedExcalidrawElement>,
      flags: {
        containsVisibleDifference: boolean;
        containsZindexDifference: boolean;
      },
    ) =>
    (
      type: "added" | "removed" | "updated",
      deltas: Record<string, Delta<ElementPartial>>,
    ) => {
      const getElement = ElementsDelta.createGetter(
        type,
        nextElements,
        snapshot,
        flags,
      );

      return Object.entries(deltas).reduce((acc, [id, delta]) => {
        const element = getElement(id, delta.inserted);

        if (element) {
          const newElement = ElementsDelta.applyDelta(element, delta, flags);
          nextElements.set(newElement.id, newElement);
          acc.set(newElement.id, newElement);
        }

        return acc;
      }, new Map<string, OrderedExcalidrawElement>());
    };

  private static createGetter =
    (
      type: "added" | "removed" | "updated",
      elements: SceneElementsMap,
      snapshot: Map<string, OrderedExcalidrawElement>,
      flags: {
        containsVisibleDifference: boolean;
        containsZindexDifference: boolean;
      },
    ) =>
    (id: string, partial: ElementPartial) => {
      let element = elements.get(id);

      if (!element) {
        // always fallback to the local snapshot, in cases when we cannot find the element in the elements array
        element = snapshot.get(id);

        if (element) {
          // as the element was brought from the snapshot, it automatically results in a possible zindex difference
          flags.containsZindexDifference = true;

          // as the element was force deleted, we need to check if adding it back results in a visible change
          if (
            partial.isDeleted === false ||
            (partial.isDeleted !== true && element.isDeleted === false)
          ) {
            flags.containsVisibleDifference = true;
          }
        } else {
          // not in elements, not in snapshot? element might have been added remotely!
          element = newElementWith(
            { id, version: 1 } as OrderedExcalidrawElement,
            {
              ...partial,
            },
          );
        }
      }

      return element;
    };

  private static applyDelta(
    element: OrderedExcalidrawElement,
    delta: Delta<ElementPartial>,
    flags: {
      containsVisibleDifference: boolean;
      containsZindexDifference: boolean;
    } = {
      // by default we don't care about about the flags
      containsVisibleDifference: true,
      containsZindexDifference: true,
    },
  ) {
    const { boundElements, ...directlyApplicablePartial } = delta.inserted;

    if (
      delta.deleted.boundElements?.length ||
      delta.inserted.boundElements?.length
    ) {
      const mergedBoundElements = Delta.mergeArrays(
        element.boundElements,
        delta.inserted.boundElements,
        delta.deleted.boundElements,
        (x) => x.id,
      );

      Object.assign(directlyApplicablePartial, {
        boundElements: mergedBoundElements,
      });
    }

    // TODO: this looks wrong, shouldn't be here
    if (element.type === "image") {
      const _delta = delta as Delta<ElementPartial<ExcalidrawImageElement>>;
      // we want to override `crop` only if modified so that we don't reset
      // when undoing/redoing unrelated change
      if (_delta.deleted.crop || _delta.inserted.crop) {
        Object.assign(directlyApplicablePartial, {
          // apply change verbatim
          crop: _delta.inserted.crop ?? null,
        });
      }
    }

    if (!flags.containsVisibleDifference) {
      // strip away fractional index, as even if it would be different, it doesn't have to result in visible change
      const { index, ...rest } = directlyApplicablePartial;
      const containsVisibleDifference = ElementsDelta.checkForVisibleDifference(
        element,
        rest,
      );

      flags.containsVisibleDifference = containsVisibleDifference;
    }

    if (!flags.containsZindexDifference) {
      flags.containsZindexDifference =
        delta.deleted.index !== delta.inserted.index;
    }

    return newElementWith(element, directlyApplicablePartial);
  }

  /**
   * Check for visible changes regardless of whether they were removed, added or updated.
   */
  private static checkForVisibleDifference(
    element: OrderedExcalidrawElement,
    partial: ElementPartial,
  ) {
    if (element.isDeleted && partial.isDeleted !== false) {
      // when it's deleted and partial is not false, it cannot end up with a visible change
      return false;
    }

    if (element.isDeleted && partial.isDeleted === false) {
      // when we add an element, it results in a visible change
      return true;
    }

    if (element.isDeleted === false && partial.isDeleted) {
      // when we remove an element, it results in a visible change
      return true;
    }

    // check for any difference on a visible element
    return Delta.isRightDifferent(element, partial);
  }

  /**
   * Resolves conflicts for all previously added, removed and updated elements.
   * Updates the previous deltas with all the changes after conflict resolution.
   *
   * // TODO: revisit since some bound arrows seem to be often redrawn incorrectly
   *
   * @returns all elements affected by the conflict resolution
   */
  private resolveConflicts(
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
  ) {
    const nextAffectedElements = new Map<string, OrderedExcalidrawElement>();
    const updater = (
      element: ExcalidrawElement,
      updates: ElementUpdate<ExcalidrawElement>,
    ) => {
      const nextElement = nextElements.get(element.id); // only ever modify next element!
      if (!nextElement) {
        return;
      }

      let affectedElement: OrderedExcalidrawElement;

      if (prevElements.get(element.id) === nextElement) {
        // create the new element instance in case we didn't modify the element yet
        // so that we won't end up in an incosistent state in case we would fail in the middle of mutations
        affectedElement = newElementWith(
          nextElement,
          updates as ElementUpdate<OrderedExcalidrawElement>,
        );
      } else {
        affectedElement = mutateElement(
          nextElement,
          nextElements,
          updates as ElementUpdate<OrderedExcalidrawElement>,
        );
      }

      nextAffectedElements.set(affectedElement.id, affectedElement);
      nextElements.set(affectedElement.id, affectedElement);
    };

    // removed delta is affecting the bindings always, as all the affected elements of the removed elements need to be unbound
    for (const id of Object.keys(this.removed)) {
      ElementsDelta.unbindAffected(prevElements, nextElements, id, updater);
    }

    // added delta is affecting the bindings always, all the affected elements of the added elements need to be rebound
    for (const id of Object.keys(this.added)) {
      ElementsDelta.rebindAffected(prevElements, nextElements, id, updater);
    }

    // updated delta is affecting the binding only in case it contains changed binding or bindable property
    for (const [id] of Array.from(Object.entries(this.updated)).filter(
      ([_, delta]) =>
        Object.keys({ ...delta.deleted, ...delta.inserted }).find((prop) =>
          bindingProperties.has(prop as BindingProp | BindableProp),
        ),
    )) {
      const updatedElement = nextElements.get(id);
      if (!updatedElement || updatedElement.isDeleted) {
        // skip fixing bindings for updates on deleted elements
        continue;
      }

      ElementsDelta.rebindAffected(prevElements, nextElements, id, updater);
    }

    // filter only previous elements, which were now affected
    const prevAffectedElements = new Map(
      Array.from(prevElements).filter(([id]) => nextAffectedElements.has(id)),
    );

    // calculate complete deltas for affected elements, and assign them back to all the deltas
    // technically we could do better here if perf. would become an issue
    const { added, removed, updated } = ElementsDelta.calculate(
      prevAffectedElements,
      nextAffectedElements,
    );

    for (const [id, delta] of Object.entries(added)) {
      this.added[id] = delta;
    }

    for (const [id, delta] of Object.entries(removed)) {
      this.removed[id] = delta;
    }

    for (const [id, delta] of Object.entries(updated)) {
      this.updated[id] = delta;
    }

    return nextAffectedElements;
  }

  /**
   * Non deleted affected elements of removed elements (before and after applying delta),
   * should be unbound ~ bindings should not point from non deleted into the deleted element/s.
   */
  private static unbindAffected(
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
    id: string,
    updater: (
      element: ExcalidrawElement,
      updates: ElementUpdate<ExcalidrawElement>,
    ) => void,
  ) {
    // the instance could have been updated, so make sure we are passing the latest element to each function below
    const prevElement = () => prevElements.get(id); // element before removal
    const nextElement = () => nextElements.get(id); // element after removal

    BoundElement.unbindAffected(nextElements, prevElement(), updater);
    BoundElement.unbindAffected(nextElements, nextElement(), updater);

    BindableElement.unbindAffected(nextElements, prevElement(), updater);
    BindableElement.unbindAffected(nextElements, nextElement(), updater);
  }

  /**
   * Non deleted affected elements of added or updated element/s (before and after applying delta),
   * should be rebound (if possible) with the current element ~ bindings should be bidirectional.
   */
  private static rebindAffected(
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
    id: string,
    updater: (
      element: ExcalidrawElement,
      updates: ElementUpdate<ExcalidrawElement>,
    ) => void,
  ) {
    // the instance could have been updated, so make sure we are passing the latest element to each function below
    const prevElement = () => prevElements.get(id); // element before addition / update
    const nextElement = () => nextElements.get(id); // element after addition / update

    BoundElement.unbindAffected(nextElements, prevElement(), updater);
    BoundElement.rebindAffected(nextElements, nextElement(), updater);

    BindableElement.unbindAffected(
      nextElements,
      prevElement(),
      (element, updates) => {
        // we cannot rebind arrows with bindable element so we don't unbind them at all during rebind (we still need to unbind them on removal)
        // TODO: #7348 add startBinding / endBinding to the `BoundElement` context so that we could rebind arrows and remove this condition
        if (isTextElement(element)) {
          updater(element, updates);
        }
      },
    );
    BindableElement.rebindAffected(nextElements, nextElement(), updater);
  }

  private static redrawTextBoundingBoxes(
    scene: Scene,
    changed: Map<string, OrderedExcalidrawElement>,
  ) {
    const elements = scene.getNonDeletedElementsMap();
    const boxesToRedraw = new Map<
      string,
      { container: OrderedExcalidrawElement; boundText: ExcalidrawTextElement }
    >();

    for (const element of changed.values()) {
      if (isBoundToContainer(element)) {
        const { containerId } = element as ExcalidrawTextElement;
        const container = containerId ? elements.get(containerId) : undefined;

        if (container) {
          boxesToRedraw.set(container.id, {
            container,
            boundText: element as ExcalidrawTextElement,
          });
        }
      }

      if (hasBoundTextElement(element)) {
        const boundTextElementId = getBoundTextElementId(element);
        const boundText = boundTextElementId
          ? elements.get(boundTextElementId)
          : undefined;

        if (boundText) {
          boxesToRedraw.set(element.id, {
            container: element,
            boundText: boundText as ExcalidrawTextElement,
          });
        }
      }
    }

    for (const { container, boundText } of boxesToRedraw.values()) {
      if (container.isDeleted || boundText.isDeleted) {
        // skip redraw if one of them is deleted, as it would not result in a meaningful redraw
        continue;
      }

      redrawTextBoundingBox(boundText, container, scene);
    }
  }

  private static redrawBoundArrows(
    scene: Scene,
    changed: Map<string, OrderedExcalidrawElement>,
  ) {
    for (const element of changed.values()) {
      if (!element.isDeleted && isBindableElement(element)) {
        updateBoundElements(element, scene, {
          changedElements: changed,
        });
      }
    }
  }

  private static reorderElements(
    elements: SceneElementsMap,
    changed: Map<string, OrderedExcalidrawElement>,
    flags: {
      containsVisibleDifference: boolean;
      containsZindexDifference: boolean;
    },
  ) {
    if (!flags.containsZindexDifference) {
      return elements;
    }

    const unordered = Array.from(elements.values());
    const ordered = orderByFractionalIndex([...unordered]);
    const moved = Delta.getRightDifferences(unordered, ordered, true).reduce(
      (acc, arrayIndex) => {
        const candidate = unordered[Number(arrayIndex)];
        if (candidate && changed.has(candidate.id)) {
          acc.set(candidate.id, candidate);
        }

        return acc;
      },
      new Map(),
    );

    if (!flags.containsVisibleDifference && moved.size) {
      // we found a difference in order!
      flags.containsVisibleDifference = true;
    }

    // synchronize all elements that were actually moved
    // could fallback to synchronizing all invalid indices
    return arrayToMap(syncMovedIndices(ordered, moved)) as typeof elements;
  }

  /**
   * It is necessary to post process the partials in case of reference values,
   * for which we need to calculate the real diff between `deleted` and `inserted`.
   */
  private static postProcess(
    deleted: ElementPartial,
    inserted: ElementPartial,
  ): [ElementPartial, ElementPartial] {
    try {
      Delta.diffArrays(deleted, inserted, "boundElements", (x) => x.id);
    } catch (e) {
      // if postprocessing fails, it does not make sense to bubble up, but let's make sure we know about it
      console.error(`Couldn't postprocess elements delta.`);

      if (isTestEnv() || isDevEnv()) {
        throw e;
      }
    } finally {
      return [deleted, inserted];
    }
  }

  private static stripIrrelevantProps(
    partial: Partial<OrderedExcalidrawElement>,
  ): ElementPartial {
    const { id, updated, version, versionNonce, ...strippedPartial } = partial;

    return strippedPartial;
  }
}
