import type { Page } from "@playwright/test";

/**
 * A scene element as returned by a {@link SceneAdapter}. Only the fields the
 * kit relies on are typed; apps are free to return their full element shape.
 */
export type SceneElement = {
  id: string;
  type: string;
  [key: string]: unknown;
};

/**
 * The single integration point between the generic kit and a concrete
 * Excalidraw host. Provide an adapter for how your app exposes its scene
 * (localStorage, a `window` API, a server endpoint, ...).
 */
export interface SceneAdapter {
  /** Resolve once the editor is mounted and ready to receive input. */
  waitUntilReady(page: Page): Promise<void>;
  /** Read the current, non-deleted scene elements. */
  getElements(page: Page): Promise<SceneElement[]>;
  /** Optional: clear persisted scene state between tests. */
  reset?(page: Page): Promise<void>;
}

export type ShapeType =
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "frame";

export type Point = {
  x: number;
  y: number;
};

export type DrawShapeOptions = {
  /** Start point relative to the canvas center, in CSS pixels. */
  from?: Point;
  /** End point relative to the canvas center, in CSS pixels. */
  to?: Point;
  /** Number of intermediate mouse moves (higher = smoother freehand). */
  steps?: number;
  /** Text to type when `type` is `"text"`. */
  text?: string;
};
