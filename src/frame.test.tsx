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

  describe("resizing frame over elements", () => {
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

      mouse.clickAt(0, 0);
      mouse.downAt(frame.x + frame.width, frame.y + frame.height);
      mouse.moveTo(
        container.x + container.width + 100,
        container.y + container.height + 100,
      );
      mouse.up();
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
        ["text", "rectangle", "frame"],
      );

      await testElements(
        "arrow",
        ["frame", "arrow", "text"],
        ["arrow", "text", "frame"],
      );
      await testElements(
        "arrow",
        ["text", "arrow", "frame"],
        ["text", "arrow", "frame"],
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
});
