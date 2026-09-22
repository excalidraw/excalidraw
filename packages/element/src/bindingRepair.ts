import { arrayToMap, cloneJSON } from "@excalidraw/common";

import type { GlobalPoint } from "@excalidraw/math";

import {
  bindBindingElement,
  calculateFixedPointForElbowArrowBinding,
  calculateFixedPointForNonElbowArrowBinding,
  getGlobalFixedPointForBindableElement,
  maxBindingDistance_simple,
  normalizeFixedPoint,
  recordBoundElement,
  unbindBindingElement,
  updateBoundPoint,
} from "./binding";
import { getHoveredElementForBinding, isPointInElement } from "./collision";
import { LinearElementEditor } from "./linearElementEditor";
import { Scene } from "./Scene";
import {
  isArrowElement,
  isBindableElement,
  isElbowArrow,
  isTextElement,
} from "./typeChecks";

import type {
  BindMode,
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  FixedPointBinding,
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Ordered,
  OrderedExcalidrawElement,
  PointsPositionUpdates,
} from "./types";

/**
 * The individual repairs `repairBindings()` can apply. Each action is
 * independent and can be selected through {@link RepairBindingsOptions.actions}.
 */
export type BindingRepairAction =
  // `startBinding`/`endBinding` pointing at an element that no longer exists or
  // is deleted: drop the binding on both sides.
  | "unbindDangling"
  // `boundElements` records on a bindable element that do not resolve to a live
  // element, or whose reverse half no longer points back: drop the record.
  | "pruneBoundElements"
  // duplicate `boundElements` entries sharing an id: keep the last one.
  | "dedupeBoundElements"
  // `mode`/`fixedPoint` missing or stale after the target moved: re-derive from
  // the current arrow endpoints.
  | "reanchorBindings"
  // binding on the arrow side with no matching `boundElements` record on the
  // target: add the record, so the container-side ledger is complete and the
  // arrow actually follows the target when it moves.
  | "linkBoundElements"
  // unbound endpoint that already touches a bindable element: create the
  // binding the generator forgot to declare.
  | "inferMissingBindings"
  // bound endpoint whose geometry does not sit on the target outline: project
  // it onto the outline, respecting the binding gap.
  | "snapToOutline";

export const ALL_BINDING_REPAIR_ACTIONS: readonly BindingRepairAction[] = [
  "unbindDangling",
  "pruneBoundElements",
  "dedupeBoundElements",
  "linkBoundElements",
  "inferMissingBindings",
  "reanchorBindings",
  "snapToOutline",
];

export interface RepairBindingsOptions {
  /**
   * Repairs to run, in the order given. Defaults to
   * {@link ALL_BINDING_REPAIR_ACTIONS} in their canonical order.
   */
  actions?: readonly BindingRepairAction[];
  /**
   * Restricts inference/re-anchoring to these arrow ids. Dangling and stale
   * records are still repaired scene-wide. Defaults to all arrows.
   */
  arrowIds?: readonly ExcalidrawElement["id"][];
  /**
   * Extra tolerance (scene units, added to the binding gap) used when deciding
   * whether an endpoint is close enough to a bindable element to bind it.
   * Defaults to 0.
   */
  tolerance?: number;
  /**
   * Reports bindings that could not be repaired through `console.warn`.
   * Defaults to true.
   */
  warn?: boolean;
}

const DEFAULT_TOLERANCE = 0;

/**
 * Per-end data for an arrow binding endpoint.
 * `pointIndex` is the absolute index into `points` (`-1` meaning last), and
 * `indexFromEnd` is the negative form `getPointAtIndexGlobalCoordinates`
 * accepts, so neither call site has to resolve `points.length` itself.
 */
const ENDPOINTS = {
  start: {
    startOrEnd: "start",
    bindingProp: "startBinding",
    pointIndex: 0,
    indexFromEnd: 0,
  },
  end: {
    startOrEnd: "end",
    bindingProp: "endBinding",
    pointIndex: -1,
    indexFromEnd: -1,
  },
} as const;

type Endpoint = typeof ENDPOINTS[keyof typeof ENDPOINTS];

const ENDPOINT_LIST: readonly Endpoint[] = [ENDPOINTS.start, ENDPOINTS.end];

/** Working state of a single repair run. */
type RepairState = {
  scene: Scene;
  elementsMap: ElementsMap;
  nonDeletedMap: NonDeletedSceneElementsMap;
  /** all live elements in z-order, resolved once per pass */
  all: () => readonly NonDeletedExcalidrawElement[];
  /** live arrows, resolved once per pass */
  arrows: () => NonDeleted<ExcalidrawArrowElement>[];
  /** live bindable elements, resolved once per pass */
  bindables: () => NonDeleted<ExcalidrawBindableElement>[];
  arrowIds: ReadonlySet<ExcalidrawElement["id"]> | null;
  tolerance: number;
  warn: boolean;
};

const isInScope = (state: RepairState, arrow: ExcalidrawElement): boolean =>
  state.arrowIds === null || state.arrowIds.has(arrow.id);

const report = (state: RepairState, message: string): void => {
  if (state.warn) {
    // eslint-disable-next-line no-console
    console.warn(`[repairBindings] ${message}`);
  }
};

/**
 * Invokes `visit` for each binding endpoint of each in-scope arrow.
 * `visit` may mutate the binding; iteration state is unaffected.
 */
const forEachBinding = (
  state: RepairState,
  visit: (
    arrow: NonDeleted<ExcalidrawArrowElement>,
    endpoint: Endpoint,
    binding: FixedPointBinding,
  ) => void,
): void => {
  for (const arrow of state.arrows()) {
    if (!isInScope(state, arrow)) {
      continue;
    }

    for (const endpoint of ENDPOINT_LIST) {
      const binding = arrow[endpoint.bindingProp];
      if (binding) {
        visit(arrow, endpoint, binding);
      }
    }
  }
};

/**
 * Resolves an existing binding's target, or null when it is missing or deleted.
 *
 * Includes locked targets: a lock must not break an already established
 * binding, and the repair has to keep its geometry correct. Only new
 * bindings honour the lock, via `findBindTarget`.
 */
const resolveTarget = (
  state: RepairState,
  binding: FixedPointBinding | null | undefined,
): NonDeleted<ExcalidrawBindableElement> | null => {
  if (!binding) {
    return null;
  }

  const target = state.nonDeletedMap.get(binding.elementId);

  return target && isBindableElement(target) ? target : null;
};

/** Whether `element` records a binding onto `bindableElementId`. */
const isBoundTo = (
  element: ExcalidrawElement,
  bindableElementId: ExcalidrawElement["id"],
): boolean => {
  if (isArrowElement(element)) {
    return (
      element.startBinding?.elementId === bindableElementId ||
      element.endBinding?.elementId === bindableElementId
    );
  }

  if (isTextElement(element)) {
    return element.containerId === bindableElementId;
  }

  return false;
};

/**
 * Drops `startBinding`/`endBinding` that point at elements absent from the
 * scene or marked deleted. A binding without a resolvable target cannot be
 * repaired, so the arrow is left unbound on that end and the drop is reported.
 */
const unbindDangling = (state: RepairState): void => {
  forEachBinding(state, (arrow, endpoint, binding) => {
    if (resolveTarget(state, binding)) {
      return;
    }

    report(
      state,
      `arrow "${arrow.id}" ${endpoint.startOrEnd} binding targets ` +
        `"${binding.elementId}", which is missing or deleted; unbinding`,
    );
    // `unbindBindingElement` tolerates a missing/deleted target, which is
    // exactly the case being repaired here
    unbindBindingElement(arrow, endpoint.startOrEnd, state.scene);
  });
};

/**
 * Drops `boundElements` records that do not resolve to a live element, or whose
 * reverse half no longer points back at the owner. This is the container-side
 * counterpart of {@link unbindDangling} and also covers containers still listing
 * a deleted arrow.
 */
const pruneBoundElements = (state: RepairState): void => {
  for (const bindable of state.bindables()) {
    if (!bindable.boundElements?.length) {
      continue;
    }

    const kept = bindable.boundElements.filter((boundElement) => {
      const bound = state.elementsMap.get(boundElement.id);

      const reason = !bound
        ? "is missing"
        : bound.isDeleted
        ? "is deleted"
        : !isBoundTo(bound, bindable.id)
        ? "no longer binds back"
        : null;

      if (!reason) {
        return true;
      }

      report(
        state,
        `bindable "${bindable.id}" lists bound element ` +
          `"${boundElement.id}", which ${reason}; dropping record`,
      );
      return false;
    });

    if (kept.length !== bindable.boundElements.length) {
      state.scene.mutateElement(bindable, { boundElements: kept });
    }
  }
};

/**
 * Removes duplicate `boundElements` entries sharing an id. The last entry wins,
 * matching `boundElementsVisitor`, where the most recently added arrow/text is
 * the one kept.
 */
const dedupeBoundElements = (state: RepairState): void => {
  for (const bindable of state.bindables()) {
    if (!bindable.boundElements?.length) {
      continue;
    }

    // keep the first occurrence of each id so the surviving order is stable;
    // duplicates share an id and type, so the retained entry is equivalent
    const seen = new Set<ExcalidrawElement["id"]>();

    const kept = bindable.boundElements.filter((boundElement) => {
      if (!seen.has(boundElement.id)) {
        seen.add(boundElement.id);
        return true;
      }

      report(
        state,
        `bindable "${bindable.id}" has duplicate boundElements entry ` +
          `"${boundElement.id}"; dropping duplicate`,
      );
      return false;
    });

    if (kept.length !== bindable.boundElements.length) {
      state.scene.mutateElement(bindable, { boundElements: kept });
    }
  }
};

/**
 * Adds the container-side `boundElements` record for every binding the arrow
 * declares but the target does not list. `pruneBoundElements` only ever
 * removes records and `inferMissingBindings` only handles endpoints with no
 * binding at all, so without this a binding declared by the generator and
 * absent from the target's ledger survives repair while `updateBoundElements`
 * ignores it: the arrow would never follow a moved target.
 *
 * Targets are resolved first, so `unbindDangling` keeps ownership of dangling
 * bindings; a locked target still gets its record, matching `resolveTarget`.
 */
const linkBoundElements = (state: RepairState): void => {
  forEachBinding(state, (arrow, _endpoint, binding) => {
    const target = resolveTarget(state, binding);

    if (!target) {
      return;
    }

    if (arrayToMap(target.boundElements || []).has(arrow.id)) {
      return;
    }

    // an arrow bound to the same target at both ends is visited twice but
    // `recordBoundElement` is idempotent, so it is recorded once
    recordBoundElement(target, arrow, state.scene);

    report(
      state,
      `arrow "${arrow.id}" binds to "${target.id}", which does not list ` +
        `it in boundElements; adding record`,
    );
  });
};

/**
 * Value equality for bindings, so a no-op re-derivation is not written and does
 * not bump the arrow's version. A binding missing `fixedPoint` is never equal to
 * a re-derived one, which is the incomplete-binding case being repaired.
 */
const isSameBinding = (a: FixedPointBinding, b: FixedPointBinding): boolean =>
  a.elementId === b.elementId &&
  a.mode === b.mode &&
  !!a.fixedPoint &&
  a.fixedPoint[0] === b.fixedPoint[0] &&
  a.fixedPoint[1] === b.fixedPoint[1];

/** Re-derives a binding's `fixedPoint` against its (possibly moved) target. */
const reanchorBinding = (
  state: RepairState,
  arrow: NonDeleted<ExcalidrawArrowElement>,
  endpoint: Endpoint,
  target: NonDeleted<ExcalidrawBindableElement>,
  binding: FixedPointBinding,
): FixedPointBinding => {
  if (isElbowArrow(arrow)) {
    return {
      ...binding,
      // Elbow arrows are always orbit-bound; `bindBindingElement` and
      // `getInferredBindMode` both enforce this. A generator that hallucinates
      // `mode: "inside"` would otherwise keep it, since `mode` is otherwise
      // preserved here. The mode does not change the final elbow route (the
      // points are re-routed by `updateElbowArrowPoints`), but the binding data
      // must not disagree with what every writer of elbow bindings produces.
      mode: "orbit",
      ...calculateFixedPointForElbowArrowBinding(
        arrow,
        target,
        endpoint.startOrEnd,
        state.nonDeletedMap,
      ),
    };
  }

  const focusPoint = getGlobalFixedPointForBindableElement(
    normalizeFixedPoint(binding.fixedPoint),
    target,
    state.nonDeletedMap,
  );

  return {
    ...binding,
    ...calculateFixedPointForNonElbowArrowBinding(
      arrow,
      target,
      endpoint.startOrEnd,
      state.nonDeletedMap,
      focusPoint,
    ),
  };
};

/**
 * Re-derives `mode`/`fixedPoint` for every binding so endpoints follow their
 * targets. Covers both a moved target and a binding the generator wrote
 * incompletely (missing `fixedPoint`).
 */
const reanchorBindings = (state: RepairState): void => {
  forEachBinding(state, (arrow, endpoint, binding) => {
    const target = resolveTarget(state, binding);

    // dangling bindings are handled by `unbindDangling`
    if (!target) {
      return;
    }

    const next = reanchorBinding(state, arrow, endpoint, target, binding);

    // bindings are compared by value, so a re-derivation that lands on the same
    // result does not bump the arrow's version and churn collaborators/history
    if (isSameBinding(binding, next)) {
      return;
    }

    state.scene.mutateElement(arrow, { [endpoint.bindingProp]: next });
  });
};

/**
 * Moves bound endpoints back onto their target outline by recomputing each
 * endpoint's local position with `updateBoundPoint`.
 */
const snapToOutline = (state: RepairState): void => {
  for (const arrow of state.arrows()) {
    if (!isInScope(state, arrow)) {
      continue;
    }

    const pointUpdates: PointsPositionUpdates = new Map();

    for (const endpoint of ENDPOINT_LIST) {
      const binding = arrow[endpoint.bindingProp];
      const target = resolveTarget(state, binding);

      if (!binding || !target) {
        continue;
      }

      const nextPoint = updateBoundPoint(
        arrow,
        endpoint.bindingProp,
        binding,
        target,
        state.nonDeletedMap,
      );

      if (nextPoint) {
        const index =
          endpoint.pointIndex < 0
            ? arrow.points.length + endpoint.pointIndex
            : endpoint.pointIndex;

        pointUpdates.set(index, { point: nextPoint });
      }
    }

    if (pointUpdates.size) {
      LinearElementEditor.movePoints(arrow, state.scene, pointUpdates);
    }
  }
};

/**
 * Decides `inside` vs `orbit` for a freshly inferred binding, mirroring the
 * editor: points inside a bindable element bind to its interior, points outside
 * orbit its outline.
 */
const getInferredBindMode = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  target: NonDeleted<ExcalidrawBindableElement>,
  point: GlobalPoint,
  elementsMap: ElementsMap,
): BindMode => {
  if (isElbowArrow(arrow)) {
    return "orbit";
  }

  return isPointInElement(point, target, elementsMap) ? "inside" : "orbit";
};

/** Global coordinates of an endpoint. */
const endpointGlobalPoint = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  endpoint: Endpoint,
  elementsMap: ElementsMap,
): GlobalPoint =>
  LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrow,
    endpoint.indexFromEnd,
    elementsMap,
  );

/** Finds the bindable element an endpoint should attach to. */
const findBindTarget = (
  state: RepairState,
  arrow: NonDeleted<ExcalidrawArrowElement>,
  point: GlobalPoint,
): NonDeleted<ExcalidrawBindableElement> | null => {
  // Same reach the editor uses while dragging an endpoint, so a generated
  // arrow whose endpoint lands near an outline binds just as it would by hand.
  // `tolerance` is caller-supplied extra slack on top of that.
  const tolerance = maxBindingDistance_simple() + state.tolerance;

  const hit = getHoveredElementForBinding(
    point,
    // hit-testing needs every element, not just arrows or bindables: it walks
    // the z-order and stops at the first opaque fill
    state.all() as readonly Ordered<NonDeletedExcalidrawElement>[],
    state.nonDeletedMap,
    tolerance,
  );

  // an arrow never binds to itself
  return hit && hit.id !== arrow.id ? hit : null;
};

/**
 * Creates bindings for endpoints that geometrically touch a bindable element
 * but carry no binding.
 */
const inferMissingBindings = (state: RepairState): void => {
  for (const arrow of state.arrows()) {
    if (!isInScope(state, arrow)) {
      continue;
    }

    if (arrow.points.length < 2) {
      report(
        state,
        `arrow "${arrow.id}" has fewer than 2 points; ` +
          `cannot infer bindings`,
      );
      continue;
    }

    for (const endpoint of ENDPOINT_LIST) {
      if (arrow[endpoint.bindingProp]) {
        continue;
      }

      const point = endpointGlobalPoint(arrow, endpoint, state.nonDeletedMap);
      const target = findBindTarget(state, arrow, point);

      if (!target) {
        continue;
      }

      const mode = getInferredBindMode(
        arrow,
        target,
        point,
        state.nonDeletedMap,
      );

      bindBindingElement(
        arrow,
        target,
        mode,
        endpoint.startOrEnd,
        state.scene,
        point,
      );
    }
  }
};

const ACTION_IMPL: Record<BindingRepairAction, (state: RepairState) => void> = {
  unbindDangling,
  pruneBoundElements,
  dedupeBoundElements,
  linkBoundElements,
  reanchorBindings,
  snapToOutline,
  inferMissingBindings,
};

/**
 * Repairs arrow bindings, bound-element records (`boundElements`) and binding
 * geometry for a scene.
 *
 * Binding repair is inherently scene-wide: hit-testing picks among all candidate
 * bindables, dangling detection compares both halves of a relationship, and
 * every write touches the arrow and its target. The whole element array is
 * therefore the input, and the whole array is returned.
 *
 * The input is never mutated: elements are cloned with `cloneJSON` and repaired
 * on an internal `Scene`. Bindings that cannot be repaired are dropped and
 * reported through `console.warn` (see {@link RepairBindingsOptions.warn}); a
 * half-applied binding is never left behind.
 *
 * The internal `Scene` is what makes the `ordered` return type honest: it
 * normalizes missing or invalid fractional indices, so callers needing a valid
 * z-order (including the common case of generator output with `index: null`)
 * can use the result directly.
 *
 * @example
 * ```ts
 * const fixedElements = repairBindings(elements, { tolerance: 4 });
 * ```
 */
export const repairBindings = (
  elements: readonly ExcalidrawElement[],
  opts?: RepairBindingsOptions,
): OrderedExcalidrawElement[] => {
  if (!elements.length) {
    return [];
  }

  const scene = new Scene(cloneJSON(elements) as ExcalidrawElement[], {
    skipValidation: true,
  });

  /**
   * Element scans are memoized per pass: a pass invalidates the cache before
   * running so it never observes a list left stale by an earlier pass, while
   * the scans within one pass are shared.
   */
  let cache: {
    all: readonly NonDeletedExcalidrawElement[];
    arrows: NonDeleted<ExcalidrawArrowElement>[];
    bindables: NonDeleted<ExcalidrawBindableElement>[];
  } | null = null;

  const liveElements = () => {
    if (!cache) {
      const all =
        scene.getNonDeletedElements() as readonly NonDeletedExcalidrawElement[];
      cache = {
        all,
        // Deliberately `isArrowElement`, not `isBindingElement`: the latter also
        // requires `!locked`, because the editor uses it to decide whether an
        // arrow is eligible for *interactive* binding. Repair is not an
        // interaction, and a locked arrow can still carry broken binding data.
        arrows: all.filter(
          (element): element is NonDeleted<ExcalidrawArrowElement> =>
            isArrowElement(element),
        ),
        bindables: all.filter(
          (element): element is NonDeleted<ExcalidrawBindableElement> =>
            isBindableElement(element),
        ),
      };
    }

    return cache;
  };

  const state: RepairState = {
    scene,
    elementsMap: scene.getElementsMapIncludingDeleted(),
    nonDeletedMap: scene.getNonDeletedElementsMap(),
    all: () => liveElements().all,
    arrows: () => liveElements().arrows,
    bindables: () => liveElements().bindables,
    arrowIds: opts?.arrowIds ? new Set(opts.arrowIds) : null,
    tolerance: opts?.tolerance ?? DEFAULT_TOLERANCE,
    warn: opts?.warn !== false,
  };

  for (const action of opts?.actions ?? ALL_BINDING_REPAIR_ACTIONS) {
    cache = null;
    ACTION_IMPL[action](state);
  }

  return scene.getElementsIncludingDeleted() as OrderedExcalidrawElement[];
};
