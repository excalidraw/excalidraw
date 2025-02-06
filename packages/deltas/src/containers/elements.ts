import { Delta } from "../common/delta";
import { elementsToMap, newElementWith, shouldThrow } from "../common/utils";

import type { DeltaContainer } from "../common/interfaces";
import type {
  ExcalidrawElement,
  ElementUpdate,
  Ordered,
  SceneElementsMap,
  DTO,
  OrderedExcalidrawElement,
  ExcalidrawImageElement,
} from "../excalidraw-types";

// CFDO: consider adding here (nonnullable) version & versionNonce & updated (so that we have correct versions when recunstructing from remote)
type ElementPartial<T extends ExcalidrawElement = ExcalidrawElement> =
  ElementUpdate<Ordered<T>>;

/**
 * Elements delta is a low level primitive to encapsulate property changes between two sets of elements.
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
      // CFDO: don't forget to re-enable
    },
  ) {
    const { shouldRedistribute } = options;
    let delta: ElementsDelta;

    if (shouldRedistribute) {
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

    if (shouldThrow()) {
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
    // notice we force generate a new id
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

  // CFDO: does it make sense having a separate snapshot?
  public applyTo(
    elements: SceneElementsMap,
    elementsSnapshot: Map<string, OrderedExcalidrawElement>,
  ): [SceneElementsMap, boolean] {
    const nextElements = new Map(elements) as SceneElementsMap;
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

      // CFDO I: don't forget to fix this part
      // const affectedElements = this.resolveConflicts(elements, nextElements);

      // TODO: #7348 validate elements semantically and syntactically the changed elements, in case they would result data integrity issues
      changedElements = new Map([
        ...addedElements,
        ...removedElements,
        ...updatedElements,
        // ...affectedElements,
      ]);
    } catch (e) {
      console.error(`Couldn't apply elements delta`, e);

      if (shouldThrow()) {
        throw e;
      }

      // should not really happen, but just in case we cannot apply deltas, let's return the previous elements with visible change set to `true`
      // even though there is obviously no visible change, returning `false` could be dangerous, as i.e.:
      // in the worst case, it could lead into iterating through the whole stack with no possibility to redo
      // instead, the worst case when returning `true` is an empty undo / redo
      return [elements, true];
    }

    try {
      // CFDO I: don't forget to fix this part
      // // TODO: #7348 refactor away mutations below, so that we couldn't end up in an incosistent state
      // ElementsDelta.redrawTextBoundingBoxes(nextElements, changedElements);
      // // the following reorder performs also mutations, but only on new instances of changed elements
      // // (unless something goes really bad and it fallbacks to fixing all invalid indices)
      // nextElements = ElementsDelta.reorderElements(
      //   nextElements,
      //   changedElements,
      //   flags,
      // );
      // // Need ordered nextElements to avoid z-index binding issues
      // ElementsDelta.redrawBoundArrows(nextElements, changedElements);
    } catch (e) {
      console.error(
        `Couldn't mutate elements after applying elements change`,
        e,
      );

      if (shouldThrow()) {
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
        } else if (type === "added") {
          // for additions the element does not have to exist (i.e. remote update)
          // CFDO II: the version itself might be different!
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

    // CFDO: this looks wrong
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

  // /**
  //  * Resolves conflicts for all previously added, removed and updated elements.
  //  * Updates the previous deltas with all the changes after conflict resolution.
  //  *
  //  * // CFDO: revisit since arrow seem often redrawn incorrectly
  //  *
  //  * @returns all elements affected by the conflict resolution
  //  */
  // private resolveConflicts(
  //   prevElements: SceneElementsMap,
  //   nextElements: SceneElementsMap,
  // ) {
  //   const nextAffectedElements = new Map<string, OrderedExcalidrawElement>();
  //   const updater = (
  //     element: ExcalidrawElement,
  //     updates: ElementUpdate<ExcalidrawElement>,
  //   ) => {
  //     const nextElement = nextElements.get(element.id); // only ever modify next element!
  //     if (!nextElement) {
  //       return;
  //     }

  //     let affectedElement: OrderedExcalidrawElement;

  //     if (prevElements.get(element.id) === nextElement) {
  //       // create the new element instance in case we didn't modify the element yet
  //       // so that we won't end up in an incosistent state in case we would fail in the middle of mutations
  //       affectedElement = newElementWith(
  //         nextElement,
  //         updates as ElementUpdate<OrderedExcalidrawElement>,
  //       );
  //     } else {
  //       affectedElement = mutateElement(
  //         nextElement,
  //         updates as ElementUpdate<OrderedExcalidrawElement>,
  //       );
  //     }

  //     nextAffectedElements.set(affectedElement.id, affectedElement);
  //     nextElements.set(affectedElement.id, affectedElement);
  //   };

  //   // removed delta is affecting the bindings always, as all the affected elements of the removed elements need to be unbound
  //   for (const id of Object.keys(this.removed)) {
  //     ElementsDelta.unbindAffected(prevElements, nextElements, id, updater);
  //   }

  //   // added delta is affecting the bindings always, all the affected elements of the added elements need to be rebound
  //   for (const id of Object.keys(this.added)) {
  //     ElementsDelta.rebindAffected(prevElements, nextElements, id, updater);
  //   }

  //   // updated delta is affecting the binding only in case it contains changed binding or bindable property
  //   for (const [id] of Array.from(Object.entries(this.updated)).filter(
  //     ([_, delta]) =>
  //       Object.keys({ ...delta.deleted, ...delta.inserted }).find((prop) =>
  //         bindingProperties.has(prop as BindingProp | BindableProp),
  //       ),
  //   )) {
  //     const updatedElement = nextElements.get(id);
  //     if (!updatedElement || updatedElement.isDeleted) {
  //       // skip fixing bindings for updates on deleted elements
  //       continue;
  //     }

  //     ElementsDelta.rebindAffected(prevElements, nextElements, id, updater);
  //   }

  //   // filter only previous elements, which were now affected
  //   const prevAffectedElements = new Map(
  //     Array.from(prevElements).filter(([id]) => nextAffectedElements.has(id)),
  //   );

  //   // calculate complete deltas for affected elements, and assign them back to all the deltas
  //   // technically we could do better here if perf. would become an issue
  //   const { added, removed, updated } = ElementsDelta.calculate(
  //     prevAffectedElements,
  //     nextAffectedElements,
  //   );

  //   for (const [id, delta] of Object.entries(added)) {
  //     this.added[id] = delta;
  //   }

  //   for (const [id, delta] of Object.entries(removed)) {
  //     this.removed[id] = delta;
  //   }

  //   for (const [id, delta] of Object.entries(updated)) {
  //     this.updated[id] = delta;
  //   }

  //   return nextAffectedElements;
  // }

  // /**
  //  * Non deleted affected elements of removed elements (before and after applying delta),
  //  * should be unbound ~ bindings should not point from non deleted into the deleted element/s.
  //  */
  // private static unbindAffected(
  //   prevElements: SceneElementsMap,
  //   nextElements: SceneElementsMap,
  //   id: string,
  //   updater: (
  //     element: ExcalidrawElement,
  //     updates: ElementUpdate<ExcalidrawElement>,
  //   ) => void,
  // ) {
  //   // the instance could have been updated, so make sure we are passing the latest element to each function below
  //   const prevElement = () => prevElements.get(id); // element before removal
  //   const nextElement = () => nextElements.get(id); // element after removal

  //   BoundElement.unbindAffected(nextElements, prevElement(), updater);
  //   BoundElement.unbindAffected(nextElements, nextElement(), updater);

  //   BindableElement.unbindAffected(nextElements, prevElement(), updater);
  //   BindableElement.unbindAffected(nextElements, nextElement(), updater);
  // }

  // /**
  //  * Non deleted affected elements of added or updated element/s (before and after applying delta),
  //  * should be rebound (if possible) with the current element ~ bindings should be bidirectional.
  //  */
  // private static rebindAffected(
  //   prevElements: SceneElementsMap,
  //   nextElements: SceneElementsMap,
  //   id: string,
  //   updater: (
  //     element: ExcalidrawElement,
  //     updates: ElementUpdate<ExcalidrawElement>,
  //   ) => void,
  // ) {
  //   // the instance could have been updated, so make sure we are passing the latest element to each function below
  //   const prevElement = () => prevElements.get(id); // element before addition / update
  //   const nextElement = () => nextElements.get(id); // element after addition / update

  //   BoundElement.unbindAffected(nextElements, prevElement(), updater);
  //   BoundElement.rebindAffected(nextElements, nextElement(), updater);

  //   BindableElement.unbindAffected(
  //     nextElements,
  //     prevElement(),
  //     (element, updates) => {
  //       // we cannot rebind arrows with bindable element so we don't unbind them at all during rebind (we still need to unbind them on removal)
  //       // TODO: #7348 add startBinding / endBinding to the `BoundElement` context so that we could rebind arrows and remove this condition
  //       if (isTextElement(element)) {
  //         updater(element, updates);
  //       }
  //     },
  //   );
  //   BindableElement.rebindAffected(nextElements, nextElement(), updater);
  // }

  // private static redrawTextBoundingBoxes(
  //   elements: SceneElementsMap,
  //   changed: Map<string, OrderedExcalidrawElement>,
  // ) {
  //   const boxesToRedraw = new Map<
  //     string,
  //     { container: OrderedExcalidrawElement; boundText: ExcalidrawTextElement }
  //   >();

  //   for (const element of changed.values()) {
  //     if (isBoundToContainer(element)) {
  //       const { containerId } = element as ExcalidrawTextElement;
  //       const container = containerId ? elements.get(containerId) : undefined;

  //       if (container) {
  //         boxesToRedraw.set(container.id, {
  //           container,
  //           boundText: element as ExcalidrawTextElement,
  //         });
  //       }
  //     }

  //     if (hasBoundTextElement(element)) {
  //       const boundTextElementId = getBoundTextElementId(element);
  //       const boundText = boundTextElementId
  //         ? elements.get(boundTextElementId)
  //         : undefined;

  //       if (boundText) {
  //         boxesToRedraw.set(element.id, {
  //           container: element,
  //           boundText: boundText as ExcalidrawTextElement,
  //         });
  //       }
  //     }
  //   }

  //   for (const { container, boundText } of boxesToRedraw.values()) {
  //     if (container.isDeleted || boundText.isDeleted) {
  //       // skip redraw if one of them is deleted, as it would not result in a meaningful redraw
  //       continue;
  //     }

  //     redrawTextBoundingBox(boundText, container, elements, false);
  //   }
  // }

  // private static redrawBoundArrows(
  //   elements: SceneElementsMap,
  //   changed: Map<string, OrderedExcalidrawElement>,
  // ) {
  //   for (const element of changed.values()) {
  //     if (!element.isDeleted && isBindableElement(element)) {
  //       updateBoundElements(element, elements, {
  //         changedElements: changed,
  //       });
  //     }
  //   }
  // }

  // private static reorderElements(
  //   elements: SceneElementsMap,
  //   changed: Map<string, OrderedExcalidrawElement>,
  //   flags: {
  //     containsVisibleDifference: boolean;
  //     containsZindexDifference: boolean;
  //   },
  // ) {
  //   if (!flags.containsZindexDifference) {
  //     return elements;
  //   }

  //   const unordered = Array.from(elements.values());
  //   const ordered = orderByFractionalIndex([...unordered]);
  //   const moved = Delta.getRightDifferences(unordered, ordered, true).reduce(
  //     (acc, arrayIndex) => {
  //       const candidate = unordered[Number(arrayIndex)];
  //       if (candidate && changed.has(candidate.id)) {
  //         acc.set(candidate.id, candidate);
  //       }

  //       return acc;
  //     },
  //     new Map(),
  //   );

  //   if (!flags.containsVisibleDifference && moved.size) {
  //     // we found a difference in order!
  //     flags.containsVisibleDifference = true;
  //   }

  //   // synchronize all elements that were actually moved
  //   // could fallback to synchronizing all invalid indices
  //   return elementsToMap(syncMovedIndices(ordered, moved)) as typeof elements;
  // }

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

      if (shouldThrow()) {
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
