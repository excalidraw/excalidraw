import { Delta } from "../common/delta";
import {
  assertNever,
  getNonDeletedGroupIds,
  getObservedAppState,
  isDevEnv,
  isTestEnv,
  shouldThrow,
} from "../common/utils";

import type { DeltaContainer } from "../common/interfaces";
import type {
  AppState,
  ObservedAppState,
  DTO,
  SceneElementsMap,
  ValueOf,
  ObservedElementsAppState,
  ObservedStandaloneAppState,
  SubtypeOf,
} from "../excalidraw-types";

export class AppStateDelta implements DeltaContainer<AppState> {
  private constructor(public readonly delta: Delta<ObservedAppState>) {}

  public static calculate<T extends ObservedAppState>(
    prevAppState: T,
    nextAppState: T,
  ): AppStateDelta {
    const delta = Delta.calculate(
      prevAppState,
      nextAppState,
      undefined,
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

      //   const selectedLinearElement =
      //     selectedLinearElementId && nextElements.has(selectedLinearElementId)
      //       ? new LinearElementEditor(
      //           nextElements.get(
      //             selectedLinearElementId,
      //           ) as NonDeleted<ExcalidrawLinearElement>,
      //         )
      //       : null;

      //   const editingLinearElement =
      //     editingLinearElementId && nextElements.has(editingLinearElementId)
      //       ? new LinearElementEditor(
      //           nextElements.get(
      //             editingLinearElementId,
      //           ) as NonDeleted<ExcalidrawLinearElement>,
      //         )
      //       : null;

      const nextAppState = {
        ...appState,
        ...directlyApplicablePartial,
        selectedElementIds: mergedSelectedElementIds,
        selectedGroupIds: mergedSelectedGroupIds,
        // selectedLinearElement:
        //   typeof selectedLinearElementId !== "undefined"
        //     ? selectedLinearElement // element was either inserted or deleted
        //     : appState.selectedLinearElement, // otherwise assign what we had before
        // editingLinearElement:
        //   typeof editingLinearElementId !== "undefined"
        //     ? editingLinearElement // element was either inserted or deleted
        //     : appState.editingLinearElement, // otherwise assign what we had before
      };

      const constainsVisibleChanges = this.filterInvisibleChanges(
        appState,
        nextAppState,
        nextElements,
      );

      return [nextAppState, constainsVisibleChanges];
    } catch (e) {
      // shouldn't really happen, but just in case
      console.error(`Couldn't apply appstate delta`, e);

      if (shouldThrow()) {
        throw e;
      }

      return [appState, false];
    }
  }

  public isEmpty(): boolean {
    return Delta.isEmpty(this.delta);
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

      if (isDevEnv() || isTestEnv()) {
        throw e;
      }
    } finally {
      return [deleted, inserted];
    }
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
            assertNever(key, `Unknown ObservedElementsAppState's key "${key}"`);
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
}
