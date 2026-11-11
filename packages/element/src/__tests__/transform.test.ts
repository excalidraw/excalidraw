import {
  arrayToMap,
  DEFAULT_STICKY_NOTE_BG,
  DEFAULT_STICKY_NOTE_SIZE,
  STICKY_NOTE_MIN_FONT_SIZE,
  STICKY_NOTE_MIN_SIZE,
  getUpdatedTimestamp,
} from "@excalidraw/common";
import { pointDistance, pointFrom } from "@excalidraw/math";
import { vi } from "vitest";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import {
  newElement,
  newEmbeddableElement,
  newFreeDrawElement,
  newIframeElement,
} from "../newElement";

import { getBindingGap } from "../binding";
import { getArrowheadSize, getCommonBounds } from "../bounds";
import { LinearElementEditor } from "../linearElementEditor";
import { getBoundTextElement } from "../textElement";
import * as textMeasurements from "../textMeasurements";
import * as textWrapping from "../textWrapping";
import {
  convertToExcalidrawElements,
  type ExcalidrawElementSkeleton,
} from "../transform";

import type { RenderEnvironment } from "../renderEnvironment";

import type {
  ExcalidrawArrowElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "../types";

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
      // placed where binding puts bound arrows: off the shape by the gap
      expect(arrow.y).toBeCloseTo(239, 1);
      expect(arrow).toMatchObject({
        type: "arrow",
        x: 261,
        boundElements: [{ id: text.id, type: "text" }],
        startBinding: {
          elementId: rectangle.id,
        },
        endBinding: {
          elementId: ellipse.id,
        },
      });

      // centered on the arrow as placed
      expect(text.x).toBeCloseTo(240, 1);
      expect(text.y).toBeCloseTo(226.5, 1);
      expect(text).toMatchObject({
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

      // placed where binding puts bound arrows: off the text by the gap
      expect(arrow.y).toBeCloseTo(239, 1);
      expect(arrow).toMatchObject({
        type: "arrow",
        x: 261,
        boundElements: [{ id: text1.id, type: "text" }],
        startBinding: {
          elementId: text2.id,
        },
        endBinding: {
          elementId: text3.id,
        },
      });

      // centered on the arrow as placed
      expect(text1.x).toBeCloseTo(240, 1);
      expect(text1.y).toBeCloseTo(226.5, 1);
      expect(text1).toMatchObject({
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
          // reaching text-2, within its binding area
          width: 305,
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
        x: 255,
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
          // reaching rect-1, within its binding area
          x: 460,
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
        fixedPoint: [0, 0.5001],
        mode: "orbit",
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

  describe("creation timestamps", () => {
    const createElements = () => [
      {
        ...newElement({ type: "rectangle", x: 0, y: 0 }),
        type: "rectangle" as const,
      },
      newFreeDrawElement({
        type: "freedraw",
        x: 0,
        y: 0,
        simulatePressure: false,
      }),
      newIframeElement({ type: "iframe", x: 0, y: 0 }),
      newEmbeddableElement({ type: "embeddable", x: 0, y: 0 }),
    ];

    it("assigns fresh timestamps when regenerating IDs without mutating the input", () => {
      const elements = createElements().map((element) => ({
        ...element,
        created: 123,
      }));
      const converted = convertToExcalidrawElements(elements);

      expect(converted).toHaveLength(elements.length);
      converted.forEach((element, index) => {
        expect(element.id).not.toBe(elements[index].id);
        expect(element.created).toBe(getUpdatedTimestamp());
        expect(elements[index].created).toBe(123);
      });
    });

    it.each([123, 0, null])(
      "preserves an explicit timestamp of %s when retaining IDs",
      (created) => {
        const elements = createElements().map((element) => ({
          ...element,
          created,
        }));
        const converted = convertToExcalidrawElements(elements, opts);

        converted.forEach((element, index) => {
          expect(element.id).toBe(elements[index].id);
          expect(element.created).toBe(created);
        });
      },
    );

    it("defaults missing timestamps when retaining IDs, as every type goes through a constructor", () => {
      // models skeletons persisted before `created` existed; the declared
      // skeleton type is a complete element
      const elements = createElements().map(
        ({ created, ...element }) => element,
      ) as unknown as ExcalidrawElementSkeleton[];
      const converted = convertToExcalidrawElements(elements, opts);

      converted.forEach((element, index) => {
        expect(element.id).toBe(elements[index].id);
        expect(element.created).toBe(getUpdatedTimestamp());
        expect(elements[index]).not.toHaveProperty("created");
      });
    });

    it("assigns fresh timestamps to generated labels and binding endpoints", () => {
      const elements: ExcalidrawElementSkeleton[] = [
        {
          type: "arrow",
          x: 100,
          y: 100,
          created: 123,
          // fragments cannot carry a creation time; they are always new
          label: { text: "label" },
          start: { type: "rectangle" },
          end: { type: "text", text: "end" },
        },
      ];
      const converted = convertToExcalidrawElements(elements);

      expect(converted).toHaveLength(4);
      expect(converted.map((element) => element.created)).toEqual(
        Array(4).fill(getUpdatedTimestamp()),
      );
    });
  });

  describe("sticky notes", () => {
    const find = <
      T extends ExcalidrawStickyNoteElement | ExcalidrawTextElement,
    >(
      elements: readonly { type: string }[],
      type: T["type"],
    ) => elements.find((element) => element.type === type) as T;

    it("creates a finalized note with the sticky defaults", () => {
      const elements = convertToExcalidrawElements(
        [{ type: "stickynote", x: 100, y: 100 }],
        opts,
      );
      const note = find<ExcalidrawStickyNoteElement>(elements, "stickynote");

      expect(elements).toHaveLength(1);
      expect(note.width).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(note.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(note.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(note.backgroundColor).toBe(DEFAULT_STICKY_NOTE_BG);
      expect(note.fillStyle).toBe("solid");
    });

    it("enforces the note invariants on the given properties", () => {
      const note = find<ExcalidrawStickyNoteElement>(
        convertToExcalidrawElements(
          [
            {
              type: "stickynote",
              x: 0,
              y: 0,
              width: 10,
              height: 300,
              backgroundColor: "transparent",
              strokeColor: "transparent",
            },
          ],
          opts,
        ),
        "stickynote",
      );

      expect(note.width).toBe(STICKY_NOTE_MIN_SIZE);
      expect(note.height).toBe(300);
      expect(note.baseHeight).toBe(300);
      expect(note.backgroundColor).toBe(DEFAULT_STICKY_NOTE_BG);
      expect(note.strokeColor).not.toBe("transparent");
    });

    it("gives the note the color of a label that sets its own", () => {
      const elements = convertToExcalidrawElements(
        [
          {
            type: "stickynote",
            x: 0,
            y: 0,
            strokeColor: "#1971c2",
            label: { text: "hello", strokeColor: "#e03131" },
          },
        ],
        opts,
      );
      const note = find<ExcalidrawStickyNoteElement>(elements, "stickynote");
      const label = find<ExcalidrawTextElement>(elements, "text");

      expect(label.strokeColor).toBe("#e03131");
      expect(note.strokeColor).toBe("#e03131");
    });

    it("binds a label whose font size becomes the note's ceiling", () => {
      const elements = convertToExcalidrawElements(
        [
          {
            type: "stickynote",
            x: 100,
            y: 100,
            strokeColor: "#1971c2",
            label: { text: "hello", fontSize: 28 },
          },
        ],
        opts,
      );
      const note = find<ExcalidrawStickyNoteElement>(elements, "stickynote");
      const label = find<ExcalidrawTextElement>(elements, "text");

      expect(elements).toHaveLength(2);
      expect(label.containerId).toBe(note.id);
      expect(note.boundElements).toEqual([{ type: "text", id: label.id }]);
      expect(label.baseFontSize).toBe(28);
      expect(label.fontSize).toBe(28);
      // the label is the note's visible text: it takes the note's stroke
      expect(label.strokeColor).toBe("#1971c2");
      expect(note.height).toBe(DEFAULT_STICKY_NOTE_SIZE);
    });

    it("grows the note for a label that overflows at the minimum font size", () => {
      const elements = convertToExcalidrawElements(
        [
          {
            type: "stickynote",
            x: 0,
            y: 0,
            label: {
              text: Array(40).fill("abcdefghijklmnopqrstuvwx").join("\n"),
              fontSize: 28,
            },
          },
        ],
        opts,
      );
      const note = find<ExcalidrawStickyNoteElement>(elements, "stickynote");
      const label = find<ExcalidrawTextElement>(elements, "text");

      expect(label.fontSize).toBe(STICKY_NOTE_MIN_FONT_SIZE);
      expect(label.baseFontSize).toBe(28);
      expect(note.baseHeight).toBe(DEFAULT_STICKY_NOTE_SIZE);
      expect(note.height).toBeGreaterThan(DEFAULT_STICKY_NOTE_SIZE);
    });
  });

  it("should position arrow labels along the arrow when labelPosition provided", () => {
    const elements = convertToExcalidrawElements(
      [
        {
          type: "arrow",
          x: 100,
          y: 100,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
          label: { text: "QUARTER", labelPosition: 0.25 },
        },
        {
          type: "arrow",
          x: 100,
          y: 200,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
          label: { text: "HALF" },
        },
      ],
      opts,
    );
    const [arrow, defaultArrow] = elements.filter(
      (element) => element.type === "arrow",
    );
    const getLabel = (containerId: string) =>
      elements.find(
        (element) =>
          element.type === "text" && element.containerId === containerId,
      ) as ExcalidrawTextElement;

    expect(getLabel(arrow.id).labelPosition).toBe(0.25);
    expect(getLabel(defaultArrow.id).labelPosition).toBe(0.5);
    // centered a quarter of the way along the arrow
    const label = getLabel(arrow.id);
    expect(label.x + label.width / 2).toBeCloseTo(150);
  });

  it("should clamp out-of-range arrow label positions as restore does", () => {
    const elements = convertToExcalidrawElements(
      [-1, 5].map((labelPosition, i) => ({
        type: "arrow" as const,
        x: 100,
        y: 100 * i,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(200, 0)],
        label: { text: "LABEL", labelPosition },
      })),
      opts,
    );
    const labels = elements.filter(
      (element) => element.type === "text",
    ) as ExcalidrawTextElement[];

    expect(labels.map((label) => label.labelPosition)).toEqual([0, 1]);
  });

  it("should measure bound arrow labels with the given render environment", () => {
    const renderEnvironment: RenderEnvironment = {
      createCanvas: () => document.createElement("canvas"),
      createImage: () => ({} as HTMLImageElement),
      textMetrics: { getLineWidth: () => 42 },
    };
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 100 },
        { type: "rectangle", id: "B", x: 400, y: 0, width: 100, height: 100 },
        {
          type: "arrow",
          x: 100,
          y: 50,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(300, 0)],
          start: { id: "A" },
          end: { id: "B" },
          label: { text: "LABEL" },
        },
      ],
      { ...opts, renderEnvironment },
    );
    const label = elements.find(
      (element) => element.type === "text",
    ) as ExcalidrawTextElement;

    expect(label.width).toBe(42);
  });

  it("should size frames around bound arrows as placed by their bindings", () => {
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 20 },
        { type: "rectangle", id: "B", x: 500, y: 0, width: 100, height: 20 },
        {
          type: "arrow",
          id: "arrow",
          x: 100,
          y: 10,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(400, 0)],
          start: { id: "A" },
          end: { id: "B" },
          // fits on one line along the arrow as given (280px), but wraps
          // along the arrow shortened by its binding gaps
          label: { text: "aaaa bbbb cccc dddd eeee fff" },
        },
        { type: "frame", children: ["A", "B", "arrow"] },
      ],
      opts,
    );
    const frame = elements.find((element) => element.type === "frame")!;
    const label = elements.find(
      (element) => element.type === "text",
    ) as ExcalidrawTextElement;

    expect(label.text).toContain("\n");
    const [, minY, , maxY] = getCommonBounds(
      elements.filter((element) => element.frameId === frame.id),
    );
    expect(frame.y).toBeLessThanOrEqual(minY);
    expect(frame.y + frame.height).toBeGreaterThanOrEqual(maxY);
  });

  it("should keep bound arrows sized by their points when labels rewrap", () => {
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 20 },
        { type: "rectangle", id: "B", x: 500, y: 0, width: 100, height: 20 },
        {
          type: "arrow",
          x: 100,
          y: 10,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(400, 0)],
          start: { id: "A" },
          end: { id: "B" },
          // wraps to a taller label along the arrow shortened by its binding
          label: { text: "aaaa bbbb cccc dddd eeee fff" },
        },
      ],
      opts,
    );
    const arrow = elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;
    const label = elements.find(
      (element) => element.type === "text",
    ) as ExcalidrawTextElement;

    expect(label.text).toContain("\n");
    expect(arrow.points.every(([, y]) => y === 0)).toBe(true);
    expect(arrow.height).toBe(0);
  });

  it("should place bound arrows listed by elements they aren't bound to", () => {
    const convert = (stale: boolean) =>
      convertToExcalidrawElements(
        [
          // lists the arrow without it being bound to it
          ...(stale
            ? [
                {
                  type: "rectangle" as const,
                  id: "X",
                  x: 0,
                  y: 300,
                  boundElements: [{ id: "arrow", type: "arrow" as const }],
                },
              ]
            : []),
          { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 100 },
          { type: "rectangle", id: "B", x: 400, y: 0, width: 100, height: 100 },
          {
            type: "arrow",
            id: "arrow",
            x: 100,
            y: 50,
            points: [
              pointFrom<LocalPoint>(0, 0),
              pointFrom<LocalPoint>(300, 0),
            ],
            start: { id: "A" },
            end: { id: "B" },
          },
        ],
        opts,
      ).find((element) => element.id === "arrow")!;

    const arrow = convert(true);
    expect(arrow).toMatchObject({
      x: convert(false).x,
      width: convert(false).width,
    });
    // placed off A by the binding gap
    expect(arrow.x).toBeGreaterThan(100);
  });

  it("should keep arrow labels where labelPosition puts them on the arrow as given", () => {
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 100 },
        { type: "rectangle", id: "B", x: 400, y: 0, width: 100, height: 100 },
        {
          type: "arrow",
          x: 80,
          y: 50,
          // starts inside A and ends short of B, so placing it shortens its
          // start end only
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(250, 0)],
          start: { id: "A" },
          end: { id: "B" },
          // a quarter of the way along the arrow as given: x = 142.5
          label: { text: "LABEL", labelPosition: 0.25 },
        },
      ],
      opts,
    );
    const arrow = elements.find(
      (element) => element.type === "arrow",
    ) as ExcalidrawArrowElement;
    const label = elements.find(
      (element) => element.type === "text",
    ) as ExcalidrawTextElementWithContainer;

    // placed off A by the binding gap
    expect(arrow.x).toBeGreaterThan(100);
    const { x, y } = LinearElementEditor.getBoundTextElementPosition(
      arrow,
      label,
      arrayToMap(elements),
    );
    expect(x + label.width / 2).toBeCloseTo(142.5);
    expect(y + label.height / 2).toBeCloseTo(50, 1);
  });

  it("should place arrow labels with no labelPosition as with the default one given", () => {
    const elements = convertToExcalidrawElements(
      [undefined, 0.5].flatMap((labelPosition, i) => [
        {
          type: "rectangle" as const,
          id: `A${i}`,
          x: 0,
          y: 200 * i,
          width: 100,
          height: 100,
        },
        {
          type: "rectangle" as const,
          id: `B${i}`,
          x: 400,
          y: 200 * i,
          width: 100,
          height: 100,
        },
        {
          type: "arrow" as const,
          id: `arrow${i}`,
          // starts inside A and ends short of B, so placing it shortens its
          // start end only
          x: 80,
          y: 200 * i + 50,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(250, 0)],
          start: { id: `A${i}` },
          end: { id: `B${i}` },
          // halfway along the arrow as given: x = 205
          label: { text: "LABEL", labelPosition },
        },
      ]),
      opts,
    );
    const elementsMap = arrayToMap(elements);
    const [defaultLabel, givenLabel] = ["arrow0", "arrow1"].map((id) => {
      const arrow = elementsMap.get(id) as ExcalidrawArrowElement;
      const label = getBoundTextElement(
        arrow,
        elementsMap,
      ) as ExcalidrawTextElementWithContainer;
      const { x } = LinearElementEditor.getBoundTextElementPosition(
        arrow,
        label,
        elementsMap,
      );
      return { label, centerX: x + label.width / 2 };
    });

    expect(defaultLabel.label.labelPosition).toBeCloseTo(
      givenLabel.label.labelPosition!,
    );
    expect(defaultLabel.centerX).toBeCloseTo(205);
    expect(givenLabel.centerX).toBeCloseTo(205);
  });

  it("should keep arrow labels clear of the arrow's ends when labelPosition puts them on a stretch placing trimmed off", () => {
    const elements = convertToExcalidrawElements(
      [0.05, 0.95].flatMap((labelPosition, i) => [
        {
          type: "rectangle" as const,
          id: `A${i}`,
          x: 0,
          y: 200 * i,
          width: 100,
          height: 100,
        },
        {
          type: "rectangle" as const,
          id: `B${i}`,
          x: 400,
          y: 200 * i,
          width: 100,
          height: 100,
        },
        {
          type: "arrow" as const,
          id: `arrow${i}`,
          // from A's center to B's center, as a layout engine might route it
          x: 50,
          y: 200 * i + 50,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(400, 0)],
          start: { id: `A${i}` },
          end: { id: `B${i}` },
          // inside A, and inside B
          label: { text: "LABEL", labelPosition },
        },
      ]),
      opts,
    );
    const elementsMap = arrayToMap(elements);
    const [startLabel, endLabel] = ["arrow0", "arrow1"].map((id) => {
      const arrow = elementsMap.get(id) as ExcalidrawArrowElement;
      const label = getBoundTextElement(
        arrow,
        elementsMap,
      ) as ExcalidrawTextElementWithContainer;
      const { x } = LinearElementEditor.getBoundTextElementPosition(
        arrow,
        label,
        elementsMap,
      );
      const [, [endX]] = LinearElementEditor.getPointsGlobalCoordinates(
        arrow,
        elementsMap,
      );
      return { arrow, label, x, endX };
    });

    // as close to the start as it can be without covering it
    expect(startLabel.label.labelPosition).toBeGreaterThan(0);
    expect(startLabel.x).toBeCloseTo(startLabel.arrow.x);
    // ...and to the end without covering its arrowhead
    expect(endLabel.label.labelPosition).toBeLessThan(1);
    expect(endLabel.x + endLabel.label.width).toBeCloseTo(
      endLabel.endX - getArrowheadSize("arrow"),
    );
  });

  it("should store bound arrow labels' x/y where the placed arrows put them", () => {
    const elements = convertToExcalidrawElements(
      [undefined, 0.25].flatMap((labelPosition, i) => [
        {
          type: "rectangle" as const,
          id: `A${i}`,
          x: 0,
          y: 100 * i,
          width: 100,
          height: 20,
        },
        {
          type: "rectangle" as const,
          id: `B${i}`,
          x: 500,
          y: 100 * i,
          width: 100,
          height: 20,
        },
        {
          type: "arrow" as const,
          x: 100,
          y: 100 * i + 10,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(400, 0)],
          start: { id: `A${i}` },
          end: { id: `B${i}` },
          // wraps along the arrow shortened by its binding gaps
          label: { text: "aaaa bbbb cccc dddd eeee fff", labelPosition },
        },
      ]),
      opts,
    );
    const elementsMap = arrayToMap(elements);
    const labels = elements.filter(
      (element) => element.type === "text",
    ) as ExcalidrawTextElementWithContainer[];

    expect(labels).toHaveLength(2);
    for (const label of labels) {
      const arrow = elementsMap.get(
        label.containerId,
      ) as ExcalidrawArrowElement;
      expect(label.text).toContain("\n");
      const { x, y } = LinearElementEditor.getBoundTextElementPosition(
        arrow,
        label,
        elementsMap,
      );
      expect(label.x).toBeCloseTo(x);
      expect(label.y).toBeCloseTo(y);
    }
  });

  it("should keep arrows' unbound ends where they're given", () => {
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 100 },
        {
          type: "arrow",
          id: "half-bound",
          x: 100,
          y: 50,
          points: [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(300, 100),
          ],
          start: { id: "A" },
        },
        {
          type: "arrow",
          id: "unbound",
          x: 100,
          y: 300,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(300, 0)],
        },
      ],
      opts,
    );
    const elementsMap = arrayToMap(elements);
    const halfBound = elementsMap.get("half-bound") as ExcalidrawArrowElement;
    const unbound = elementsMap.get("unbound") as ExcalidrawArrowElement;

    // placed off A by the binding gap
    expect(halfBound.x).toBeGreaterThan(100);
    const [endX, endY] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      halfBound,
      -1,
      elementsMap,
    );
    expect(endX).toBeCloseTo(400);
    expect(endY).toBeCloseTo(150);
    expect(unbound).toMatchObject({
      x: 100,
      y: 300,
      width: 300,
      points: [
        [0, 0],
        [300, 0],
      ],
    });
  });

  it("should unbind arrow ends given beyond the binding areas of the elements they're bound to", () => {
    // e.g. a sequence diagram's messages, bound to their participants' headers
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 20 },
        { type: "rectangle", id: "B", x: 500, y: 0, width: 100, height: 20 },
        {
          type: "arrow",
          id: "beyond",
          x: 50,
          // further below them than binding distance
          y: 40,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(500, 0)],
          start: { id: "A" },
          end: { id: "B" },
          label: { text: "message" },
        },
        {
          type: "arrow",
          id: "half-far",
          x: 100,
          y: 10,
          points: [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(450, 490),
          ],
          start: { id: "A" },
          end: { id: "B" },
        },
        {
          type: "arrow",
          id: "near",
          x: 50,
          // within binding distance below them
          y: 30,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(500, 0)],
          start: { id: "A" },
          end: { id: "B" },
        },
      ],
      opts,
    );
    const elementsMap = arrayToMap(elements);
    const near = elementsMap.get("near") as ExcalidrawArrowElement;
    const beyond = elementsMap.get("beyond") as ExcalidrawArrowElement;
    const halfFar = elementsMap.get("half-far") as ExcalidrawArrowElement;

    expect(beyond).toMatchObject({
      startBinding: null,
      endBinding: null,
      x: 50,
      y: 40,
      width: 500,
      height: 0,
      points: [
        [0, 0],
        [500, 0],
      ],
    });
    expect(near.startBinding?.elementId).toBe("A");
    expect(near.endBinding?.elementId).toBe("B");
    expect(halfFar.startBinding?.elementId).toBe("A");
    expect(halfFar.endBinding).toBeNull();
    expect(elementsMap.get("A")?.boundElements).toEqual([
      { id: "half-far", type: "arrow" },
      { id: "near", type: "arrow" },
    ]);
    expect(elementsMap.get("B")?.boundElements).toEqual([
      { id: "near", type: "arrow" },
    ]);

    // placed off A by the binding gap, its unbound end left where given
    expect(halfFar.x).toBeGreaterThan(100);
    const [endX, endY] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      halfFar,
      -1,
      elementsMap,
    );
    expect(endX).toBeCloseTo(550);
    expect(endY).toBeCloseTo(500);
  });

  it("should frame arrows unbound from a frame's children with them", () => {
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 20 },
        { type: "rectangle", id: "B", x: 500, y: 0, width: 100, height: 20 },
        {
          type: "arrow",
          id: "arrow",
          x: 50,
          // further below them than binding distance
          y: 60,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(500, 0)],
          start: { id: "A" },
          end: { id: "B" },
        },
        { type: "frame", children: ["A", "B"] },
      ],
      opts,
    );
    const frame = elements.find((element) => element.type === "frame")!;
    const arrow = elements.find(
      (element) => element.id === "arrow",
    ) as ExcalidrawArrowElement;

    expect(arrow.startBinding).toBeNull();
    expect(arrow.endBinding).toBeNull();
    expect(arrow.frameId).toBe(frame.id);
    const [, , , maxY] = getCommonBounds([arrow]);
    expect(frame.y + frame.height).toBeGreaterThanOrEqual(maxY);
  });

  it("should extend arrow ends falling short of the elements they're bound to onto them", () => {
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 20 },
        { type: "rectangle", id: "B", x: 500, y: 0, width: 100, height: 20 },
        {
          type: "arrow",
          id: "short",
          // ends 100px short of B: within its end segment's length
          x: 150,
          y: 10,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(250, 0)],
          end: { id: "B" },
        },
        {
          type: "arrow",
          id: "stub",
          // starts 80px short of A: within the minimum extension
          x: 180,
          y: 10,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(20, 0)],
          start: { id: "A" },
        },
        {
          type: "arrow",
          id: "too-short",
          // ends 200px short of B: beyond its end segment's length
          x: 200,
          y: 10,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
          end: { id: "B" },
        },
      ],
      opts,
    );
    const elementsMap = arrayToMap(elements);
    const short = elementsMap.get("short") as ExcalidrawArrowElement;
    const stub = elementsMap.get("stub") as ExcalidrawArrowElement;
    const tooShort = elementsMap.get("too-short") as ExcalidrawArrowElement;

    expect(short.endBinding?.elementId).toBe("B");
    const [shortEndX, shortEndY] =
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        short,
        -1,
        elementsMap,
      );
    expect(shortEndX).toBeCloseTo(500 - getBindingGap(elementsMap.get("B")!));
    expect(shortEndY).toBeCloseTo(10);

    expect(stub.startBinding?.elementId).toBe("A");
    const [stubStartX, stubStartY] =
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        stub,
        0,
        elementsMap,
      );
    expect(stubStartX).toBeCloseTo(100 + getBindingGap(elementsMap.get("A")!));
    expect(stubStartY).toBeCloseTo(10);

    expect(tooShort).toMatchObject({
      endBinding: null,
      x: 200,
      y: 10,
      points: [
        [0, 0],
        [100, 0],
      ],
    });
    expect(elementsMap.get("A")?.boundElements).toEqual([
      { id: "stub", type: "arrow" },
    ]);
    expect(elementsMap.get("B")?.boundElements).toEqual([
      { id: "short", type: "arrow" },
    ]);
  });

  it("should keep arrow ends bound to frame children where given, whether frameId or children is given", () => {
    for (const byFrameId of [true, false]) {
      const elements = convertToExcalidrawElements(
        [
          // not sized yet when arrow ends are checked
          {
            type: "frame",
            id: "frame",
            x: 0,
            y: 0,
            children: byFrameId ? [] : ["A", "B"],
          },
          {
            type: "rectangle",
            id: "A",
            x: 0,
            y: 0,
            width: 100,
            height: 20,
            ...(byFrameId && { frameId: "frame" }),
          },
          {
            type: "rectangle",
            id: "B",
            x: 300,
            y: 0,
            width: 100,
            height: 20,
            ...(byFrameId && { frameId: "frame" }),
          },
          {
            type: "arrow",
            id: "arrow",
            x: 100,
            y: 10,
            points: [
              pointFrom<LocalPoint>(0, 0),
              pointFrom<LocalPoint>(200, 0),
            ],
            start: { id: "A" },
            end: { id: "B" },
          },
        ],
        opts,
      );
      const elementsMap = arrayToMap(elements);
      const arrow = elementsMap.get("arrow") as ExcalidrawArrowElement;

      expect(elementsMap.get("A")?.frameId).toBe("frame");
      expect(elementsMap.get("B")?.frameId).toBe("frame");
      // on the edges they're given on, facing each other
      expect(arrow.startBinding).toStrictEqual({
        elementId: "A",
        fixedPoint: [1, 0.5001],
        mode: "orbit",
      });
      expect(arrow.endBinding).toStrictEqual({
        elementId: "B",
        fixedPoint: [0, 0.5001],
        mode: "orbit",
      });
    }
  });

  it("should bind arrows to elements sized to fit their labels after them as to those before them", () => {
    const convert = (rectangleFirst: boolean) => {
      // sized to fit its label, after the arrows listed before it are bound
      const rectangle = {
        type: "rectangle",
        id: "B",
        x: 400,
        y: 25,
        label: { text: "B" },
      } as const;
      const arrow = {
        type: "arrow",
        id: "arrow",
        x: 100,
        y: 50,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(300, 0)],
        end: { id: "B" },
      } as const;
      const elements = convertToExcalidrawElements(
        rectangleFirst ? [rectangle, arrow] : [arrow, rectangle],
        opts,
      );
      return elements.find(
        (element) => element.id === "arrow",
      ) as ExcalidrawArrowElement;
    };
    const arrowFirst = convert(false);
    const rectangleFirst = convert(true);

    // not bound to the center of B as it was before being sized, but where
    // the end was given: B's left edge
    expect(arrowFirst.endBinding?.fixedPoint[0]).toBeCloseTo(0);
    expect(arrowFirst.endBinding).toEqual(rectangleFirst.endBinding);
    expect(arrowFirst.points).toEqual(rectangleFirst.points);
    expect(arrowFirst.height).toBe(0);
  });

  it("should route elbow arrows extended onto elements as to elements sized to fit their labels after them as to those before them", () => {
    // starting short of A, or ending short of B
    for (const [startX, endX] of [
      [150, 400],
      [106, 330],
    ]) {
      const convert = (rectangleFirst: boolean) => {
        const rectangleA = {
          type: "rectangle",
          id: "A",
          x: 0,
          y: 25,
          width: 100,
          height: 50,
        } as const;
        // sized to fit its label, after the arrows listed before it are bound
        const rectangleB = {
          type: "rectangle",
          id: "B",
          x: 400,
          y: 25,
          label: { text: "B" },
        } as const;
        const arrow = {
          type: "arrow",
          id: "arrow",
          elbowed: true,
          x: startX,
          y: 50,
          points: [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(endX - startX, 0),
          ],
          start: { id: "A" },
          end: { id: "B" },
        } as const;
        const elements = convertToExcalidrawElements(
          rectangleFirst
            ? [rectangleA, rectangleB, arrow]
            : [rectangleA, arrow, rectangleB],
          opts,
        );
        return elements.find(
          (element) => element.id === "arrow",
        ) as ExcalidrawArrowElement;
      };
      const arrowFirst = convert(false);
      const rectangleFirst = convert(true);

      // into B's left side, not routed around it from its center as it was
      // before being sized
      expect(arrowFirst.endBinding?.fixedPoint[0]).toBeLessThan(0);
      expect(arrowFirst.endBinding).toEqual(rectangleFirst.endBinding);
      expect(arrowFirst.points).toEqual(rectangleFirst.points);
      expect(arrowFirst.points).toHaveLength(2);
    }
  });

  it("should create shapes for start / end without ids where arrows in any direction start / end", () => {
    const arrows = {
      diagonal: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
      vertical: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 200)],
      "right-to-left": [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(-200, 0),
      ],
      "multi-point": [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(0, 150),
        pointFrom<LocalPoint>(200, 150),
      ],
    };
    for (const [id, points] of Object.entries(arrows)) {
      for (const [start, end] of [
        [{ type: "rectangle" }, { type: "ellipse" }],
        [{ type: "diamond" }, { type: "text", text: "end" }],
      ] as const) {
        const elements = convertToExcalidrawElements(
          [{ type: "arrow", id, x: 0, y: 0, points, start, end }],
          opts,
        );
        const elementsMap = arrayToMap(elements);
        const arrow = elementsMap.get(id) as ExcalidrawArrowElement;
        const [, startElement, endElement] = elements;

        expect(arrow.startBinding?.elementId).toBe(startElement.id);
        expect(arrow.endBinding?.elementId).toBe(endElement.id);
        expect(startElement.boundElements).toEqual([{ id, type: "arrow" }]);
        expect(endElement.boundElements).toEqual([{ id, type: "arrow" }]);

        // placed off the shapes by about the gap, not routed around them
        for (const [index, element, [x, y]] of [
          [0, startElement, points[0]],
          [-1, endElement, points[points.length - 1]],
        ] as const) {
          const point = LinearElementEditor.getPointAtIndexGlobalCoordinates(
            arrow,
            index,
            elementsMap,
          );
          // the arrows are at 0,0
          expect(
            pointDistance(point, pointFrom<GlobalPoint>(x, y)),
          ).toBeLessThan(2 * getBindingGap(element));
        }
      }
    }
  });

  it("should wrap and measure arrow labels once, along the arrows as placed", () => {
    const wrapTextSpy = vi.spyOn(textWrapping, "wrapText");
    const measureTextSpy = vi.spyOn(textMeasurements, "measureText");
    const elements = convertToExcalidrawElements(
      [
        { type: "rectangle", id: "A", x: 0, y: 0, width: 100, height: 20 },
        { type: "rectangle", id: "B", x: 500, y: 0, width: 100, height: 20 },
        {
          type: "arrow",
          id: "bound",
          x: 100,
          y: 10,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(400, 0)],
          start: { id: "A" },
          end: { id: "B" },
          label: { text: "aaaa bbbb cccc dddd eeee fff" },
        },
        {
          type: "arrow",
          id: "unbound",
          x: 100,
          y: 300,
          points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(400, 0)],
          label: { text: "aaaa bbbb cccc dddd eeee fff" },
        },
      ],
      opts,
    );
    const labelOf = (arrowId: string) =>
      elements.find(
        (element) => element.type === "text" && element.containerId === arrowId,
      ) as ExcalidrawTextElement;

    // wrapped along the bound arrow shortened by its binding gaps, and along
    // the unbound one as given
    expect(labelOf("bound").text).toContain("\n");
    expect(labelOf("unbound").text).not.toContain("\n");
    // once each (plus each unwrapped label's measurement as created)
    expect(wrapTextSpy).toHaveBeenCalledTimes(2);
    expect(measureTextSpy).toHaveBeenCalledTimes(4);

    wrapTextSpy.mockRestore();
    measureTextSpy.mockRestore();
  });
});
