import { pointFrom } from "@excalidraw/math";
import { vi } from "vitest";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { convertToExcalidrawElements } from "./transform";

import type { ExcalidrawElementSkeleton } from "./transform";

const opts = { regenerateIds: false };

describe("Test Transform", () => {
  it("should generate id unless opts.regenerateIds is set to false explicitly", () => {
    const elements = [
      {
        type: "rectangle",
        x: 100,
        y: 100,
        id: "rect-1",
      },
    ];
    let data = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
    );
    expect(data.length).toBe(1);
    expect(data[0].id).toBe("id0");

    data = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
      opts,
    );
    expect(data[0].id).toBe("rect-1");
  });

  it("should transform regular shapes", () => {
    const elements = [
      {
        type: "rectangle",
        x: 100,
        y: 100,
      },
      {
        type: "ellipse",
        x: 100,
        y: 250,
      },
      {
        type: "diamond",
        x: 100,
        y: 400,
      },
      {
        type: "rectangle",
        x: 300,
        y: 100,
        width: 200,
        height: 100,
        backgroundColor: "#c0eb75",
        strokeWidth: 2,
      },
      {
        type: "ellipse",
        x: 300,
        y: 250,
        width: 200,
        height: 100,
        backgroundColor: "#ffc9c9",
        strokeStyle: "dotted",
        fillStyle: "solid",
        strokeWidth: 2,
      },
      {
        type: "diamond",
        x: 300,
        y: 400,
        width: 200,
        height: 100,
        backgroundColor: "#a5d8ff",
        strokeColor: "#1971c2",
        strokeStyle: "dashed",
        fillStyle: "cross-hatch",
        strokeWidth: 2,
      },
    ];

    convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
      opts,
    ).forEach((ele) => {
      expect(ele).toMatchSnapshot({
        seed: expect.any(Number),
        versionNonce: expect.any(Number),
        id: expect.any(String),
      });
    });
  });

  it("should transform text element", () => {
    const elements = [
      {
        type: "text",
        x: 100,
        y: 100,
        text: "HELLO WORLD!",
      },
      {
        type: "text",
        x: 100,
        y: 150,
        text: "STYLED HELLO WORLD!",
        fontSize: 20,
        strokeColor: "#5f3dc4",
      },
    ];
    convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
      opts,
    ).forEach((ele) => {
      expect(ele).toMatchSnapshot({
        seed: expect.any(Number),
        versionNonce: expect.any(Number),
        id: expect.any(String),
      });
    });
  });

  it("should transform linear elements", () => {
    const elements = [
      {
        type: "arrow",
        x: 100,
        y: 20,
      },
      {
        type: "arrow",
        x: 450,
        y: 20,
        startArrowhead: "dot",
        endArrowhead: "triangle",
        strokeColor: "#1971c2",
        strokeWidth: 2,
      },
      {
        type: "line",
        x: 100,
        y: 60,
      },
      {
        type: "line",
        x: 450,
        y: 60,
        strokeColor: "#2f9e44",
        strokeWidth: 2,
        strokeStyle: "dotted",
      },
    ];
    const excalidrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
      opts,
    );

    expect(excalidrawElements.length).toBe(4);

    excalidrawElements.forEach((ele) => {
      expect(ele).toMatchSnapshot({
        seed: expect.any(Number),
        versionNonce: expect.any(Number),
        id: expect.any(String),
      });
    });
  });

  it("should transform to text containers when label provided", () => {
    const elements = [
      {
        type: "rectangle",
        x: 100,
        y: 100,
        label: {
          text: "RECTANGLE TEXT CONTAINER",
        },
      },
      {
        type: "ellipse",
        x: 500,
        y: 100,
        width: 200,
        label: {
          text: "ELLIPSE TEXT CONTAINER",
        },
      },
      {
        type: "diamond",
        x: 100,
        y: 150,
        width: 280,
        label: {
          text: "DIAMOND\nTEXT CONTAINER",
        },
      },
      {
        type: "diamond",
        x: 100,
        y: 400,
        width: 300,
        backgroundColor: "#fff3bf",
        strokeWidth: 2,
        label: {
          text: "STYLED DIAMOND TEXT CONTAINER",
          strokeColor: "#099268",
          fontSize: 20,
        },
      },
      {
        type: "rectangle",
        x: 500,
        y: 300,
        width: 200,
        strokeColor: "#c2255c",
        label: {
          text: "TOP LEFT ALIGNED RECTANGLE TEXT CONTAINER",
          textAlign: "left",
          verticalAlign: "top",
          fontSize: 20,
        },
      },
      {
        type: "ellipse",
        x: 500,
        y: 500,
        strokeColor: "#f08c00",
        backgroundColor: "#ffec99",
        width: 200,
        label: {
          text: "STYLED ELLIPSE TEXT CONTAINER",
          strokeColor: "#c2255c",
        },
      },
    ];
    const excalidrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
      opts,
    );

    expect(excalidrawElements.length).toBe(12);

    excalidrawElements.forEach((ele) => {
      expect(ele).toMatchSnapshot({
        seed: expect.any(Number),
        versionNonce: expect.any(Number),
        id: expect.any(String),
      });
    });
  });

  it("should transform to labelled arrows when label provided for arrows", () => {
    const elements = [
      {
        type: "arrow",
        x: 100,
        y: 100,
        label: {
          text: "LABELED ARROW",
        },
      },
      {
        type: "arrow",
        x: 100,
        y: 200,
        label: {
          text: "STYLED LABELED ARROW",
          strokeColor: "#099268",
          fontSize: 20,
        },
      },
      {
        type: "arrow",
        x: 100,
        y: 300,
        strokeColor: "#1098ad",
        strokeWidth: 2,
        label: {
          text: "ANOTHER STYLED LABELLED ARROW",
        },
      },
      {
        type: "arrow",
        x: 100,
        y: 400,
        strokeColor: "#1098ad",
        strokeWidth: 2,
        label: {
          text: "ANOTHER STYLED LABELLED ARROW",
          strokeColor: "#099268",
        },
      },
    ];
    const excalidrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
      opts,
    );

    expect(excalidrawElements.length).toBe(8);

    excalidrawElements.forEach((ele) => {
      expect(ele).toMatchSnapshot({
        seed: expect.any(Number),
        versionNonce: expect.any(Number),
        id: expect.any(String),
      });
    });
  });

  describe("Test Frames", () => {
    const elements: ExcalidrawElementSkeleton[] = [
      {
        type: "rectangle",
        x: 10,
        y: 10,
        strokeWidth: 2,
        id: "1",
      },
      {
        type: "diamond",
        x: 120,
        y: 20,
        backgroundColor: "#fff3bf",
        strokeWidth: 2,
        label: {
          text: "HELLO EXCALIDRAW",
          strokeColor: "#099268",
          fontSize: 30,
        },
        id: "2",
      },
    ];

    it("should transform frames and update frame ids when regenerated", () => {
      const elementsSkeleton: ExcalidrawElementSkeleton[] = [
        ...elements,
        {
          type: "frame",
          children: ["1", "2"],
          name: "My frame",
        },
      ];
      const excalidrawElements = convertToExcalidrawElements(
        elementsSkeleton,
        opts,
      );
      expect(excalidrawElements.length).toBe(4);

      excalidrawElements.forEach((ele) => {
        expect(ele).toMatchObject({
          seed: expect.any(Number),
          versionNonce: expect.any(Number),
          id: expect.any(String),
        });
      });
    });

    it("should consider user defined frame dimensions over calculated when provided", () => {
      const elementsSkeleton: ExcalidrawElementSkeleton[] = [
        ...elements,
        {
          type: "frame",
          children: ["1", "2"],
          name: "My frame",
          width: 800,
          height: 100,
        },
      ];
      const excalidrawElements = convertToExcalidrawElements(
        elementsSkeleton,
        opts,
      );
      const frame = excalidrawElements.find((ele) => ele.type === "frame")!;
      expect(frame.width).toBe(800);
      expect(frame.height).toBe(100);
    });

    it("should consider user defined frame coordinates calculated when provided", () => {
      const elementsSkeleton: ExcalidrawElementSkeleton[] = [
        ...elements,
        {
          type: "frame",
          children: ["1", "2"],
          name: "My frame",
          x: 100,
          y: 300,
        },
      ];
      const excalidrawElements = convertToExcalidrawElements(
        elementsSkeleton,
        opts,
      );
      const frame = excalidrawElements.find((ele) => ele.type === "frame")!;
      expect(frame.x).toBe(100);
      expect(frame.y).toBe(300);
    });
  });

  describe("Test arrow bindings", () => {
    it("should bind arrows to shapes when start / end provided without ids", () => {
      const elements = [
        {
          type: "arrow",
          x: 255,
          y: 239,
          label: {
            text: "HELLO WORLD!!",
          },
          start: {
            type: "rectangle",
          },
          end: {
            type: "ellipse",
          },
        },
      ];
      const excalidrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
        opts,
      );

      expect(excalidrawElements.length).toBe(4);
      const [arrow, text, rectangle, ellipse] = excalidrawElements;
      expect(arrow).toMatchObject({
        type: "arrow",
        x: 255.5,
        y: 239,
        boundElements: [{ id: text.id, type: "text" }],
        startBinding: {
          elementId: rectangle.id,
          focus: 0,
          gap: 1,
        },
        endBinding: {
          elementId: ellipse.id,
          focus: -0,
        },
      });

      expect(text).toMatchObject({
        x: 240,
        y: 226.5,
        type: "text",
        text: "HELLO WORLD!!",
        containerId: arrow.id,
      });

      expect(rectangle).toMatchObject({
        x: 155,
        y: 189,
        type: "rectangle",
        boundElements: [
          {
            id: arrow.id,
            type: "arrow",
          },
        ],
      });

      expect(ellipse).toMatchObject({
        x: 355,
        y: 189,
        type: "ellipse",
        boundElements: [
          {
            id: arrow.id,
            type: "arrow",
          },
        ],
      });

      excalidrawElements.forEach((ele) => {
        expect(ele).toMatchSnapshot({
          seed: expect.any(Number),
          versionNonce: expect.any(Number),
          id: expect.any(String),
        });
      });
    });

    it("should bind arrows to text when start / end provided without ids", () => {
      const elements = [
        {
          type: "arrow",
          x: 255,
          y: 239,
          label: {
            text: "HELLO WORLD!!",
          },
          start: {
            type: "text",
            text: "HEYYYYY",
          },
          end: {
            type: "text",
            text: "WHATS UP ?",
          },
        },
      ];

      const excalidrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
        opts,
      );

      expect(excalidrawElements.length).toBe(4);
      const [arrow, text1, text2, text3] = excalidrawElements;

      expect(arrow).toMatchObject({
        type: "arrow",
        x: 255.5,
        y: 239,
        boundElements: [{ id: text1.id, type: "text" }],
        startBinding: {
          elementId: text2.id,
          focus: 0,
          gap: 1,
        },
        endBinding: {
          elementId: text3.id,
          focus: -0,
        },
      });

      expect(text1).toMatchObject({
        x: 240,
        y: 226.5,
        type: "text",
        text: "HELLO WORLD!!",
        containerId: arrow.id,
      });

      expect(text2).toMatchObject({
        x: 185,
        y: 226.5,
        type: "text",
        boundElements: [
          {
            id: arrow.id,
            type: "arrow",
          },
        ],
      });

      expect(text3).toMatchObject({
        x: 355,
        y: 226.5,
        type: "text",
        boundElements: [
          {
            id: arrow.id,
            type: "arrow",
          },
        ],
      });

      excalidrawElements.forEach((ele) => {
        expect(ele).toMatchSnapshot({
          seed: expect.any(Number),
          versionNonce: expect.any(Number),
          id: expect.any(String),
        });
      });
    });

    it("should bind arrows to existing shapes when start / end provided with ids", () => {
      const elements = [
        {
          type: "ellipse",
          id: "ellipse-1",
          strokeColor: "#66a80f",
          x: 630,
          y: 316,
          width: 300,
          height: 300,
          backgroundColor: "#d8f5a2",
        },
        {
          type: "diamond",
          id: "diamond-1",
          strokeColor: "#9c36b5",
          width: 140,
          x: 96,
          y: 400,
        },
        {
          type: "arrow",
          x: 247,
          y: 420,
          width: 395,
          height: 35,
          strokeColor: "#1864ab",
          start: {
            type: "rectangle",
            width: 300,
            height: 300,
          },
          end: {
            id: "ellipse-1",
          },
        },
        {
          type: "arrow",
          x: 227,
          y: 450,
          width: 400,
          strokeColor: "#e67700",
          start: {
            id: "diamond-1",
          },
          end: {
            id: "ellipse-1",
          },
        },
      ];

      const excalidrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
        opts,
      );

      expect(excalidrawElements.length).toBe(5);

      excalidrawElements.forEach((ele) => {
        expect(ele).toMatchSnapshot({
          seed: expect.any(Number),
          versionNonce: expect.any(Number),
          id: expect.any(String),
        });
      });
    });

    it("should bind arrows to existing text elements when start / end provided with ids", () => {
      const elements = [
        {
          x: 100,
          y: 239,
          type: "text",
          text: "HEYYYYY",
          id: "text-1",
          strokeColor: "#c2255c",
        },
        {
          type: "text",
          id: "text-2",
          x: 560,
          y: 239,
          text: "Whats up ?",
        },
        {
          type: "arrow",
          x: 255,
          y: 239,
          label: {
            text: "HELLO WORLD!!",
          },
          start: {
            id: "text-1",
          },
          end: {
            id: "text-2",
          },
        },
      ];

      const excalidrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
        opts,
      );

      expect(excalidrawElements.length).toBe(4);

      excalidrawElements.forEach((ele) => {
        expect(ele).toMatchSnapshot({
          seed: expect.any(Number),
          versionNonce: expect.any(Number),
          id: expect.any(String),
        });
      });
    });

    it("should bind arrows to existing elements if ids are correct", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementationOnce(() => void 0);
      const elements = [
        {
          x: 100,
          y: 239,
          type: "text",
          text: "HEYYYYY",
          id: "text-1",
          strokeColor: "#c2255c",
        },
        {
          type: "rectangle",
          x: 560,
          y: 139,
          id: "rect-1",
          width: 100,
          height: 200,
          backgroundColor: "#bac8ff",
        },
        {
          type: "arrow",
          x: 255,
          y: 239,
          label: {
            text: "HELLO WORLD!!",
          },
          start: {
            id: "text-13",
          },
          end: {
            id: "rect-11",
          },
        },
      ];

      const excalidrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
        opts,
      );

      expect(excalidrawElements.length).toBe(4);
      const [, , arrow, text] = excalidrawElements;
      expect(arrow).toMatchObject({
        type: "arrow",
        x: 255.5,
        y: 239,
        boundElements: [
          {
            id: text.id,
            type: "text",
          },
        ],
        startBinding: null,
        endBinding: null,
      });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        "No element for start binding with id text-13 found",
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        "No element for end binding with id rect-11 found",
      );
    });

    it("should bind when ids referenced before the element data", () => {
      const elements = [
        {
          type: "arrow",
          x: 255,
          y: 239,
          end: {
            id: "rect-1",
          },
        },
        {
          type: "rectangle",
          x: 560,
          y: 139,
          id: "rect-1",
          width: 100,
          height: 200,
          backgroundColor: "#bac8ff",
        },
      ];
      const excalidrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
        opts,
      );
      expect(excalidrawElements.length).toBe(2);
      const [arrow, rect] = excalidrawElements;
      expect((arrow as ExcalidrawArrowElement).endBinding).toStrictEqual({
        elementId: "rect-1",
        focus: -0,
        gap: 14,
      });
      expect(rect.boundElements).toStrictEqual([
        {
          id: arrow.id,
          type: "arrow",
        },
      ]);
    });
  });

  it("should not allow duplicate ids", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementationOnce(() => void 0);
    const elements = [
      {
        type: "rectangle",
        x: 300,
        y: 100,
        id: "rect-1",
        width: 100,
        height: 200,
      },

      {
        type: "rectangle",
        x: 100,
        y: 200,
        id: "rect-1",
        width: 100,
        height: 200,
      },
    ];
    const excalidrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
      opts,
    );

    expect(excalidrawElements.length).toBe(1);
    expect(excalidrawElements[0]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Duplicate id found for rect-1",
    );
  });

  it("should contains customData if provided", () => {
    const rawData = [
      {
        type: "rectangle",
        x: 100,
        y: 100,
        customData: { createdBy: "user01" },
      },
    ];
    const convertedElements = convertToExcalidrawElements(
      rawData as ExcalidrawElementSkeleton[],
      opts,
    );
    expect(convertedElements[0].customData).toStrictEqual({
      createdBy: "user01",
    });
  });

  it("should transform the elements correctly when linear elements have single point", () => {
    const elements: ExcalidrawElementSkeleton[] = [
      {
        id: "B",
        type: "rectangle",
        groupIds: ["subgraph_group_B"],
        x: 0,
        y: 0,
        width: 166.03125,
        height: 163,
        label: {
          groupIds: ["subgraph_group_B"],
          text: "B",
          fontSize: 20,
          verticalAlign: "top",
        },
      },
      {
        id: "A",
        type: "rectangle",
        groupIds: ["subgraph_group_A"],
        x: 364.546875,
        y: 0,
        width: 120.265625,
        height: 114,
        label: {
          groupIds: ["subgraph_group_A"],
          text: "A",
          fontSize: 20,
          verticalAlign: "top",
        },
      },
      {
        id: "Alice",
        type: "rectangle",
        groupIds: ["subgraph_group_A"],
        x: 389.546875,
        y: 35,
        width: 70.265625,
        height: 44,
        strokeWidth: 2,
        label: {
          groupIds: ["subgraph_group_A"],
          text: "Alice",
          fontSize: 20,
        },
        link: null,
      },
      {
        id: "Bob",
        type: "rectangle",
        groupIds: ["subgraph_group_B"],
        x: 54.76953125,
        y: 35,
        width: 56.4921875,
        height: 44,
        strokeWidth: 2,
        label: {
          groupIds: ["subgraph_group_B"],
          text: "Bob",
          fontSize: 20,
        },
        link: null,
      },
      {
        id: "Bob_Alice",
        type: "arrow",
        groupIds: [],
        x: 111.262,
        y: 57,
        strokeWidth: 2,
        points: [pointFrom(0, 0), pointFrom(272.985, 0)],
        label: {
          text: "How are you?",
          fontSize: 20,
          groupIds: [],
        },
        roundness: {
          type: 2,
        },
        start: {
          id: "Bob",
        },
        end: {
          id: "Alice",
        },
      },
      {
        id: "Bob_B",
        type: "arrow",
        groupIds: [],
        x: 77.017,
        y: 79,
        strokeWidth: 2,
        points: [pointFrom(0, 0)],
        label: {
          text: "Friendship",
          fontSize: 20,
          groupIds: [],
        },
        roundness: {
          type: 2,
        },
        start: {
          id: "Bob",
        },
        end: {
          id: "B",
        },
      },
    ];

    const excalidrawElements = convertToExcalidrawElements(elements, opts);
    expect(excalidrawElements.length).toBe(12);
    excalidrawElements.forEach((ele) => {
      expect(ele).toMatchSnapshot({
        seed: expect.any(Number),
        versionNonce: expect.any(Number),
        id: expect.any(String),
      });
    });
  });
});
