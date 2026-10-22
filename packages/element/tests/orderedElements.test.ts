import { expectTypeOf } from "vitest";

import {
  newElement,
  orderByFractionalIndex,
  syncInvalidIndices,
  validateFractionalIndices,
} from "@excalidraw/element";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type {
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  FractionalIndex,
  NonRestoredExcalidrawElement,
  Ordered,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

// see https://github.com/excalidraw/excalidraw/issues/7941

const expectValidIndices = (elements: readonly ExcalidrawElement[]) => {
  for (const element of elements) {
    expect(element.index).toEqual(expect.any(String));
  }
  expect(() =>
    validateFractionalIndices(elements, {
      shouldThrow: true,
      includeBoundTextValidation: true,
      ignoreLogs: true,
    }),
  ).not.toThrow();
};

describe("ordered elements", () => {
  // NOTE these are checked by `yarn test:typecheck`, at runtime they're no-ops
  describe("type contracts", () => {
    it("every ExcalidrawElement is ordered", () => {
      expectTypeOf<
        ExcalidrawElement["index"]
      >().toEqualTypeOf<FractionalIndex>();
    });

    it("NonRestoredExcalidrawElement does not have to be ordered", () => {
      expectTypeOf<
        NonRestoredExcalidrawElement["index"]
      >().toEqualTypeOf<FractionalIndex | null>();
    });

    it("ordered elements can be passed where non-restored are expected, not vice versa", () => {
      expectTypeOf<ExcalidrawElement>().toMatchTypeOf<NonRestoredExcalidrawElement>();
      expectTypeOf<NonRestoredExcalidrawElement>().not.toMatchTypeOf<ExcalidrawElement>();
    });

    it("NonRestoredExcalidrawElement keeps the element type discriminant", () => {
      expectTypeOf<
        NonRestoredExcalidrawElement<ExcalidrawRectangleElement>["type"]
      >().toEqualTypeOf<"rectangle">();
    });

    it("keeps the deprecated aliases backwards compatible", () => {
      expectTypeOf<OrderedExcalidrawElement>().toEqualTypeOf<ExcalidrawElement>();
      expectTypeOf<
        Ordered<ExcalidrawRectangleElement>
      >().toEqualTypeOf<ExcalidrawRectangleElement>();
    });
  });

  describe("newElement (scene boundary)", () => {
    it("creates elements without an index until they're inserted into the scene", () => {
      const element = newElement({ type: "rectangle", x: 0, y: 0 });

      expect(element.index).toBeNull();
    });

    it("keeps an explicitly passed index", () => {
      const element = newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        index: "a5" as FractionalIndex,
      });

      expect(element.index).toBe("a5");
    });

    it("assigns valid indices to freshly created elements on sync", () => {
      const elements = [
        newElement({ type: "rectangle", x: 0, y: 0 }),
        newElement({ type: "ellipse", x: 10, y: 10 }),
        newElement({ type: "diamond", x: 20, y: 20 }),
      ];

      const synced = syncInvalidIndices(elements);

      expectValidIndices(synced);
      expect(synced.map((element) => element.id)).toEqual(
        elements.map((element) => element.id),
      );
    });
  });

  describe("orderByFractionalIndex", () => {
    it("orders elements by their index", () => {
      const first = API.createElement({ index: "a0" as FractionalIndex });
      const second = API.createElement({ index: "a1" as FractionalIndex });
      const third = API.createElement({ index: "a2" as FractionalIndex });

      expect(orderByFractionalIndex([third, first, second])).toEqual([
        first,
        second,
        third,
      ]);
    });

    it("breaks ties of identical indices by element id", () => {
      const a = API.createElement({ id: "A", index: "a0" as FractionalIndex });
      const b = API.createElement({ id: "B", index: "a0" as FractionalIndex });

      expect(orderByFractionalIndex([b, a])).toEqual([a, b]);
    });

    it("does not throw nor drop elements without an index at runtime", () => {
      const ordered = API.createElement({ index: "a0" as FractionalIndex });
      // freshly created elements don't have an index until inserted
      const unordered = newElement({ type: "rectangle", x: 0, y: 0 });

      const result = orderByFractionalIndex([unordered, ordered]);

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([ordered, unordered]));
    });
  });
});
