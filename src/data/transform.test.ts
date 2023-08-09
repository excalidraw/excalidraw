import { vi } from "vitest";
import {
  ExcalidrawElementSkeleton,
  convertToExcalidrawElements,
} from "./transform";
import { ExcalidrawArrowElement } from "../element/types";

describe("Test Transform", () => {
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
    const excaldrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
    );

    expect(excaldrawElements.length).toBe(4);

    excaldrawElements.forEach((ele) => {
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
    const excaldrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
    );

    expect(excaldrawElements.length).toBe(12);

    excaldrawElements.forEach((ele) => {
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
    const excaldrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
    );

    expect(excaldrawElements.length).toBe(8);

    excaldrawElements.forEach((ele) => {
      expect(ele).toMatchSnapshot({
        seed: expect.any(Number),
        versionNonce: expect.any(Number),
        id: expect.any(String),
      });
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
      const excaldrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
      );

      expect(excaldrawElements.length).toBe(4);
      const [arrow, text, rectangle, ellipse] = excaldrawElements;
      expect(arrow).toMatchObject({
        type: "arrow",
        x: 255,
        y: 239,
        boundElements: [{ id: text.id, type: "text" }],
        startBinding: {
          elementId: rectangle.id,
          focus: 0,
          gap: 1,
        },
        endBinding: {
          elementId: ellipse.id,
          focus: 0,
        },
      });

      expect(text).toMatchObject({
        x: 340,
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
        x: 555,
        y: 189,
        type: "ellipse",
        boundElements: [
          {
            id: arrow.id,
            type: "arrow",
          },
        ],
      });

      excaldrawElements.forEach((ele) => {
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

      const excaldrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
      );

      expect(excaldrawElements.length).toBe(4);

      const [arrow, text1, text2, text3] = excaldrawElements;

      expect(arrow).toMatchObject({
        type: "arrow",
        x: 255,
        y: 239,
        boundElements: [{ id: text1.id, type: "text" }],
        startBinding: {
          elementId: text2.id,
          focus: 0,
          gap: 1,
        },
        endBinding: {
          elementId: text3.id,
          focus: 0,
        },
      });

      expect(text1).toMatchObject({
        x: 340,
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
        x: 555,
        y: 226.5,
        type: "text",
        boundElements: [
          {
            id: arrow.id,
            type: "arrow",
          },
        ],
      });

      excaldrawElements.forEach((ele) => {
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

      const excaldrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
      );

      expect(excaldrawElements.length).toBe(5);

      excaldrawElements.forEach((ele) => {
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

      const excaldrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
      );

      expect(excaldrawElements.length).toBe(4);

      excaldrawElements.forEach((ele) => {
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

      const excaldrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
      );

      expect(excaldrawElements.length).toBe(4);
      const [, , arrow] = excaldrawElements;
      expect(arrow).toMatchObject({
        type: "arrow",
        x: 255,
        y: 239,
        boundElements: [
          {
            id: "id46",
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
      const excaldrawElements = convertToExcalidrawElements(
        elements as ExcalidrawElementSkeleton[],
      );
      expect(excaldrawElements.length).toBe(2);
      const [arrow, rect] = excaldrawElements;
      expect((arrow as ExcalidrawArrowElement).endBinding).toStrictEqual({
        elementId: "rect-1",
        focus: 0,
        gap: 5,
      });
      expect(rect.boundElements).toStrictEqual([
        {
          id: "id47",
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
    const excaldrawElements = convertToExcalidrawElements(
      elements as ExcalidrawElementSkeleton[],
    );

    expect(excaldrawElements.length).toBe(1);
    expect(excaldrawElements[0]).toMatchSnapshot({
      seed: expect.any(Number),
      versionNonce: expect.any(Number),
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Duplicate id found for rect-1",
    );
  });
});
