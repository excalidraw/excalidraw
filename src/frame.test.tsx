import { ExcalidrawElement } from "./element/types";
import {
  convertToExcalidrawElements,
  Excalidraw,
} from "./packages/excalidraw/index";
import { API } from "./tests/helpers/api";
import { Pointer } from "./tests/helpers/ui";
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

  describe("resizing frame over all elements", () => {
    const testElements = async (
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

    it("resizing over text containers / labelled arrows", async () => {
      await testElements(
        "rectangle",
        ["frame", "rectangle", "text"],
        ["rectangle", "text", "frame"],
      );
      await testElements(
        "rectangle",
        ["frame", "text", "rectangle"],
        ["rectangle", "text", "frame"],
      );
      await testElements(
        "rectangle",
        ["rectangle", "text", "frame"],
        ["rectangle", "text", "frame"],
      );
      await testElements(
        "rectangle",
        ["text", "rectangle", "frame"],
        ["rectangle", "text", "frame"],
      );

      await testElements(
        "arrow",
        ["frame", "arrow", "text"],
        ["arrow", "text", "frame"],
      );
      await testElements(
        "arrow",
        ["text", "arrow", "frame"],
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
      // await testElements(
      //   "arrow",
      //   ["frame", "text", "arrow"],
      //   ["text", "arrow", "frame"],
      // );
    });
  });

  /**
   * TODO:
   * dragging element into the frame
   *
   * selecting frame (mouseClick) should not call "addElementsToFrame"
   * removing element from frame should not again call "addElementsToFrame"
   * - related, "existingElements" are empty in tests due to this, but no in browser
   */
  describe("resizing frame over rectangles one by one", async () => {
    let frame: ExcalidrawElement;
    let rect1: ExcalidrawElement;
    let rect2: ExcalidrawElement;
    let rect3: ExcalidrawElement;
    let rect4: ExcalidrawElement;

    beforeEach(async () => {
      await render(<Excalidraw />);

      frame = API.createElement({ id: "id0", type: "frame", x: 0, y: 0 });
      rect1 = API.createElement({
        id: "id1",
        type: "rectangle",
        x: -1000,
        y: -1000,
      });
      rect2 = API.createElement({
        id: "id2",
        type: "rectangle",
        x: 100,
        y: 100,
      });
      rect3 = API.createElement({
        id: "id3",
        type: "rectangle",
        x: 200,
        y: 200,
      });
      rect4 = API.createElement({
        id: "id4",
        type: "rectangle",
        x: 1000,
        y: 1000,
      });
    });

    describe("when frame is in a layer below", async () => {
      it("should add an element", async () => {
        h.elements = [frame, rect2];

        resizeFrameOverElement(frame, rect2);

        expect(h.elements[0].frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect2, frame]);
      });

      it("should add elements", async () => {
        h.elements = [frame, rect2, rect3];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect2, rect3, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        h.elements = [frame, rect1, rect2, rect4, rect3];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect2, rect3, frame, rect1, rect4]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        h.elements = [frame, rect3, rect4, rect2, rect1];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect2, rect3, frame, rect4, rect1]);
      });

      it("should add elements when resizing down", async () => {
        h.elements = [frame, rect1, rect2, rect3, rect4];

        resizeFrameOverElement(frame, rect4);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect2, rect3, frame, rect4, rect1]);
      });
    });

    describe("when frame is in a layer above", async () => {
      it("should add an element", async () => {
        h.elements = [rect2, frame];

        resizeFrameOverElement(frame, rect2);

        expect(h.elements[0].frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect2, frame]);
      });

      it("should add elements", async () => {
        h.elements = [rect2, rect3, frame];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect3, rect2, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        h.elements = [rect1, rect2, rect4, rect3, frame];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect1, rect4, rect3, rect2, frame]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        h.elements = [rect3, rect4, rect2, rect1, frame];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect4, rect1, rect3, rect2, frame]);
      });

      it("should add elements when resizing down", async () => {
        h.elements = [rect1, rect2, rect3, rect4, frame];

        resizeFrameOverElement(frame, rect4);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect1, rect2, rect3, frame, rect4]);
      });
    });

    describe("when frame is in an inner layer", async () => {
      it("should add elements", async () => {
        h.elements = [rect2, frame, rect3];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect2, rect3, frame]);
      });

      it("should add elements when there are other other elements in between", async () => {
        h.elements = [rect2, rect1, frame, rect4, rect3];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect1, rect2, rect3, frame, rect4]);
      });

      it("should add elements when there are other elements in between and the order is reversed", async () => {
        h.elements = [rect3, rect4, frame, rect2, rect1];

        resizeFrameOverElement(frame, rect2);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect4, rect3, rect2, frame, rect1]);
      });

      it("should add elements when resizing down", async () => {
        h.elements = [rect1, rect2, frame, rect3, rect4];

        resizeFrameOverElement(frame, rect4);
        resizeFrameOverElement(frame, rect3);

        expect(rect2.frameId).toBe(frame.id);
        expect(rect3.frameId).toBe(frame.id);
        expect(h.elements).toEqual([rect1, rect2, rect3, frame, rect4]);
      });
    });
  });
});
