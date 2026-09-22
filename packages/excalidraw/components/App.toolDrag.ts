import {
  DEFAULT_STICKY_NOTE_SIZE,
  DRAGGING_THRESHOLD,
  EVENT,
  KEYS,
  getGridPoint,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { isStickyNoteElement, newStickyNoteElement } from "@excalidraw/element";

import type {
  ExcalidrawNonSelectionElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { trackEvent } from "../analytics";

import type App from "./App";
import type { ToolType } from "../types";

type ScenePoint = { x: number; y: number };

/** what a drag places: any element the new-element canvas can preview */
type DraggedElement = NonDeleted<ExcalidrawNonSelectionElement>;

/**
 * A tool the user can drag out of the toolbar to drop a default-sized element
 * where the pointer is released.
 */
type DraggableTool = {
  /** the element the drop creates, centered on the pointer */
  createElement: (app: App, center: ScenePoint) => DraggedElement;
  /** what the tool does once its element is on the canvas (e.g. start editing) */
  onDrop?: (app: App, element: DraggedElement) => void;
};

const centered = (center: ScenePoint, width: number, height: number) => ({
  x: center.x - width / 2,
  y: center.y - height / 2,
  width,
  height,
});

/**
 * The tools that can be dragged out of the toolbar. Add an entry to make a
 * tool's button draggable — the gesture, preview and drop are shared.
 */
export const DRAGGABLE_TOOLS: Partial<Record<ToolType, DraggableTool>> = {
  stickynote: {
    createElement: (app, center) => {
      const size = DEFAULT_STICKY_NOTE_SIZE;
      const { state } = app;
      return newStickyNoteElement({
        type: "stickynote",
        ...centered(center, size, size),
        baseHeight: size,
        strokeColor: state.currentItemStickynoteStrokeColor,
        backgroundColor: state.currentItemStickynoteBackgroundColor,
        fillStyle: state.currentItemFillStyle,
        strokeWidth: app.getCurrentItemStrokeWidth("stickynote"),
        strokeStyle: state.currentItemStrokeStyle,
        roughness: state.currentItemRoughness,
        opacity: state.currentItemOpacity,
        roundness: app.getCurrentItemRoundness("stickynote"),
        locked: false,
        frameId: app.getTopLayerFrameAtSceneCoords(center)?.id ?? null,
      });
    },
    onDrop: (app, element) => {
      if (isStickyNoteElement(element)) {
        app.startTextEditing({
          sceneX: element.x + element.width / 2,
          sceneY: element.y + element.height / 2,
          container: element,
        });
      }
    },
  },
};

/** CSS opacity of the preview canvas while dragging */
export const TOOL_DRAG_PREVIEW_OPACITY = 0.5;

/**
 * Dragging a tool out of the toolbar. The preview element exists only here
 * until the drop — it is not in the scene, the store or the history, so
 * collaborators never see it and an aborted drag leaves nothing behind. It
 * is painted by the `NewElementCanvas`, drawn exactly as it will land, with
 * the canvas itself made translucent.
 *
 * The button arms on pointerdown; the drag starts once the pointer has
 * moved `DRAGGING_THRESHOLD`, so a plain click still selects the tool. The
 * gesture lives on the owner window (the pointer leaves the button at once),
 * like the other pointer gestures in `App`.
 */
export class AppToolDrag {
  constructor(private app: App) {}

  /** the element under the pointer while dragging, `null` otherwise */
  public preview: DraggedElement | null = null;

  private armed: {
    type: ToolType;
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null = null;

  private tool: DraggableTool | null = null;
  private type: ToolType | null = null;

  static isDraggable = (type: ToolType) => type in DRAGGABLE_TOOLS;

  isDragging = () => this.preview !== null;

  /**
   * Arm a drag from a tool button's pointerdown. Returns whether the tool is
   * draggable (the caller lets a non-draggable press fall through).
   */
  handleButtonPointerDown = (type: ToolType, event: PointerEvent) => {
    const tool = DRAGGABLE_TOOLS[type];
    if (!tool || event.button !== 0 || !this.app.isInteractionEnabled()) {
      return false;
    }
    this.cancel();
    this.armed = {
      type,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    this.tool = tool;
    this.type = type;
    this.addListeners();
    return true;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.armed || event.pointerId !== this.armed.pointerId) {
      return;
    }
    if (!this.preview) {
      const moved = Math.hypot(
        event.clientX - this.armed.clientX,
        event.clientY - this.armed.clientY,
      );
      if (moved < DRAGGING_THRESHOLD) {
        return;
      }
      trackEvent("toolbar", this.armed.type, "drag");
    }
    const preview = this.tool!.createElement(
      this.app,
      viewportCoordsToSceneCoords(event, this.app.state),
    );
    // Snap after the tool centers its element, just like click-to-place.
    const [x, y] = getGridPoint(
      preview.x,
      preview.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.app.getEffectiveGridSize(),
    );
    this.preview = { ...preview, x, y };
    this.app.triggerRender();
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.armed || event.pointerId !== this.armed.pointerId) {
      return;
    }
    const { preview, tool, type } = this;
    // the button's own click handles a press that never became a drag
    if (!preview) {
      this.cancel();
      return;
    }
    this.cancel();
    if (!this.isOverCanvas(event)) {
      return;
    }
    const { app } = this;
    app.insertNewElement(preview);
    app.store.scheduleCapture();
    app.setState({
      selectedElementIds: { [preview.id]: true },
      selectedGroupIds: {},
    });
    // the drop is a one-off placement: whatever tool was active (an arrow,
    // say) must not stay armed under the dropped element or its editor
    app.setActiveTool(
      { type: app.state.preferredSelectionTool.type },
      { keepSelection: true },
    );
    trackEvent("toolbar", type!, "drop");
    tool!.onDrop?.(app, preview);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE) {
      event.stopPropagation();
      this.cancel();
    }
  };

  /** drop the gesture without a trace */
  cancel = () => {
    const wasDragging = this.preview !== null;
    this.armed = null;
    this.tool = null;
    this.type = null;
    this.preview = null;
    this.removeListeners();
    if (wasDragging) {
      this.app.triggerRender();
    }
  };

  private isOverCanvas = (event: PointerEvent) => {
    // the element under the pointer. `elementFromPoint` sees through the
    // implicit capture a touch gives the button; jsdom doesn't implement it,
    // so fall back to the event's target
    const target = (this.app.ownerDocument.elementFromPoint?.(
      event.clientX,
      event.clientY,
    ) ?? event.target) as Element | null;
    return !!target?.closest?.(".excalidraw__canvas");
  };

  private addListeners = () => {
    const { ownerWindow } = this.app;
    ownerWindow.addEventListener(EVENT.POINTER_MOVE, this.onPointerMove);
    ownerWindow.addEventListener(EVENT.POINTER_UP, this.onPointerUp);
    ownerWindow.addEventListener(EVENT.POINTER_CANCEL, this.cancel);
    ownerWindow.addEventListener(EVENT.BLUR, this.cancel);
    ownerWindow.addEventListener(EVENT.KEYDOWN, this.onKeyDown, true);
  };

  private removeListeners = () => {
    const { ownerWindow } = this.app;
    ownerWindow.removeEventListener(EVENT.POINTER_MOVE, this.onPointerMove);
    ownerWindow.removeEventListener(EVENT.POINTER_UP, this.onPointerUp);
    ownerWindow.removeEventListener(EVENT.POINTER_CANCEL, this.cancel);
    ownerWindow.removeEventListener(EVENT.BLUR, this.cancel);
    ownerWindow.removeEventListener(EVENT.KEYDOWN, this.onKeyDown, true);
  };
}
