/**
 * The minimap's logic on the editor's side, loaded once the minimap is first
 * shown.
 *
 * DON'T depend on anything from the outside (types aside), so that this
 * lazy-loaded chunk stays self-contained.
 */

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type {
  MinimapBounds,
  MinimapColors,
  MinimapConfig,
  MinimapInMessage,
  MinimapOutMessage,
  MinimapTransform,
  MinimapViewport,
} from "./minimap-shared.chunk";
import type { AppClassProperties } from "../../types";

type MinimapShared = typeof import("./minimap-shared.chunk");

/**
 * Edge auto-pan: while the viewport is dragged with the pointer held outside
 * of the minimap, it keeps panning that way — by this many viewport sizes per
 * second for each px the pointer is past the minimap's edge...
 */
const AUTO_PAN_SPEED = 1 / 8;
/** ...up to this many viewport sizes per second */
const AUTO_PAN_MAX_SPEED = 3;

/** polylines are downsampled to at most this many points */
const MAX_PATH_POINTS = 24;
/** the canvas resolution is capped, the minimap being low-res by design */
const MAX_DEVICE_PIXEL_RATIO = 2;
/**
 * Upper bound of the main thread time spent on sending elements to the
 * renderer, as a fraction. E.g. if encoding a (huge) scene takes 2ms, it's
 * done at most every 40ms.
 */
const MAX_ENCODING_LOAD = 0.05;

/**
 * Drives the minimap canvas. All the main thread does is to copy a few
 * numbers per element (throttled, and only when the scene changes) and to
 * forward the viewport — bounds, layout and drawing happen in a worker
 * rendering to an OffscreenCanvas. Falls back to the main thread where
 * that's not supported.
 */
export class MinimapController {
  private canvas: HTMLCanvasElement | null = null;
  private worker: Worker | null = null;
  private fallback: ReturnType<MinimapShared["createMinimapEndpoint"]> | null =
    null;
  private shared: MinimapShared | null = null;
  private isDestroyed = false;
  private cleanups: (() => void)[] = [];

  private config: MinimapConfig | null = null;
  /** the transform of the last rendered frame */
  private transform: MinimapTransform | null = null;
  /** bounds of the elements of the last rendered frame */
  private contentBounds: MinimapBounds | null = null;

  private scratch = new Float32Array(4096);
  private elementsSeq = 0;
  private isElementsDirty = true;
  private isAwaitingFrame = false;
  private nextEncodingAt = 0;
  private encodingTimer: number | null = null;
  private encodingFrame: number | null = null;

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

  constructor(private app: AppClassProperties, private container: HTMLElement) {
    this.init(typeof Worker !== "undefined").catch((error: unknown) => {
      console.error("Failed to initialize the minimap", error);
    });
  }

  // ---------------------------------------------------------------------------
  // lifecycle
  // ---------------------------------------------------------------------------

  private async init(useWorker: boolean): Promise<void> {
    // loaded dynamically so that the bundler keeps it a chunk of its own,
    // shared with the worker — a static import would get it merged into this
    // chunk, which the worker would then load whole
    const shared = await import("./minimap-shared.chunk");
    if (this.isDestroyed) {
      return;
    }
    this.shared = shared;

    const canvas = this.container.ownerDocument.createElement("canvas");
    canvas.className = "minimap__canvas";
    this.container.appendChild(canvas);
    this.canvas = canvas;

    const config = this.getConfig();
    this.config = config;

    if (useWorker && "transferControlToOffscreen" in canvas) {
      try {
        const { WorkerUrl } = await import("./minimap-worker.chunk");
        if (this.isDestroyed) {
          return;
        }
        if (
          !WorkerUrl ||
          !import.meta.url ||
          // the worker code is bundled into this chunk
          WorkerUrl.toString() === import.meta.url
        ) {
          throw new Error("Minimap worker is not available");
        }

        const worker = new Worker(WorkerUrl, { type: "module" });
        worker.onmessage = (event: MessageEvent<MinimapOutMessage>) =>
          this.onFrame(event.data);
        worker.onerror = () => this.restartOnMainThread();
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: "init", canvas: offscreen, config }, [
          offscreen,
        ]);
        this.worker = worker;
      } catch (error) {
        console.warn(
          "Failed to render the minimap in a worker, falling back to the main thread.",
          error,
        );
        return this.restartOnMainThread();
      }
    } else {
      const { ownerWindow } = this.app;
      this.fallback = shared.createMinimapEndpoint(
        (message) => this.onFrame(message),
        {
          requestFrame: (callback) =>
            ownerWindow.requestAnimationFrame(callback),
          cancelFrame: (id) => ownerWindow.cancelAnimationFrame(id),
        },
      );
      this.fallback.handle({ type: "init", canvas, config });
    }

    this.subscribe();
    this.syncViewport();
    this.scheduleEncoding();
  }

  private subscribe() {
    const { app, container } = this;

    this.cleanups.push(
      app.scene.onUpdate(() => {
        this.isElementsDirty = true;
        this.scheduleEncoding();
      }),
      app.onStateChange(
        ["scrollX", "scrollY", "zoom", "width", "height"],
        this.syncViewport,
      ),
      // the colors are theme-dependent
      app.onStateChange("theme", this.syncConfig),
    );

    if (typeof app.ownerWindow.ResizeObserver !== "undefined") {
      const resizeObserver = new app.ownerWindow.ResizeObserver(
        this.syncConfig,
      );
      resizeObserver.observe(container);
      this.cleanups.push(() => resizeObserver.disconnect());
    }

    container.addEventListener("pointerdown", this.onPointerDown);
    container.addEventListener("pointermove", this.onPointerMove);
    container.addEventListener("pointerup", this.onPointerUp);
    container.addEventListener("pointercancel", this.onPointerUp);
    container.addEventListener("lostpointercapture", this.onPointerUp);
    container.addEventListener("wheel", this.onWheel, { passive: false });
    this.cleanups.push(() => {
      container.removeEventListener("wheel", this.onWheel);
      container.removeEventListener("pointerdown", this.onPointerDown);
      container.removeEventListener("pointermove", this.onPointerMove);
      container.removeEventListener("pointerup", this.onPointerUp);
      container.removeEventListener("pointercancel", this.onPointerUp);
      container.removeEventListener("lostpointercapture", this.onPointerUp);
    });
  }

  /** tears down everything but the instance itself, so it can be restarted */
  private teardown() {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];

    if (this.encodingTimer !== null) {
      this.app.ownerWindow.clearTimeout(this.encodingTimer);
      this.encodingTimer = null;
    }
    if (this.encodingFrame !== null) {
      this.app.ownerWindow.cancelAnimationFrame(this.encodingFrame);
      this.encodingFrame = null;
    }

    this.worker?.terminate();
    this.worker = null;
    this.fallback?.destroy();
    this.fallback = null;
    // a canvas whose control was transferred can't be drawn to again
    this.canvas?.remove();
    this.canvas = null;

    this.transform = null;
    this.contentBounds = null;
    this.endDrag();
    this.cancelUnlock();
    this.isElementsDirty = true;
    this.isAwaitingFrame = false;
  }

  private restartOnMainThread(): Promise<void> | undefined {
    if (this.isDestroyed) {
      return;
    }
    this.teardown();
    return this.init(false);
  }

  destroy() {
    this.isDestroyed = true;
    this.teardown();
  }

  // ---------------------------------------------------------------------------
  // editor → renderer
  // ---------------------------------------------------------------------------

  private send(message: MinimapInMessage, transfer?: Transferable[]) {
    if (this.worker) {
      this.worker.postMessage(message, transfer ?? []);
    } else {
      this.fallback?.handle(message);
    }
  }

  private getConfig(): MinimapConfig {
    const style = this.app.ownerWindow.getComputedStyle(this.container);
    const getColor = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;

    const colors: MinimapColors = {
      element: getColor("--minimap-element-color", "#999"),
      viewport: getColor("--minimap-viewport-color", "#6965db"),
    };

    return {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      devicePixelRatio: Math.min(
        this.app.ownerWindow.devicePixelRatio || 1,
        MAX_DEVICE_PIXEL_RATIO,
      ),
      colors,
    };
  }

  private syncConfig = () => {
    const config = this.getConfig();
    const prevConfig = this.config;
    if (
      prevConfig &&
      prevConfig.width === config.width &&
      prevConfig.height === config.height &&
      prevConfig.devicePixelRatio === config.devicePixelRatio &&
      prevConfig.colors.element === config.colors.element &&
      prevConfig.colors.viewport === config.colors.viewport
    ) {
      return;
    }
    this.config = config;
    this.send({ type: "config", config });
  };

  private getViewport(): MinimapViewport {
    const { scrollX, scrollY, zoom, width, height } = this.app.state;
    return {
      x: -scrollX,
      y: -scrollY,
      width: width / zoom.value,
      height: height / zoom.value,
    };
  }

  private syncViewport = () => {
    // browser zoom, or moving the window to another screen (both resize the
    // editor, in CSS pixels)
    this.syncConfig();
    this.send({ type: "viewport", viewport: this.getViewport() });
  };

  private scheduleEncoding() {
    if (
      !this.isElementsDirty ||
      // sending the elements faster than they're rendered would only pile
      // them up
      this.isAwaitingFrame ||
      this.encodingTimer !== null ||
      this.encodingFrame !== null
    ) {
      return;
    }

    // (the editor may be mounted into another window than the one this code
    // runs in, whose frames may be throttled or paused)
    const { ownerWindow } = this.app;

    const requestFrame = () => {
      this.encodingFrame = ownerWindow.requestAnimationFrame(() => {
        this.encodingFrame = null;
        this.sendElements();
      });
    };

    const delay = this.nextEncodingAt - performance.now();
    if (delay > 0) {
      this.encodingTimer = ownerWindow.setTimeout(() => {
        this.encodingTimer = null;
        requestFrame();
      }, delay);
    } else {
      requestFrame();
    }
  }

  private sendElements() {
    const start = performance.now();
    const records = this.encodeElements(this.app.scene.getNonDeletedElements());
    const duration = performance.now() - start;
    this.nextEncodingAt = start + duration / MAX_ENCODING_LOAD;

    this.isElementsDirty = false;
    this.isAwaitingFrame = true;
    this.send({ type: "elements", seq: ++this.elementsSeq, records }, [
      records.buffer,
    ]);
  }

  /** @see MinimapRecord for the format */
  private encodeElements(elements: readonly NonDeletedExcalidrawElement[]) {
    const { MinimapRecord } = this.shared!;
    let records = this.scratch;
    let length = 0;

    const reserve = (size: number) => {
      if (length + size > records.length) {
        const grown = new Float32Array(
          Math.max(records.length * 2, length + size),
        );
        grown.set(records);
        records = grown;
      }
    };

    for (const element of elements) {
      if (
        element.type === "line" ||
        element.type === "arrow" ||
        element.type === "freedraw"
      ) {
        const { points } = element;
        const count = Math.min(points.length, MAX_PATH_POINTS);
        reserve(5 + count * 2);
        records[length++] = MinimapRecord.PATH;
        records[length++] = element.x;
        records[length++] = element.y;
        records[length++] = element.angle;
        records[length++] = count;
        const step = count > 1 ? (points.length - 1) / (count - 1) : 0;
        for (let index = 0; index < count; index++) {
          const point = points[Math.round(index * step)];
          records[length++] = point[0];
          records[length++] = point[1];
        }
      } else if (
        // labels are covered by their containers
        !(element.type === "text" && element.containerId)
      ) {
        reserve(6);
        records[length++] =
          element.type === "frame" || element.type === "magicframe"
            ? MinimapRecord.FRAME
            : MinimapRecord.BOX;
        records[length++] = element.x;
        records[length++] = element.y;
        records[length++] = element.width;
        records[length++] = element.height;
        records[length++] = element.angle;
      }
    }

    this.scratch = records;
    // a copy, as it's handed over (transferred) to the renderer
    return records.slice(0, length);
  }

  // ---------------------------------------------------------------------------
  // renderer → editor
  // ---------------------------------------------------------------------------

  private onFrame(message: MinimapOutMessage) {
    if (this.isDestroyed) {
      return;
    }
    this.transform = message.transform;
    this.contentBounds = message.contentBounds;
    if (message.elementsSeq === this.elementsSeq) {
      this.isAwaitingFrame = false;
      this.scheduleEncoding();
    }
  }

  // ---------------------------------------------------------------------------
  // dragging the viewport
  // ---------------------------------------------------------------------------

  /** the position of the pointer in the minimap (CSS px) */
  private getPointerPosition(event: PointerEvent) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - this.container.clientLeft,
      y: event.clientY - rect.top - this.container.clientTop,
    };
  }

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

    const transform = this.transform;
    const viewport = this.getViewport();
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
      this.send({ type: "lock", transform });
    }
    this.container.setPointerCapture(event.pointerId);
    this.container.classList.add("minimap--dragging");

    if (!isOverViewport) {
      this.moveViewport();
    }
  };

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
    const viewport = this.getViewport();

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
      const viewport = this.getViewport();
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
    this.send({ type: "lock", transform: null });
  };

  private cancelUnlock() {
    if (this.unlockFrame !== null) {
      this.app.ownerWindow.cancelAnimationFrame(this.unlockFrame);
      this.unlockFrame = null;
    }
  }
}
