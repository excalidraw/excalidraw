import {
  debounce,
  easeOut,
  isBounds,
  type Bounds,
  type StylesPanelMode,
} from "@excalidraw/common";
import { clamp } from "@excalidraw/math";

import {
  getCommonBounds,
  getElementsInGroup,
  isElementLink,
  isExcalidrawElement,
  parseElementLinkFromURL,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { getLanguage, t } from "../i18n";
import { AnimationController } from "../renderer/animation";
import {
  constrainScrollState,
  DEFAULT_OVERSCROLL,
  type SetViewportOptions,
  type SetViewportRect,
  zoomToFitBounds,
} from "../viewport";

import type {
  AppProps,
  AppState,
  NormalizedZoomValue,
  Offsets,
  ScrollConstraints,
  ViewportOffsets,
  ViewportOffsetsOptions,
  ViewportUIDock,
  ViewportUIName,
} from "../types";
import type App from "./App";

export const SCROLL_TO_CONTENT_ANIMATION_KEY = "animateScrollToContent";
export const SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY =
  "animateScrollConstraintsSnapBack";

const DEFAULT_SCROLL_ANIMATION_DURATION = 500;

/** rubberband snap-back animation duration, in ms — kept snappier than the
 * default scroll animation so releasing an overscroll feels responsive */
const SNAP_BACK_ANIMATION_DURATION = 250;

/** how long after the last pan/zoom we animate the rubberband back into the
 * scroll constraints box */
const SCROLL_CONSTRAINTS_SNAP_BACK_DELAY = 200;

/** single source of truth for the `--right-sidebar-width` CSS variable */
export const RIGHT_SIDEBAR_WIDTH = 302;

/**
 * Approximate styles panel footprints (panel width + editor edge inset),
 * used by `getOffsets` to reserve space for the panel before it was ever
 * rendered (= measured). Keep roughly in sync with the CSS
 * (`.App-menu__left` width / `.compact-shape-actions-island` min-width +
 * `--editor-container-padding`).
 */
const STYLES_PANEL_APPROX_WIDTH = { full: 216, compact: 64 };

type Viewport = Pick<AppState, "scrollX" | "scrollY" | "zoom">;

const isSetViewportRect = (target: unknown): target is SetViewportRect => {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return false;
  }

  const rect = target as Partial<SetViewportRect>;
  return (
    typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    (rect.width == null || typeof rect.width === "number") &&
    (rect.height == null || typeof rect.height === "number")
  );
};

const getElementsFromId = (
  id: string,
  elementsMap: NonDeletedSceneElementsMap,
) => {
  const element = elementsMap.get(id);
  if (element) {
    return [element];
  }

  return getElementsInGroup(elementsMap, id);
};

type ResolvedViewportTarget = {
  /** null when the target couldn't be resolved (unknown id/link, or all
   * supplied elements deleted) */
  bounds: Bounds | null;
  /** how the target was specified, so callers can react to unresolved
   * targets themselves (e.g. toast on a broken element link) */
  type: "element" | "area" | "link";
};

/** Resolves a `setViewport` target to a scene-coordinate box. */
const resolveViewportTarget = (
  target: SetViewportOptions["target"],
  elementsMap: NonDeletedSceneElementsMap,
  appState: Pick<AppState, "width" | "height">,
): ResolvedViewportTarget => {
  if (typeof target === "string") {
    const isLink = isElementLink(target);
    const type = isLink ? ("link" as const) : ("element" as const);
    const id = isLink ? parseElementLinkFromURL(target) : target;
    const resolved = id ? getElementsFromId(id, elementsMap) : [];

    if (!resolved.length) {
      return { bounds: null, type };
    }

    return { bounds: getCommonBounds(resolved, elementsMap), type };
  }

  if (isBounds(target)) {
    return { bounds: target, type: "area" };
  }

  if (isSetViewportRect(target) && !isExcalidrawElement(target)) {
    const width = target.width ?? appState.width;
    const height = target.height ?? appState.height;
    return {
      bounds: [target.x, target.y, target.x + width, target.y + height],
      type: "area",
    };
  }

  // widening to null values in case the host app doesn't have
  // noUncheckedIndexedAccess enabled
  const targetElements: (ExcalidrawElement | undefined | null)[] =
    Array.isArray(target) ? target : [target];
  const elements = targetElements.reduce<NonDeleted<ExcalidrawElement>[]>(
    (acc, element) => {
      if (element && !element.isDeleted) {
        const sceneElement = elementsMap.get(element.id);
        if (sceneElement) {
          acc.push(sceneElement);
        }
      }
      return acc;
    },
    [],
  );

  const hasNoElements = !elements.length;
  if (elements.length !== targetElements.length || hasNoElements) {
    console.warn(
      "supplied element target(s) for setViewport contain deleted or non-existent elements which have been filtered out",
    );
  }

  if (hasNoElements) {
    return { bounds: null, type: "element" };
  }

  return { bounds: getCommonBounds(elements, elementsMap), type: "element" };
};

const resolveOverscroll = (
  overscroll: boolean | number | undefined,
): number => {
  if (overscroll === false) {
    return 0;
  }
  if (overscroll === true || overscroll == null) {
    return DEFAULT_OVERSCROLL;
  }
  return Math.max(overscroll, 0);
};

/** Computes the viewport (scroll + zoom) that brings the target box into view,
 * based on the requested fit behavior. */
const getTargetViewport = (
  state: AppState,
  bounds: Bounds,
  fit: SetViewportOptions["fit"] = "scale-down",
  offsets?: Offsets,
): Viewport => {
  const { appState } = zoomToFitBounds({
    bounds,
    appState: state,
    fit,
    canvasOffsets: offsets,
    steppedZoom: false,
  });

  return {
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
  };
};

/** Computes the viewport patch for landing on `bounds`: the target
 * scroll/zoom, plus the scroll lock to install — or `scrollConstraints: null`
 * to clear a previous lock when none is requested. */
const getConstrainedTargetViewport = (
  appState: AppState,
  bounds: Bounds,
  // NOTE offsets must be resolved (see `AppViewport.resolveOffsets`)
  {
    fit,
    offsets,
    lock,
  }: Pick<SetViewportOptions, "fit" | "lock"> & { offsets?: Offsets },
): Viewport & { scrollConstraints: ScrollConstraints | null } => {
  const viewport = getTargetViewport(appState, bounds, fit, offsets);

  if (!lock?.scroll && !lock?.zoom) {
    return { ...viewport, scrollConstraints: null };
  }

  const [x1, y1, x2, y2] = bounds;
  const scrollConstraints: ScrollConstraints = {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    lockScroll: !!lock.scroll,
    lockZoom: !!lock.zoom,
    zoom: viewport.zoom.value,
    overscroll: resolveOverscroll(lock.overscroll),
    offsets,
  };

  return {
    ...constrainScrollState({ ...appState, ...viewport, scrollConstraints }),
    scrollConstraints,
  };
};

/**
 * Interpolates the viewport from `from` to `target` at the (already-eased)
 * blend amount `factor` (0 = `from`, 1 = `target`).
 *
 * Zoom is interpolated geometrically (so it feels uniform), but the pan can't
 * simply lerp alongside it: pairing a geometric zoom with a linear scroll (or
 * a linearly-tweened focal point) makes scene points swoop along curved,
 * non-monotone screen paths once the zoom ratio exceeds ~e (the destination
 * visibly drifts away before converging). Instead we interpolate the view
 * transform affinely — a scene point maps to screen as
 * `(scenePt + scroll) * zoom`, and requiring every point to travel a straight
 * screen line forces `zoom` to be a convex blend `(1-m)*z0 + m*z1` with
 * `scroll * zoom` lerped by that same weight. Deriving `m` from the geometric
 * zoom keeps its pacing while making all screen trajectories straight and
 * monotone.
 */
const interpolateViewport = ({
  from,
  target,
  factor,
}: {
  from: Viewport;
  target: Viewport;
  factor: number;
}): Viewport => {
  if (factor >= 1) {
    // land bit-exactly on the target (`z0 * (z1/z0)^1` can be off by an ulp)
    return { ...target };
  }

  const zoom = (from.zoom.value *
    Math.pow(
      target.zoom.value / from.zoom.value,
      factor,
    )) as NormalizedZoomValue;

  // pan blend weight derived from the zoom blend (0/0 for pure pans, hence
  // the `factor` fallback; near-equal zooms are fine — the ratio limits to
  // `factor` smoothly)
  const m =
    target.zoom.value === from.zoom.value
      ? factor
      : (zoom - from.zoom.value) / (target.zoom.value - from.zoom.value);

  return {
    scrollX:
      ((1 - m) * from.scrollX * from.zoom.value +
        m * target.scrollX * target.zoom.value) /
      zoom,
    scrollY:
      ((1 - m) * from.scrollY * from.zoom.value +
        m * target.scrollY * target.zoom.value) /
      zoom,
    zoom: { value: zoom },
  };
};

type AppViewportDependencies = {
  getContainer: () => HTMLDivElement | null;
  getStylesPanelMode: () => StylesPanelMode;
  isGestureActive: () => boolean;
};

const resolveAnimationDuration = (
  animation: SetViewportOptions["animation"],
): number | null => {
  if (animation === false) {
    return null;
  }
  if (animation === true || animation == null) {
    return DEFAULT_SCROLL_ANIMATION_DURATION;
  }
  return animation.duration ?? DEFAULT_SCROLL_ANIMATION_DURATION;
};

/** Eases the viewport from its current position to `target` over `duration`,
 * driving the transition through the shared AnimationController so it doesn't
 * slow down other processes. */
const animateToViewport = (
  from: Viewport,
  target: Viewport,
  duration: number,
  onFrame: (
    state: Pick<
      AppState,
      "scrollX" | "scrollY" | "zoom" | "shouldCacheIgnoreZoom"
    >,
  ) => void,
  onComplete: () => void,
) => {
  AnimationController.start<{ elapsed: number }>(
    SCROLL_TO_CONTENT_ANIMATION_KEY,
    ({ deltaTime, state }) => {
      const elapsed = (state?.elapsed ?? 0) + deltaTime;
      const progress = Math.min(elapsed / duration, 1);
      const factor = easeOut(clamp(progress, 0, 1));

      if (progress < 1) {
        onFrame({
          ...interpolateViewport({ from, target, factor }),
          shouldCacheIgnoreZoom: true,
        });
        return { elapsed };
      }

      onComplete();

      return null;
    },
  );
};

/**
 * Rubberband snap-back: animates the viewport from its current (possibly
 * overscrolled) position back inside the lock box via the shared
 * AnimationController. No-op when already within the hard bounds (or when
 * there is no lock).
 */
export const snapBackToConstraints = (
  state: Pick<
    AppState,
    "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
  >,
  onFrame: (
    updater: (
      state: Pick<
        AppState,
        | "scrollX"
        | "scrollY"
        | "zoom"
        | "width"
        | "height"
        | "scrollConstraints"
      >,
    ) => Viewport | null,
  ) => void,
  duration = SNAP_BACK_ANIMATION_DURATION,
) => {
  const target = constrainScrollState(state);

  if (
    target.scrollX === state.scrollX &&
    target.scrollY === state.scrollY &&
    target.zoom.value === state.zoom.value
  ) {
    return;
  }

  // A programmatic navigation owns the viewport until it settles. A stale
  // rubberband debounce must not supersede it.
  if (AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)) {
    return;
  }

  // Keep the displacement zoom-independent. Each animation frame resolves
  // the resting viewport from the latest state, allowing zoom to update the
  // underlying viewport while the same on-screen rubberband distance decays.
  const overscrollX = (state.scrollX - target.scrollX) * state.zoom.value;
  const overscrollY = (state.scrollY - target.scrollY) * state.zoom.value;

  AnimationController.start<{ elapsed: number }>(
    SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY,
    ({ deltaTime, state: animationState }) => {
      const elapsed = (animationState?.elapsed ?? 0) + deltaTime;
      const progress = Math.min(elapsed / duration, 1);
      const remaining = 1 - easeOut(clamp(progress, 0, 1));

      onFrame((currentState) => {
        if (!currentState.scrollConstraints) {
          return null;
        }

        const restingViewport = constrainScrollState(currentState);
        const zoom = restingViewport.zoom.value;
        return {
          scrollX: restingViewport.scrollX + (overscrollX * remaining) / zoom,
          scrollY: restingViewport.scrollY + (overscrollY * remaining) / zoom,
          zoom: restingViewport.zoom,
        };
      });

      return progress < 1 ? { elapsed } : null;
    },
  );
};

/**
 * Owns viewport state transitions and App-bound viewport concerns. Pure
 * viewport geometry remains in `viewport.ts` so actions and public helpers can
 * calculate state without an App instance.
 */
export class AppViewport {
  public lastPosition = { x: 0, y: 0 };

  private activeTransition: {
    target: Viewport & Pick<AppState, "scrollConstraints">;
  } | null = null;

  private uiLastMeasured = new Map<
    ViewportUIName,
    { side: "left" | "right"; offset: number }
  >();

  constructor(
    private app: App,
    private dependencies: AppViewportDependencies,
  ) {}

  get isAnimating() {
    return (
      AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY) ||
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY)
    );
  }

  /** Whether a programmatic transition into a locked viewport currently owns
   * user pan/zoom input. */
  get isLockedTransitionPending() {
    return !!this.activeTransition?.target.scrollConstraints;
  }

  invalidateUIOffset = (name: ViewportUIName) => {
    this.uiLastMeasured.delete(name);
  };

  /**
   * Resolves user-supplied viewport offsets into concrete per-side pixel
   * values. Static sides take precedence over UI-derived sides.
   */
  resolveOffsets = (
    offsets: ViewportOffsets | undefined,
  ): Offsets | undefined => {
    if (!offsets) {
      return offsets;
    }

    const { ui, ...staticOffsets } = offsets;

    if (!ui) {
      return staticOffsets;
    }

    const uiOffsets = this.getOffsets(ui === true ? undefined : ui);

    return {
      top: staticOffsets.top ?? uiOffsets.top,
      right: staticOffsets.right ?? uiOffsets.right,
      bottom: staticOffsets.bottom ?? uiOffsets.bottom,
      left: staticOffsets.left ?? uiOffsets.left,
    };
  };

  /**
   * Measures the currently rendered editor UI and returns the usable viewport
   * offsets, including optional padding and reserved hidden surfaces.
   */
  getOffsets = (opts?: ViewportOffsetsOptions): Offsets => {
    const excalidrawContainer = this.dependencies.getContainer();
    const excalidrawContainerRect =
      excalidrawContainer?.getBoundingClientRect();
    const isRTL = getLanguage().rtl;

    const measuredOffsets = { top: 0, right: 0, bottom: 0, left: 0 };
    const renderedSurfaces = new Set<ViewportUIName>();

    if (excalidrawContainer && excalidrawContainerRect) {
      for (const node of excalidrawContainer.querySelectorAll<HTMLElement>(
        "[data-viewport-ui]",
      )) {
        const domRect = node.getBoundingClientRect();
        const rect = {
          top: domRect.top - excalidrawContainerRect.top,
          right: domRect.right - excalidrawContainerRect.left,
          bottom: domRect.bottom - excalidrawContainerRect.top,
          left: domRect.left - excalidrawContainerRect.left,
          width: domRect.width,
        };

        switch (node.dataset.viewportUi as ViewportUIDock) {
          case "top":
            measuredOffsets.top = Math.max(measuredOffsets.top, rect.bottom);
            break;
          case "bottom":
            measuredOffsets.bottom = Math.max(
              measuredOffsets.bottom,
              this.app.state.height - rect.top,
            );
            break;
          case "side": {
            const [side, offset] =
              rect.left + rect.width / 2 < this.app.state.width / 2
                ? (["left", rect.right] as const)
                : (["right", this.app.state.width - rect.left] as const);

            measuredOffsets[side] = Math.max(measuredOffsets[side], offset);

            const name = node.dataset.viewportUiName as
              | ViewportUIName
              | undefined;
            if (name) {
              renderedSurfaces.add(name);
              if (offset > 0) {
                this.uiLastMeasured.set(name, { side, offset });
              }
            }
            break;
          }
        }
      }
    }

    if (opts?.reserve && this.app.editorInterface.formFactor !== "phone") {
      const reserveSurface = (
        name: ViewportUIName,
        fallback: { side: "left" | "right"; offset: number },
      ) => {
        if (renderedSurfaces.has(name)) {
          return;
        }
        const { side, offset } = this.uiLastMeasured.get(name) ?? fallback;
        measuredOffsets[side] = Math.max(measuredOffsets[side], offset);
      };

      if (opts.reserve.stylesPanel) {
        reserveSurface("stylesPanel", {
          side: isRTL ? "right" : "left",
          offset:
            this.dependencies.getStylesPanelMode() === "compact"
              ? STYLES_PANEL_APPROX_WIDTH.compact
              : STYLES_PANEL_APPROX_WIDTH.full,
        });
      }
      if (opts.reserve.sidebar) {
        reserveSurface("sidebar", {
          side: isRTL ? "left" : "right",
          offset: RIGHT_SIDEBAR_WIDTH,
        });
      }
    }

    const padding = opts?.padding ?? 24;
    const topPadding = opts?.paddingTop ?? padding;
    const rightPadding =
      (isRTL ? opts?.paddingLeft : opts?.paddingRight) ?? padding;
    const bottomPadding = opts?.paddingBottom ?? padding;
    const leftPadding =
      (isRTL ? opts?.paddingRight : opts?.paddingLeft) ?? padding;

    const editorOffsets = {
      top: measuredOffsets.top + topPadding,
      right: measuredOffsets.right + rightPadding,
      bottom: measuredOffsets.bottom + bottomPadding,
      left: measuredOffsets.left + leftPadding,
    };

    return {
      top: opts?.top ?? editorOffsets.top,
      right: (isRTL ? opts?.left : opts?.right) ?? editorOffsets.right,
      bottom: opts?.bottom ?? editorOffsets.bottom,
      left: (isRTL ? opts?.right : opts?.left) ?? editorOffsets.left,
    };
  };

  /** Resolves the host-supplied initial viewport against restored scene data. */
  resolveInitialViewport = (
    opts: Omit<SetViewportOptions, "animation">,
    elementsMap: NonDeletedSceneElementsMap,
    appState: AppState,
  ) => {
    const { bounds } = resolveViewportTarget(
      opts.target,
      elementsMap,
      appState,
    );

    if (!bounds) {
      return null;
    }

    return getConstrainedTargetViewport(appState, bounds, {
      ...opts,
      // Initial state is resolved post-mount so UI-derived offsets measure
      // the actually-rendered editor UI.
      offsets: this.resolveOffsets(opts.offsets),
    });
  };

  /** Navigates to a target and optionally installs scroll/zoom constraints. */
  setViewport = (opts: SetViewportOptions | null) => {
    if (opts === null) {
      this.cancelTransition();
      AnimationController.cancel(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);
      this.snapBackDebounced.cancel();
      this.app.setState({
        scrollConstraints: null,
        shouldCacheIgnoreZoom: false,
      });
      return;
    }

    const { target, fit, lock, animation } = opts;
    const offsets = this.resolveOffsets(opts.offsets);
    const { bounds, type } = resolveViewportTarget(
      target,
      this.app.scene.getNonDeletedElementsMap(),
      this.app.state,
    );

    if (!bounds) {
      if (type === "link") {
        this.app.setState({
          toast: {
            message: t("elementLink.notFound"),
            duration: 3000,
            closable: true,
          },
        });
      }
      return;
    }

    const viewportUpdate = getConstrainedTargetViewport(
      this.app.state,
      bounds,
      { fit, offsets, lock },
    );
    const duration = resolveAnimationDuration(animation);
    const from = {
      scrollX: this.app.state.scrollX,
      scrollY: this.app.state.scrollY,
      zoom: this.app.state.zoom,
    };

    // A new programmatic navigation supersedes the previous one and starts
    // from whatever viewport its last rendered frame reached.
    this.cancelTransition();
    AnimationController.cancel(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);
    this.snapBackDebounced.cancel();

    if (duration === null) {
      this.app.setState({
        ...viewportUpdate,
        shouldCacheIgnoreZoom: false,
      });
      return;
    }

    const transition = {
      target: viewportUpdate,
    };
    this.activeTransition = transition;

    // The old lock has been superseded. Keep the new lock pending outside
    // AppState so it cannot constrain animation frames back toward either
    // endpoint, and install it together with the final viewport.
    if (this.app.state.scrollConstraints) {
      this.app.setState({ scrollConstraints: null });
    }

    animateToViewport(
      from,
      viewportUpdate,
      duration,
      (state) => {
        if (this.activeTransition === transition) {
          this.app.setState(state);
        }
      },
      () => {
        if (this.activeTransition !== transition) {
          return;
        }

        this.activeTransition = null;
        this.app.setState({
          ...transition.target,
          shouldCacheIgnoreZoom: false,
        });
      },
    );
  };

  /** Use when changing scrollX/scrollY/zoom based on user interaction. */
  translate = <K extends keyof AppState>(
    state:
      | AppState
      | Pick<AppState, K>
      | null
      | ((
          prevState: Readonly<AppState>,
          props: Readonly<AppProps>,
        ) => AppState | Pick<AppState, K> | null),
    opts?: {
      zoomPreConstrained?: boolean;
      preserveScrollConstraintsSnapBack?: boolean;
    },
  ) => {
    if (this.isLockedTransitionPending) {
      return false;
    }

    this.cancelTransition();
    if (!opts?.preserveScrollConstraintsSnapBack) {
      AnimationController.cancel(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);
    }
    this.app.setState({ shouldCacheIgnoreZoom: false });
    if (this.app.state.userToFollow) {
      this.app.setState({ userToFollow: null });
    }

    const prevZoom = this.app.state.zoom.value;
    this.app.setState(state);

    this.app.setState((prevState) => {
      if (!prevState.scrollConstraints) {
        return null;
      }
      const zoomed =
        !opts?.zoomPreConstrained && prevState.zoom.value !== prevZoom;
      const overscroll = zoomed ? 0 : prevState.scrollConstraints.overscroll;
      if (overscroll > 0) {
        this.snapBackDebounced();
      }
      return constrainScrollState(prevState, overscroll);
    });

    return true;
  };

  /** Clamps the viewport into the active scroll constraints. */
  constrain = (overscroll = 0) => {
    this.app.setState((prevState) =>
      prevState.scrollConstraints
        ? constrainScrollState(prevState, overscroll)
        : null,
    );
  };

  /** Releases a held rubberband overscroll. */
  releaseOverscroll = () => {
    if (!this.app.state.scrollConstraints) {
      return;
    }
    this.snapBackDebounced.cancel();
    this.snapBack();
  };

  private snapBack = () => {
    if (this.app.unmounted || this.dependencies.isGestureActive()) {
      return;
    }
    snapBackToConstraints(this.app.state, (updater) =>
      this.app.setState((state) => updater(state)),
    );
  };

  private snapBackDebounced = debounce(
    this.snapBack,
    SCROLL_CONSTRAINTS_SNAP_BACK_DELAY,
  );

  private cancelTransition = () => {
    this.activeTransition = null;
    AnimationController.cancel(SCROLL_TO_CONTENT_ANIMATION_KEY);
  };

  destroy = () => {
    this.cancelTransition();
    AnimationController.cancel(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);
    this.snapBackDebounced.cancel();
  };
}
