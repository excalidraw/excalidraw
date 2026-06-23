import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCommonBounds, isFrameLikeElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { useExcalidrawSetAppState } from "./App";

import "./TerraformMinimap.scss";

import type { AppClassProperties, UIAppState } from "../types";

/**
 * Overview minimap for large Terraform scenes.
 *
 * Navigation aid for the zoomed-out case where LOD has culled per-element
 * detail (see docs/terraform-canvas-runtime-performance.md). It renders the
 * whole scene bounds from raw element geometry and a draggable viewport rect.
 *
 * Hot-path constraints (Eng review #14):
 * - Draws with raw `fillRect`/`strokeRect` only. It NEVER calls `renderElement`
 *   or touches `elementWithCanvasCache`, so it cannot trigger the per-element
 *   canvas-regeneration that dominates low-zoom cost.
 * - Redraw is state-driven (scene nonce / viewport / size / collapse), not a
 *   free requestAnimationFrame loop. When collapsed there is no draw work.
 * - Scene bounds are cached by scene nonce so panning does not recompute
 *   `getCommonBounds` over thousands of elements each frame.
 * - Own LOD: at most `MAX_DRAWN_PRIMITIVES` boxes are drawn (strided sampling)
 *   so a huge scene stays a cheap O(cap) draw.
 */

const MINIMAP_MAX_WIDTH = 200;
const MINIMAP_MAX_HEIGHT = 150;
const MINIMAP_MIN_SIDE = 60;
const MAX_DRAWN_PRIMITIVES = 1500;
const COLLAPSE_STORAGE_KEY = "tfdraw-terraform-minimap-collapsed";

type SceneBounds = [minX: number, minY: number, maxX: number, maxY: number];

export type TerraformMinimapDims = {
  scale: number;
  width: number;
  height: number;
};

/**
 * Scene bounds for the minimap, or `null` when there is nothing drawable.
 * `getCommonBounds([])` returns `Infinity`, and a degenerate (zero-area) scene
 * would divide-by-zero in the scale math — both are guarded here so the caller
 * can simply bail when this returns `null`.
 */
export const terraformMinimapBounds = (
  elements: readonly ExcalidrawElement[],
): SceneBounds | null => {
  if (elements.length === 0) {
    return null;
  }
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY) ||
    maxX - minX <= 0 ||
    maxY - minY <= 0
  ) {
    return null;
  }
  return [minX, minY, maxX, maxY];
};

/** Minimap content dimensions, preserving scene aspect ratio within the cap. */
export const terraformMinimapDims = (
  bounds: SceneBounds | null,
): TerraformMinimapDims | null => {
  if (!bounds) {
    return null;
  }
  const [minX, minY, maxX, maxY] = bounds;
  const sceneW = maxX - minX;
  const sceneH = maxY - minY;
  const scale = Math.min(
    MINIMAP_MAX_WIDTH / sceneW,
    MINIMAP_MAX_HEIGHT / sceneH,
  );
  return {
    scale,
    width: Math.max(MINIMAP_MIN_SIDE, Math.round(sceneW * scale)),
    height: Math.max(MINIMAP_MIN_SIDE, Math.round(sceneH * scale)),
  };
};

/**
 * Stride between drawn elements so at most `MAX_DRAWN_PRIMITIVES` boxes are
 * rendered — the minimap's own LOD, keeping a huge scene a cheap O(cap) draw.
 */
export const terraformMinimapDrawStep = (count: number): number => {
  if (count <= MAX_DRAWN_PRIMITIVES) {
    return 1;
  }
  return Math.ceil(count / MAX_DRAWN_PRIMITIVES);
};

const readCollapsedPref = (): boolean => {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const writeCollapsedPref = (collapsed: boolean) => {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  } catch {
    // ignore storage failures (private mode etc.)
  }
};

type TerraformMinimapProps = {
  app: AppClassProperties;
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
};

type Viewport = {
  scrollX: number;
  scrollY: number;
  zoom: number;
};

const TerraformMinimapInner = ({
  app,
  appState,
  elements,
}: TerraformMinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setAppState = useExcalidrawSetAppState();
  const [collapsed, setCollapsed] = useState(readCollapsedPref);
  const draggingRef = useRef(false);

  // UIAppState omits scrollX/scrollY (so the UI layer does not re-render on
  // pan), so we track the live viewport via onScrollChangeEmitter — fires only
  // on actual pan/zoom, no idle RAF polling (Eng review #14). Seeded from the
  // current app state on mount.
  const [viewport, setViewport] = useState<Viewport>(() => ({
    scrollX: app.state.scrollX,
    scrollY: app.state.scrollY,
    zoom: app.state.zoom.value,
  }));

  useEffect(() => {
    const unsubscribe = app.onScrollChangeEmitter.on((scrollX, scrollY, zoom) =>
      setViewport({ scrollX, scrollY, zoom: zoom.value }),
    );
    // re-seed in case scroll changed between initial state and subscription
    setViewport({
      scrollX: app.state.scrollX,
      scrollY: app.state.scrollY,
      zoom: app.state.zoom.value,
    });
    return unsubscribe;
  }, [app]);

  const nonce = app.scene.getSceneNonce();

  // Scene bounds are expensive over thousands of elements; cache by nonce so a
  // pan (which changes only the viewport, not the nonce) reuses them.
  const bounds = useMemo<SceneBounds | null>(
    () => terraformMinimapBounds(elements),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nonce, elements.length],
  );

  // Minimap content dimensions, preserving scene aspect ratio within the cap.
  const dims = useMemo(() => terraformMinimapDims(bounds), [bounds]);

  const drawStep = useMemo(
    () => terraformMinimapDrawStep(elements.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nonce, elements.length],
  );

  const sceneToMinimap = useCallback(
    (sceneX: number, sceneY: number) => {
      if (!bounds || !dims) {
        return { x: 0, y: 0 };
      }
      return {
        x: (sceneX - bounds[0]) * dims.scale,
        y: (sceneY - bounds[1]) * dims.scale,
      };
    },
    [bounds, dims],
  );

  // State-driven redraw. No RAF loop: this effect runs only when an input that
  // affects the picture changes.
  useEffect(() => {
    if (collapsed || !bounds || !dims) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.width * dpr;
    canvas.height = dims.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dims.width, dims.height);

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dims.width, dims.height);

    // elements: frames as outlines, everything else as filled blocks. Raw
    // primitives only — no renderElement, no canvas cache.
    for (let i = 0; i < elements.length; i += drawStep) {
      const element = elements[i];
      if (element.isDeleted) {
        continue;
      }
      const { x, y } = sceneToMinimap(element.x, element.y);
      const w = Math.max(1, element.width * dims.scale);
      const h = Math.max(1, element.height * dims.scale);
      if (isFrameLikeElement(element)) {
        ctx.strokeStyle = "rgba(90, 90, 110, 0.5)";
        ctx.lineWidth = 0.75;
        ctx.strokeRect(x, y, w, h);
      } else {
        ctx.fillStyle = "rgba(99, 102, 241, 0.55)";
        ctx.fillRect(x, y, w, h);
      }
    }

    // viewport rectangle: visible scene region is [-scroll, size/zoom].
    const zoom = viewport.zoom;
    const vp0 = sceneToMinimap(-viewport.scrollX, -viewport.scrollY);
    const vpW = (appState.width / zoom) * dims.scale;
    const vpH = (appState.height / zoom) * dims.scale;
    // clamp the rect to the minimap so an over-zoomed-out viewport stays visible
    const rx = Math.max(0, Math.min(vp0.x, dims.width));
    const ry = Math.max(0, Math.min(vp0.y, dims.height));
    const rw = Math.min(vpW, dims.width - rx);
    const rh = Math.min(vpH, dims.height - ry);
    ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
    ctx.fillRect(rx, ry, Math.max(2, rw), Math.max(2, rh));
    ctx.strokeStyle = "rgba(67, 56, 202, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, Math.max(2, rw), Math.max(2, rh));
  }, [
    collapsed,
    bounds,
    dims,
    drawStep,
    elements,
    sceneToMinimap,
    viewport,
    appState.width,
    appState.height,
  ]);

  // Center the viewport on the scene point under a minimap pixel.
  const recenterFromEvent = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bounds || !dims) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const sceneX = bounds[0] + px / dims.scale;
      const sceneY = bounds[1] + py / dims.scale;
      const zoom = viewport.zoom;
      setAppState({
        scrollX: appState.width / (2 * zoom) - sceneX,
        scrollY: appState.height / (2 * zoom) - sceneY,
      });
    },
    [setAppState, appState.width, appState.height, viewport.zoom, bounds, dims],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      recenterFromEvent(event);
    },
    [recenterFromEvent],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (draggingRef.current) {
        recenterFromEvent(event);
      }
    },
    [recenterFromEvent],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      draggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsedPref(next);
      return next;
    });
  }, []);

  if (!bounds || !dims) {
    return null;
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="terraform-minimap terraform-minimap--collapsed"
        data-testid="terraform-minimap-toggle"
        onClick={toggleCollapsed}
        aria-label="Show minimap"
        title="Show minimap"
      >
        Map
      </button>
    );
  }

  return (
    <div className="terraform-minimap" data-testid="terraform-minimap">
      <button
        type="button"
        className="terraform-minimap__collapse"
        data-testid="terraform-minimap-toggle"
        onClick={toggleCollapsed}
        aria-label="Hide minimap"
        title="Hide minimap"
      >
        ×
      </button>
      <canvas
        ref={canvasRef}
        className="terraform-minimap__canvas"
        style={{ width: dims.width, height: dims.height }}
        data-testid="terraform-minimap-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        // decorative overview; keyboard users navigate via search-to-fit
        aria-hidden="true"
      />
    </div>
  );
};

const hasResources = (elements: readonly ExcalidrawElement[]): boolean =>
  elements.some((element) => element.customData?.terraform === true);

export const TerraformMinimap = memo((props: TerraformMinimapProps) => {
  if (
    !props.appState.terraformMinimapEnabled ||
    !hasResources(props.elements)
  ) {
    return null;
  }
  return <TerraformMinimapInner {...props} />;
});
TerraformMinimap.displayName = "TerraformMinimap";
