/**
 * Minimap renderer & message protocol, shared by the worker and by the
 * main-thread fallback.
 *
 * DON'T depend on anything from the outside, as this module is part of a
 * separate lazy-loaded chunk that's also loaded by the worker — including
 * anything from the main chunk would pull the whole editor into the worker.
 */

// -----------------------------------------------------------------------------
// protocol
// -----------------------------------------------------------------------------

/**
 * Elements are sent as a flat Float32Array of records, so that the main
 * thread only copies a few numbers per element and everything else (bounds,
 * transform, drawing) happens off the main thread. Each record starts with
 * its kind:
 *
 * - `BOX` & `FRAME`: `kind, x, y, width, height, angle`
 * - `PATH`: `kind, x, y, angle, pointsCount, ...[pointX, pointY]` (points
 *   are relative to `x`/`y`, same as on linear elements)
 */
export const MinimapRecord = {
  /** drawn as a filled block */
  BOX: 0,
  /** drawn as an outline, so that it doesn't cover its children */
  FRAME: 1,
  /** drawn as a polyline */
  PATH: 2,
} as const;

export const MINIMAP_BOX_RECORD_SIZE = 6;
export const MINIMAP_PATH_RECORD_HEADER_SIZE = 5;

/** scene → minimap (CSS pixels): `minimap = scene * scale + translate` */
export type MinimapTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

/** in scene coordinates */
export type MinimapViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MinimapColors = {
  element: string;
  viewport: string;
};

export type MinimapConfig = {
  /** CSS pixels */
  width: number;
  /** CSS pixels */
  height: number;
  devicePixelRatio: number;
  colors: MinimapColors;
};

type MinimapCanvas = OffscreenCanvas | HTMLCanvasElement;

export type MinimapInMessage =
  | { type: "init"; canvas: MinimapCanvas; config: MinimapConfig }
  | { type: "config"; config: MinimapConfig }
  | { type: "elements"; seq: number; records: Float32Array }
  | { type: "viewport"; viewport: MinimapViewport }
  /**
   * While a transform is supplied, it's used as is instead of being fitted
   * to the content. Used while dragging the viewport of a locked (scroll-
   * constrained) editor, so that the minimap doesn't rescale as the viewport
   * rubberbands past the lock.
   */
  | { type: "lock"; transform: MinimapTransform | null };

export type MinimapOutMessage = {
  type: "frame";
  /** the transform the frame was rendered with */
  transform: MinimapTransform;
  /** `seq` of the elements the frame was rendered with */
  elementsSeq: number;
  /** bounds of those elements, in scene coordinates (null if there are none) */
  contentBounds: MinimapBounds | null;
};

// -----------------------------------------------------------------------------
// renderer
// -----------------------------------------------------------------------------

/** CSS pixels */
const PADDING = 8;
/** CSS pixels. Keeps tiny elements visible. */
const MIN_BLOCK_SIZE = 1.5;
/** CSS pixels. Keeps the viewport visible (and grabbable) when tiny. */
export const MINIMAP_MIN_VIEWPORT_SIZE = 6;
/** CSS pixels */
const PATH_WIDTH = 1.25;
/**
 * The viewport is a translucent overlay, so that the elements in it show
 * through...
 */
const VIEWPORT_ALPHA = 0.25;
/**
 * ...but the smaller it is, the more opaque — it'd otherwise get lost among
 * the elements. As fractions of the minimap's size (the viewport's larger
 * side to the minimap's respective one): fully opaque at the first and below,
 * at the regular opacity from the second up.
 */
const VIEWPORT_OPAQUE_SIZE = 0.05;
const VIEWPORT_TRANSLUCENT_SIZE = 0.12;
export type MinimapBounds = [
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
];
type Bounds = MinimapBounds;

const isSameTransform = (a: MinimapTransform | null, b: MinimapTransform) =>
  !!a &&
  a.scale === b.scale &&
  a.translateX === b.translateX &&
  a.translateY === b.translateY;

/**
 * The on-minimap rect of the viewport, grown to the minimum size around its
 * center.
 */
export const getMinimapViewportRect = (
  viewport: MinimapViewport,
  transform: MinimapTransform,
) => {
  const width = Math.max(
    viewport.width * transform.scale,
    MINIMAP_MIN_VIEWPORT_SIZE,
  );
  const height = Math.max(
    viewport.height * transform.scale,
    MINIMAP_MIN_VIEWPORT_SIZE,
  );
  return {
    x:
      (viewport.x + viewport.width / 2) * transform.scale +
      transform.translateX -
      width / 2,
    y:
      (viewport.y + viewport.height / 2) * transform.scale +
      transform.translateY -
      height / 2,
    width,
    height,
  };
};

const getRecordsBounds = (records: Float32Array): Bounds | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const extend = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    angle: number,
  ) => {
    if (angle) {
      // AABB of the rect rotated around its center
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const halfWidth = (x2 - x1) / 2;
      const halfHeight = (y2 - y1) / 2;
      const extentX = halfWidth * cos + halfHeight * sin;
      const extentY = halfWidth * sin + halfHeight * cos;
      x1 = cx - extentX;
      x2 = cx + extentX;
      y1 = cy - extentY;
      y2 = cy + extentY;
    }
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  };

  let i = 0;
  while (i < records.length) {
    if (records[i] === MinimapRecord.PATH) {
      const [x1, y1, x2, y2] = getPathBounds(records, i);
      extend(x1, y1, x2, y2, records[i + 3]);
      i += MINIMAP_PATH_RECORD_HEADER_SIZE + records[i + 4] * 2;
    } else {
      const x = records[i + 1];
      const y = records[i + 2];
      const width = records[i + 3];
      const height = records[i + 4];
      // elements being drawn can have negative dimensions
      extend(
        Math.min(x, x + width),
        Math.min(y, y + height),
        Math.max(x, x + width),
        Math.max(y, y + height),
        records[i + 5],
      );
      i += MINIMAP_BOX_RECORD_SIZE;
    }
  }

  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
};

/** unrotated bounds of the PATH record at `offset` */
const getPathBounds = (records: Float32Array, offset: number): Bounds => {
  const x = records[offset + 1];
  const y = records[offset + 2];
  const count = records[offset + 4];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let p = 0; p < count; p++) {
    const px = records[offset + MINIMAP_PATH_RECORD_HEADER_SIZE + p * 2];
    const py = records[offset + MINIMAP_PATH_RECORD_HEADER_SIZE + p * 2 + 1];
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  if (!count) {
    return [x, y, x, y];
  }
  return [x + minX, y + minY, x + maxX, y + maxY];
};

type Context2D =
  | OffscreenCanvasRenderingContext2D
  | CanvasRenderingContext2D
  | null;

class MinimapRenderer {
  private context: Context2D;
  /**
   * The elements rendered with `layerTransform`, so that viewport-only
   * changes (panning, zooming) don't redraw every element.
   */
  private layer: MinimapCanvas;
  private layerContext: Context2D;
  private layerTransform: MinimapTransform | null = null;

  private records: Float32Array = new Float32Array(0);
  private contentBounds: Bounds | null = null;
  private viewport: MinimapViewport | null = null;
  private lockedTransform: MinimapTransform | null = null;

  constructor(private canvas: MinimapCanvas, private config: MinimapConfig) {
    this.context = canvas.getContext("2d") as Context2D;
    this.layer =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(1, 1)
        : (canvas as HTMLCanvasElement).ownerDocument.createElement("canvas");
    this.layerContext = this.layer.getContext("2d") as Context2D;
    this.resize();
  }

  setConfig(config: MinimapConfig) {
    this.config = config;
    this.resize();
  }

  setElements(records: Float32Array) {
    this.records = records;
    this.contentBounds = getRecordsBounds(records);
    this.layerTransform = null;
  }

  setViewport(viewport: MinimapViewport) {
    this.viewport = viewport;
  }

  getContentBounds() {
    return this.contentBounds;
  }

  setLockedTransform(transform: MinimapTransform | null) {
    this.lockedTransform = transform;
  }

  private resize() {
    const { width, height, devicePixelRatio } = this.config;
    for (const canvas of [this.canvas, this.layer]) {
      canvas.width = Math.max(1, Math.round(width * devicePixelRatio));
      canvas.height = Math.max(1, Math.round(height * devicePixelRatio));
    }
    this.layerTransform = null;
  }

  /** fits the content along with the viewport into the minimap */
  private getTransform(): MinimapTransform {
    if (this.lockedTransform) {
      return this.lockedTransform;
    }

    let [minX, minY, maxX, maxY] = this.contentBounds ?? [
      Infinity,
      Infinity,
      -Infinity,
      -Infinity,
    ];
    if (this.viewport) {
      minX = Math.min(minX, this.viewport.x);
      minY = Math.min(minY, this.viewport.y);
      maxX = Math.max(maxX, this.viewport.x + this.viewport.width);
      maxY = Math.max(maxY, this.viewport.y + this.viewport.height);
    }

    const { width, height } = this.config;
    if (!Number.isFinite(minX)) {
      return { scale: 1, translateX: width / 2, translateY: height / 2 };
    }

    const scale = Math.min(
      Math.max(width - PADDING * 2, 1) / Math.max(maxX - minX, 1),
      Math.max(height - PADDING * 2, 1) / Math.max(maxY - minY, 1),
    );

    return {
      scale,
      translateX: width / 2 - ((minX + maxX) / 2) * scale,
      translateY: height / 2 - ((minY + maxY) / 2) * scale,
    };
  }

  private renderLayer(transform: MinimapTransform) {
    const context = this.layerContext;
    if (!context) {
      return;
    }
    const { devicePixelRatio, colors } = this.config;
    const { scale, translateX, translateY } = transform;
    const { records } = this;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.layer.width, this.layer.height);
    context.fillStyle = colors.element;
    context.strokeStyle = colors.element;
    context.lineWidth = PATH_WIDTH;
    context.lineJoin = "round";
    context.lineCap = "round";

    const resetTransform = () =>
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const rotate = (angle: number, cx: number, cy: number) => {
      context.translate(cx, cy);
      context.rotate(angle);
      context.translate(-cx, -cy);
    };
    resetTransform();

    let i = 0;
    while (i < records.length) {
      const kind = records[i];

      if (kind === MinimapRecord.PATH) {
        const count = records[i + 4];
        const angle = records[i + 3];
        const originX = records[i + 1] * scale + translateX;
        const originY = records[i + 2] * scale + translateY;
        const points = i + MINIMAP_PATH_RECORD_HEADER_SIZE;

        if (angle) {
          const [x1, y1, x2, y2] = getPathBounds(records, i);
          rotate(
            angle,
            ((x1 + x2) / 2) * scale + translateX,
            ((y1 + y2) / 2) * scale + translateY,
          );
        }
        context.beginPath();
        for (let p = 0; p < count; p++) {
          const x = originX + records[points + p * 2] * scale;
          const y = originY + records[points + p * 2 + 1] * scale;
          if (p === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        if (count === 1) {
          // a dot
          context.lineTo(originX, originY);
        }
        context.stroke();
        if (angle) {
          resetTransform();
        }

        i += MINIMAP_PATH_RECORD_HEADER_SIZE + count * 2;
        continue;
      }

      const angle = records[i + 5];
      const width = Math.max(Math.abs(records[i + 3]) * scale, MIN_BLOCK_SIZE);
      const height = Math.max(Math.abs(records[i + 4]) * scale, MIN_BLOCK_SIZE);
      const cx = (records[i + 1] + records[i + 3] / 2) * scale + translateX;
      const cy = (records[i + 2] + records[i + 4] / 2) * scale + translateY;

      if (angle) {
        rotate(angle, cx, cy);
      }
      if (kind === MinimapRecord.FRAME) {
        context.strokeRect(cx - width / 2, cy - height / 2, width, height);
      } else {
        context.fillRect(cx - width / 2, cy - height / 2, width, height);
      }
      if (angle) {
        resetTransform();
      }

      i += MINIMAP_BOX_RECORD_SIZE;
    }

    this.layerTransform = transform;
  }

  render(): MinimapTransform {
    const transform = this.getTransform();
    const context = this.context;
    if (!context) {
      return transform;
    }

    if (!isSameTransform(this.layerTransform, transform)) {
      this.renderLayer(transform);
    }

    const { devicePixelRatio, colors } = this.config;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.layer, 0, 0);

    if (this.viewport) {
      const { x, y, width, height } = getMinimapViewportRect(
        this.viewport,
        transform,
      );
      const size = Math.max(
        width / this.config.width,
        height / this.config.height,
      );
      const translucency = Math.min(
        Math.max(
          (size - VIEWPORT_OPAQUE_SIZE) /
            (VIEWPORT_TRANSLUCENT_SIZE - VIEWPORT_OPAQUE_SIZE),
          0,
        ),
        1,
      );

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.globalAlpha = 1 - translucency * (1 - VIEWPORT_ALPHA);
      context.fillStyle = colors.viewport;
      context.beginPath();
      if (context.roundRect) {
        context.roundRect(x, y, width, height, 2);
      } else {
        context.rect(x, y, width, height);
      }
      context.fill();
      context.globalAlpha = 1;
    }

    return transform;
  }
}

// -----------------------------------------------------------------------------
// endpoint
// -----------------------------------------------------------------------------

export type MinimapScheduler = {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
};

/** that of the global scope, i.e. of the worker */
const defaultScheduler: MinimapScheduler = {
  requestFrame: (callback) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(callback)
      : (setTimeout(callback, 16) as unknown as number),
  cancelFrame: (id) => {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  },
};

/**
 * Receives the messages of the editor and renders at most once per frame.
 * Runs in the worker, or on the main thread where workers (or
 * OffscreenCanvas) aren't available — there, supply the scheduler of the
 * window the minimap is rendered in, which may not be the one the code runs
 * in (an editor mounted into a pop-out window).
 */
export const createMinimapEndpoint = (
  postMessage: (message: MinimapOutMessage) => void,
  { requestFrame, cancelFrame }: MinimapScheduler = defaultScheduler,
) => {
  let renderer: MinimapRenderer | null = null;
  let frameId: number | null = null;
  let elementsSeq = -1;
  let reportedSeq = -1;
  let reportedTransform: MinimapTransform | null = null;

  const render = () => {
    frameId = null;
    // nothing is drawn (nor reported) until the first elements arrive: a
    // minimap fitted to the viewport alone would only flash by, and couldn't
    // be dragged in for the lack of content bounds
    if (!renderer || elementsSeq < 0) {
      return;
    }
    const transform = renderer.render();
    // the editor only needs to know about new elements being rendered (so it
    // can send the next ones) and about the transform changing (to map the
    // pointer). Don't wake it up otherwise, e.g. on each panned frame.
    if (
      reportedSeq !== elementsSeq ||
      !isSameTransform(reportedTransform, transform)
    ) {
      reportedSeq = elementsSeq;
      reportedTransform = transform;
      postMessage({
        type: "frame",
        transform,
        elementsSeq,
        contentBounds: renderer.getContentBounds(),
      });
    }
  };

  return {
    handle: (message: MinimapInMessage) => {
      switch (message.type) {
        case "init":
          renderer = new MinimapRenderer(message.canvas, message.config);
          break;
        case "config":
          renderer?.setConfig(message.config);
          break;
        case "elements":
          elementsSeq = message.seq;
          renderer?.setElements(message.records);
          break;
        case "viewport":
          renderer?.setViewport(message.viewport);
          break;
        case "lock":
          renderer?.setLockedTransform(message.transform);
          break;
      }
      if (frameId === null) {
        frameId = requestFrame(render);
      }
    },
    destroy: () => {
      if (frameId !== null) {
        cancelFrame(frameId);
        frameId = null;
      }
      renderer = null;
    },
  };
};
