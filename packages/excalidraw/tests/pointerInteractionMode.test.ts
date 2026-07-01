import { getPointerInteractionMode } from "../interaction/pointerInteractionMode";

import type { PointerInteractionMode } from "../interaction/pointerInteractionMode";
import type { AppState } from "../types";

// Minimal stand-ins: getPointerInteractionMode only reads `type` off elements
// (via isLinearElement) and `isDragging` off the linear editor.
const linear = { type: "arrow" } as AppState["newElement"];
const generic = { type: "rectangle" } as AppState["newElement"];
const linearEditor = (isDragging: boolean) =>
  ({ isDragging } as AppState["selectedLinearElement"]);

type State = Parameters<typeof getPointerInteractionMode>[0];
type Resize = Parameters<typeof getPointerInteractionMode>[1];

const emptyState: State = {
  croppingElementId: null,
  newElement: null,
  multiElement: null,
  selectionElement: null,
  selectedLinearElement: null,
  selectedElementsAreBeingDragged: false,
};

const noResize: Resize = { isResizing: false, handleType: false };

const mode = (
  state: Partial<State>,
  resize: Partial<Resize> = {},
): PointerInteractionMode =>
  getPointerInteractionMode(
    { ...emptyState, ...state },
    { ...noResize, ...resize },
  );

describe("getPointerInteractionMode", () => {
  it("is idle when no interaction field is populated", () => {
    expect(mode({})).toEqual({ kind: "idle" });
  });

  describe("resize / crop (share the isResizing gate)", () => {
    it("is resize when resizing with a handle and no crop target", () => {
      expect(mode({}, { isResizing: true, handleType: "se" })).toEqual({
        kind: "resize",
        handleType: "se",
      });
    });

    it("is crop when a crop target is set — crop wins over resize", () => {
      expect(
        mode(
          { croppingElementId: "img" },
          { isResizing: true, handleType: "se" },
        ),
      ).toEqual({ kind: "crop", elementId: "img" });
    });

    it("does not enter resize/crop unless isResizing is set", () => {
      expect(mode({ croppingElementId: "img" }, { handleType: "se" })).toEqual({
        kind: "idle",
      });
    });

    it("does not enter resize without a handle", () => {
      expect(mode({}, { isResizing: true, handleType: false })).toEqual({
        kind: "idle",
      });
    });

    // App.tsx: a hit resize handle takes precedence over the linear-editor
    // fallback (8579 vs 8601).
    it("resize wins over an active linear editor", () => {
      expect(
        mode(
          { selectedLinearElement: linearEditor(false) },
          { isResizing: true, handleType: "nw" },
        ),
      ).toEqual({ kind: "resize", handleType: "nw" });
    });
  });

  describe("linear element", () => {
    it("is linearCreateFinalizing on the four-field transition", () => {
      expect(
        mode({
          newElement: linear,
          multiElement: linear as AppState["multiElement"],
          selectedLinearElement: linearEditor(false),
        }),
      ).toEqual({ kind: "linearCreateFinalizing" });
    });

    it("is linearCreate while a multi-point element is being created", () => {
      expect(
        mode({ multiElement: linear as AppState["multiElement"] }),
      ).toEqual({ kind: "linearCreate" });
    });

    // The finalizing case requires all four fields; missing the editor is
    // still plain creation.
    it("is linearCreate when the finalizing condition is only partial", () => {
      expect(
        mode({
          newElement: linear,
          multiElement: linear as AppState["multiElement"],
        }),
      ).toEqual({ kind: "linearCreate" });
    });

    it("is linearPointDrag when dragging an editor point", () => {
      expect(mode({ selectedLinearElement: linearEditor(true) })).toEqual({
        kind: "linearPointDrag",
      });
    });

    it("is linearEdit when the editor is open but not dragging", () => {
      expect(mode({ selectedLinearElement: linearEditor(false) })).toEqual({
        kind: "linearEdit",
      });
    });
  });

  describe("selection / drag / generic creation", () => {
    it("is boxSelect when a selection element exists", () => {
      expect(
        mode({ selectionElement: {} as AppState["selectionElement"] }),
      ).toEqual({ kind: "boxSelect" });
    });

    it("is elementDrag when selected elements are being dragged", () => {
      expect(mode({ selectedElementsAreBeingDragged: true })).toEqual({
        kind: "elementDrag",
      });
    });

    it("is genericCreate for a non-linear new element", () => {
      expect(mode({ newElement: generic })).toEqual({ kind: "genericCreate" });
    });
  });

  describe("precedence between overlapping fields", () => {
    it("linear editor wins over a stray selection element", () => {
      expect(
        mode({
          selectedLinearElement: linearEditor(false),
          selectionElement: {} as AppState["selectionElement"],
        }),
      ).toEqual({ kind: "linearEdit" });
    });

    it("box select wins over element drag", () => {
      expect(
        mode({
          selectionElement: {} as AppState["selectionElement"],
          selectedElementsAreBeingDragged: true,
        }),
      ).toEqual({ kind: "boxSelect" });
    });

    it("element drag wins over generic creation", () => {
      expect(
        mode({
          selectedElementsAreBeingDragged: true,
          newElement: generic,
        }),
      ).toEqual({ kind: "elementDrag" });
    });

    it("resize wins over every AppState-derived mode", () => {
      expect(
        mode(
          {
            newElement: generic,
            selectionElement: {} as AppState["selectionElement"],
            selectedElementsAreBeingDragged: true,
          },
          { isResizing: true, handleType: "e" },
        ),
      ).toEqual({ kind: "resize", handleType: "e" });
    });
  });
});
