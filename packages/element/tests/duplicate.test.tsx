import { pointFrom } from "@excalidraw/math";

import {
  FONT_FAMILY,
  KEYS,
  ORIG_ID,
  ROUNDNESS,
  isPrimitive,
  getUpdatedTimestamp,
} from "@excalidraw/common";

import { Excalidraw, mutateElement } from "@excalidraw/excalidraw";

import { actionDuplicateSelection } from "@excalidraw/excalidraw/actions";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { UI, Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";

import { getTextEditor } from "@excalidraw/excalidraw/tests/queries/dom";

import {
  GlobalTestState,
  act,
  assertElements,
  fireEvent,
  getCloneByOrigId,
  render,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { LocalPoint } from "@excalidraw/math";

import {
  deepCopyElement,
  duplicateElement,
  duplicateElements,
} from "../src/duplicate";

import { isBoundToContainer, isTextElement } from "../src/typeChecks";

import type {
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

const assertCloneObjects = (source: any, clone: any) => {
  for (const key in clone) {
    if (clone.hasOwnProperty(key) && !isPrimitive(clone[key])) {
      expect(clone[key]).not.toBe(source[key]);
      if (source[key]) {
        assertCloneObjects(source[key], clone[key]);
      }
    }
  }
};

describe("duplicating single elements", () => {
  it.each([123, 0, null])(
    "preserves created=%s on a deep copy and resets it for a new instance",
    (created) => {
      const element = API.createElement({ type: "rectangle", created });
      const cloned = deepCopyElement(element);
      const duplicate = duplicateElement(null, new Map(), element);

      expect(cloned).toEqual(element);
      expect(duplicate).toMatchObject({
        created: getUpdatedTimestamp(),
        version: element.version,
        versionNonce: element.versionNonce,
      });
      expect(duplicate.id).not.toBe(element.id);
      expect(element.created).toBe(created);
    },
  );

  it("clones arrow element", () => {
    const element = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      strokeColor: "#000000",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      roughness: 1,
      opacity: 100,
    });

    // @ts-ignore
    element.__proto__ = { hello: "world" };

    mutateElement(element, new Map(), {
      points: [pointFrom<LocalPoint>(1, 2), pointFrom<LocalPoint>(3, 4)],
    });

    const copy = duplicateElement(null, new Map(), element, true);

    assertCloneObjects(element, copy);

    // assert we clone the object's prototype
    // @ts-ignore
    expect(copy.__proto__).toEqual({ hello: "world" });
    expect(copy.hasOwnProperty("hello")).toBe(false);

    expect(copy.points).not.toBe(element.points);
    expect(copy).not.toHaveProperty("shape");
    expect(copy.id).not.toBe(element.id);
    expect(typeof copy.id).toBe("string");
    expect(copy.seed).not.toBe(element.seed);
    expect(typeof copy.seed).toBe("number");
    expect(copy).toEqual({
      ...element,
      id: copy.id,
      seed: copy.seed,
      version: copy.version,
      versionNonce: copy.versionNonce,
    });
  });

  it("clones text element", () => {
    const element = API.createElement({
      type: "text",
      x: 0,
      y: 0,
      strokeColor: "#000000",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roundness: null,
      roughness: 1,
      opacity: 100,
      text: "hello",
      fontSize: 20,
      fontFamily: FONT_FAMILY.Virgil,
      textAlign: "left",
      verticalAlign: "top",
    });

    const copy = duplicateElement(null, new Map(), element);

    assertCloneObjects(element, copy);

    expect(copy).not.toHaveProperty("points");
    expect(copy).not.toHaveProperty("shape");
    expect(copy.id).not.toBe(element.id);
    expect(typeof copy.id).toBe("string");
    expect(typeof copy.seed).toBe("number");
  });
});

describe("duplicating multiple elements", () => {
  it("duplicateElements should clone bindings", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      id: "rectangle1",
      boundElements: [
        { id: "arrow1", type: "arrow" },
        { id: "arrow2", type: "arrow" },
        { id: "text1", type: "text" },
      ],
    });

    const text1 = API.createElement({
      type: "text",
      id: "text1",
      containerId: "rectangle1",
    });

    const arrow1 = API.createElement({
      type: "arrow",
      id: "arrow1",
      startBinding: {
        elementId: "rectangle1",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });

    const arrow2 = API.createElement({
      type: "arrow",
      id: "arrow2",
      endBinding: {
        elementId: "rectangle1",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
      boundElements: [{ id: "text2", type: "text" }],
    });

    const text2 = API.createElement({
      type: "text",
      id: "text2",
      containerId: "arrow2",
    });

    // -------------------------------------------------------------------------

    const origElements = [rectangle1, text1, arrow1, arrow2, text2] as const;
    const { duplicatedElements } = duplicateElements({
      type: "everything",
      elements: origElements,
    });

    // generic id in-equality checks
    // --------------------------------------------------------------------------
    expect(origElements.map((e) => e.type)).toEqual(
      duplicatedElements.map((e) => e.type),
    );
    origElements.forEach((origElement, idx) => {
      const clonedElement = duplicatedElements[idx];
      expect(origElement).toEqual(
        expect.objectContaining({
          id: expect.not.stringMatching(clonedElement.id),
          type: clonedElement.type,
        }),
      );
      if ("containerId" in origElement) {
        expect(origElement.containerId).not.toBe(
          (clonedElement as any).containerId,
        );
      }
      if ("endBinding" in origElement) {
        if (origElement.endBinding) {
          expect(origElement.endBinding.elementId).not.toBe(
            (clonedElement as any).endBinding?.elementId,
          );
        } else {
          expect((clonedElement as any).endBinding).toBeNull();
        }
      }
      if ("startBinding" in origElement) {
        if (origElement.startBinding) {
          expect(origElement.startBinding.elementId).not.toBe(
            (clonedElement as any).startBinding?.elementId,
          );
        } else {
          expect((clonedElement as any).startBinding).toBeNull();
        }
      }
    });
    // --------------------------------------------------------------------------

    const clonedArrows = duplicatedElements.filter(
      (e) => e.type === "arrow",
    ) as ExcalidrawLinearElement[];

    const [clonedRectangle, clonedText1, , clonedArrow2, clonedArrowLabel] =
      duplicatedElements as any as typeof origElements;

    expect(clonedText1.containerId).toBe(clonedRectangle.id);
    expect(
      clonedRectangle.boundElements!.find((e) => e.id === clonedText1.id),
    ).toEqual(
      expect.objectContaining({
        id: clonedText1.id,
        type: clonedText1.type,
      }),
    );
    expect(clonedRectangle.type).toBe("rectangle");

    clonedArrows.forEach((arrow) => {
      expect(
        clonedRectangle.boundElements!.find((e) => e.id === arrow.id),
      ).toEqual(
        expect.objectContaining({
          id: arrow.id,
          type: arrow.type,
        }),
      );

      if (arrow.endBinding) {
        expect(arrow.endBinding.elementId).toBe(clonedRectangle.id);
      }
      if (arrow.startBinding) {
        expect(arrow.startBinding.elementId).toBe(clonedRectangle.id);
      }
    });

    expect(clonedArrow2.boundElements).toEqual([
      { type: "text", id: clonedArrowLabel.id },
    ]);
    expect(clonedArrowLabel.containerId).toBe(clonedArrow2.id);
  });

  it("should remove id references of elements that aren't found", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      id: "rectangle1",
      boundElements: [
        // should keep
        { id: "arrow1", type: "arrow" },
        // should drop
        { id: "arrow-not-exists", type: "arrow" },
        // should drop
        { id: "text-not-exists", type: "text" },
      ],
    });

    const arrow1 = API.createElement({
      type: "arrow",
      id: "arrow1",
      startBinding: {
        elementId: "rectangle1",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });

    const text1 = API.createElement({
      type: "text",
      id: "text1",
      containerId: "rectangle-not-exists",
    });

    const arrow2 = API.createElement({
      type: "arrow",
      id: "arrow2",
      startBinding: {
        elementId: "rectangle1",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
      endBinding: {
        elementId: "rectangle-not-exists",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });

    const arrow3 = API.createElement({
      type: "arrow",
      id: "arrow3",
      startBinding: {
        elementId: "rectangle-not-exists",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
      endBinding: {
        elementId: "rectangle1",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });

    // -------------------------------------------------------------------------

    const origElements = [rectangle1, text1, arrow1, arrow2, arrow3] as const;
    const duplicatedElements = duplicateElements({
      type: "everything",
      elements: origElements,
    }).duplicatedElements as any as typeof origElements;

    const [
      clonedRectangle,
      clonedText1,
      clonedArrow1,
      clonedArrow2,
      clonedArrow3,
    ] = duplicatedElements;

    expect(clonedRectangle.boundElements).toEqual([
      { id: clonedArrow1.id, type: "arrow" },
    ]);

    expect(clonedText1.containerId).toBe(null);

    expect(clonedArrow2.startBinding).toEqual({
      ...arrow2.startBinding,
      elementId: clonedRectangle.id,
    });
    expect(clonedArrow2.endBinding).toBe(null);
    expect(clonedArrow3.startBinding).toBe(null);
    expect(clonedArrow3.endBinding).toEqual({
      ...arrow3.endBinding,
      elementId: clonedRectangle.id,
    });
  });

  describe("should duplicate all group ids", () => {
    it("should regenerate all group ids and keep them consistent across elements", () => {
      const rectangle1 = API.createElement({
        type: "rectangle",
        groupIds: ["g1"],
      });
      const rectangle2 = API.createElement({
        type: "rectangle",
        groupIds: ["g2", "g1"],
      });
      const rectangle3 = API.createElement({
        type: "rectangle",
        groupIds: ["g2", "g1"],
      });

      const origElements = [rectangle1, rectangle2, rectangle3] as const;
      const { duplicatedElements } = duplicateElements({
        type: "everything",
        elements: origElements,
      });
      const [clonedRectangle1, clonedRectangle2, clonedRectangle3] =
        duplicatedElements;

      expect(rectangle1.groupIds[0]).not.toBe(clonedRectangle1.groupIds[0]);
      expect(rectangle2.groupIds[0]).not.toBe(clonedRectangle2.groupIds[0]);
      expect(rectangle2.groupIds[1]).not.toBe(clonedRectangle2.groupIds[1]);

      expect(clonedRectangle1.groupIds[0]).toBe(clonedRectangle2.groupIds[1]);
      expect(clonedRectangle2.groupIds[0]).toBe(clonedRectangle3.groupIds[0]);
      expect(clonedRectangle2.groupIds[1]).toBe(clonedRectangle3.groupIds[1]);
    });

    it("should keep and regenerate ids of groups even if invalid", () => {
      // lone element shouldn't be able to be grouped with itself,
      // but hard to check against in a performant way so we ignore it
      const rectangle1 = API.createElement({
        type: "rectangle",
        groupIds: ["g1"],
      });

      const {
        duplicatedElements: [clonedRectangle1],
      } = duplicateElements({ type: "everything", elements: [rectangle1] });

      expect(typeof clonedRectangle1.groupIds[0]).toBe("string");
      expect(rectangle1.groupIds[0]).not.toBe(clonedRectangle1.groupIds[0]);
    });
  });
});

describe("group-related duplication", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("action-duplicating within group", async () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      groupIds: ["group1"],
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      groupIds: ["group1"],
    });

    API.setElements([rectangle1, rectangle2]);
    API.setSelectedElements([rectangle2], "group1");

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { id: rectangle2.id },
      { [ORIG_ID]: rectangle2.id, selected: true, groupIds: ["group1"] },
    ]);
    expect(h.state.editingGroupId).toBe("group1");
  });

  it("alt-duplicating within group", async () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      groupIds: ["group1"],
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      groupIds: ["group1"],
    });

    API.setElements([rectangle1, rectangle2]);
    API.setSelectedElements([rectangle2], "group1");

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle2.x + 5, rectangle2.y + 5);
      mouse.up(rectangle2.x + 50, rectangle2.y + 50);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { id: rectangle2.id },
      { [ORIG_ID]: rectangle2.id, selected: true, groupIds: ["group1"] },
    ]);
    expect(h.state.editingGroupId).toBe("group1");
  });

  it("alt-duplicating within group away outside frame", () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      groupIds: ["group1"],
      frameId: frame.id,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      groupIds: ["group1"],
      frameId: frame.id,
    });

    API.setElements([frame, rectangle1, rectangle2]);
    API.setSelectedElements([rectangle2], "group1");

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle2.x + 5, rectangle2.y + 5);
      mouse.up(frame.x + frame.width + 50, frame.y + frame.height + 50);
    });

    assertElements(h.elements, [
      { id: frame.id },
      { id: rectangle1.id, frameId: frame.id },
      { id: rectangle2.id, frameId: frame.id },
      { [ORIG_ID]: rectangle2.id, selected: true, groupIds: [], frameId: null },
    ]);
    expect(h.state.editingGroupId).toBe(null);
  });
});

describe("duplication z-order", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("duplication z order with Cmd+D for the lowest z-ordered element should be +1 for the clone", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
    });
    const rectangle3 = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
    });

    API.setElements([rectangle1, rectangle2, rectangle3]);
    API.setSelectedElements([rectangle1]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { [ORIG_ID]: rectangle1.id, selected: true },
      { id: rectangle2.id },
      { id: rectangle3.id },
    ]);
  });

  it("duplication z order with Cmd+D  for the highest z-ordered element should be +1 for the clone", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
    });
    const rectangle3 = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
    });

    API.setElements([rectangle1, rectangle2, rectangle3]);
    API.setSelectedElements([rectangle3]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { id: rectangle2.id },
      { id: rectangle3.id },
      { [ORIG_ID]: rectangle3.id, selected: true },
    ]);
  });

  it("duplication z order with alt+drag for the lowest z-ordered element should be +1 for the clone", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
    });
    const rectangle3 = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
    });

    API.setElements([rectangle1, rectangle2, rectangle3]);

    mouse.select(rectangle1);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle1.x + 5, rectangle1.y + 5);
      mouse.up(rectangle1.x + 5, rectangle1.y + 5);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { [ORIG_ID]: rectangle1.id, selected: true },
      { id: rectangle2.id },
      { id: rectangle3.id },
    ]);
  });

  it("duplication z order with alt+drag for the highest z-ordered element should be +1 for the clone", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
    });
    const rectangle3 = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
    });

    API.setElements([rectangle1, rectangle2, rectangle3]);

    mouse.select(rectangle3);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle3.x + 5, rectangle3.y + 5);
      mouse.up(rectangle3.x + 5, rectangle3.y + 5);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { id: rectangle2.id },
      { id: rectangle3.id },
      { [ORIG_ID]: rectangle3.id, selected: true },
    ]);
  });

  it("duplication z order with alt+drag for the lowest z-ordered element should be +1 for the clone", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
    });
    const rectangle3 = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
    });

    API.setElements([rectangle1, rectangle2, rectangle3]);

    mouse.select(rectangle1);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle1.x + 5, rectangle1.y + 5);
      mouse.up(rectangle1.x + 5, rectangle1.y + 5);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { [ORIG_ID]: rectangle1.id, selected: true },
      { id: rectangle2.id },
      { id: rectangle3.id },
    ]);
  });

  it("duplication z order with alt+drag with grouped elements should consider the group together when determining z-index", () => {
    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      groupIds: ["group1"],
    });
    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      groupIds: ["group1"],
    });
    const rectangle3 = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      groupIds: ["group1"],
    });

    API.setElements([rectangle1, rectangle2, rectangle3]);

    mouse.select(rectangle1);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle1.x + 5, rectangle1.y + 5);
      mouse.up(rectangle1.x + 15, rectangle1.y + 15);
    });

    assertElements(h.elements, [
      { id: rectangle1.id },
      { id: rectangle2.id },
      { id: rectangle3.id },
      { [ORIG_ID]: rectangle1.id, selected: true },
      { [ORIG_ID]: rectangle2.id, selected: true },
      { [ORIG_ID]: rectangle3.id, selected: true },
    ]);
  });

  it("alt-duplicating text container (in-order)", async () => {
    const [rectangle, text] = API.createTextContainer();
    API.setElements([rectangle, text]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle.x + 5, rectangle.y + 5);
      mouse.up(rectangle.x + 15, rectangle.y + 15);
    });

    assertElements(h.elements, [
      { id: rectangle.id },
      { id: text.id, containerId: rectangle.id },
      { [ORIG_ID]: rectangle.id, selected: true },
      {
        [ORIG_ID]: text.id,
        containerId: getCloneByOrigId(rectangle.id)?.id,
      },
    ]);
  });

  it("alt-duplicating text container (out-of-order)", async () => {
    const [rectangle, text] = API.createTextContainer();
    API.setElements([text, rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(rectangle.x + 5, rectangle.y + 5);
      mouse.up(rectangle.x + 15, rectangle.y + 15);
    });

    assertElements(h.elements, [
      { id: rectangle.id },
      { id: text.id, containerId: rectangle.id },
      { [ORIG_ID]: rectangle.id, selected: true },
      {
        [ORIG_ID]: text.id,
        containerId: getCloneByOrigId(rectangle.id)?.id,
      },
    ]);
  });

  it("alt-duplicating labeled arrows (in-order)", async () => {
    const [arrow, text] = API.createLabeledArrow();

    API.setElements([arrow, text]);
    API.setSelectedElements([arrow]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(arrow.x + 5, arrow.y + 5);
      mouse.up(arrow.x + 15, arrow.y + 15);
    });

    assertElements(h.elements, [
      { id: arrow.id },
      { id: text.id, containerId: arrow.id },
      { [ORIG_ID]: arrow.id, selected: true },
      {
        [ORIG_ID]: text.id,
        containerId: getCloneByOrigId(arrow.id)?.id,
      },
    ]);
    expect(h.state.selectedLinearElement).toEqual(
      expect.objectContaining({ elementId: getCloneByOrigId(arrow.id)?.id }),
    );
  });

  it("alt-duplicating labeled arrows (out-of-order)", async () => {
    const [arrow, text] = API.createLabeledArrow();

    API.setElements([text, arrow]);
    API.setSelectedElements([arrow]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(arrow.x + 5, arrow.y + 5);
      mouse.up(arrow.x + 15, arrow.y + 15);
    });

    assertElements(h.elements, [
      { id: arrow.id },
      { id: text.id, containerId: arrow.id },
      { [ORIG_ID]: arrow.id, selected: true },
      {
        [ORIG_ID]: text.id,
        containerId: getCloneByOrigId(arrow.id)?.id,
      },
    ]);
  });

  it("alt-duplicating bindable element with bound arrow should keep the arrow on the duplicate", async () => {
    const rect = UI.createElement("rectangle", {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    const arrow = UI.createElement("arrow", {
      x: -100,
      y: 50,
      width: 115,
      height: 0,
    });

    expect(arrow.endBinding?.elementId).toBe(rect.id);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(5, 5);
      mouse.up(15, 15);
    });

    assertElements(h.elements, [
      {
        id: rect.id,
        boundElements: expect.arrayContaining([
          expect.objectContaining({ id: arrow.id }),
        ]),
      },
      { [ORIG_ID]: rect.id, boundElements: [], selected: true },
      {
        id: arrow.id,
        endBinding: expect.objectContaining({ elementId: rect.id }),
      },
    ]);
  });
});

describe("duplicating list items", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const duplicate = (texts: string[]) => {
    const elements = texts.map((text, index) =>
      API.createElement({ type: "text", text, y: index * 100 }),
    );
    API.setElements(elements);
    API.setSelectedElements(elements);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    // (each duplicate goes right after its original)
    const duplicates = h.elements.filter(
      (element) => h.state.selectedElementIds[element.id],
    ) as ExcalidrawTextElement[];

    return duplicates.map((element) => {
      expect(element).toMatchObject({ text: element.originalText });
      return element.originalText;
    });
  };

  it.each([
    ["1. foo", "2. foo"],
    ["1) foo", "2) foo"],
    ["(9) foo", "(10) foo"],
    ["[1] foo", "[2] foo"],
    ["09. foo", "10. foo"],
    ["0.", "1."],
    ["  b. foo", "  c. foo"],
    ["A) foo", "B) foo"],
    ["(a) foo", "(b) foo"],
    ["(A) foo", "(B) foo"],
    // below `i` alphabetically, from `i` up as roman numerals
    ["h. foo", "i. foo"],
    ["i. foo", "ii. foo"],
    ["viii) foo", "ix) foo"],
    ["(iv) foo", "(v) foo"],
    ["XXXIX. foo", "XL. foo"],
    ["l. foo", "li. foo"],
    ["1. step\n  a. sub-step", "2. step\n  a. sub-step"],
    // lone numbers
    ["7", "8"],
    [" 05 ", " 06 "],
    // numbers up to 42
    ["41", "42"],
    ["42", "42"],
    ["2024", "2024"],
    ["(41) foo", "(42) foo"],
    ["42. foo", "42. foo"],
    // not list items
    ["1.5 kg", "1.5 kg"],
    ["e.g. foo", "e.g. foo"],
    ["[a] foo", "[a] foo"],
    ["j. foo", "j. foo"],
    ["Ii. foo", "Ii. foo"],
    ["iiii. foo", "iiii. foo"],
    ["xcix. foo", "xcix. foo"],
    ["1. foo\n2. bar", "1. foo\n2. bar"],
  ])("advances the marker of %j", (text, expected) => {
    expect(duplicate([text])).toEqual([expected]);
  });

  it("continues the list from the highest of the duplicated items", () => {
    expect(duplicate(["5.", "1.", "3.", "a.", "1", "1"])).toEqual([
      "8.",
      "6.",
      "7.",
      "b.",
      "2",
      "3",
    ]);
  });

  it.each<[string, () => NonDeletedExcalidrawElement[], string[]]>([
    [
      "labeled containers",
      () => [
        ...API.createTextContainer({ label: { text: "1." } }),
        ...API.createTextContainer({ label: { text: "2." } }),
      ],
      ["3.", "4."],
    ],
    // several list items only if they're just markers
    [
      "list items with text",
      () => [
        API.createElement({ type: "text", text: "1. aa" }),
        API.createElement({ type: "text", text: "2. bb" }),
        API.createElement({ type: "text", text: "3. cc" }),
      ],
      ["1. aa", "2. bb", "3. cc"],
    ],
    // along with anything else, list items are copied as they are
    [
      "a labeled container and another element",
      () => [
        ...API.createTextContainer({ label: { text: "1. foo" } }),
        API.createElement({ type: "rectangle" }),
      ],
      ["1. foo"],
    ],
    [
      "a list item and another text",
      () => [
        API.createElement({ type: "text", text: "1. foo" }),
        API.createElement({ type: "text", text: "foo" }),
      ],
      ["1. foo", "foo"],
    ],
    [
      "a list item and another element",
      () => [
        API.createElement({ type: "text", text: "1. foo" }),
        API.createElement({ type: "rectangle" }),
      ],
      ["1. foo"],
    ],
  ])("duplicating %s", (_, createElements, expected) => {
    const elements = createElements();
    API.setElements(elements);
    API.setSelectedElements(
      elements.filter((element) => !isBoundToContainer(element)),
    );

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    expect(
      elements
        .filter(isTextElement)
        .map(
          (text) =>
            (getCloneByOrigId(text.id) as ExcalidrawTextElement).originalText,
        ),
    ).toEqual(expected);
  });

  it("stops letters at `i` (the switch to roman numerals)", () => {
    expect(duplicate(["g.", "h."])).toEqual(["i.", "h."]);
  });

  it.each([
    ["rectangle", "9. foo", "10. foo"],
    ["stickynote", "9. foo", "10. foo"],
    ["ellipse", "3", "4"],
  ] as const)(
    "advances the marker of a %s label %j",
    (type, text, expected) => {
      const container = API.createElement({ type });
      const label = API.createElement({
        type: "text",
        text,
        containerId: container.id,
      });
      API.setElements([container, label]);
      h.app.scene.mutateElement(container, {
        boundElements: [{ type: "text", id: label.id }],
      });
      API.setSelectedElements([container]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: container.id },
        { id: label.id, originalText: text },
        { [ORIG_ID]: container.id, selected: true },
        {
          [ORIG_ID]: label.id,
          containerId: getCloneByOrigId(container.id).id,
          originalText: expected,
        },
      ]);
    },
  );

  it("undo reverts the marker before the duplication", () => {
    const text = API.createElement({ type: "text", text: "1. foo" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });
    // (undo loses the ORIG_ID)
    const { id } = getCloneByOrigId(text.id);

    Keyboard.undo();
    assertElements(h.elements, [
      { id: text.id, originalText: "1. foo" },
      { id, selected: true, originalText: "1. foo" },
    ]);

    Keyboard.undo();
    assertElements(h.elements, [{ id: text.id }, { id, isDeleted: true }]);
  });

  it("alt-drag advances the markers from the start of the drag, undoably", async () => {
    const [container, label] = API.createTextContainer({
      label: { text: "9. foo" },
    });
    API.setElements([container, label]);
    API.setSelectedElements([container]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(container.x + 5, container.y + 5);
      mouse.move(50, 50);
    });

    expect(getCloneByOrigId(label.id)).toMatchObject({
      originalText: "10. foo",
    });

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.up();
    });

    // (undo loses the ORIG_ID)
    const duplicate = getCloneByOrigId(container.id);
    const duplicateLabel = getCloneByOrigId(label.id);
    expect(duplicateLabel).toMatchObject({ originalText: "10. foo" });

    // on to editing the item's text
    const editor = await getTextEditor();
    expect(h.state.editingTextElement?.id).toBe(duplicateLabel.id);
    expect(editor.value).toBe("10. foo");
    await waitFor(() =>
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([4, 7]),
    );
    Keyboard.exitTextEditor(editor);

    Keyboard.undo();
    assertElements(h.elements, [
      { id: container.id },
      { id: label.id, originalText: "9. foo" },
      { id: duplicate.id, selected: true, x: duplicate.x, y: duplicate.y },
      { id: duplicateLabel.id, originalText: "9. foo" },
    ]);

    Keyboard.redo();
    assertElements(h.elements, [
      { id: container.id },
      { id: label.id },
      { id: duplicate.id, selected: true },
      { id: duplicateLabel.id, originalText: "10. foo" },
    ]);
  });

  it("alt-drag doesn't edit a list item without text", () => {
    const text = API.createElement({ type: "text", text: "1" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(text.x + 5, text.y + 5);
      mouse.up(50, 50);
    });

    expect(getCloneByOrigId(text.id)).toMatchObject({ originalText: "2" });
    expect(h.state.editingTextElement).toBe(null);
  });

  it("alt-drag doesn't edit the list item when the drag gets interrupted", () => {
    const text = API.createElement({ type: "text", text: "1. foo" });
    API.setElements([text]);
    API.setSelectedElements([text]);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.down(text.x + 5, text.y + 5);
      mouse.move(50, 50);
    });
    fireEvent.pointerCancel(GlobalTestState.interactiveCanvas, {
      pointerId: 1,
    });

    expect(getCloneByOrigId(text.id)).toMatchObject({ originalText: "2. foo" });
    expect(h.state.editingTextElement).toBe(null);
  });

  it("leaves the texts of a duplicated frame as they are", () => {
    const frame = API.createElement({ type: "frame", width: 500 });
    const text = API.createElement({
      type: "text",
      text: "1. foo",
      frameId: frame.id,
    });
    API.setElements([text, frame]);
    API.setSelectedElements([frame]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: text.id },
      { id: frame.id },
      { [ORIG_ID]: text.id, originalText: "1. foo" },
      { [ORIG_ID]: frame.id, selected: true },
    ]);
  });
});

describe("alt-dragging the text being edited", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  /** alt-presses the text editor, which hands the press over to the canvas */
  const altPressTextEditor = async (x: number, y: number) => {
    const editor = await getTextEditor();
    // (the editor takes pointer downs from the next frame on)
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    mouse.restorePosition(x, y);
    fireEvent.pointerDown(editor, {
      clientX: x,
      clientY: y,
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      altKey: true,
    });
    expect(h.state.editingTextElement).toBe(null);
  };

  it.each([
    ["foo", "foo", "foo"],
    // a list item's text only, as when alt-dragged on the canvas
    ["1. foo", "2. foo", "foo"],
  ])(
    "duplicates %j, editing the duplicate %j with %j selected",
    async (text, duplicateText, selectedText) => {
      const element = API.createElement({ type: "text", text });
      API.setElements([element]);
      API.setSelectedElements([element]);
      Keyboard.keyPress(KEYS.ENTER);
      await altPressTextEditor(element.x + 5, element.y + 5);

      Keyboard.withModifierKeys({ alt: true }, () => {
        mouse.moveTo(element.x + 5, element.y + 50);
        mouse.up();
      });

      const duplicate = getCloneByOrigId(element.id);
      expect(duplicate).toMatchObject({ originalText: duplicateText });
      const duplicateEditor = await getTextEditor();
      expect(h.state.editingTextElement?.id).toBe(duplicate.id);
      await waitFor(() =>
        expect(
          duplicateEditor.value.slice(
            duplicateEditor.selectionStart,
            duplicateEditor.selectionEnd,
          ),
        ).toBe(selectedText),
      );
    },
  );

  // the editor reaches past the text's bounds, over its resize handles
  it("duplicates the text when pressed past its bounds", async () => {
    const element = API.createElement({
      type: "text",
      text: "foo\nbar\nbaz\nqux\nquux",
    });
    API.setElements([element]);
    API.setSelectedElements([element]);
    Keyboard.keyPress(KEYS.ENTER);
    // (as laid out by the editor)
    const { x, y, width, height, fontSize } = h
      .elements[0] as ExcalidrawTextElement;
    await altPressTextEditor(x + 5, y + height + 3);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.moveTo(x + 5, y + height + 100);
      mouse.up();
    });

    assertElements(h.elements, [
      { id: element.id, x, y, width, height, fontSize },
      { id: getCloneByOrigId(element.id).id, width, height, fontSize },
    ]);
  });

  // the label is over the arrow's midpoint handle
  it("duplicates a labeled arrow when pressed on its label", async () => {
    const [arrow, label] = API.createLabeledArrow();
    API.setElements([arrow, label]);
    const { x, y, width, height, points } = arrow as ExcalidrawLinearElement;
    mouse.clickAt(x + width / 4, y + height / 4);
    // (its editor keeps what the last press grabbed)
    mouse.clickAt(x + width / 2, y + height / 2);
    expect(
      h.state.selectedLinearElement?.initialState.segmentMidpoint.value,
    ).not.toBe(null);
    Keyboard.keyPress(KEYS.ENTER);
    expect(h.state.editingTextElement?.id).toBe(label.id);
    await altPressTextEditor(x + width / 2, y + height / 2);

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.moveTo(x + width / 2, y + height + 100);
      mouse.up();
    });

    assertElements(h.elements, [
      { id: arrow.id, x, y, points },
      { id: label.id },
      { id: getCloneByOrigId(arrow.id).id, points },
      { id: getCloneByOrigId(label.id).id },
    ]);
  });
});
