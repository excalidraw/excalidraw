/**
 * The minimap's logic on the editor's side, loaded once the minimap is first
 * shown.
 *
 * DON'T depend on anything from the outside (types aside), so that this
 * lazy-loaded chunk stays self-contained.
 */

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { AppClassProperties } from "../../types";

import type { MinimapHandler } from "./minimap-input.chunk";

import type {
  MinimapBounds,
  MinimapColors,
  MinimapConfig,
  MinimapInMessage,
  MinimapOutMessage,
  MinimapTransform,
  MinimapViewport,
} from "./minimap-shared.chunk";

type MinimapShared = typeof import("./minimap-shared.chunk");

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

  private handlers: MinimapHandler[] = [];

  constructor(public app: AppClassProperties, public container: HTMLElement) {
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
    this.container.focus();
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

    const { MinimapKeyboardHandler, MinimapPointerHandler } = await import(
      "./minimap-input.chunk"
    );
    this.handlers = [
      new MinimapPointerHandler(this),
      new MinimapKeyboardHandler(this),
    ];

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

    this.handlers.forEach((h) => {
      h.attach();
      this.cleanups.push(() => h.detach());
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
    this.handlers.forEach((h) => h.destroy());
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

  send(message: MinimapInMessage, transfer?: Transferable[]) {
    if (this.worker) {
      this.worker.postMessage(message, transfer ?? []);
    } else {
      this.fallback?.handle(message);
    }
  }

  getConfig(): MinimapConfig {
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

  getViewport(): MinimapViewport {
    const { scrollX, scrollY, zoom, width, height } = this.app.state;
    return {
      x: -scrollX,
      y: -scrollY,
      width: width / zoom.value,
      height: height / zoom.value,
    };
  }

  getShared() {
    return this.shared;
  }
  getTransform() {
    return this.transform;
  }
  getContentBounds() {
    return this.contentBounds;
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
}
