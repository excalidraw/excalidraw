import { CURSOR_TYPE, MIME_TYPES, THEME } from "@excalidraw/common";

import { isHandToolActive, isEraserActive } from "../appState";

import type App from "./App";
import type { AppState, DataURL } from "../types";

const laserPointerCursorSVG_tag = `<svg viewBox="0 0 24 24" stroke-width="1" width="28" height="28" xmlns="http://www.w3.org/2000/svg">`;
const laserPointerCursorBackgroundSVG = `<path d="M6.164 11.755a5.314 5.314 0 0 1-4.932-5.298 5.314 5.314 0 0 1 5.311-5.311 5.314 5.314 0 0 1 5.307 5.113l8.773 8.773a3.322 3.322 0 0 1 0 4.696l-.895.895a3.322 3.322 0 0 1-4.696 0l-8.868-8.868Z" style="fill:#fff"/>`;
const laserPointerCursorIconSVG = `<path stroke="#1b1b1f" fill="#fff" d="m7.868 11.113 7.773 7.774a2.359 2.359 0 0 0 1.667.691 2.368 2.368 0 0 0 2.357-2.358c0-.625-.248-1.225-.69-1.667L11.201 7.78 9.558 9.469l-1.69 1.643v.001Zm10.273 3.606-3.333 3.333m-3.25-6.583 2 2m-7-7 3 3M3.664 3.625l1 1M2.529 6.922l1.407-.144m5.735-2.932-1.118.866M4.285 9.823l.758-1.194m1.863-6.207-.13 1.408"/>`;

const laserPointerCursorDataURL_lightMode = `data:${
  MIME_TYPES.svg
},${encodeURIComponent(
  `${laserPointerCursorSVG_tag}${laserPointerCursorIconSVG}</svg>`,
)}`;
const laserPointerCursorDataURL_darkMode = `data:${
  MIME_TYPES.svg
},${encodeURIComponent(
  `${laserPointerCursorSVG_tag}${laserPointerCursorBackgroundSVG}${laserPointerCursorIconSVG}</svg>`,
)}`;

/**
 * Captures all cursor management for the interactive canvas.
 *
 * The canvas cursor is set exclusively imperatively, through this class —
 * never via inline styles or React-rendered `style.cursor`, which React
 * would rewrite on rerender whenever the computed value changes, clobbering
 * cursors set here.
 */
export class AppCursor {
  private eraserCanvasCache:
    | (HTMLCanvasElement & { theme?: AppState["theme"] })
    | null = null;
  private eraserPreviewDataURL: DataURL | null = null;

  private drawShapeCanvasCache:
    | (HTMLCanvasElement & { theme?: AppState["theme"] })
    | null = null;
  private drawShapePreviewDataURL: DataURL | null = null;

  constructor(private app: App) {}

  private get canvas() {
    return this.app.interactiveCanvas;
  }

  set = (cursor: string) => {
    if (this.canvas) {
      this.canvas.style.cursor = cursor;
    }
  };

  /**
   * Resets to the resting cursor — the cursor shown when no interaction or
   * hover affordance overrides it: the view-mode grab cursor when
   * drag-to-pan applies, the active tool's cursor otherwise.
   */
  reset = () => {
    if (
      this.app.state.viewModeEnabled &&
      !this.app.isActiveToolPointerCapturing()
    ) {
      if (this.app.isNavigationEnabled()) {
        this.set(CURSOR_TYPE.GRAB);
      } else {
        this.clear();
      }
    } else {
      this.applyForTool();
    }
  };

  /** applies the given tool's cursor (defaults to the active tool) */
  applyForTool = (
    activeTool: AppState["activeTool"] = this.app.state.activeTool,
  ) => {
    if (!this.canvas) {
      return;
    }
    if (activeTool.type === "selection") {
      this.clear();
    } else if (isHandToolActive({ activeTool })) {
      this.set(CURSOR_TYPE.GRAB);
    } else if (isEraserActive({ activeTool })) {
      this.applyEraser();
    } else if (activeTool.type === "drawShape") {
      this.applyDrawShape();
    } else if (activeTool.type === "laser") {
      const url =
        this.app.state.theme === THEME.LIGHT
          ? laserPointerCursorDataURL_lightMode
          : laserPointerCursorDataURL_darkMode;
      this.set(`url(${url}), auto`);
    } else if (!["image", "custom"].includes(activeTool.type)) {
      this.set(CURSOR_TYPE.CROSSHAIR);
      // do nothing if image tool is selected which suggests there's
      // an image-preview set as the cursor
      // Ignore custom type as well and let host decide
    } else if (activeTool.type !== "image") {
      this.set(CURSOR_TYPE.AUTO);
    }
  };

  /** clears the inline cursor so the environment default (CSS) applies */
  private clear = () => {
    if (this.canvas) {
      this.canvas.style.cursor = "";
    }
  };

  private applyEraser = () => {
    const cursorImageSizePx = 20;
    const theme = this.app.state.theme;

    if (!this.eraserCanvasCache || this.eraserCanvasCache.theme !== theme) {
      const isDarkTheme = theme === THEME.DARK;
      this.eraserCanvasCache = document.createElement("canvas");
      this.eraserCanvasCache.theme = theme;
      this.eraserCanvasCache.height = cursorImageSizePx;
      this.eraserCanvasCache.width = cursorImageSizePx;
      const context = this.eraserCanvasCache.getContext("2d")!;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(
        this.eraserCanvasCache.width / 2,
        this.eraserCanvasCache.height / 2,
        5,
        0,
        2 * Math.PI,
      );
      context.fillStyle = isDarkTheme ? "#000" : "#fff";
      context.fill();
      context.strokeStyle = isDarkTheme ? "#fff" : "#000";
      context.stroke();
      this.eraserPreviewDataURL = this.eraserCanvasCache.toDataURL(
        MIME_TYPES.svg,
      ) as DataURL;
    }

    this.set(
      `url(${this.eraserPreviewDataURL}) ${cursorImageSizePx / 2} ${
        cursorImageSizePx / 2
      }, auto`,
    );
  };

  private applyDrawShape = () => {
    const cursorImageSizePx = 20;
    const theme = this.app.state.theme;

    if (
      !this.drawShapeCanvasCache ||
      this.drawShapeCanvasCache.theme !== theme
    ) {
      const isDarkTheme = theme === THEME.DARK;
      this.drawShapeCanvasCache = document.createElement("canvas");
      this.drawShapeCanvasCache.theme = theme;
      this.drawShapeCanvasCache.height = cursorImageSizePx;
      this.drawShapeCanvasCache.width = cursorImageSizePx;
      const context = this.drawShapeCanvasCache.getContext("2d")!;
      context.strokeStyle = isDarkTheme ? "#fff" : "#000";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(4, 10.5);
      context.lineTo(15, 4.15);
      context.lineTo(15, 16.85);
      context.closePath();
      context.stroke();
      this.drawShapePreviewDataURL = this.drawShapeCanvasCache.toDataURL(
        MIME_TYPES.svg,
      ) as DataURL;
    }

    this.set(
      `url(${this.drawShapePreviewDataURL}) ${cursorImageSizePx / 2} ${
        cursorImageSizePx / 2
      }, auto`,
    );
  };
}
