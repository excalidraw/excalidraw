import React from "react";
import { vi } from "vitest";

import { KEYS, ORIG_ID } from "@excalidraw/common";

import {
  getElementBounds,
  newElementWith,
  reconcileDuplicatedElements,
  duplicateElements,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionDuplicateSelection } from "../actions";
import { createPasteEvent, serializeAsClipboardJSON } from "../clipboard";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, Keyboard } from "./helpers/ui";
import {
  act,
  assertElements,
  getCloneByOrigId,
  render,
  waitFor,
  GlobalTestState,
  unmountComponent,
} from "./test-utils";

import type { ExcalidrawProps, NormalizedZoomValue } from "../types";

const { h } = window;

const mouse = new Pointer("mouse");

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();
  const { mockThrottleRAF } = await import("./helpers/mocks");

  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
    throttleRAF: mockThrottleRAF,
  };
});

type OnDuplicate = NonNullable<ExcalidrawProps["onDuplicate"]>;

const isDuplicate = (
  element: ExcalidrawElement,
  prevElements: readonly ExcalidrawElement[],
) => !prevElements.some((prevElement) => prevElement.id === element.id);

/** returns new objects for every duplicate */
const stampDuplicates: OnDuplicate = (nextElements, prevElements) =>
  nextElements.map((element) =>
    isDuplicate(element, prevElements)
      ? newElementWith(element, {
          customData: { stamped: true, frameId: element.frameId },
        })
      : element,
  );

/** vetoes duplicates of elements with the supplied ids */
const vetoDuplicatesOf =
  (...origIds: ExcalidrawElement["id"][]): OnDuplicate =>
  (nextElements, prevElements) =>
    nextElements.filter(
      (element) =>
        !isDuplicate(element, prevElements) ||
        !origIds.includes((element as any)[ORIG_ID]),
    );

const renderWithOnDuplicate = async (onDuplicate: OnDuplicate) => {
  await render(
    <Excalidraw
      autoFocus={true}
      handleKeyboardGlobally={true}
      initialData={{ appState: { zoom: { value: 1 as NormalizedZoomValue } } }}
      onDuplicate={onDuplicate}
    />,
  );
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
};

const paste = async (elements: readonly NonDeletedExcalidrawElement[]) => {
  const clipboardJSON = await serializeAsClipboardJSON({
    elements,
    files: null,
  });
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.V);
    document.dispatchEvent(
      createPasteEvent({ types: { "text/plain": clipboardJSON } }),
    );
  });
};

const altDrag = (element: ExcalidrawElement, offset: number) => {
  const x = element.x + element.width / 2;
  const y = element.y + element.height / 2;
  Keyboard.withModifierKeys({ alt: true }, () => {
    mouse.downAt(x, y);
    mouse.moveTo(x + offset / 2, y + offset / 2);
    mouse.moveTo(x + offset, y + offset);
    mouse.up();
  });
};

const createFrame = () =>
  API.createElement({
    type: "frame",
    x: 0,
    y: 0,
    width: 400,
    height: 400,
  });

beforeEach(() => {
  unmountComponent();
  localStorage.clear();
  mouse.reset();
});

describe("props.onDuplicate returning new objects for duplicates", () => {
  beforeEach(async () => {
    await renderWithOnDuplicate(stampDuplicates);
  });

  it("duplicate action", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    assertElements(h.elements, [
      { id: rectangle.id },
      {
        [ORIG_ID]: rectangle.id,
        selected: true,
        customData: { stamped: true, frameId: null },
      },
    ]);
  });

  it("alt-drag", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);

    mouse.select(rectangle);
    altDrag(rectangle, 50);

    assertElements(h.elements, [
      { id: rectangle.id, x: 0, y: 0 },
      {
        [ORIG_ID]: rectangle.id,
        selected: true,
        x: 50,
        y: 50,
        customData: { stamped: true, frameId: null },
      },
    ]);
  });

  it("alt-drag of a container with bound text", () => {
    const [container, text] = API.createTextContainer();
    API.setElements([container, text]);

    expect([container.x, container.y, text.x, text.y]).toEqual([0, 0, 0, 0]);

    mouse.select(container);
    altDrag(container, 50);

    const containerDuplicate = getCloneByOrigId(container.id);
    const textDuplicate = getCloneByOrigId(text.id);

    assertElements(h.elements, [
      { id: container.id, x: 0, y: 0 },
      { id: text.id, x: 0, y: 0, containerId: container.id },
      {
        [ORIG_ID]: container.id,
        selected: true,
        x: 50,
        y: 50,
        boundElements: [{ type: "text", id: textDuplicate.id }],
        customData: { stamped: true, frameId: null },
      },
      {
        [ORIG_ID]: text.id,
        x: 50,
        y: 50,
        containerId: containerDuplicate.id,
        customData: { stamped: true, frameId: null },
      },
    ]);
  });

  it("paste over a frame", async () => {
    const frame = createFrame();
    const [container, text] = API.createTextContainer();
    API.setElements([frame]);

    mouse.moveTo(200, 200);
    // bound text which needs to be redrawn to fit its container
    await paste([container, newElementWith(text, { x: -50, y: -50 })]);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
    });

    const containerDuplicate = getCloneByOrigId(container.id);
    const textDuplicate = getCloneByOrigId(text.id);

    assertElements(h.elements, [
      {
        [ORIG_ID]: container.id,
        selected: true,
        frameId: frame.id,
        // host sees the duplicates already assigned to the frame
        customData: { stamped: true, frameId: frame.id },
      },
      {
        [ORIG_ID]: text.id,
        frameId: frame.id,
        containerId: containerDuplicate.id,
        customData: { stamped: true, frameId: frame.id },
      },
      { id: frame.id },
    ]);

    expect(textDuplicate.x).toBeGreaterThan(containerDuplicate.x);
    expect(textDuplicate.y).toBeGreaterThan(containerDuplicate.y);
    expect(textDuplicate.x + textDuplicate.width).toBeLessThan(
      containerDuplicate.x + containerDuplicate.width,
    );
  });
});

describe("props.onDuplicate changing already measured duplicates", () => {
  // pasting over a frame measures the duplicates (generating their shapes)
  // ahead of the callback
  it("should not keep stale shapes or bounds", async () => {
    await renderWithOnDuplicate((nextElements, prevElements) =>
      nextElements.map((element) => {
        if (!isDuplicate(element, prevElements)) {
          return element;
        }
        return element.type === "arrow"
          ? newElementWith(element, {
              strokeColor: "#ff0000",
              width: 200,
              points: [
                pointFrom<LocalPoint>(0, 0),
                pointFrom<LocalPoint>(200, 0),
              ],
            })
          : // partial element (version isn't bumped)
            ({ id: element.id, width: 50 } as ExcalidrawElement);
      }),
    );

    const frame = createFrame();
    const arrow = API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
    });
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 50,
      width: 100,
      height: 100,
    });
    API.setElements([frame]);

    mouse.moveTo(200, 200);
    await paste([arrow, rectangle]);

    await waitFor(() => {
      expect(h.elements.length).toBe(3);
    });

    const elementsMap = h.app.scene.getNonDeletedElementsMap();
    const getWidth = (element: ExcalidrawElement) => {
      const [x1, , x2] = getElementBounds(element, elementsMap);
      return Math.round(x2 - x1);
    };

    const arrowDuplicate = getCloneByOrigId(arrow.id);
    const rectangleDuplicate = getCloneByOrigId(rectangle.id);

    expect(arrowDuplicate.frameId).toBe(frame.id);
    expect(getWidth(arrowDuplicate)).toBe(200);
    expect(getWidth(rectangleDuplicate)).toBe(50);
  });
});

describe("props.onDuplicate vetoing duplicates", () => {
  const createRectangles = () => {
    const rectangle1 = API.createElement({
      id: "rectangle1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const rectangle2 = API.createElement({
      id: "rectangle2",
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });
    return [rectangle1, rectangle2] as const;
  };

  describe("some", () => {
    beforeEach(async () => {
      await renderWithOnDuplicate(vetoDuplicatesOf("rectangle1"));
    });

    it("duplicate action", () => {
      const [rectangle1, rectangle2] = createRectangles();
      API.setElements([rectangle1, rectangle2]);
      API.setSelectedElements([rectangle1, rectangle2]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      assertElements(h.elements, [
        { id: rectangle1.id },
        { id: rectangle2.id },
        { [ORIG_ID]: rectangle2.id, selected: true },
      ]);
    });

    it("alt-drag leaves the original behind", () => {
      const [rectangle1, rectangle2] = createRectangles();
      API.setElements([rectangle1, rectangle2]);
      API.setSelectedElements([rectangle1, rectangle2]);

      altDrag(rectangle1, 50);

      assertElements(h.elements, [
        { id: rectangle1.id, x: 0, y: 0 },
        { id: rectangle2.id, x: 200, y: 0 },
        { [ORIG_ID]: rectangle2.id, selected: true, x: 250, y: 50 },
      ]);
    });

    it("paste over a frame", async () => {
      const [rectangle1, rectangle2] = createRectangles();
      const frame = createFrame();
      API.setElements([frame]);

      mouse.moveTo(200, 200);
      await paste([rectangle1, rectangle2]);

      await waitFor(() => {
        expect(h.elements.length).toBe(2);
      });

      assertElements(h.elements, [
        { [ORIG_ID]: rectangle2.id, selected: true, frameId: frame.id },
        { id: frame.id },
      ]);
    });
  });

  describe.each([
    ["by omitting them", vetoDuplicatesOf("rectangle1", "rectangle2")],
    ["by returning false", (() => false) as OnDuplicate],
  ])("all, %s", (_, handler) => {
    const onDuplicate = vi.fn(handler);

    beforeEach(async () => {
      onDuplicate.mockClear();
      await renderWithOnDuplicate(onDuplicate);
    });

    it("duplicate action", () => {
      const [rectangle1, rectangle2] = createRectangles();
      API.setElements([rectangle1, rectangle2]);
      API.setSelectedElements([rectangle1, rectangle2]);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      expect(onDuplicate).toHaveBeenCalledTimes(1);
      expect(API.getUndoStack().length).toBe(0);
      assertElements(h.elements, [
        { id: rectangle1.id, selected: true },
        { id: rectangle2.id, selected: true },
      ]);
    });

    it("alt-drag moves the originals", () => {
      const [rectangle1, rectangle2] = createRectangles();
      API.setElements([rectangle1, rectangle2]);
      API.setSelectedElements([rectangle1, rectangle2]);

      altDrag(rectangle1, 50);

      expect(onDuplicate).toHaveBeenCalledTimes(1);
      assertElements(h.elements, [
        { id: rectangle1.id, selected: true, x: 50, y: 50 },
        { id: rectangle2.id, selected: true, x: 250, y: 50 },
      ]);
    });

    it("paste over a frame", async () => {
      const [rectangle1, rectangle2] = createRectangles();
      const frame = createFrame();
      API.setElements([frame]);

      mouse.moveTo(200, 200);
      await paste([rectangle1, rectangle2]);

      await waitFor(() => {
        expect(onDuplicate).toHaveBeenCalledTimes(1);
      });

      expect(API.getUndoStack().length).toBe(0);
      assertElements(h.elements, [{ id: frame.id }]);
    });
  });
});

describe("props.onDuplicate data", () => {
  const onDuplicate = vi.fn<OnDuplicate>();

  const getCall = () => {
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    const [nextElements, prevElements, data] = onDuplicate.mock.calls[0];
    return { nextElements, prevElements, ...data };
  };

  beforeEach(async () => {
    onDuplicate.mockClear();
    await renderWithOnDuplicate(onDuplicate);
  });

  it("duplicate action", () => {
    const [container, text] = API.createTextContainer();
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([container, text, rectangle]);
    API.setSelectedElements([container]);

    act(() => {
      h.app.actionManager.executeAction(actionDuplicateSelection);
    });

    const {
      duplicateElements,
      originalElements,
      origIdToDuplicateId,
      duplicateIdToOrigId,
    } = getCall();

    const containerDuplicate = getCloneByOrigId(container.id);
    const textDuplicate = getCloneByOrigId(text.id);

    // only what takes part in the duplication
    expect([...originalElements]).toEqual([
      [container.id, container],
      [text.id, text],
    ]);
    expect([...duplicateElements.keys()]).toEqual([
      containerDuplicate.id,
      textDuplicate.id,
    ]);
    expect(duplicateElements.get(containerDuplicate.id)).toBe(
      containerDuplicate,
    );
    expect([...origIdToDuplicateId]).toEqual([
      [container.id, containerDuplicate.id],
      [text.id, textDuplicate.id],
    ]);
    expect([...duplicateIdToOrigId]).toEqual([
      [containerDuplicate.id, container.id],
      [textDuplicate.id, text.id],
    ]);
    // the original of a duplicate
    expect(
      originalElements.get(duplicateIdToOrigId.get(textDuplicate.id)!),
    ).toBe(text);
  });

  it("alt-drag supplies the originals as they are in next elements", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);

    mouse.select(rectangle);
    altDrag(rectangle, 50);

    const { nextElements, duplicateElements, originalElements } = getCall();

    expect(originalElements.size).toBe(1);
    expect(originalElements.get(rectangle.id)).toBe(
      nextElements.find((element) => element.id === rectangle.id),
    );
    expect(originalElements.get(rectangle.id)).toMatchObject({ x: 0, y: 0 });
    expect([...duplicateElements.values()]).toEqual([
      getCloneByOrigId(rectangle.id),
    ]);
  });

  it("paste supplies the pasted elements as originals", async () => {
    const rectangle = API.createElement({ id: "rectangle", type: "rectangle" });
    API.setElements([rectangle]);

    await paste([rectangle]);

    await waitFor(() => {
      expect(h.elements.length).toBe(2);
    });

    const { prevElements, originalElements, origIdToDuplicateId } = getCall();

    const original = originalElements.get(rectangle.id)!;
    expect(prevElements).toEqual([rectangle]);
    // the pasted element, not the scene element it was copied from
    expect(original).not.toBe(rectangle);
    expect(h.elements).not.toContain(original);
    expect(origIdToDuplicateId.get(rectangle.id)).toBe(
      getCloneByOrigId(rectangle.id).id,
    );
  });
});

describe("reconcileDuplicatedElements()", () => {
  const duplicate = (elements: readonly ExcalidrawElement[]) => {
    const { duplicatedElements } = duplicateElements({
      type: "everything",
      elements,
    });
    const byOrigId = (origId: ExcalidrawElement["id"]) =>
      duplicatedElements.find(
        (element) => (element as any)[ORIG_ID] === origId,
      )!;
    return { duplicatedElements, byOrigId };
  };

  it("should return the supplied elements if host returns nothing", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const { duplicatedElements } = duplicate([rectangle]);
    const nextElements = [rectangle, ...duplicatedElements];

    const result = reconcileDuplicatedElements(
      undefined,
      nextElements,
      duplicatedElements,
    );

    expect(result.elements).toBe(nextElements);
    expect(result.duplicatedElements).toBe(duplicatedElements);
  });

  it("should veto all duplicates if host returns false", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const { duplicatedElements } = duplicate([rectangle]);
    const nextElements = [rectangle, ...duplicatedElements];

    const result = reconcileDuplicatedElements(
      false,
      nextElements,
      duplicatedElements,
    );

    expect(result.duplicatedElements).toEqual([]);
  });

  it("should merge into duplicates, and replace other elements", () => {
    const rectangle = newElementWith(API.createElement({ type: "rectangle" }), {
      customData: { a: 1 },
    });
    const { duplicatedElements } = duplicate([rectangle]);
    const [rectangleDuplicate] = duplicatedElements;

    const hostRectangle = newElementWith(rectangle, { locked: true });

    const result = reconcileDuplicatedElements(
      [
        hostRectangle,
        newElementWith(rectangleDuplicate, {
          link: "https://excalidraw.com",
          customData: { b: 2 },
        }),
      ],
      [rectangle, rectangleDuplicate],
      duplicatedElements,
    );

    expect(result.elements[0]).toBe(hostRectangle);
    expect(rectangle.locked).toBe(false);

    expect(result.elements[1]).toBe(rectangleDuplicate);
    expect(result.duplicatedElements).toEqual([rectangleDuplicate]);
    expect(rectangleDuplicate.link).toBe("https://excalidraw.com");
    // shallow merge (nested objects are replaced)
    expect(rectangleDuplicate.customData).toEqual({ b: 2 });
  });

  it("should keep properties omitted by the host", () => {
    const rectangle = API.createElement({ type: "rectangle", x: 0 });
    const { duplicatedElements } = duplicate([rectangle]);
    const [rectangleDuplicate] = duplicatedElements;
    const expected = { ...rectangleDuplicate, x: 100 };

    const result = reconcileDuplicatedElements(
      [
        rectangle,
        { id: rectangleDuplicate.id, x: 100 } as unknown as ExcalidrawElement,
      ],
      [rectangle, rectangleDuplicate],
      duplicatedElements,
    );

    expect(result.elements[1]).toBe(rectangleDuplicate);
    expect(rectangleDuplicate).toEqual({
      ...expected,
      // bumped, so that what's cached by version is invalidated
      version: expected.version + 1,
      versionNonce: expect.any(Number),
      updated: expect.any(Number),
    });
  });

  it("should veto duplicates returned as deleted", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const { duplicatedElements } = duplicate([rectangle]);

    const result = reconcileDuplicatedElements(
      [
        rectangle,
        newElementWith<ExcalidrawElement>(duplicatedElements[0], {
          isDeleted: true,
        }),
      ],
      [rectangle, ...duplicatedElements],
      duplicatedElements,
    );

    expect(result.elements).toEqual([rectangle]);
    expect(result.duplicatedElements).toEqual([]);
  });

  it("should veto bound text of a vetoed container", () => {
    const rectangle = API.createElement({
      id: "rectangle",
      type: "rectangle",
      boundElements: [{ type: "text", id: "text" }],
    });
    const text = API.createElement({
      id: "text",
      type: "text",
      containerId: rectangle.id,
    });
    const { duplicatedElements, byOrigId } = duplicate([rectangle, text]);
    const nextElements = [rectangle, text, ...duplicatedElements];

    const result = reconcileDuplicatedElements(
      nextElements.filter((element) => element !== byOrigId(rectangle.id)),
      nextElements,
      duplicatedElements,
    );

    expect(result.elements).toEqual([rectangle, text]);
    expect(result.duplicatedElements).toEqual([]);
  });

  it("should veto bound text of a vetoed container (partial element)", () => {
    const rectangle = API.createElement({
      id: "rectangle",
      type: "rectangle",
      boundElements: [{ type: "text", id: "text" }],
    });
    const text = API.createElement({
      id: "text",
      type: "text",
      containerId: rectangle.id,
    });
    const { duplicatedElements, byOrigId } = duplicate([rectangle, text]);

    const result = reconcileDuplicatedElements(
      [
        rectangle,
        text,
        {
          id: byOrigId(text.id).id,
          text: "changed",
        } as unknown as ExcalidrawElement,
      ],
      [rectangle, text, ...duplicatedElements],
      duplicatedElements,
    );

    expect(result.elements).toEqual([rectangle, text]);
    expect(result.duplicatedElements).toEqual([]);
  });

  it("should clear references to vetoed duplicates", () => {
    const frame = API.createElement({ id: "frame", type: "frame" });
    const rectangle = API.createElement({
      id: "rectangle",
      type: "rectangle",
      frameId: frame.id,
      boundElements: [
        { type: "text", id: "text" },
        { type: "arrow", id: "arrow" },
      ],
    });
    const text = API.createElement({
      id: "text",
      type: "text",
      frameId: frame.id,
      containerId: rectangle.id,
    });
    const ellipse = API.createElement({
      id: "ellipse",
      type: "ellipse",
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const arrow = API.createElement({
      id: "arrow",
      type: "arrow",
      startBinding: {
        elementId: rectangle.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
      endBinding: {
        elementId: ellipse.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
    });
    const elements = [rectangle, text, frame, ellipse, arrow];
    const { duplicatedElements, byOrigId } = duplicate(elements);
    const nextElements = [...elements, ...duplicatedElements];

    // sanity check
    expect(byOrigId(rectangle.id).frameId).toBe(byOrigId(frame.id).id);

    const vetoed = [
      byOrigId(frame.id),
      byOrigId(text.id),
      byOrigId(ellipse.id),
    ];

    const result = reconcileDuplicatedElements(
      nextElements.filter((element) => !vetoed.includes(element as any)),
      nextElements,
      duplicatedElements,
    );

    const rectangleDuplicate = byOrigId(rectangle.id);
    const arrowDuplicate = byOrigId(arrow.id) as ExcalidrawArrowElement;

    expect(result.elements).toEqual([
      ...elements,
      rectangleDuplicate,
      arrowDuplicate,
    ]);
    expect(result.duplicatedElements).toEqual([
      rectangleDuplicate,
      arrowDuplicate,
    ]);

    expect(rectangleDuplicate.frameId).toBe(null);
    expect(rectangleDuplicate.boundElements).toEqual([
      { type: "arrow", id: arrowDuplicate.id },
    ]);
    expect(arrowDuplicate.startBinding?.elementId).toBe(rectangleDuplicate.id);
    expect(arrowDuplicate.endBinding).toBe(null);
  });
});
