import { ExcalidrawElement } from "./element/types";
import {
  convertToExcalidrawElements,
  Excalidraw,
} from "./packages/excalidraw/index";
import { API } from "./tests/helpers/api";
import { Keyboard, Pointer } from "./tests/helpers/ui";
import { render } from "./tests/test-utils";

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

  const commonTestCases = async (
    func: typeof resizeFrameOverElement | typeof dragElementIntoFrame,
  ) => {
    describe("when frame is in a layer below", async () => {
      it("should add an element", async () => {
        h.elements = [frame, rect2];

        func(frame, rect2);

        expect(h.elements[0].frameId).toBe(frame.id);
        expectEqualIds([rect2, frame]);
      });

      it("should add elements", async () => {
        h.elements = [frame, rect2, rect3];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        h.elements = [frame, rect1, rect2, rect4, rect3];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame, rect1, rect4]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        h.elements = [frame, rect3, rect4, rect2, rect1];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame, rect4, rect1]);
      });
    });

    describe("when frame is in a layer above", async () => {
      it("should add an element", async () => {
        h.elements = [rect2, frame];

        func(frame, rect2);

        expect(h.elements[0].frameId).toBe(frame.id);
        expectEqualIds([rect2, frame]);
      });

      it("should add elements", async () => {
        h.elements = [rect2, rect3, frame];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect3, rect2, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        h.elements = [rect1, rect2, rect4, rect3, frame];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect1, rect4, rect3, rect2, frame]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        h.elements = [rect3, rect4, rect2, rect1, frame];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect4, rect1, rect3, rect2, frame]);
      });
    });

    describe("when frame is in an inner layer", async () => {
      it("should add elements", async () => {
        h.elements = [rect2, frame, rect3];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect2, rect3, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        h.elements = [rect2, rect1, frame, rect4, rect3];

        func(frame, rect2);
        func(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expectEqualIds([rect1, rect2, rect3, frame, rect4]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        h.elements = [rect3, rect4, frame, rect2, rect1];

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

    h.elements = reorderElements(
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

    it("resizing over text containers and labelled arrows", async () => {
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

    it("should add arrow bound with text when frame is in a layer below", async () => {
      h.elements = [frame, arrow, text];

      resizeFrameOverElement(frame, arrow);

      expect(arrow.frameId).toBe(frame.id);
      expect(text.frameId).toBe(frame.id);
      expectEqualIds([arrow, text, frame]);
    });

    it("should add arrow bound with text when frame is in a layer above", async () => {
      h.elements = [arrow, text, frame];

      resizeFrameOverElement(frame, arrow);

      expect(arrow.frameId).toBe(frame.id);
      expect(text.frameId).toBe(frame.id);
      expectEqualIds([arrow, text, frame]);
    });

    it("should add arrow bound with text when frame is in an inner layer", async () => {
      h.elements = [arrow, frame, text];

      resizeFrameOverElement(frame, arrow);

      expect(arrow.frameId).toBe(frame.id);
      expect(text.frameId).toBe(frame.id);
      expectEqualIds([arrow, text, frame]);
    });
  });

  describe("resizing frame over elements but downwards", async () => {
    it("should add elements when frame is in a layer below", async () => {
      h.elements = [frame, rect1, rect2, rect3, rect4];

      resizeFrameOverElement(frame, rect4);
      resizeFrameOverElement(frame, rect3);

      expect(rect2.frameId).toBe(frame.id);
      expect(rect3.frameId).toBe(frame.id);
      expectEqualIds([rect2, rect3, frame, rect4, rect1]);
    });

    it("should add elements when frame is in a layer above", async () => {
      h.elements = [rect1, rect2, rect3, rect4, frame];

      resizeFrameOverElement(frame, rect4);
      resizeFrameOverElement(frame, rect3);

      expect(rect2.frameId).toBe(frame.id);
      expect(rect3.frameId).toBe(frame.id);
      expectEqualIds([rect1, rect2, rect3, frame, rect4]);
    });

    it("should add elements when frame is in an inner layer", async () => {
      h.elements = [rect1, rect2, frame, rect3, rect4];

      resizeFrameOverElement(frame, rect4);
      resizeFrameOverElement(frame, rect3);

      expect(rect2.frameId).toBe(frame.id);
      expect(rect3.frameId).toBe(frame.id);
      expectEqualIds([rect1, rect2, rect3, frame, rect4]);
    });
  });

  describe("dragging elements into the frame", async () => {
    await commonTestCases(dragElementIntoFrame);

    it("should drag element inside, duplicate it and keep it in frame", () => {
      h.elements = [frame, rect2];

      dragElementIntoFrame(frame, rect2);

      const rect2_copy = { ...rect2, id: `${rect2.id}_copy` };

      selectElementAndDuplicate(rect2);

      expect(rect2_copy.frameId).toBe(frame.id);
      expect(rect2.frameId).toBe(frame.id);
      expectEqualIds([rect2_copy, rect2, frame]);
    });

    it("should drag element inside, duplicate it and remove it from frame", () => {
      h.elements = [frame, rect2];

      dragElementIntoFrame(frame, rect2);

      const rect2_copy = { ...rect2, id: `${rect2.id}_copy` };

      // move the rect2 outside the frame
      selectElementAndDuplicate(rect2, [-1000, -1000]);

      expect(rect2_copy.frameId).toBe(frame.id);
      expect(rect2.frameId).toBe(null);
      expectEqualIds([rect2_copy, frame, rect2]);
    });
  });
});
