import { expect } from "@playwright/test";

import { DEFAULT_TOOL_KEYS } from "./shapes";

import type { Page } from "@playwright/test";
import type {
  DrawShapeOptions,
  Point,
  SceneAdapter,
  SceneElement,
  ShapeType,
} from "./types";

/** Default shape bounds relative to the canvas center. */
const DEFAULT_FROM: Point = { x: -230, y: -140 };
const DEFAULT_TO: Point = { x: 110, y: 70 };

const DEFAULT_TIMEOUT = 10_000;

export type ExcalidrawDriverOptions = {
  /** Path to open the editor at. Defaults to `/`. */
  path?: string;
  /** Keyboard modifier used for app shortcuts (`Meta` on macOS). */
  modifier?: string;
  /** Timeout (ms) for scene polling. */
  timeout?: number;
  /** Override tool shortcuts for apps that remap them. */
  toolKeys?: Partial<Record<ShapeType, string>>;
};

/**
 * Framework-agnostic driver for an Excalidraw canvas.
 *
 * It only assumes two things:
 * 1. a visible `canvas.interactive` element, and
 * 2. a {@link SceneAdapter} that can read elements back.
 *
 * Everything else (hosting app, persistence, auth) is supplied by the caller,
 * which makes the kit reusable outside of the stock `excalidraw-app`.
 */
export class ExcalidrawDriver {
  private readonly toolKeys: Record<ShapeType, string>;
  private readonly modifier: string;
  private readonly timeout: number;
  private readonly path: string;

  constructor(
    public readonly page: Page,
    private readonly adapter: SceneAdapter,
    options: ExcalidrawDriverOptions = {},
  ) {
    this.toolKeys = { ...DEFAULT_TOOL_KEYS, ...options.toolKeys };
    this.modifier =
      options.modifier ?? (process.platform === "darwin" ? "Meta" : "Control");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.path = options.path ?? "/";
  }

  /** Navigate to the editor and wait until the adapter reports readiness. */
  async open() {
    await this.page.goto(this.path);
    await this.adapter.waitUntilReady(this.page);
    return this;
  }

  /** Clear any state the adapter knows how to clear. */
  async reset() {
    await this.adapter.reset?.(this.page);
  }

  /** Read the current scene. */
  async getElements(): Promise<SceneElement[]> {
    return this.adapter.getElements(this.page);
  }

  /** Return elements of a given type. */
  async getElementsByType(type: ShapeType): Promise<SceneElement[]> {
    const elements = await this.getElements();
    return elements.filter((element) => element.type === type);
  }

  /** Poll the scene until the total (or per-type) element count matches. */
  async waitForElementCount(count: number, type?: ShapeType) {
    await expect
      .poll(
        async () => {
          const elements = await this.getElements();
          return type
            ? elements.filter((element) => element.type === type).length
            : elements.length;
        },
        { timeout: this.timeout },
      )
      .toBe(count);
  }

  /** Poll until at least `count` elements of `type` exist. */
  async waitForElementType(type: ShapeType, count = 1) {
    return this.waitForElementCount(count, type);
  }

  /** Select a tool using its configured keyboard shortcut. */
  async activateTool(type: ShapeType) {
    await this.page.keyboard.press(this.toolKeys[type]);
  }

  /**
   * Draw one shape at the canvas center. Coordinates are relative offsets from
   * the canvas center, so the helper is independent of viewport size.
   */
  async drawShape(type: ShapeType, options: DrawShapeOptions = {}) {
    const box = await this.getCanvasBox();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await this.activateTool(type);

    if (type === "text") {
      const point = options.from ?? { x: 0, y: 0 };
      await this.page.mouse.click(centerX + point.x, centerY + point.y);
      await this.page.keyboard.type(options.text ?? "Hello Excalidraw");
      await this.page.keyboard.press("Escape");
      return;
    }

    const from = options.from ?? DEFAULT_FROM;
    const to = options.to ?? DEFAULT_TO;
    const steps = options.steps ?? (type === "freedraw" ? 24 : 12);

    await this.page.mouse.move(centerX + from.x, centerY + from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(centerX + to.x, centerY + to.y, { steps });
    await this.page.mouse.up();
  }

  async drawRectangle(options?: DrawShapeOptions) {
    return this.drawShape("rectangle", options);
  }

  async drawDiamond(options?: DrawShapeOptions) {
    return this.drawShape("diamond", options);
  }

  async drawEllipse(options?: DrawShapeOptions) {
    return this.drawShape("ellipse", options);
  }

  async drawArrow(options?: DrawShapeOptions) {
    return this.drawShape("arrow", options);
  }

  async drawLine(options?: DrawShapeOptions) {
    return this.drawShape("line", options);
  }

  async drawFreedraw(options?: DrawShapeOptions) {
    return this.drawShape("freedraw", options);
  }

  async drawText(options?: DrawShapeOptions) {
    return this.drawShape("text", options);
  }

  async drawFrame(options?: DrawShapeOptions) {
    return this.drawShape("frame", options);
  }

  /** Select all and delete, then wait for the adapter to report an empty scene. */
  async clear() {
    await this.page.keyboard.press(`${this.modifier}+a`);
    await this.page.keyboard.press("Backspace");
    await this.waitForElementCount(0);
  }

  private async getCanvasBox() {
    const box = await this.page.locator("canvas.interactive").boundingBox();
    if (!box) {
      throw new Error(
        "Could not find the interactive canvas. Is the editor mounted?",
      );
    }
    return box;
  }
}
