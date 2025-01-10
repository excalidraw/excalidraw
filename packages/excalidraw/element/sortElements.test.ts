import { API } from "../tests/helpers/api";
import { mutateElement } from "./mutateElement";
import { normalizeElementOrder } from "./sortElements";
import type { ExcalidrawElement } from "./types";

const assertOrder = (
  elements: readonly ExcalidrawElement[],
  expectedOrder: string[],
) => {
  const actualOrder = elements.map((element) => element.id);
  expect(actualOrder).toEqual(expectedOrder);
};

describe("normalizeElementsOrder", () => {
  it("sort bound-text elements", () => {
    const container = API.createElement({
      id: "container",
      type: "rectangle",
    });
    const boundText = API.createElement({
      id: "boundText",
      type: "text",
      containerId: container.id,
    });
    const otherElement = API.createElement({
      id: "otherElement",
      type: "rectangle",
      boundElements: [],
    });
    const otherElement2 = API.createElement({
      id: "otherElement2",
      type: "rectangle",
      boundElements: [],
    });

    mutateElement(container, {
      boundElements: [{ type: "text", id: boundText.id }],
    });

    assertOrder(normalizeElementOrder([container, boundText]), [
      "container",
      "boundText",
    ]);
    assertOrder(normalizeElementOrder([boundText, container]), [
      "container",
      "boundText",
    ]);
    assertOrder(
      normalizeElementOrder([
        boundText,
        container,
        otherElement,
        otherElement2,
      ]),
      ["container", "boundText", "otherElement", "otherElement2"],
    );
    assertOrder(normalizeElementOrder([container, otherElement, boundText]), [
      "container",
      "boundText",
      "otherElement",
    ]);
    assertOrder(
      normalizeElementOrder([
        container,
        otherElement,
        otherElement2,
        boundText,
      ]),
      ["container", "boundText", "otherElement", "otherElement2"],
    );

    assertOrder(
      normalizeElementOrder([
        boundText,
        otherElement,
        container,
        otherElement2,
      ]),
      ["otherElement", "container", "boundText", "otherElement2"],
    );

    // noop
    assertOrder(
      normalizeElementOrder([
        otherElement,
        container,
        boundText,
        otherElement2,
      ]),
      ["otherElement", "container", "boundText", "otherElement2"],
    );

    // text has existing containerId, but container doesn't list is
    // as a boundElement
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "boundText",
          type: "text",
          containerId: "container",
        }),
        API.createElement({
          id: "container",
          type: "rectangle",
        }),
      ]),
      ["boundText", "container"],
    );
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "boundText",
          type: "text",
          containerId: "container",
        }),
      ]),
      ["boundText"],
    );
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "container",
          type: "rectangle",
          boundElements: [],
        }),
      ]),
      ["container"],
    );
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "container",
          type: "rectangle",
          boundElements: [{ id: "x", type: "text" }],
        }),
      ]),
      ["container"],
    );
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "arrow",
          type: "arrow",
        }),
        API.createElement({
          id: "container",
          type: "rectangle",
          boundElements: [{ id: "arrow", type: "arrow" }],
        }),
      ]),
      ["arrow", "container"],
    );
  });

  it("normalize group order", () => {
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "A_rect1",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "rect2",
          type: "rectangle",
        }),
        API.createElement({
          id: "rect3",
          type: "rectangle",
        }),
        API.createElement({
          id: "A_rect4",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "A_rect5",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "rect6",
          type: "rectangle",
        }),
        API.createElement({
          id: "A_rect7",
          type: "rectangle",
          groupIds: ["A"],
        }),
      ]),
      ["A_rect1", "A_rect4", "A_rect5", "A_rect7", "rect2", "rect3", "rect6"],
    );
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "A_rect1",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "rect2",
          type: "rectangle",
        }),
        API.createElement({
          id: "B_rect3",
          type: "rectangle",
          groupIds: ["B"],
        }),
        API.createElement({
          id: "A_rect4",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "B_rect5",
          type: "rectangle",
          groupIds: ["B"],
        }),
        API.createElement({
          id: "rect6",
          type: "rectangle",
        }),
        API.createElement({
          id: "A_rect7",
          type: "rectangle",
          groupIds: ["A"],
        }),
      ]),
      ["A_rect1", "A_rect4", "A_rect7", "rect2", "B_rect3", "B_rect5", "rect6"],
    );
    // nested groups
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "A_rect1",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "BA_rect2",
          type: "rectangle",
          groupIds: ["B", "A"],
        }),
      ]),
      ["A_rect1", "BA_rect2"],
    );
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "BA_rect1",
          type: "rectangle",
          groupIds: ["B", "A"],
        }),
        API.createElement({
          id: "A_rect2",
          type: "rectangle",
          groupIds: ["A"],
        }),
      ]),
      ["BA_rect1", "A_rect2"],
    );
    assertOrder(
      normalizeElementOrder([
        API.createElement({
          id: "BA_rect1",
          type: "rectangle",
          groupIds: ["B", "A"],
        }),
        API.createElement({
          id: "A_rect2",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "CBA_rect3",
          type: "rectangle",
          groupIds: ["C", "B", "A"],
        }),
        API.createElement({
          id: "rect4",
          type: "rectangle",
        }),
        API.createElement({
          id: "A_rect5",
          type: "rectangle",
          groupIds: ["A"],
        }),
        API.createElement({
          id: "BA_rect5",
          type: "rectangle",
          groupIds: ["B", "A"],
        }),
        API.createElement({
          id: "BA_rect6",
          type: "rectangle",
          groupIds: ["B", "A"],
        }),
        API.createElement({
          id: "CBA_rect7",
          type: "rectangle",
          groupIds: ["C", "B", "A"],
        }),
        API.createElement({
          id: "X_rect8",
          type: "rectangle",
          groupIds: ["X"],
        }),
        API.createElement({
          id: "rect9",
          type: "rectangle",
        }),
        API.createElement({
          id: "YX_rect10",
          type: "rectangle",
          groupIds: ["Y", "X"],
        }),
        API.createElement({
          id: "X_rect11",
          type: "rectangle",
          groupIds: ["X"],
        }),
      ]),
      [
        "BA_rect1",
        "BA_rect5",
        "BA_rect6",
        "A_rect2",
        "A_rect5",
        "CBA_rect3",
        "CBA_rect7",
        "rect4",
        "X_rect8",
        "X_rect11",
        "YX_rect10",
        "rect9",
      ],
    );
  });

  // TODO
  it.skip("normalize boundElements array", () => {
    const container = API.createElement({
      id: "container",
      type: "rectangle",
      boundElements: [],
    });
    const boundText = API.createElement({
      id: "boundText",
      type: "text",
      containerId: container.id,
    });

    mutateElement(container, {
      boundElements: [
        { type: "text", id: boundText.id },
        { type: "text", id: "xxx" },
      ],
    });

    expect(normalizeElementOrder([container, boundText])).toEqual([
      expect.objectContaining({
        id: container.id,
      }),
      expect.objectContaining({ id: boundText.id }),
    ]);
  });

  // should take around <100ms for 10K iterations (@dwelle's PC 22-05-25)
  it.skip("normalizeElementsOrder() perf", () => {
    const makeElements = (iterations: number) => {
      const elements: ExcalidrawElement[] = [];
      while (iterations--) {
        const container = API.createElement({
          type: "rectangle",
          boundElements: [],
          groupIds: ["B", "A"],
        });
        const boundText = API.createElement({
          type: "text",
          containerId: container.id,
          groupIds: ["A"],
        });
        const otherElement = API.createElement({
          type: "rectangle",
          boundElements: [],
          groupIds: ["C", "A"],
        });
        mutateElement(container, {
          boundElements: [{ type: "text", id: boundText.id }],
        });

        elements.push(boundText, otherElement, container);
      }
      return elements;
    };

    const elements = makeElements(10000);
    const t0 = Date.now();
    normalizeElementOrder(elements);
    console.info(`${Date.now() - t0}ms`);
  });
});
