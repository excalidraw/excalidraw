import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_PROPS,
  KEYS,
  MIN_WIDTH_OR_HEIGHT,
  getGridPoint,
  isArrowKey,
  isInteractive,
  invariant,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  DEFAULT_DIMENSION,
  makeNextSelectedElementIds,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawGenericElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import type React from "react";
import type App from "./App";

export type KeyboardPlacementShapeType = Extract<
  ExcalidrawGenericElement["type"],
  "rectangle" | "diamond" | "ellipse"
>;

type KeyboardPlacementElement = NonDeleted<
  Extract<ExcalidrawGenericElement, { type: KeyboardPlacementShapeType }>
>;

export const KEYBOARD_PLACEMENT_MOVE_STEP = 10;
export const KEYBOARD_PLACEMENT_RESIZE_STEP = 10;

const KEYBOARD_PLACEMENT_STROKE_COLOR = COLOR_PALETTE.gray[3];
const KEYBOARD_PLACEMENT_BACKGROUND_COLOR = COLOR_PALETTE.gray[1];

export const isKeyboardPlacementShape = (
  type: string,
): type is KeyboardPlacementShapeType =>
  type === "rectangle" || type === "diamond" || type === "ellipse";

export const isKeyboardPlacementElement = (
  element: ExcalidrawElement,
): element is KeyboardPlacementElement =>
  isKeyboardPlacementShape(element.type) && !element.isDeleted;

const getShapeLabel = (type: KeyboardPlacementShapeType) =>
  t(`toolBar.${type}`);

/**
 * Keyboard-only placement for the core generic shapes.
 *
 * Like toolbar drag-and-drop, the pending element stays outside the scene,
 * store, history, and collaboration until it is committed. The regular new
 * element canvas renders it, while App's normal element factory and insertion
 * path make the committed element indistinguishable from a pointer-created one.
 */
export class AppKeyboardPlacement {
  public preview: KeyboardPlacementElement | null = null;
  private elementToCommit: KeyboardPlacementElement | null = null;

  constructor(private app: App) {}

  public isActive = () => this.preview !== null;

  public start = (type: KeyboardPlacementShapeType) => {
    this.cancel();

    const { state } = this.app;
    const center = viewportCoordsToSceneCoords(
      {
        clientX: state.offsetLeft + state.width / 2,
        clientY: state.offsetTop + state.height / 2,
      },
      state,
    );
    const [x, y] = getGridPoint(
      center.x - DEFAULT_DIMENSION / 2,
      center.y - DEFAULT_DIMENSION / 2,
      this.app.getEffectiveGridSize(),
    );
    const frame = this.app.getTopLayerFrameAtSceneCoords(center);

    const element = this.app.createGenericShapeElement({
      type,
      x,
      y,
      width: DEFAULT_DIMENSION,
      height: DEFAULT_DIMENSION,
      frameId: frame?.id ?? null,
    });
    invariant(
      isKeyboardPlacementElement(element),
      "Keyboard placement created an unsupported element",
    );
    this.elementToCommit = element;
    this.preview = newElementWith(element, {
      strokeColor: KEYBOARD_PLACEMENT_STROKE_COLOR,
      backgroundColor: KEYBOARD_PLACEMENT_BACKGROUND_COLOR,
      opacity: DEFAULT_ELEMENT_PROPS.opacity,
    });

    this.app.setToast({
      message: t("keyboardPlacement.started", {
        shape: getShapeLabel(type),
      }),
      duration: Infinity,
    });
    this.app.triggerRender();
  };

  public handleKeyDown = (
    event: React.KeyboardEvent | KeyboardEvent,
  ): boolean => {
    if (!this.preview || isInteractive(event.target)) {
      return false;
    }

    // Let existing modified-arrow workflows keep their shortcuts. A pending
    // placement has no scene selection, so none of them will act on it.
    if (event.altKey || event[KEYS.CTRL_OR_CMD]) {
      // An undo/redo shortcut should never leave a stale preview behind.
      if (
        event[KEYS.CTRL_OR_CMD] &&
        (event.key.toLowerCase() === KEYS.Z ||
          event.key.toLowerCase() === KEYS.Y)
      ) {
        this.cancel();
      }
      return false;
    }

    if (event.key === KEYS.ENTER) {
      this.commit();
      this.consume(event);
      return true;
    }

    if (event.key === KEYS.ESCAPE) {
      this.cancel({ announce: true });
      this.app.setActiveTool(
        { type: this.app.state.preferredSelectionTool.type },
        { keepSelection: true },
      );
      this.consume(event);
      return true;
    }

    if (!isArrowKey(event.key)) {
      return false;
    }

    this.preview = event.shiftKey
      ? this.resize(this.preview, event.key)
      : this.move(this.preview, event.key);
    this.app.triggerRender();
    this.consume(event);
    return true;
  };

  /** Cancel without touching the scene or history. */
  public cancel = ({ announce = false }: { announce?: boolean } = {}) => {
    if (!this.preview) {
      return;
    }

    this.preview = null;
    this.elementToCommit = null;
    this.app.setToast(
      announce ? { message: t("keyboardPlacement.cancelled") } : null,
    );
  };

  /** Tear down during App unmount without scheduling React work. */
  public destroy = () => {
    this.preview = null;
    this.elementToCommit = null;
  };

  private commit = () => {
    const preview = this.preview;
    const elementToCommit = this.elementToCommit;
    if (!preview || !elementToCommit) {
      return;
    }

    const element = newElementWith(elementToCommit, {
      x: preview.x,
      y: preview.y,
      width: preview.width,
      height: preview.height,
    });
    this.preview = null;
    this.elementToCommit = null;
    this.app.insertNewElement(element);
    this.app.store.scheduleCapture();

    if (!this.app.isToolLocked()) {
      this.app.setState((prevState) => ({
        selectedElementIds: makeNextSelectedElementIds(
          { [element.id]: true },
          prevState,
        ),
        selectedGroupIds: {},
      }));
      this.app.setActiveTool(
        { type: this.app.state.preferredSelectionTool.type },
        { keepSelection: true },
      );
    }

    this.app.setToast({
      message: t("keyboardPlacement.created", {
        shape: getShapeLabel(element.type),
      }),
    });
  };

  private move = (
    element: KeyboardPlacementElement,
    key: string,
  ): KeyboardPlacementElement => {
    const step = Math.max(
      this.app.getEffectiveGridSize() ?? 0,
      KEYBOARD_PLACEMENT_MOVE_STEP,
    );
    const offsetX =
      key === KEYS.ARROW_LEFT ? -step : key === KEYS.ARROW_RIGHT ? step : 0;
    const offsetY =
      key === KEYS.ARROW_UP ? -step : key === KEYS.ARROW_DOWN ? step : 0;

    return newElementWith(element, {
      x: element.x + offsetX,
      y: element.y + offsetY,
    });
  };

  private resize = (
    element: KeyboardPlacementElement,
    key: string,
  ): KeyboardPlacementElement => {
    const step = Math.max(
      this.app.getEffectiveGridSize() ?? 0,
      KEYBOARD_PLACEMENT_RESIZE_STEP,
    );
    const horizontal = key === KEYS.ARROW_LEFT || key === KEYS.ARROW_RIGHT;
    const grow = key === KEYS.ARROW_RIGHT || key === KEYS.ARROW_DOWN;
    const delta = grow ? step : -step;
    const width = horizontal
      ? Math.max(MIN_WIDTH_OR_HEIGHT, element.width + delta)
      : element.width;
    const height = horizontal
      ? element.height
      : Math.max(MIN_WIDTH_OR_HEIGHT, element.height + delta);

    // Keep the placement position stable while resizing by growing/shrinking
    // around the element's center.
    return newElementWith(element, {
      x: element.x + (element.width - width) / 2,
      y: element.y + (element.height - height) / 2,
      width,
      height,
    });
  };

  private consume = (event: React.KeyboardEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
}
