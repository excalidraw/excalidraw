import { duplicateElement, duplicateElements } from "./newElement";
import { mutateElement } from "./mutateElement";
import { API } from "../tests/helpers/api";
import { FONT_FAMILY, ROUNDNESS } from "../constants";
import { isPrimitive } from "../utils";
import type { ExcalidrawLinearElement } from "./types";
import type { LocalPoint } from "../../math";
import { pointFrom } from "../../math";

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

    mutateElement(element, {
      points: [pointFrom<LocalPoint>(1, 2), pointFrom<LocalPoint>(3, 4)],
    });

    const copy = duplicateElement(null, new Map(), element);

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
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
      },
    });

    const arrow2 = API.createElement({
      type: "arrow",
      id: "arrow2",
      endBinding: {
        elementId: "rectangle1",
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
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
    const clonedElements = duplicateElements(origElements);

    // generic id in-equality checks
    // --------------------------------------------------------------------------
    expect(origElements.map((e) => e.type)).toEqual(
      clonedElements.map((e) => e.type),
    );
    origElements.forEach((origElement, idx) => {
      const clonedElement = clonedElements[idx];
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

    const clonedArrows = clonedElements.filter(
      (e) => e.type === "arrow",
    ) as ExcalidrawLinearElement[];

    const [clonedRectangle, clonedText1, , clonedArrow2, clonedArrowLabel] =
      clonedElements as any as typeof origElements;

    expect(clonedText1.containerId).toBe(clonedRectangle.id);
    expect(
      clonedRectangle.boundElements!.find((e) => e.id === clonedText1.id),
    ).toEqual(
      expect.objectContaining({
        id: clonedText1.id,
        type: clonedText1.type,
      }),
    );

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
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
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
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
      },
      endBinding: {
        elementId: "rectangle-not-exists",
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
      },
    });

    const arrow3 = API.createElement({
      type: "arrow",
      id: "arrow2",
      startBinding: {
        elementId: "rectangle-not-exists",
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
      },
      endBinding: {
        elementId: "rectangle1",
        focus: 0.2,
        gap: 7,
        fixedPoint: [0.5, 1],
      },
    });

    // -------------------------------------------------------------------------

    const origElements = [rectangle1, text1, arrow1, arrow2, arrow3] as const;
    const clonedElements = duplicateElements(
      origElements,
    ) as any as typeof origElements;
    const [
      clonedRectangle,
      clonedText1,
      clonedArrow1,
      clonedArrow2,
      clonedArrow3,
    ] = clonedElements;

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
      const clonedElements = duplicateElements(
        origElements,
      ) as any as typeof origElements;
      const [clonedRectangle1, clonedRectangle2, clonedRectangle3] =
        clonedElements;

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

      const [clonedRectangle1] = duplicateElements([rectangle1]);

      expect(typeof clonedRectangle1.groupIds[0]).toBe("string");
      expect(rectangle1.groupIds[0]).not.toBe(clonedRectangle1.groupIds[0]);
    });
  });
});
