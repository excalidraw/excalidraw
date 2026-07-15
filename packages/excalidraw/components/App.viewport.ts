import { debounce, easeOut, type StylesPanelMode } from "@excalidraw/common";
import { clamp } from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";

import { getLanguage, t } from "../i18n";
import { AnimationController } from "../renderer/animation";
import {
  constrainScrollState,
  getConstrainedTargetViewport,
  getTargetViewport,
  interpolateViewport,
  resolveViewportTarget,
  type SetViewportOptions,
} from "../viewport";

import type {
  AppProps,
  AppState,
  Offsets,
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
  onComplete?: () => void,
) => {
  AnimationController.start<{ elapsed: number }>(
    SCROLL_TO_CONTENT_ANIMATION_KEY,
    ({ deltaTime, state }) => {
      const elapsed = (state?.elapsed ?? 0) + deltaTime;
      const progress = Math.min(elapsed / duration, 1);
      const factor = easeOut(clamp(progress, 0, 1));

      onFrame({
        ...interpolateViewport({ from, target, factor }),
        shouldCacheIgnoreZoom: progress < 1,
      });

      if (progress < 1) {
        return { elapsed };
      }

      onComplete?.();

      return null;
    },
  );
};

/**
 * Scrolls (and, per `fit`, zooms) the viewport so the given target box is in
 * view, optionally animating the transition. `onComplete` runs once the
 * viewport has settled on the target.
 */
const setViewportToBounds = (
  state: AppState,
  bounds: Bounds,
  // NOTE offsets must be resolved (see `AppViewport.resolveOffsets`)
  opts: Pick<SetViewportOptions, "fit" | "animation"> & { offsets?: Offsets },
  onFrame: (
    state: Pick<
      AppState,
      "scrollX" | "scrollY" | "zoom" | "shouldCacheIgnoreZoom"
    >,
  ) => void,
  onComplete?: () => void,
) => {
  AnimationController.cancel(SCROLL_TO_CONTENT_ANIMATION_KEY);
  AnimationController.cancel(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);

  const viewport = getTargetViewport(state, bounds, opts.fit, opts.offsets);
  const duration = resolveAnimationDuration(opts.animation);

  if (duration === null) {
    // no animation: jump straight to the target. Re-enable zoom caching in
    // case we just cancelled an in-flight animation that had suppressed it.
    onFrame({ ...viewport, shouldCacheIgnoreZoom: false });
    onComplete?.();
  } else {
    animateToViewport(state, viewport, duration, onFrame, onComplete);
  }
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

  /** Navigates to a target and optionally installs scroll/zoom constraints. */
  setViewport = (opts: SetViewportOptions | null) => {
    if (opts === null) {
      AnimationController.cancel(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);
      if (this.app.state.scrollConstraints) {
        this.app.setState({ scrollConstraints: null });
      }
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

    const installLock = () => {
      this.app.setState((prevState) => {
        if (!viewportUpdate.scrollConstraints && !prevState.scrollConstraints) {
          return null;
        }

        return viewportUpdate;
      });
    };

    setViewportToBounds(
      this.app.state,
      bounds,
      { fit, animation, offsets },
      this.app.setState.bind(this.app),
      installLock,
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
    AnimationController.cancel(SCROLL_TO_CONTENT_ANIMATION_KEY);
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

  destroy = () => {
    this.snapBackDebounced.cancel();
  };
}
