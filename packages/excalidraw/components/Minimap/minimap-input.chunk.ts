/**
 * Pointer/Keyboard logic for the minimap, kept separate from the
 * controller so the controller stays focused on editor and renderer.
 */

import type {
  MinimapBounds,
  MinimapTransform,
  MinimapViewport,
} from "./minimap-shared.chunk";

import type { MinimapController } from "./minimap-controller.chunk";

/**
 * Edge auto-pan: while the viewport is dragged with the pointer held outside
 * of the minimap, it keeps panning that way — by this many viewport sizes per
 * second for each px the pointer is past the minimap's edge...
 */
const AUTO_PAN_SPEED = 1 / 8;
/** ...up to this many viewport sizes per second */
const AUTO_PAN_MAX_SPEED = 3;

export interface MinimapHandler {
  attach(): void;
  detach(): void;
  destroy(): void;
}

export class MinimapPointerHandler implements MinimapHandler {
  private drag: {
    pointerId: number;
    /**
     * The transform at the start of the drag, which the pointer is mapped to
     * the scene with throughout: the minimap is fitted to the content along
     * with the viewport, so it rescales once the viewport is dragged past the
     * content — mapping the pointer through that would feed back into itself.
     */
    transform: MinimapTransform;
    /** position of the pointer in the minimap (CSS px) */
    x: number;
    y: number;
    /** scene offset of the pointer from the viewport's top-left corner */
    offsetX: number;
    offsetY: number;
    /**
     * The scene bounds the viewport is kept in, or null where the editor's
     * own scroll constraints apply instead.
     */
    bounds: MinimapBounds | null;
    /** the scene distance auto-panned so far */
    panX: number;
    panY: number;
    autoPanFrame: number | null;
    autoPanTime: number | null;
    /** @see AppViewport.beginGesture */
    endGesture: () => void;
  } | null = null;
  /** @see unlockOnceSettled */
  private unlockFrame: number | null = null;

  constructor(private readonly host: MinimapController) {}

  attach() {
    const { container } = this.host;
    container.addEventListener("pointerdown", this.onPointerDown);
    container.addEventListener("pointermove", this.onPointerMove);
    container.addEventListener("pointerup", this.onPointerUp);
    container.addEventListener("pointercancel", this.onPointerUp);
    container.addEventListener("lostpointercapture", this.onPointerUp);
    container.addEventListener("wheel", this.onWheel, { passive: false });
  }

  detach() {
    const { container } = this.host;
    container.removeEventListener("pointerdown", this.onPointerDown);
    container.removeEventListener("pointermove", this.onPointerMove);
    container.removeEventListener("pointerup", this.onPointerUp);
    container.removeEventListener("pointercancel", this.onPointerUp);
    container.removeEventListener("lostpointercapture", this.onPointerUp);
    container.removeEventListener("wheel", this.onWheel);
  }

  destroy() {
    this.endDrag();
    this.cancelUnlock();
  }

  /** the position of the pointer in the minimap (CSS px) */
  private getPointerPosition(event: PointerEvent) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - this.container.clientLeft,
      y: event.clientY - rect.top - this.container.clientTop,
    };
  }

  /**
   * The viewport can be dragged up to its own size past the content, i.e.
   * until the content is just out of view (or as far as it already is).
   */
  private getDragBounds(viewport: MinimapViewport): MinimapBounds {
    const { x, y, width, height } = viewport;
    if (!this.contentBounds) {
      return [x, y, x + width, y + height];
    }
    const [minX, minY, maxX, maxY] = this.contentBounds;
    return [
      Math.min(minX - width, x),
      Math.min(minY - height, y),
      Math.max(maxX + width, x + width),
      Math.max(maxY + height, y + height),
    ];
  }

  // ---------------------------------------------------------------------------
  // dragging the viewport
  // ---------------------------------------------------------------------------

  private onPointerDown = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      this.drag ||
      !this.transform ||
      !this.shared ||
      !this.app.isNavigationEnabled()
    ) {
      return;
    }
    event.preventDefault();
    // (still locked to the transform of the previous drag, if any)
    this.cancelUnlock();
    this.container.focus();

    const transform = this.transform;
    const viewport = this.host.getViewport();
    const { x, y } = this.getPointerPosition(event);
    const rect = this.shared.getMinimapViewportRect(viewport, transform);
    const isOverViewport =
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height;

    // (a zoom-only lock leaves scrolling unconstrained)
    const isLocked = !!this.app.state.scrollConstraints?.lockScroll;

    this.drag = {
      pointerId: event.pointerId,
      transform,
      x,
      y,
      // pressing outside of the viewport centers it on the pointer
      offsetX: isOverViewport
        ? (x - transform.translateX) / transform.scale - viewport.x
        : viewport.width / 2,
      offsetY: isOverViewport
        ? (y - transform.translateY) / transform.scale - viewport.y
        : viewport.height / 2,
      bounds: isLocked ? null : this.getDragBounds(viewport),
      panX: 0,
      panY: 0,
      autoPanFrame: null,
      autoPanTime: null,
      // holds the rubberband overscroll (of a locked viewport) until release,
      // instead of it snapping back whenever the pointer rests
      endGesture: this.app.viewport.beginGesture(),
    };
    if (isLocked) {
      // the viewport can only rubberband past the lock, which the minimap
      // shouldn't rescale for (nor for it snapping back, see
      // `unlockOnceSettled`)
      this.host.send({ type: "lock", transform });
    }
    this.container.setPointerCapture(event.pointerId);
    this.container.classList.add("minimap--dragging");

    if (!isOverViewport) {
      this.moveViewport();
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    const { drag } = this;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const { x, y } = this.getPointerPosition(event);
    drag.x = x;
    drag.y = y;
    this.moveViewport();
    if (drag.autoPanFrame === null) {
      this.autoPan(null);
    }
  };

  /** moves the viewport where the pointer drags it */
  private moveViewport() {
    const { drag } = this;
    if (!drag) {
      return;
    }
    const { transform, bounds } = drag;
    const viewport = this.host.getViewport();

    let x =
      (drag.x - transform.translateX) / transform.scale -
      drag.offsetX +
      drag.panX;
    let y =
      (drag.y - transform.translateY) / transform.scale -
      drag.offsetY +
      drag.panY;

    if (bounds) {
      const constrain = (
        value: number,
        min: number,
        max: number,
        pan: number,
      ): [value: number, pan: number] => {
        const constrained = Math.max(min, Math.min(value, max));
        const excess = value - constrained;
        // drop the auto-panned distance that'd lead past the bounds, so
        // that it doesn't have to be made up for when dragging back
        if (excess * pan > 0) {
          pan -= Math.sign(pan) * Math.min(Math.abs(pan), Math.abs(excess));
        }
        return [constrained, pan];
      };
      [x, drag.panX] = constrain(
        x,
        bounds[0],
        bounds[2] - viewport.width,
        drag.panX,
      );
      [y, drag.panY] = constrain(
        y,
        bounds[1],
        bounds[3] - viewport.height,
        drag.panY,
      );
    }

    this.app.viewport.translate({ scrollX: -x, scrollY: -y });
  }

  /**
   * Keeps panning the viewport for as long as the pointer is held outside of
   * the minimap, the faster the further out it is — the pointer may have
   * nowhere further to go (the minimap sits in the corner of the screen).
   */
  private autoPan = (timestamp: number | null) => {
    const { drag, config } = this;
    if (!drag) {
      return;
    }
    drag.autoPanFrame = null;

    const getSpeed = (position: number, size: number) => {
      const distance = position < 0 ? position : Math.max(position - size, 0);
      return (
        Math.sign(distance) *
        Math.min(Math.abs(distance) * AUTO_PAN_SPEED, AUTO_PAN_MAX_SPEED)
      );
    };
    const speedX = getSpeed(drag.x, config?.width ?? 0);
    const speedY = getSpeed(drag.y, config?.height ?? 0);

    if (!drag.bounds || (!speedX && !speedY)) {
      drag.autoPanTime = null;
      return;
    }

    if (timestamp !== null && drag.autoPanTime !== null) {
      // (capped in case the frames were paused, e.g. in a background tab)
      const elapsed = Math.min((timestamp - drag.autoPanTime) / 1000, 0.1);
      const viewport = this.host.getViewport();
      drag.panX += speedX * viewport.width * elapsed;
      drag.panY += speedY * viewport.height * elapsed;
      this.moveViewport();
    }
    drag.autoPanTime = timestamp;
    drag.autoPanFrame = this.app.ownerWindow.requestAnimationFrame(
      this.autoPan,
    );
  };

  /**
   * Zooms the canvas around the center of its viewport, wherever in the
   * minimap the pointer (or the viewport) is — as opposed to over the canvas,
   * wheeling over the minimap never pans.
   */
  private onWheel = (event: WheelEvent) => {
    // the editor would otherwise handle it as wheeling over the canvas
    event.preventDefault();
    event.stopPropagation();

    if (
      event.deltaY &&
      // the dragged viewport is tied to the pointer
      !this.drag &&
      this.app.isNavigationEnabled()
    ) {
      this.app.wheel.zoomBy(event.deltaY, "center");
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.drag?.pointerId === event.pointerId) {
      this.endDrag();
    }
  };

  private endDrag() {
    const { drag } = this;
    if (!drag) {
      return;
    }
    this.drag = null;
    if (drag.autoPanFrame !== null) {
      this.app.ownerWindow.cancelAnimationFrame(drag.autoPanFrame);
    }
    drag.endGesture();
    this.container.classList.remove("minimap--dragging");
    this.unlockOnceSettled();
  }

  /**
   * Ending the drag may leave the viewport animating (the rubberband
   * overscroll of a locked viewport snapping back). The minimap is kept as is
   * until that settles, so that only the viewport moves, instead of the
   * minimap refitting itself under it on each frame.
   */
  private unlockOnceSettled = () => {
    this.unlockFrame = null;
    if (this.app.viewport.isAnimating) {
      this.unlockFrame = this.app.ownerWindow.requestAnimationFrame(
        this.unlockOnceSettled,
      );
      return;
    }
    this.host.send({ type: "lock", transform: null });
  };

  private cancelUnlock() {
    if (this.unlockFrame !== null) {
      this.app.ownerWindow.cancelAnimationFrame(this.unlockFrame);
      this.unlockFrame = null;
    }
  }

  private get app() {
    return this.host.app;
  }
  private get container() {
    return this.host.container;
  }
  private get shared() {
    return this.host.getShared();
  }
  private get transform() {
    return this.host.getTransform();
  }
  private get contentBounds() {
    return this.host.getContentBounds();
  }
  private get config() {
    return this.host.getConfig();
  }
}

const NAV_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
]);

export class MinimapKeyboardHandler implements MinimapHandler {
  private keySet = new Set<string>();
  private requestId: number | null = null;
  private lastTime = 0;

  constructor(private readonly host: MinimapController) {}

  attach() {
    const { container } = this.host;

    container.addEventListener("keydown", this.onKeyDown);
    container.addEventListener("keyup", this.onKeyUp);
    container.addEventListener("blur", this.onBlur);
  }

  detach() {
    const { container } = this.host;

    container.removeEventListener("keydown", this.onKeyDown);
    container.removeEventListener("keyup", this.onKeyUp);
    container.removeEventListener("blur", this.onBlur);
  }

  destroy() {
    this.detach();
  }

  // ---------------------------------------------------------------------------
  // minimap movement
  // ---------------------------------------------------------------------------

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.app.isNavigationEnabled() || !NAV_KEYS.has(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.keySet.add(event.key);
    this.startLoop();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keySet.delete(event.key);
  };

  private onBlur = () => {
    this.keySet.clear();
  };

  private startLoop() {
    if (this.requestId !== null) {
      return;
    }

    this.lastTime = performance.now();
    this.requestId = requestAnimationFrame(this.step);
  }

  private step = (timestamp: number) => {
    const elapsed = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    if (!this.app.isNavigationEnabled()) {
      this.keySet.clear();
    }

    const keys = this.keySet;

    const dirX =
      (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
    const dirY =
      (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);

    if (dirX || dirY) {
      const viewport = this.host.getViewport();
      const dx = dirX * viewport.width * elapsed;
      const dy = dirY * viewport.height * elapsed;
      const [minX, minY, maxX, maxY] = this.getBounds(viewport);

      const constrain = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(value, max));

      this.app.viewport.translate(({ scrollX, scrollY }) => ({
        scrollX: constrain(scrollX + dx, -(maxX - viewport.width), -minX),
        scrollY: constrain(scrollY + dy, -(maxY - viewport.height), -minY),
      }));
    }

    const zoomDir =
      (keys.has("PageDown") ? 1 : 0) - (keys.has("PageUp") ? 1 : 0);
    if (zoomDir) {
      this.app.wheel.zoomBy(zoomDir * 120 * elapsed, "center");
    }

    if (keys.size > 0) {
      this.requestId = requestAnimationFrame(this.step);
    } else {
      this.requestId = null;
    }
  };

  private getBounds(viewport: MinimapViewport): MinimapBounds {
    const { x, y, width, height } = viewport;
    const contentBounds = this.host.getContentBounds();
    if (!contentBounds) {
      return [x, y, x + width, y + height];
    }
    const [minX, minY, maxX, maxY] = contentBounds;
    return [
      Math.min(minX - width, x),
      Math.min(minY - height, y),
      Math.max(maxX + width, x + width),
      Math.max(maxY + height, y + height),
    ];
  }

  private get app() {
    return this.host.app;
  }
}
