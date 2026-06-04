import {
  convertToExcalidrawElements,
  Excalidraw,
} from "@excalidraw/excalidraw";
import { arrayToMap } from "@excalidraw/common";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard, Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { getTextEditor } from "@excalidraw/excalidraw/tests/queries/dom";
import {
  getCloneByOrigId,
  render,
} from "@excalidraw/excalidraw/tests/test-utils";

import { getSelectedElements } from "@excalidraw/excalidraw/scene";

import { elementOverlapsWithFrame } from "../src/frame";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
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
      API.setSelectedElements([rect2]);
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
            frameToHighlight: frame as ExcalidrawFrameLikeElement,
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
          frameToHighlight: frame as ExcalidrawFrameLikeElement,
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
