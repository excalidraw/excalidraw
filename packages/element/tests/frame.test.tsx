import {
  convertToExcalidrawElements,
  Excalidraw,
} from "@excalidraw/excalidraw";
import { arrayToMap, ELEMENT_TRANSLATE_AMOUNT, KEYS } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { getTextEditor } from "@excalidraw/excalidraw/tests/queries/dom";
import {
  act,
  getCloneByOrigId,
  render,
} from "@excalidraw/excalidraw/tests/test-utils";

import { getSelectedElements } from "@excalidraw/excalidraw/scene";
import { exportScene } from "@excalidraw/excalidraw/scene/export";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import {
  elementOverlapsWithFrame,
  getElementsOverlappingFrame,
  shouldApplyFrameClip,
} from "../src/frame";
import { LinearElementEditor } from "../src/linearElementEditor";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

describe("adding elements to frames", () => {
  type ElementType = string;
  const assertOrder = (
    els: readonly { type: ElementType }[],
    order: ElementType[],
  ) => {
    expect(els.map((el) => el.type)).toEqual(order);
  };

  const reorderElements = <T extends { type: ElementType }>(
    els: readonly T[],
    order: ElementType[],
  ) => {
    return order.reduce((acc: T[], el) => {
      acc.push(els.find((e) => e.type === el)!);
      return acc;
    }, []);
  };

  function resizeFrameOverElement(
    frame: ExcalidrawElement,
    element: ExcalidrawElement,
  ) {
    mouse.clickAt(0, 0);
    mouse.downAt(frame.x + frame.width, frame.y + frame.height);
    mouse.moveTo(
      element.x + element.width + 50,
      element.y + element.height + 50,
    );
    mouse.up();
  }

  function dragElementIntoFrame(
    frame: ExcalidrawElement,
    element: ExcalidrawElement,
  ) {
    mouse.clickAt(element.x, element.y);
    mouse.downAt(element.x + element.width / 2, element.y + element.height / 2);
    mouse.moveTo(frame.x + frame.width / 2, frame.y + frame.height / 2);
    mouse.up();
  }

  function selectElementAndDuplicate(
    element: ExcalidrawElement,
    moveTo: [number, number] = [element.x + 25, element.y + 25],
  ) {
    const [x, y] = [
      element.x + element.width / 2,
      element.y + element.height / 2,
    ];

    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.downAt(x, y);
      mouse.moveTo(moveTo[0], moveTo[1]);
      mouse.up();
    });
  }

  function expectEqualIds(expected: ExcalidrawElement[]) {
    expect(h.elements.map((x) => x.id)).toEqual(expected.map((x) => x.id));
  }

  let frame: ExcalidrawElement;
  let rect1: ExcalidrawElement;
  let rect2: ExcalidrawElement;
  let rect3: ExcalidrawElement;
  let rect4: ExcalidrawElement;
  let text: ExcalidrawElement;
  let arrow: ExcalidrawElement;

  beforeEach(async () => {
    await render(<Excalidraw />);

    frame = API.createElement({ id: "id0", type: "frame", x: 0, width: 150 });
    rect1 = API.createElement({
      id: "id1",
      type: "rectangle",
      x: -1000,
    });
    rect2 = API.createElement({
      id: "id2",
      type: "rectangle",
      x: 200,
      width: 50,
    });
    rect3 = API.createElement({
      id: "id3",
      type: "rectangle",
      x: 400,
      width: 50,
    });
    rect4 = API.createElement({
      id: "id4",
      type: "rectangle",
      x: 1000,
      width: 50,
    });
    text = API.createElement({
      id: "id5",
      type: "text",
      x: 100,
    });
    arrow = API.createElement({
      id: "id6",
      type: "arrow",
      x: 100,
      boundElements: [{ id: text.id, type: "text" }],
    });
  });

  it("should treat an element fully containing a frame as overlapping the frame", () => {
    const containingRect = API.createElement({
      type: "rectangle",
      x: -50,
      y: -50,
      width: 250,
      height: 250,
    });

    API.setElements([containingRect, frame]);

    expect(
      elementOverlapsWithFrame(
        containingRect,
        frame as ExcalidrawFrameLikeElement,
        arrayToMap(h.elements),
      ),
    ).toBe(true);
  });

  it("should add a group a new frame matches edge to edge", () => {
    // a hair outside, as snapping the frame to it leaves it
    const rects = [
      [100 - 1e-8, 100],
      [200, 100 + 1e-8],
    ].map(([x, width]) =>
      API.createElement({
        type: "rectangle",
        x,
        y: 100,
        width,
        height: 100,
        strokeWidth: 4,
        groupIds: ["group"],
      }),
    );
    API.setElements(rects);

    act(() => h.app.setActiveTool({ type: "frame" }));
    mouse.downAt(100, 100);
    mouse.moveTo(300, 200);
    mouse.up();

    const newFrame = h.elements.find((el) => el.type === "frame");
    expect(newFrame).toMatchObject({ x: 100, y: 100, width: 200 });
    expect(
      rects.map((rect) => h.elements.find((el) => el.id === rect.id)?.frameId),
    ).toEqual([newFrame!.id, newFrame!.id]);
  });

  it("should add a group a resized frame matches edge to edge", () => {
    // a hair outside, as snapping the frame to it leaves it
    const rects = [
      [160, 40],
      [200, 50 + 1e-8],
    ].map(([x, width]) =>
      API.createElement({
        type: "rectangle",
        x,
        y: 0,
        width,
        height: 100,
        groupIds: ["group"],
      }),
    );
    API.setElements([frame, ...rects]);

    mouse.clickAt(0, 0);
    mouse.downAt(frame.x + frame.width, frame.y + frame.height);
    mouse.moveTo(250, 100);
    mouse.up();

    expect(
      rects.map((rect) => h.elements.find((el) => el.id === rect.id)?.frameId),
    ).toEqual([frame.id, frame.id]);
  });

  it("should clip a frame's child to it, even if inside it (but for its stroke)", () => {
    const child = API.createElement({
      type: "rectangle",
      x: 1e-7,
      y: 1e-7,
      width: 150 - 2e-7,
      height: 100 - 2e-7,
      frameId: frame.id,
    });
    API.setElements([child, frame]);

    expect(
      shouldApplyFrameClip(
        child,
        frame as ExcalidrawFrameLikeElement,
        h.state,
        arrayToMap(h.elements),
      ),
    ).toBe(true);
  });

  it("should not clip a child dragged out of its frame", () => {
    const child = API.createElement({
      type: "rectangle",
      x: 300,
      width: 50,
      height: 50,
      frameId: frame.id,
    });
    API.setElements([child, frame]);

    expect(
      shouldApplyFrameClip(
        child,
        frame as ExcalidrawFrameLikeElement,
        {
          ...h.state,
          selectedElementIds: { [child.id]: true },
          selectedElementsAreBeingDragged: true,
        },
        arrayToMap(h.elements),
      ),
    ).toBe(false);
  });

  it("should not add a newly created element to a frame behind a non-frame element", () => {
    const cover = API.createElement({
      id: "cover",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      backgroundColor: "#ffc9c9",
    });

    API.setElements([frame, cover]);

    UI.clickTool("rectangle");
    mouse.downAt(20, 20);
    mouse.moveTo(40, 40);
    mouse.upAt(40, 40);

    const createdElement = h.elements.find(
      (element) => element.id !== frame.id && element.id !== cover.id,
    );

    expect(createdElement?.frameId).toBe(null);
    expect(h.elements.map((element) => element.id)).toEqual([
      frame.id,
      cover.id,
      createdElement?.id,
    ]);
  });

  it("should add a newly created element to a frame over a non-frame element", () => {
    const cover = API.createElement({
      id: "cover",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      backgroundColor: "#ffc9c9",
    });

    API.setElements([cover, frame]);

    UI.clickTool("rectangle");
    mouse.downAt(20, 20);
    mouse.moveTo(40, 40);
    mouse.upAt(40, 40);

    const createdElement = h.elements.find(
      (element) => element.id !== frame.id && element.id !== cover.id,
    );

    expect(createdElement?.frameId).toBe(frame.id);
  });

  it("should highlight the target frame while creating a new element", () => {
    API.setElements([frame]);

    UI.clickTool("rectangle");
    mouse.downAt(20, 20);
    mouse.moveTo(40, 40);

    expect(h.state.frameToHighlight?.id).toBe(frame.id);

    mouse.upAt(40, 40);

    expect(h.state.frameToHighlight).toBe(null);
  });

  it("should highlight the target frame while hovering with a creation tool", () => {
    API.setElements([frame]);

    UI.clickTool("rectangle");
    mouse.moveTo(20, 20);

    expect(h.state.frameToHighlight?.id).toBe(frame.id);

    mouse.moveTo(200, 200);

    expect(h.state.frameToHighlight).toBe(null);
  });

  it("should not add grid-snapped text outside the frame to the clicked frame", async () => {
    const offsetFrame = API.createElement({
      id: "offsetFrame",
      type: "frame",
      x: 10,
      y: 0,
      width: 150,
      height: 150,
    });

    API.setElements([offsetFrame]);
    API.setAppState({
      gridModeEnabled: true,
    });

    UI.clickTool("text");
    mouse.clickAt(12, 0);

    await getTextEditor();

    const createdText = h.elements.find(
      (element) => element.id !== offsetFrame.id,
    );

    expect(createdText?.x).toBe(0);
    expect(createdText?.y).toBe(0);
    expect(createdText?.frameId).toBe(null);
  });

  it("should add a newly created element to a frame behind another frame", () => {
    const lockedFrame = API.createElement({
      id: "lockedFrame",
      type: "frame",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      locked: true,
    });

    API.setElements([frame, lockedFrame]);

    UI.clickTool("rectangle");
    mouse.downAt(20, 20);
    mouse.moveTo(40, 40);
    mouse.upAt(40, 40);

    const createdElement = h.elements.find(
      (element) => element.id !== frame.id && element.id !== lockedFrame.id,
    );

    expect(createdElement?.frameId).toBe(frame.id);
  });

  it("should insert a newly created frame child just below its frame", () => {
    const frameChildUnderCursor = API.createElement({
      id: "frameChildUnderCursor",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      backgroundColor: "#ffc9c9",
      frameId: frame.id,
    });
    const otherFrameChild = API.createElement({
      id: "otherFrameChild",
      type: "rectangle",
      x: 100,
      y: 20,
      width: 20,
      height: 20,
      frameId: frame.id,
    });

    API.setElements([frameChildUnderCursor, otherFrameChild, frame]);

    UI.clickTool("rectangle");
    mouse.downAt(20, 20);
    mouse.moveTo(40, 40);
    mouse.upAt(40, 40);

    const createdElement = h.elements.find(
      (element) =>
        element.id !== frame.id &&
        element.id !== frameChildUnderCursor.id &&
        element.id !== otherFrameChild.id,
    );

    expect(createdElement?.frameId).toBe(frame.id);
    expect(h.elements.map((element) => element.id)).toEqual([
      frameChildUnderCursor.id,
      otherFrameChild.id,
      createdElement?.id,
      frame.id,
    ]);
  });

  it("should insert a newly created frame child below its frame despite deleted frame children above it", () => {
    const frameChild = API.createElement({
      id: "frameChild",
      type: "rectangle",
      x: 100,
      y: 20,
      width: 20,
      height: 20,
      frameId: frame.id,
    });
    const deletedFrameChild = API.createElement({
      id: "deletedFrameChild",
      type: "rectangle",
      x: 100,
      y: 60,
      width: 20,
      height: 20,
      frameId: frame.id,
      isDeleted: true,
    });

    API.setElements([frameChild, frame, deletedFrameChild]);

    UI.clickTool("rectangle");
    mouse.downAt(20, 20);
    mouse.moveTo(40, 40);
    mouse.upAt(40, 40);

    const createdElement = h.elements.find(
      (element) =>
        element.id !== frame.id &&
        element.id !== frameChild.id &&
        element.id !== deletedFrameChild.id,
    );

    expect(createdElement?.frameId).toBe(frame.id);
    expect(h.elements.map((element) => element.id)).toEqual([
      frameChild.id,
      createdElement?.id,
      frame.id,
      deletedFrameChild.id,
    ]);
  });

  it("should insert a newly created frame child above the highest frame child", () => {
    const frameChildUnderCursor = API.createElement({
      id: "frameChildUnderCursor",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
      backgroundColor: "#ffc9c9",
      frameId: frame.id,
    });
    const otherFrameChild = API.createElement({
      id: "otherFrameChild",
      type: "rectangle",
      x: 100,
      y: 20,
      width: 20,
      height: 20,
      frameId: frame.id,
    });

    API.setElements([frame, frameChildUnderCursor, otherFrameChild]);

    UI.clickTool("rectangle");
    mouse.downAt(20, 20);
    mouse.moveTo(40, 40);
    mouse.upAt(40, 40);

    const createdElement = h.elements.find(
      (element) =>
        element.id !== frame.id &&
        element.id !== frameChildUnderCursor.id &&
        element.id !== otherFrameChild.id,
    );

    expect(createdElement?.frameId).toBe(frame.id);
    expect(h.elements.map((element) => element.id)).toEqual([
      frame.id,
      frameChildUnderCursor.id,
      otherFrameChild.id,
      createdElement?.id,
    ]);
  });

  const commonTestCases = async (
    func: typeof resizeFrameOverElement | typeof dragElementIntoFrame,
  ) => {
    describe.skip("when frame is in a layer below", async () => {
      it("should add an element", async () => {
        API.setElements([frame, rect2]);

        func(frame, rect2);

        expect(h.elements[0].frameId).toBe(frame.id);
        expectEqualIds([rect2, frame]);
      });

      it("should add elements", async () => {
        API.setElements([frame, rect2, rect3]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        API.setElements([frame, rect1, rect2, rect4, rect3]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame, rect1, rect4]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        API.setElements([frame, rect3, rect4, rect2, rect1]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame, rect4, rect1]);
      });
    });

    describe.skip("when frame is in a layer above", async () => {
      it("should add an element", async () => {
        API.setElements([rect2, frame]);

        func(frame, rect2);

        expect(h.elements[0].frameId).toBe(frame.id);
        expectEqualIds([rect2, frame]);
      });

      it("should add elements", async () => {
        API.setElements([rect2, rect3, frame]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect3, rect2, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        API.setElements([rect1, rect2, rect4, rect3, frame]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect1, rect4, rect3, rect2, frame]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        API.setElements([rect3, rect4, rect2, rect1, frame]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect4, rect1, rect3, rect2, frame]);
      });
    });

    describe("when frame is in an inner layer", async () => {
      it.skip("should add elements", async () => {
        API.setElements([rect2, frame, rect3]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame]);
      });

      it.skip("should add elements when there are other other elements in between", async () => {
        API.setElements([rect2, rect1, frame, rect4, rect3]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect1, rect2, rect3, frame, rect4]);
      });

      it.skip("should add elements when there are other elements in between and the order is reversed", async () => {
        API.setElements([rect3, rect4, frame, rect2, rect1]);

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect4, rect3, rect2, frame, rect1]);
      });
    });
  };

  const resizingTest = async (
    containerType: "arrow" | "rectangle",
    initialOrder: ElementType[],
    expectedOrder: ElementType[],
  ) => {
    await render(<Excalidraw />);

    const frame = API.createElement({ type: "frame", x: 0, y: 0 });

    API.setElements(
      reorderElements(
        [
          frame,
          ...convertToExcalidrawElements([
            {
              type: containerType,
              x: 100,
              y: 100,
              height: 10,
              label: { text: "xx" },
            },
          ]),
        ],
        initialOrder,
      ),
    );

    assertOrder(h.elements, initialOrder);

    expect(h.elements[1].frameId).toBe(null);
    expect(h.elements[2].frameId).toBe(null);

    const container = h.elements[1];

    resizeFrameOverElement(frame, container);
    assertOrder(h.elements, expectedOrder);

    expect(h.elements[0].frameId).toBe(frame.id);
    expect(h.elements[1].frameId).toBe(frame.id);
  };

  describe("resizing frame over elements", async () => {
    await commonTestCases(resizeFrameOverElement);

    it.skip("resizing over text containers and labelled arrows", async () => {
      await resizingTest(
        "rectangle",
        ["frame", "rectangle", "text"],
        ["rectangle", "text", "frame"],
      );
      await resizingTest(
        "rectangle",
        ["frame", "text", "rectangle"],
        ["rectangle", "text", "frame"],
      );
      await resizingTest(
        "rectangle",
        ["rectangle", "text", "frame"],
        ["rectangle", "text", "frame"],
      );
      await resizingTest(
        "rectangle",
        ["text", "rectangle", "frame"],
        ["rectangle", "text", "frame"],
      );
      await resizingTest(
        "arrow",
        ["frame", "arrow", "text"],
        ["arrow", "text", "frame"],
      );
      await resizingTest(
        "arrow",
        ["text", "arrow", "frame"],
        ["arrow", "text", "frame"],
      );
      await resizingTest(
        "arrow",
        ["frame", "arrow", "text"],
        ["arrow", "text", "frame"],
      );

      // FIXME failing in tests (it fails to add elements to frame for some
      // reason) but works in browser. (╯°□°)╯︵ ┻━┻
      //
      // Looks like the `getElementsCompletelyInFrame()` doesn't work
      // in these cases.
      //
      // await testElements(
      //   "arrow",
      //   ["arrow", "text", "frame"],
      //   ["arrow", "text", "frame"],
      // );
    });

    it.skip("should add arrow bound with text when frame is in a layer below", async () => {
      API.setElements([frame, arrow, text]);

      resizeFrameOverElement(frame, arrow);

      expect(arrow.frameId).toBe(frame.id);
      expect(text.frameId).toBe(frame.id);
      expectEqualIds([arrow, text, frame]);
    });

    it("should add arrow bound with text when frame is in a layer above", async () => {
      API.setElements([arrow, text, frame]);

      resizeFrameOverElement(frame, arrow);

      expect(arrow.frameId).toBe(frame.id);
      expect(text.frameId).toBe(frame.id);
      expectEqualIds([arrow, text, frame]);
    });

    it.skip("should add arrow bound with text when frame is in an inner layer", async () => {
      API.setElements([arrow, frame, text]);

      resizeFrameOverElement(frame, arrow);

      expect(arrow.frameId).toBe(frame.id);
      expect(text.frameId).toBe(frame.id);
      expectEqualIds([arrow, text, frame]);
    });
  });

  describe("resizing frame over elements but downwards", async () => {
    it.skip("should add elements when frame is in a layer below", async () => {
      API.setElements([frame, rect1, rect2, rect3, rect4]);

      resizeFrameOverElement(frame, rect4);
      resizeFrameOverElement(frame, rect3);

      expect(rect2.frameId).toBe(frame.id);
      expect(rect3.frameId).toBe(frame.id);
      expectEqualIds([rect2, rect3, frame, rect4, rect1]);
    });

    it.skip("should add elements when frame is in a layer above", async () => {
      API.setElements([rect1, rect2, rect3, rect4, frame]);

      resizeFrameOverElement(frame, rect4);
      resizeFrameOverElement(frame, rect3);

      expect(rect2.frameId).toBe(frame.id);
      expect(rect3.frameId).toBe(frame.id);
      expectEqualIds([rect1, rect2, rect3, frame, rect4]);
    });

    it.skip("should add elements when frame is in an inner layer", async () => {
      API.setElements([rect1, rect2, frame, rect3, rect4]);

      resizeFrameOverElement(frame, rect4);
      resizeFrameOverElement(frame, rect3);

      expect(rect2.frameId).toBe(frame.id);
      expect(rect3.frameId).toBe(frame.id);
      expectEqualIds([rect1, rect2, rect3, frame, rect4]);
    });
  });

  describe("dragging elements into the frame", async () => {
    await commonTestCases(dragElementIntoFrame);

    it("should add a dragged element fully containing the frame", () => {
      const containingRect = API.createElement({
        type: "rectangle",
        x: 220,
        y: 20,
        width: 300,
        height: 300,
      });

      API.setElements([frame, containingRect]);

      dragElementIntoFrame(frame, containingRect);

      expect(API.getElement(containingRect).frameId).toBe(frame.id);
    });

    it("should drag an element into a frame", () => {
      API.setElements([rect2, frame]);

      dragElementIntoFrame(frame, rect2);

      expect(rect2.frameId).toBe(frame.id);
    });

    it("should move an element dragged from one frame into another", () => {
      const otherFrame = API.createElement({
        id: "otherFrame",
        type: "frame",
        x: 300,
        y: 0,
        width: 150,
        height: 150,
      });
      const frameChild = API.createElement({
        id: "frameChild",
        type: "rectangle",
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        frameId: frame.id,
      });

      API.setElements([frame, frameChild, otherFrame]);

      expect(frameChild.frameId).toBe(frame.id);

      dragElementIntoFrame(otherFrame, frameChild);

      expect(frameChild.frameId).toBe(otherFrame.id);
    });

    it("should layer a dragged element above the highest frame child", () => {
      const frameChild = API.createElement({
        id: "frameChild",
        type: "rectangle",
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
      });

      API.setElements([frame, frameChild, rect2]);

      dragElementIntoFrame(frame, rect2);

      expect(rect2.frameId).toBe(frame.id);
      expect(h.elements.map((element) => element.id)).toEqual([
        frame.id,
        frameChild.id,
        rect2.id,
      ]);
      expect(rect2.index! > frameChild.index!).toBe(true);
      expect(rect2.index! > frame.index!).toBe(true);
    });

    it("should preview a dragged element above the highest frame child before pointerup", () => {
      const frameChild = API.createElement({
        id: "frameChild",
        type: "rectangle",
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
      });

      API.setElements([rect2, frame, frameChild]);
      API.setSelectedElements([rect2] as NonDeletedExcalidrawElement[]);
      API.updateElement(rect2, {
        x: 10,
        y: 10,
      });

      const getRenderableElementIds = (
        selectedElementsAreBeingDragged: boolean,
      ) => {
        return h.app.renderer
          .getRenderableElements({
            zoom: h.state.zoom,
            offsetLeft: 0,
            offsetTop: 0,
            scrollX: 0,
            scrollY: 0,
            height: 1000,
            width: 1000,
            editingTextElement: h.state.editingTextElement,
            newElement: h.state.newElement,
            selectedElements: getSelectedElements(h.elements, h.state),
            selectedElementsAreBeingDragged,
            frameToHighlight: frame as NonDeleted<ExcalidrawFrameLikeElement>,
          })
          .visibleElements.map((element) => element.id);
      };

      expect(h.elements.map((element) => element.id)).toEqual([
        rect2.id,
        frame.id,
        frameChild.id,
      ]);
      expect(getRenderableElementIds(false)).toEqual([
        rect2.id,
        frame.id,
        frameChild.id,
      ]);
      expect(getRenderableElementIds(true)).toEqual([
        frame.id,
        frameChild.id,
        rect2.id,
      ]);
      expect(h.elements.map((element) => element.id)).toEqual([
        rect2.id,
        frame.id,
        frameChild.id,
      ]);
      expect(rect2.frameId).toBe(null);
    });

    it("should not preview reorder dragged elements already in the highlighted frame", () => {
      const frameChild = API.createElement({
        id: "frameChild",
        type: "rectangle",
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
      });
      const otherFrameChild = API.createElement({
        id: "otherFrameChild",
        type: "rectangle",
        x: 40,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
      });

      API.setElements([frameChild, frame, otherFrameChild]);
      API.setSelectedElements([frameChild]);

      const renderableElementIds = h.app.renderer
        .getRenderableElements({
          zoom: h.state.zoom,
          offsetLeft: 0,
          offsetTop: 0,
          scrollX: 0,
          scrollY: 0,
          height: 1000,
          width: 1000,
          editingTextElement: h.state.editingTextElement,
          newElement: h.state.newElement,
          selectedElements: getSelectedElements(h.elements, h.state),
          selectedElementsAreBeingDragged: true,
          frameToHighlight: frame as NonDeleted<ExcalidrawFrameLikeElement>,
        })
        .visibleElements.map((element) => element.id);

      expect(renderableElementIds).toEqual([
        frameChild.id,
        frame.id,
        otherFrameChild.id,
      ]);
    });

    it("should put a dragged mixed selection above the highest frame child", () => {
      const frameChild = API.createElement({
        id: "frameChild",
        type: "rectangle",
        x: 50,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
        boundElements: [{ id: "boundText", type: "text" }],
      });
      const boundText = API.createElement({
        id: "boundText",
        type: "text",
        x: 50,
        y: 10,
        width: 20,
        height: 20,
        containerId: frameChild.id,
        frameId: frame.id,
      });
      const otherFrameChild = API.createElement({
        id: "otherFrameChild",
        type: "rectangle",
        x: 80,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
      });
      const nonFrameElement = API.createElement({
        id: "nonFrameElement",
        type: "rectangle",
        x: 155,
        y: 10,
        width: 20,
        height: 20,
      });

      API.setElements([
        frame,
        frameChild,
        boundText,
        otherFrameChild,
        nonFrameElement,
      ]);
      API.setSelectedElements([frameChild, nonFrameElement]);

      mouse.downAt(
        nonFrameElement.x + nonFrameElement.width / 2,
        nonFrameElement.y + nonFrameElement.height / 2,
      );
      mouse.moveTo(frame.x + frame.width - 5, nonFrameElement.y + 10);
      mouse.up();

      expect(frameChild.frameId).toBe(frame.id);
      expect(boundText.frameId).toBe(frame.id);
      expect(nonFrameElement.frameId).toBe(frame.id);
      expect(h.elements.map((element) => element.id)).toEqual([
        frame.id,
        otherFrameChild.id,
        frameChild.id,
        boundText.id,
        nonFrameElement.id,
      ]);
    });

    it("should not reorder dragged elements already in the highlighted frame", () => {
      const frameChild = API.createElement({
        id: "frameChild",
        type: "rectangle",
        x: 50,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
      });
      const otherFrameChild = API.createElement({
        id: "otherFrameChild",
        type: "rectangle",
        x: 80,
        y: 10,
        width: 20,
        height: 20,
        frameId: frame.id,
      });

      API.setElements([frame, frameChild, otherFrameChild]);
      API.setSelectedElements([frameChild]);

      mouse.downAt(
        frameChild.x + frameChild.width / 2,
        frameChild.y + frameChild.height / 2,
      );
      mouse.moveTo(frameChild.x + frameChild.width / 2 + 5, frameChild.y + 10);
      mouse.up();

      expect(frameChild.frameId).toBe(frame.id);
      expect(h.elements.map((element) => element.id)).toEqual([
        frame.id,
        frameChild.id,
        otherFrameChild.id,
      ]);
    });

    it("should not drag an element into a frame behind a non-frame element", () => {
      const cover = API.createElement({
        id: "cover",
        type: "rectangle",
        x: 10,
        y: 10,
        width: 80,
        height: 80,
        backgroundColor: "#ffc9c9",
      });
      API.setElements([frame, cover, rect2]);

      mouse.clickAt(rect2.x, rect2.y);
      mouse.downAt(rect2.x + rect2.width / 2, rect2.y + rect2.height / 2);
      mouse.moveTo(20, 20);
      mouse.upAt(20, 20);

      expect(rect2.frameId).toBe(null);
    });

    it("should drag an element into a frame over a non-frame element", () => {
      const cover = API.createElement({
        id: "cover",
        type: "rectangle",
        x: 10,
        y: 10,
        width: 80,
        height: 80,
        backgroundColor: "#ffc9c9",
      });
      API.setElements([cover, rect2, frame]);

      mouse.clickAt(rect2.x, rect2.y);
      mouse.downAt(rect2.x + rect2.width / 2, rect2.y + rect2.height / 2);
      mouse.moveTo(20, 20);
      mouse.upAt(20, 20);

      expect(rect2.frameId).toBe(frame.id);
    });

    it("should keep dragging a frame child over a non-frame element above its frame", () => {
      const cover = API.createElement({
        id: "cover",
        type: "rectangle",
        x: 10,
        y: 10,
        width: 80,
        height: 80,
        backgroundColor: "#ffc9c9",
      });
      const frameChild = API.createElement({
        id: "frameChild",
        type: "rectangle",
        x: 100,
        y: 20,
        width: 20,
        height: 20,
        frameId: frame.id,
      });

      API.setElements([frameChild, frame, cover]);
      API.setSelectedElements([frameChild]);

      mouse.downAt(
        frameChild.x + frameChild.width / 2,
        frameChild.y + frameChild.height / 2,
      );
      mouse.moveTo(20, 20);

      expect(h.state.frameToHighlight?.id).toBe(frame.id);

      mouse.upAt(20, 20);

      expect(frameChild.frameId).toBe(frame.id);
    });

    it.skip("should drag element inside, duplicate it and keep it in frame", () => {
      API.setElements([frame, rect2]);

      dragElementIntoFrame(frame, rect2);

      selectElementAndDuplicate(rect2);

      const rect2_copy = getCloneByOrigId(rect2.id);

      expect(rect2_copy.frameId).toBe(frame.id);
      expect(rect2.frameId).toBe(frame.id);
      expectEqualIds([rect2_copy, rect2, frame]);
    });

    it.skip("should drag element inside, duplicate it and remove it from frame", () => {
      API.setElements([frame, rect2]);

      dragElementIntoFrame(frame, rect2);

      // move the rect2 outside the frame
      selectElementAndDuplicate(rect2, [-1000, -1000]);

      const rect2_copy = getCloneByOrigId(rect2.id);

      expect(rect2_copy.frameId).toBe(frame.id);
      expect(rect2.frameId).toBe(null);
      expectEqualIds([rect2_copy, frame, rect2]);
    });

    it("random order 01", () => {
      const frame1 = API.createElement({
        type: "frame",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const frame2 = API.createElement({
        type: "frame",
        x: 200,
        y: 0,
        width: 100,
        height: 100,
      });
      const frame3 = API.createElement({
        type: "frame",
        x: 300,
        y: 0,
        width: 100,
        height: 100,
      });

      const rectangle1 = API.createElement({
        type: "rectangle",
        x: 25,
        y: 25,
        width: 50,
        height: 50,
        frameId: frame1.id,
      });
      const rectangle2 = API.createElement({
        type: "rectangle",
        x: 225,
        y: 25,
        width: 50,
        height: 50,
        frameId: frame2.id,
      });
      const rectangle3 = API.createElement({
        type: "rectangle",
        x: 325,
        y: 25,
        width: 50,
        height: 50,
        frameId: frame3.id,
      });
      const rectangle4 = API.createElement({
        type: "rectangle",
        x: 350,
        y: 25,
        width: 50,
        height: 50,
        frameId: frame3.id,
      });

      API.setElements([
        frame1,
        rectangle4,
        rectangle1,
        rectangle3,
        frame3,
        rectangle2,
        frame2,
      ]);

      API.setSelectedElements([rectangle2]);

      const origSize = h.elements.length;

      expect(h.elements.length).toBe(origSize);
      dragElementIntoFrame(frame3, rectangle2);
      expect(h.elements.length).toBe(origSize);
    });

    it("random order 02", () => {
      const frame1 = API.createElement({
        type: "frame",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const frame2 = API.createElement({
        type: "frame",
        x: 200,
        y: 0,
        width: 100,
        height: 100,
      });
      const rectangle1 = API.createElement({
        type: "rectangle",
        x: 25,
        y: 25,
        width: 50,
        height: 50,
        frameId: frame1.id,
      });
      const rectangle2 = API.createElement({
        type: "rectangle",
        x: 225,
        y: 25,
        width: 50,
        height: 50,
        frameId: frame2.id,
      });

      API.setElements([rectangle1, rectangle2, frame1, frame2]);

      API.setSelectedElements([rectangle2]);

      expect(h.elements.length).toBe(4);
      dragElementIntoFrame(frame2, rectangle1);
      expect(h.elements.length).toBe(4);
    });
  });
});

describe("arrows in frames", () => {
  // frame A and frame B side by side, a rectangle in each
  let frameA: NonDeleted<ExcalidrawFrameLikeElement>;
  let frameB: NonDeleted<ExcalidrawFrameLikeElement>;
  let rectA: NonDeletedExcalidrawElement;
  let rectB: NonDeletedExcalidrawElement;

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    frameA = API.createElement({ type: "frame", width: 300, height: 300 });
    frameB = API.createElement({
      type: "frame",
      x: 500,
      y: 0,
      width: 300,
      height: 300,
    });
    rectA = API.createElement({
      type: "rectangle",
      x: 50,
      y: 100,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      frameId: frameA.id,
    });
    rectB = API.createElement({
      type: "rectangle",
      x: 600,
      y: 100,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      frameId: frameB.id,
    });
    API.setElements([rectA, frameA, rectB, frameB]);
  });

  /**
   * draws an arrow from `start` in frame A (rectA by default) to `end` in rectB,
   * which is added to frame A
   */
  const drawArrowBetweenFrames = (
    start = pointFrom<GlobalPoint>(100, 150),
    end = pointFrom<GlobalPoint>(650, 150),
  ) => {
    UI.clickTool("arrow");
    mouse.downAt(...start);
    mouse.moveTo(400, end[1]);
    mouse.moveTo(...end);
    mouse.up();
    UI.clickTool("selection");

    const arrow = h.elements.find(
      (element): element is ExcalidrawArrowElement => element.type === "arrow",
    )!;
    expect(arrow.frameId).toBe(frameA.id);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    return arrow;
  };

  const getPoints = (arrow: ExcalidrawArrowElement) =>
    arrow.points.map((_, index) =>
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        index,
        arrayToMap(h.elements),
      ),
    );

  /** an arrow (with a label) in frame A, reaching out into frame B */
  const createLabeledArrowOutOfFrame = () => {
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 150,
      width: 550,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(550, 0)],
      frameId: frameA.id,
    });
    const label = API.createElement({
      type: "text",
      x: 400,
      y: 140,
      width: 50,
      height: 20,
      containerId: arrow.id,
      frameId: frameA.id,
    });
    h.app.scene.mutateElement(arrow, {
      boundElements: [{ type: "text", id: label.id }],
    });
    API.setElements([rectA, arrow, label, frameA, rectB, frameB]);
    return { arrow, label };
  };

  it("should not clip an arrow, nor its label, to its frame", async () => {
    const { arrow, label } = createLabeledArrowOutOfFrame();

    expect(
      shouldApplyFrameClip(arrow, frameA, h.state, arrayToMap(h.elements)),
    ).toBe(false);

    const data = { elements: h.app.scene.getNonDeletedElements() };
    // the rectangles to their frames, and the arrow's line around its label
    // (drawn with it)
    const canvas = await exportScene({ type: "canvas", data });
    expect(
      (canvas.getContext("2d") as any)
        .__getEvents()
        .filter((event: any) => event.type === "clip"),
    ).toHaveLength(3);

    const svg = await exportScene({ type: "svg", data });
    const getClipPath = (element: ExcalidrawElement) =>
      svg.querySelector(`[data-id="${element.id}"]`)?.getAttribute("clip-path");
    expect(getClipPath(rectA)).toBe(`url(#${frameA.id})`);
    expect(getClipPath(arrow)).toBe(null);
    expect(getClipPath(label)).toBe(null);
  });

  it("should select an arrow by its part outside its frame", () => {
    const arrow = drawArrowBetweenFrames();
    mouse.clickAt(0, 0);

    mouse.clickAt(400, 150);
    expect(h.state.selectedElementIds).toEqual({ [arrow.id]: true });
  });

  it("should export an arrow reaching into a frame from another one", () => {
    const { arrow, label } = createLabeledArrowOutOfFrame();

    expect(
      getElementsOverlappingFrame(h.elements, frameB, arrayToMap(h.elements)),
    ).toEqual([arrow, label, rectB, frameB]);
  });

  it("should keep an arrow bound to an element in another frame when dragging its frame", () => {
    const arrow = drawArrowBetweenFrames();
    expect(arrow.startBinding?.elementId).toBe(rectA.id);
    const { y } = arrow;
    const endPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      arrow,
      -1,
      arrayToMap(h.elements),
    );

    API.setSelectedElements([frameA]);
    mouse.downAt(250, 250);
    mouse.moveTo(250, 300);
    mouse.moveTo(250, 350);
    mouse.up();

    expect(h.app.scene.getElement(frameA.id)?.y).toBe(100);
    expect(arrow.startBinding?.elementId).toBe(rectA.id);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    expect(arrow.y).toBe(y + 100);
    expect(
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        -1,
        arrayToMap(h.elements),
      ),
    ).toEqual(endPoint);
  });

  it("should keep an elbow arrow's fixed segment when dragging its frame", () => {
    API.setAppState({ currentItemArrowType: "elbow" });
    // routed around rectB, with its middle segment fixed
    const arrow = drawArrowBetweenFrames(
      undefined,
      pointFrom<GlobalPoint>(650, 180),
    ) as ExcalidrawElbowArrowElement;
    expect(arrow.elbowed).toBe(true);
    const index = Math.floor(arrow.points.length / 2);
    API.updateElement(arrow, {
      fixedSegments: [
        { index, start: arrow.points[index - 1], end: arrow.points[index] },
      ],
    });
    const { points, fixedSegments } = arrow;

    API.setSelectedElements([frameA]);
    mouse.downAt(250, 250);
    mouse.moveTo(285, 350);
    mouse.up();

    expect(arrow.startBinding?.elementId).toBe(rectA.id);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    // moved with its start (and frame), the rest of the route following
    expect(arrow.points).toHaveLength(points.length);
    expect(arrow.fixedSegments).toHaveLength(1);
    expect(arrow.fixedSegments![0].index).toBe(index);
    expect(arrow.fixedSegments![0].start).toEqual(fixedSegments![0].start);
  });

  it("should put an elbow arrow's fixed segment back when dragging its frame away and back", () => {
    API.setAppState({ currentItemArrowType: "elbow" });
    // from rectB (in frame B) to rectA, in frame A
    UI.clickTool("arrow");
    mouse.downAt(650, 180);
    mouse.moveTo(400, 150);
    mouse.moveTo(100, 150);
    mouse.up();
    UI.clickTool("selection");
    const arrow = h.elements.find(
      (element): element is ExcalidrawElbowArrowElement =>
        element.type === "arrow",
    )!;
    expect(arrow.startBinding?.elementId).toBe(rectB.id);
    expect(arrow.endBinding?.elementId).toBe(rectA.id);
    const index = Math.floor(arrow.points.length / 2);
    API.updateElement(arrow, {
      frameId: frameA.id,
      fixedSegments: [
        { index, start: arrow.points[index - 1], end: arrow.points[index] },
      ],
    });
    const points = getPoints(arrow);

    API.setSelectedElements([frameA]);
    mouse.downAt(250, 270);
    mouse.moveTo(250, 320);
    mouse.moveTo(250, 370);
    mouse.moveTo(250, 320);
    mouse.moveTo(250, 270);
    mouse.up();

    expect(h.app.scene.getElement(frameA.id)?.y).toBe(0);
    const nextPoints = getPoints(arrow);
    expect(nextPoints).toHaveLength(points.length);
    points.forEach(([x, y], index) => {
      expect(nextPoints[index][0]).toBeCloseTo(x);
      expect(nextPoints[index][1]).toBeCloseTo(y);
    });
  });

  it("should move the midpoints of an arrow bound at both ends to an element in another frame with its frame", () => {
    const arrow = drawArrowBetweenFrames(pointFrom<GlobalPoint>(250, 250));
    // a loop on rectB, bending in frame A
    API.updateElement(arrow, {
      points: [
        arrow.points[arrow.points.length - 1],
        pointFrom<LocalPoint>(arrow.points[1][0] - 300, 100),
        arrow.points[arrow.points.length - 1],
      ],
      startBinding: arrow.endBinding,
    });
    const [startPoint, midPoint, endPoint] = getPoints(arrow);

    API.setSelectedElements([frameA]);
    mouse.downAt(150, 250);
    mouse.moveTo(150, 300);
    mouse.moveTo(150, 350);
    mouse.up();

    expect(arrow.startBinding?.elementId).toBe(rectB.id);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    const [nextStartPoint, nextMidPoint, nextEndPoint] = getPoints(arrow);
    expect(nextStartPoint[0]).toBeCloseTo(startPoint[0]);
    expect(nextStartPoint[1]).toBeCloseTo(startPoint[1]);
    expect(nextMidPoint[0]).toBeCloseTo(midPoint[0]);
    expect(nextMidPoint[1]).toBeCloseTo(midPoint[1] + 100);
    expect(nextEndPoint[0]).toBeCloseTo(endPoint[0]);
    expect(nextEndPoint[1]).toBeCloseTo(endPoint[1]);
  });

  it("should keep an arrow bound to an element in another frame when moving its frame from the stats panel", () => {
    const arrow = drawArrowBetweenFrames();
    const [startPoint, endPoint] = getPoints(arrow);

    API.setSelectedElements([frameA]);
    API.setAppState({ stats: { ...h.state.stats, open: true } });
    UI.updateInput(
      UI.queryStatsProperty("Y")!.querySelector(".drag-input")!,
      "100",
    );

    expect(h.app.scene.getElement(frameA.id)?.y).toBe(100);
    expect(arrow.startBinding?.elementId).toBe(rectA.id);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    const [nextStartPoint, nextEndPoint] = getPoints(arrow);
    expect(nextStartPoint[0]).toBeCloseTo(startPoint[0]);
    expect(nextStartPoint[1]).toBeCloseTo(startPoint[1] + 100);
    expect(nextEndPoint).toEqual(endPoint);
  });

  it("should move an arrow bound to an element in another frame when nudging its frame", () => {
    // from empty space in frame A, bending in it
    const arrow = drawArrowBetweenFrames(pointFrom<GlobalPoint>(100, 250));
    expect(arrow.startBinding).toBe(null);
    API.updateElement(arrow, {
      points: [
        arrow.points[0],
        pointFrom<LocalPoint>(100, 0),
        arrow.points[arrow.points.length - 1],
      ],
    });
    const [startPoint, midPoint, endPoint] = getPoints(arrow);

    API.setSelectedElements([frameA]);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);

    expect(h.app.scene.getElement(frameA.id)?.x).toBe(ELEMENT_TRANSLATE_AMOUNT);
    expect(arrow.endBinding?.elementId).toBe(rectB.id);
    const [nextStartPoint, nextMidPoint, nextEndPoint] = getPoints(arrow);
    expect(nextStartPoint).toEqual(
      pointFrom(startPoint[0] + ELEMENT_TRANSLATE_AMOUNT, startPoint[1]),
    );
    expect(nextMidPoint).toEqual(
      pointFrom(midPoint[0] + ELEMENT_TRANSLATE_AMOUNT, midPoint[1]),
    );
    expect(nextEndPoint).toEqual(endPoint);
  });
});
