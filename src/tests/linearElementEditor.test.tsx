import ReactDOM from "react-dom";
import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  FontString,
} from "../element/types";
import ExcalidrawApp from "../excalidraw-app";
import { centerPoint } from "../math";
import { reseed } from "../random";
import * as Renderer from "../renderer/renderScene";
import { Keyboard, Pointer } from "./helpers/ui";
import { screen, render, fireEvent, GlobalTestState } from "./test-utils";
import { API } from "../tests/helpers/api";
import { Point } from "../types";
import { KEYS } from "../keys";
import { LinearElementEditor } from "../element/linearElementEditor";
import { queryByText } from "@testing-library/react";
import { resize, rotate } from "./utils";
import { getBoundTextElementPosition, wrapText } from "../element/textElement";
import { getMaxContainerWidth } from "../element/newElement";

const renderScene = jest.spyOn(Renderer, "renderScene");

const { h } = window;
const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;

describe("Test Linear Elements", () => {
  let container: HTMLElement;
  let canvas: HTMLCanvasElement;

  beforeEach(async () => {
    // Unmount ReactDOM from root
    ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
    localStorage.clear();
    renderScene.mockClear();
    reseed(7);
    const comp = await render(<ExcalidrawApp />);
    container = comp.container;
    canvas = container.querySelector("canvas")!;
    canvas.width = 1000;
    canvas.height = 1000;
  });

  const p1: Point = [20, 20];
  const p2: Point = [60, 20];
  const midpoint = centerPoint(p1, p2);
  const delta = 50;
  const mouse = new Pointer("mouse");

  const createTwoPointerLinearElement = (
    type: ExcalidrawLinearElement["type"],
    strokeSharpness: ExcalidrawLinearElement["strokeSharpness"] = "sharp",
    roughness: ExcalidrawLinearElement["roughness"] = 0,
  ) => {
    const line = API.createElement({
      x: p1[0],
      y: p1[1],
      width: p2[0] - p1[0],
      height: 0,
      type,
      roughness,
      points: [
        [0, 0],
        [p2[0] - p1[0], p2[1] - p1[1]],
      ],
      strokeSharpness,
    });
    h.elements = [line];

    mouse.clickAt(p1[0], p1[1]);
    return line;
  };

  const createThreePointerLinearElement = (
    type: ExcalidrawLinearElement["type"],
    strokeSharpness: ExcalidrawLinearElement["strokeSharpness"] = "sharp",
    roughness: ExcalidrawLinearElement["roughness"] = 0,
  ) => {
    //dragging line from midpoint
    const p3 = [midpoint[0] + delta - p1[0], midpoint[1] + delta - p1[1]];
    const line = API.createElement({
      x: p1[0],
      y: p1[1],
      width: p3[0] - p1[0],
      height: 0,
      type,
      roughness,
      points: [
        [0, 0],
        [p3[0], p3[1]],
        [p2[0] - p1[0], p2[1] - p1[1]],
      ],
      strokeSharpness,
    });
    h.elements = [line];
    mouse.clickAt(p1[0], p1[1]);
    return line;
  };

  const enterLineEditingMode = (
    line: ExcalidrawLinearElement,
    selectProgrammatically = false,
  ) => {
    if (selectProgrammatically) {
      API.setSelectedElements([line]);
    } else {
      mouse.clickAt(p1[0], p1[1]);
    }
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ENTER);
    });
    expect(h.state.editingLinearElement?.elementId).toEqual(line.id);
  };

  const drag = (startPoint: Point, endPoint: Point) => {
    fireEvent.pointerDown(canvas, {
      clientX: startPoint[0],
      clientY: startPoint[1],
    });
    fireEvent.pointerMove(canvas, {
      clientX: endPoint[0],
      clientY: endPoint[1],
    });
    fireEvent.pointerUp(canvas, {
      clientX: endPoint[0],
      clientY: endPoint[1],
    });
  };

  const deletePoint = (point: Point) => {
    fireEvent.pointerDown(canvas, {
      clientX: point[0],
      clientY: point[1],
    });
    fireEvent.pointerUp(canvas, {
      clientX: point[0],
      clientY: point[1],
    });
    Keyboard.keyPress(KEYS.DELETE);
  };

  it("should allow dragging line from midpoint in 2 pointer lines outside editor", async () => {
    createTwoPointerLinearElement("line");
    const line = h.elements[0] as ExcalidrawLinearElement;

    expect(renderScene).toHaveBeenCalledTimes(7);
    expect((h.elements[0] as ExcalidrawLinearElement).points.length).toEqual(2);

    // drag line from midpoint
    drag(midpoint, [midpoint[0] + delta, midpoint[1] + delta]);
    expect(renderScene).toHaveBeenCalledTimes(10);
    expect(line.points.length).toEqual(3);
    expect(line.points).toMatchInlineSnapshot(`
      Array [
        Array [
          0,
          0,
        ],
        Array [
          70,
          50,
        ],
        Array [
          40,
          0,
        ],
      ]
    `);
  });

  it("should allow entering and exiting line editor via context menu", () => {
    createTwoPointerLinearElement("line");
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    // Enter line editor
    let contextMenu = document.querySelector(".context-menu");
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Edit line")!);

    expect(h.state.editingLinearElement?.elementId).toEqual(h.elements[0].id);

    // Exiting line editor
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    contextMenu = document.querySelector(".context-menu");
    fireEvent.contextMenu(GlobalTestState.canvas, {
      button: 2,
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    fireEvent.click(
      queryByText(contextMenu as HTMLElement, "Exit line editor")!,
    );
    expect(h.state.editingLinearElement?.elementId).toBeUndefined();
  });

  describe("Inside editor", () => {
    it("should allow dragging line from midpoint in 2 pointer lines", async () => {
      createTwoPointerLinearElement("line");

      const line = h.elements[0] as ExcalidrawLinearElement;
      enterLineEditingMode(line);

      // drag line from midpoint
      drag(midpoint, [midpoint[0] + delta, midpoint[1] + delta]);
      expect(renderScene).toHaveBeenCalledTimes(14);

      expect(line.points.length).toEqual(3);
      expect(line.points).toMatchInlineSnapshot(`
        Array [
          Array [
            0,
            0,
          ],
          Array [
            70,
            50,
          ],
          Array [
            40,
            0,
          ],
        ]
      `);
    });

    it("should update the midpoints when element sharpness changed", async () => {
      createThreePointerLinearElement("line");

      const line = h.elements[0] as ExcalidrawLinearElement;
      expect(line.points.length).toEqual(3);

      enterLineEditingMode(line);

      const midPointsWithSharpEdge = LinearElementEditor.getEditorMidPoints(
        line,
        h.state,
      );

      // update sharpness
      fireEvent.click(screen.getByTitle("Round"));

      expect(renderScene).toHaveBeenCalledTimes(12);
      const midPointsWithRoundEdge = LinearElementEditor.getEditorMidPoints(
        h.elements[0] as ExcalidrawLinearElement,
        h.state,
      );
      expect(midPointsWithRoundEdge[0]).not.toEqual(midPointsWithSharpEdge[0]);
      expect(midPointsWithRoundEdge[1]).not.toEqual(midPointsWithSharpEdge[1]);

      expect(midPointsWithRoundEdge).toMatchInlineSnapshot(`
        Array [
          Array [
            55.9697848965255,
            47.442326230998205,
          ],
          Array [
            76.08587175006699,
            43.294165939653226,
          ],
        ]
      `);
    });

    it("should update all the midpoints when element position changed", async () => {
      createThreePointerLinearElement("line", "round");

      const line = h.elements[0] as ExcalidrawLinearElement;
      expect(line.points.length).toEqual(3);
      enterLineEditingMode(line);

      const points = LinearElementEditor.getPointsGlobalCoordinates(line);
      expect([line.x, line.y]).toEqual(points[0]);

      const midPoints = LinearElementEditor.getEditorMidPoints(line, h.state);

      const startPoint = centerPoint(points[0], midPoints[0] as Point);
      const deltaX = 50;
      const deltaY = 20;
      const endPoint: Point = [startPoint[0] + deltaX, startPoint[1] + deltaY];

      // Move the element
      drag(startPoint, endPoint);

      expect(renderScene).toHaveBeenCalledTimes(15);
      expect([line.x, line.y]).toEqual([
        points[0][0] + deltaX,
        points[0][1] + deltaY,
      ]);

      const newMidPoints = LinearElementEditor.getEditorMidPoints(
        line,
        h.state,
      );
      expect(midPoints[0]).not.toEqual(newMidPoints[0]);
      expect(midPoints[1]).not.toEqual(newMidPoints[1]);
      expect(newMidPoints).toMatchInlineSnapshot(`
        Array [
          Array [
            105.96978489652551,
            67.4423262309982,
          ],
          Array [
            126.08587175006699,
            63.294165939653226,
          ],
        ]
      `);
    });

    describe("When edges are sharp", () => {
      // This is the expected midpoint for line with sharp edge
      // hence hardcoding it so if later some bug is introduced
      // this will fail and we can fix it
      const firstSegmentMidpoint: Point = [55, 45];
      const lastSegmentMidpoint: Point = [75, 40];

      let line: ExcalidrawLinearElement;

      beforeEach(() => {
        line = createThreePointerLinearElement("line");

        expect(line.points.length).toEqual(3);

        enterLineEditingMode(line);
      });

      it("should allow dragging lines from midpoints in between segments", async () => {
        // drag line via first segment midpoint
        drag(firstSegmentMidpoint, [
          firstSegmentMidpoint[0] + delta,
          firstSegmentMidpoint[1] + delta,
        ]);
        expect(line.points.length).toEqual(4);

        // drag line from last segment midpoint
        drag(lastSegmentMidpoint, [
          lastSegmentMidpoint[0] + delta,
          lastSegmentMidpoint[1] + delta,
        ]);

        expect(renderScene).toHaveBeenCalledTimes(19);
        expect(line.points.length).toEqual(5);

        expect((h.elements[0] as ExcalidrawLinearElement).points)
          .toMatchInlineSnapshot(`
          Array [
            Array [
              0,
              0,
            ],
            Array [
              85,
              75,
            ],
            Array [
              70,
              50,
            ],
            Array [
              105,
              75,
            ],
            Array [
              40,
              0,
            ],
          ]
        `);
      });

      it("should update only the first segment midpoint when its point is dragged", async () => {
        const points = LinearElementEditor.getPointsGlobalCoordinates(line);
        const midPoints = LinearElementEditor.getEditorMidPoints(line, h.state);

        const hitCoords: Point = [points[0][0], points[0][1]];

        // Drag from first point
        drag(hitCoords, [hitCoords[0] - delta, hitCoords[1] - delta]);

        expect(renderScene).toHaveBeenCalledTimes(15);

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(line);
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] - delta,
          points[0][1] - delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.state,
        );

        expect(midPoints[0]).not.toEqual(newMidPoints[0]);
        expect(midPoints[1]).toEqual(newMidPoints[1]);
      });

      it("should hide midpoints in the segment when points moved close", async () => {
        const points = LinearElementEditor.getPointsGlobalCoordinates(line);
        const midPoints = LinearElementEditor.getEditorMidPoints(line, h.state);

        const hitCoords: Point = [points[0][0], points[0][1]];

        // Drag from first point
        drag(hitCoords, [hitCoords[0] + delta, hitCoords[1] + delta]);

        expect(renderScene).toHaveBeenCalledTimes(15);

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(line);
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] + delta,
          points[0][1] + delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.state,
        );
        // This midpoint is hidden since the points are too close
        expect(newMidPoints[0]).toBeNull();
        expect(midPoints[1]).toEqual(newMidPoints[1]);
      });

      it("should remove the midpoint when one of the points in the segment is deleted", async () => {
        const line = h.elements[0] as ExcalidrawLinearElement;
        enterLineEditingMode(line);
        const points = LinearElementEditor.getPointsGlobalCoordinates(line);

        // dragging line from last segment midpoint
        drag(lastSegmentMidpoint, [
          lastSegmentMidpoint[0] + 50,
          lastSegmentMidpoint[1] + 50,
        ]);
        expect(line.points.length).toEqual(4);

        const midPoints = LinearElementEditor.getEditorMidPoints(line, h.state);

        // delete 3rd point
        deletePoint(points[2]);
        expect(line.points.length).toEqual(3);
        expect(renderScene).toHaveBeenCalledTimes(21);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.state,
        );
        expect(newMidPoints.length).toEqual(2);
        expect(midPoints[0]).toEqual(newMidPoints[0]);
        expect(midPoints[1]).toEqual(newMidPoints[1]);
      });
    });

    describe("When edges are round", () => {
      // This is the expected midpoint for line with round edge
      // hence hardcoding it so if later some bug is introduced
      // this will fail and we can fix it
      const firstSegmentMidpoint: Point = [
        55.9697848965255, 47.442326230998205,
      ];
      const lastSegmentMidpoint: Point = [
        76.08587175006699, 43.294165939653226,
      ];
      let line: ExcalidrawLinearElement;

      beforeEach(() => {
        line = createThreePointerLinearElement("line", "round");
        expect(line.points.length).toEqual(3);

        enterLineEditingMode(line);
      });

      it("should allow dragging lines from midpoints in between segments", async () => {
        // drag line from first segment midpoint
        drag(firstSegmentMidpoint, [
          firstSegmentMidpoint[0] + delta,
          firstSegmentMidpoint[1] + delta,
        ]);
        expect(line.points.length).toEqual(4);

        // drag line from last segment midpoint
        drag(lastSegmentMidpoint, [
          lastSegmentMidpoint[0] + delta,
          lastSegmentMidpoint[1] + delta,
        ]);
        expect(renderScene).toHaveBeenCalledTimes(19);

        expect(line.points.length).toEqual(5);

        expect((h.elements[0] as ExcalidrawLinearElement).points)
          .toMatchInlineSnapshot(`
          Array [
            Array [
              0,
              0,
            ],
            Array [
              85.96978489652551,
              77.4423262309982,
            ],
            Array [
              70,
              50,
            ],
            Array [
              104.58050066266131,
              74.24758482724201,
            ],
            Array [
              40,
              0,
            ],
          ]
        `);
      });

      it("should update all the midpoints when its point is dragged", async () => {
        const points = LinearElementEditor.getPointsGlobalCoordinates(line);
        const midPoints = LinearElementEditor.getEditorMidPoints(line, h.state);

        const hitCoords: Point = [points[0][0], points[0][1]];

        // Drag from first point
        drag(hitCoords, [hitCoords[0] - delta, hitCoords[1] - delta]);

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(line);
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] - delta,
          points[0][1] - delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.state,
        );

        expect(midPoints[0]).not.toEqual(newMidPoints[0]);
        expect(midPoints[1]).not.toEqual(newMidPoints[1]);
        expect(newMidPoints).toMatchInlineSnapshot(`
          Array [
            Array [
              31.884084517616053,
              23.13275505472383,
            ],
            Array [
              77.74792546875662,
              44.57840982272327,
            ],
          ]
        `);
      });

      it("should hide midpoints in the segment when points moved close", async () => {
        const points = LinearElementEditor.getPointsGlobalCoordinates(line);
        const midPoints = LinearElementEditor.getEditorMidPoints(line, h.state);

        const hitCoords: Point = [points[0][0], points[0][1]];

        // Drag from first point
        drag(hitCoords, [hitCoords[0] + delta, hitCoords[1] + delta]);

        expect(renderScene).toHaveBeenCalledTimes(15);

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(line);
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] + delta,
          points[0][1] + delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.state,
        );
        // This mid point is hidden due to point being too close
        expect(newMidPoints[0]).toBeNull();
        expect(newMidPoints[1]).not.toEqual(midPoints[1]);
      });

      it("should update all the midpoints when a point is deleted", async () => {
        drag(lastSegmentMidpoint, [
          lastSegmentMidpoint[0] + delta,
          lastSegmentMidpoint[1] + delta,
        ]);
        expect(line.points.length).toEqual(4);

        const midPoints = LinearElementEditor.getEditorMidPoints(line, h.state);
        const points = LinearElementEditor.getPointsGlobalCoordinates(line);

        // delete 3rd point
        deletePoint(points[2]);
        expect(line.points.length).toEqual(3);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.state,
        );
        expect(newMidPoints.length).toEqual(2);
        expect(midPoints[0]).not.toEqual(newMidPoints[0]);
        expect(midPoints[1]).not.toEqual(newMidPoints[1]);
        expect(newMidPoints).toMatchInlineSnapshot(`
          Array [
            Array [
              55.9697848965255,
              47.442326230998205,
            ],
            Array [
              76.08587175006699,
              43.294165939653226,
            ],
          ]
        `);
      });
    });

    it("in-editor dragging a line point covered by another element", () => {
      createTwoPointerLinearElement("line");
      const line = h.elements[0] as ExcalidrawLinearElement;
      h.elements = [
        line,
        API.createElement({
          type: "rectangle",
          x: line.x - 50,
          y: line.y - 50,
          width: 100,
          height: 100,
          backgroundColor: "red",
          fillStyle: "solid",
        }),
      ];

      const dragEndPositionOffset = [100, 100] as const;
      API.setSelectedElements([line]);
      enterLineEditingMode(line, true);
      drag(
        [line.points[0][0] + line.x, line.points[0][1] + line.y],
        [dragEndPositionOffset[0] + line.x, dragEndPositionOffset[1] + line.y],
      );
      expect(line.points).toMatchInlineSnapshot(`
        Array [
          Array [
            0,
            0,
          ],
          Array [
            -60,
            -100,
          ],
        ]
      `);
    });
  });
  describe("Test bound text element", () => {
    const DEFAULT_TEXT = "Online whiteboard collaboration made easy";

    const createBoundTextElement = (
      text: string,
      container: ExcalidrawLinearElement,
    ) => {
      const textElement = API.createElement({
        type: "text",
        x: 0,
        y: 0,
        text: wrapText(text, font, getMaxContainerWidth(container)),
        containerId: container.id,
        width: 30,
        height: 20,
      }) as ExcalidrawTextElementWithContainer;
      container = {
        ...container,
        boundElements: (container.boundElements || []).concat({
          type: "text",
          id: textElement.id,
        }),
      };
      const elements: ExcalidrawElement[] = [];
      h.elements.forEach((element) => {
        if (element.id === container.id) {
          elements.push(container);
        } else {
          elements.push(element);
        }
      });
      const updatedTextElement = { ...textElement, originalText: text };
      h.elements = [...elements, updatedTextElement];
      return { textElement: updatedTextElement, container };
    };

    describe("Test getBoundTextElementPosition", () => {
      it("should return correct position for 2 pointer line", () => {
        createTwoPointerLinearElement("line");
        const line = h.elements[0] as ExcalidrawLinearElement;
        const { textElement, container } = createBoundTextElement(
          DEFAULT_TEXT,
          line,
        );
        const position = LinearElementEditor.getBoundTextElementPosition(
          container,
          textElement,
        );
        expect(position).toMatchInlineSnapshot(`
          Object {
            "x": 25,
            "y": 10,
          }
        `);
      });

      it("should return correct position for line with odd points", () => {
        createThreePointerLinearElement("line", "round");
        const line = h.elements[0] as ExcalidrawLinearElement;
        const { textElement, container } = createBoundTextElement(
          DEFAULT_TEXT,
          line,
        );

        const position = LinearElementEditor.getBoundTextElementPosition(
          container,
          textElement,
        );
        expect(position).toMatchInlineSnapshot(`
          Object {
            "x": 75,
            "y": 60,
          }
        `);
      });

      it("should return correct position for line with even points", () => {
        createThreePointerLinearElement("line", "round");
        const line = h.elements[0] as ExcalidrawLinearElement;
        const { textElement, container } = createBoundTextElement(
          DEFAULT_TEXT,
          line,
        );
        enterLineEditingMode(container);
        // This is the expected midpoint for line with round edge
        // hence hardcoding it so if later some bug is introduced
        // this will fail and we can fix it
        const firstSegmentMidpoint: Point = [
          55.9697848965255, 47.442326230998205,
        ];
        // drag line from first segment midpoint
        drag(firstSegmentMidpoint, [
          firstSegmentMidpoint[0] + delta,
          firstSegmentMidpoint[1] + delta,
        ]);

        const position = LinearElementEditor.getBoundTextElementPosition(
          container,
          textElement,
        );
        expect(position).toMatchInlineSnapshot(`
          Object {
            "x": 100.32201843191861,
            "y": 85.63461309860818,
          }
        `);
      });
    });

    it("should bind text to container when clicked", async () => {
      createTwoPointerLinearElement("line");
      const line = h.elements[0] as ExcalidrawLinearElement;

      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(line.id);
      mouse.doubleClickAt(line.x, line.y);
      expect(h.elements.length).toBe(2);

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.type).toBe("text");
      expect(text.containerId).toBe(line.id);
      mouse.down();
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, {
        target: { value: DEFAULT_TEXT },
      });

      await new Promise((r) => setTimeout(r, 0));
      editor.blur();
      expect(line.boundElements).toStrictEqual([{ id: text.id, type: "text" }]);
      expect((h.elements[1] as ExcalidrawTextElementWithContainer).text)
        .toMatchInlineSnapshot(`
        "
        O
        n
        l
        i
        n
        e

        w
        h
        i
        t
        e
        b
        o
        a
        r
        d

        c
        o
        l
        l
        a
        b
        o
        r
        a
        t
        i
        o
        n

        m
        a
        d
        e

        e
        a
        s
        y"
      `);
    });

    it("should bind text to container when clicked on container and enter pressed", async () => {
      const line = createTwoPointerLinearElement("line");

      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(line.id);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.elements.length).toBe(2);

      const textElement = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(textElement.type).toBe("text");
      expect(textElement.containerId).toBe(line.id);
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      await new Promise((r) => setTimeout(r, 0));

      fireEvent.change(editor, {
        target: { value: DEFAULT_TEXT },
      });
      editor.blur();
      expect(line.boundElements).toStrictEqual([
        { id: textElement.id, type: "text" },
      ]);
      expect((h.elements[1] as ExcalidrawTextElementWithContainer).text)
        .toMatchInlineSnapshot(`
        "
        O
        n
        l
        i
        n
        e

        w
        h
        i
        t
        e
        b
        o
        a
        r
        d

        c
        o
        l
        l
        a
        b
        o
        r
        a
        t
        i
        o
        n

        m
        a
        d
        e

        e
        a
        s
        y"
      `);
    });

    it("should not rotate the bound text and update position of bound text and bounding box correctly when linear element rotated", () => {
      createThreePointerLinearElement("line", "round");

      const line = h.elements[0] as ExcalidrawLinearElement;

      const { textElement, container } = createBoundTextElement(
        DEFAULT_TEXT,
        line,
      );

      expect(container.angle).toBe(0);
      expect(textElement.angle).toBe(0);
      expect(getBoundTextElementPosition(line, textElement))
        .toMatchInlineSnapshot(`
        Object {
          "x": 75,
          "y": 60,
        }
      `);
      expect(textElement.text).toMatchInlineSnapshot(`
        "Online 
        whitebo
        ard 
        collabo
        ration 
        made 
        easy"
      `);
      expect(LinearElementEditor.getElementAbsoluteCoords(container, true))
        .toMatchInlineSnapshot(`
        Array [
          20,
          20,
          105,
          80,
          55.45893770831013,
          45,
        ]
      `);

      rotate(container, -35, 55);
      expect(container.angle).toMatchInlineSnapshot(`1.3988061968364685`);
      expect(textElement.angle).toBe(0);
      expect(getBoundTextElementPosition(container, textElement))
        .toMatchInlineSnapshot(`
        Object {
          "x": 21.73926141863671,
          "y": 73.31003398390868,
        }
      `);
      expect(textElement.text).toMatchInlineSnapshot(`
        "Online 
        whitebo
        ard 
        collabo
        ration 
        made 
        easy"
      `);
      expect(LinearElementEditor.getElementAbsoluteCoords(container, true))
        .toMatchInlineSnapshot(`
        Array [
          20,
          20,
          102.41961302274555,
          86.49012635273976,
          55.45893770831013,
          45,
        ]
      `);
    });

    it("should resize and position the bound text and bounding box correctly when 3 pointer linear element resized", () => {
      createThreePointerLinearElement("line", "round");

      const line = h.elements[0] as ExcalidrawLinearElement;

      const { textElement, container } = createBoundTextElement(
        DEFAULT_TEXT,
        line,
      );
      expect(container.width).toBe(70);
      expect(container.height).toBe(50);
      expect(getBoundTextElementPosition(container, textElement))
        .toMatchInlineSnapshot(`
        Object {
          "x": 75,
          "y": 60,
        }
      `);
      expect(textElement.text).toMatchInlineSnapshot(`
        "Online 
        whitebo
        ard 
        collabo
        ration 
        made 
        easy"
      `);
      expect(LinearElementEditor.getElementAbsoluteCoords(container, true))
        .toMatchInlineSnapshot(`
        Array [
          20,
          20,
          105,
          80,
          55.45893770831013,
          45,
        ]
      `);

      resize(container, "ne", [200, 200]);

      expect({ width: container.width, height: container.height })
        .toMatchInlineSnapshot(`
        Object {
          "height": 10,
          "width": 268,
        }
      `);

      expect(getBoundTextElementPosition(container, textElement))
        .toMatchInlineSnapshot(`
        Object {
          "x": 287.5,
          "y": 70,
        }
      `);
      expect((h.elements[1] as ExcalidrawTextElementWithContainer).text)
        .toMatchInlineSnapshot(`
        "Online whiteboard 
        collaboration made
        easy"
      `);
      expect(LinearElementEditor.getElementAbsoluteCoords(container, true))
        .toMatchInlineSnapshot(`
        Array [
          20,
          60,
          291.5141515950605,
          70,
          155.75707579753026,
          65,
        ]
      `);
    });

    it("should resize and position the bound text correctly when 2 pointer linear element resized", () => {
      createTwoPointerLinearElement("line");

      const line = h.elements[0] as ExcalidrawLinearElement;
      const { textElement, container } = createBoundTextElement(
        DEFAULT_TEXT,
        line,
      );
      expect(container.width).toBe(40);
      expect(getBoundTextElementPosition(container, textElement))
        .toMatchInlineSnapshot(`
        Object {
          "x": 25,
          "y": 10,
        }
      `);
      expect(textElement.text).toMatchInlineSnapshot(`
        "Online 
        whitebo
        ard 
        collabo
        ration 
        made 
        easy"
      `);
      const points = LinearElementEditor.getPointsGlobalCoordinates(container);

      // Drag from last point
      drag(points[1], [points[1][0] + 150, points[1][1]]);

      expect({ width: container.width, height: container.height })
        .toMatchInlineSnapshot(`
        Object {
          "height": 0,
          "width": 190,
        }
      `);

      expect(getBoundTextElementPosition(container, textElement))
        .toMatchInlineSnapshot(`
        Object {
          "x": 114.5,
          "y": 20,
        }
      `);
      expect(textElement.text).toMatchInlineSnapshot(`
        "Online 
        whiteboard
        collaborat
        ion made 
        easy"
      `);
    });
  });
});
