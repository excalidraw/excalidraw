import React from "react";
import ReactDOM from "react-dom";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  FontString,
  SceneElementsMap,
} from "../element/types";
import { Excalidraw, mutateElement } from "../index";
import { reseed } from "../random";
import * as StaticScene from "../renderer/staticScene";
import * as InteractiveCanvas from "../renderer/interactiveScene";

import { Keyboard, Pointer, UI } from "./helpers/ui";
import { screen, render, fireEvent, GlobalTestState } from "./test-utils";
import { API } from "../tests/helpers/api";
import { KEYS } from "../keys";
import { LinearElementEditor } from "../element/linearElementEditor";
import { act, queryByTestId, queryByText } from "@testing-library/react";
import {
  getBoundTextElementPosition,
  wrapText,
  getBoundTextMaxWidth,
} from "../element/textElement";
import * as textElementUtils from "../element/textElement";
import { ROUNDNESS, VERTICAL_ALIGN } from "../constants";
import { vi } from "vitest";
import { arrayToMap } from "../utils";
import type { GlobalPoint } from "../../math";
import { pointCenter, pointFrom } from "../../math";

const renderInteractiveScene = vi.spyOn(
  InteractiveCanvas,
  "renderInteractiveScene",
);
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

const { h } = window;
const font = "20px Cascadia, width: Segoe UI Emoji" as FontString;

describe("Test Linear Elements", () => {
  let container: HTMLElement;
  let interactiveCanvas: HTMLCanvasElement;

  beforeEach(async () => {
    // Unmount ReactDOM from root
    ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
    localStorage.clear();
    renderInteractiveScene.mockClear();
    renderStaticScene.mockClear();
    reseed(7);
    const comp = await render(<Excalidraw handleKeyboardGlobally={true} />);
    h.state.width = 1000;
    h.state.height = 1000;
    container = comp.container;
    interactiveCanvas = container.querySelector("canvas.interactive")!;
  });

  const p1 = pointFrom<GlobalPoint>(20, 20);
  const p2 = pointFrom<GlobalPoint>(60, 20);
  const midpoint = pointCenter<GlobalPoint>(p1, p2);
  const delta = 50;
  const mouse = new Pointer("mouse");

  const createTwoPointerLinearElement = (
    type: ExcalidrawLinearElement["type"],
    roundness: ExcalidrawElement["roundness"] = null,
    roughness: ExcalidrawLinearElement["roughness"] = 0,
  ) => {
    const line = API.createElement({
      x: p1[0],
      y: p1[1],
      width: p2[0] - p1[0],
      height: 0,
      type,
      roughness,
      points: [pointFrom(0, 0), pointFrom(p2[0] - p1[0], p2[1] - p1[1])],
      roundness,
    });
    API.setElements([line]);

    mouse.clickAt(p1[0], p1[1]);
    return line;
  };

  const createThreePointerLinearElement = (
    type: ExcalidrawLinearElement["type"],
    roundness: ExcalidrawElement["roundness"] = null,
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
        pointFrom(0, 0),
        pointFrom(p3[0], p3[1]),
        pointFrom(p2[0] - p1[0], p2[1] - p1[1]),
      ],
      roundness,
    });
    mutateElement(line, { points: line.points });
    API.setElements([line]);
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

  const drag = (startPoint: GlobalPoint, endPoint: GlobalPoint) => {
    fireEvent.pointerDown(interactiveCanvas, {
      clientX: startPoint[0],
      clientY: startPoint[1],
    });
    fireEvent.pointerMove(interactiveCanvas, {
      clientX: endPoint[0],
      clientY: endPoint[1],
    });
    fireEvent.pointerUp(interactiveCanvas, {
      clientX: endPoint[0],
      clientY: endPoint[1],
    });
  };

  const deletePoint = (point: GlobalPoint) => {
    fireEvent.pointerDown(interactiveCanvas, {
      clientX: point[0],
      clientY: point[1],
    });
    fireEvent.pointerUp(interactiveCanvas, {
      clientX: point[0],
      clientY: point[1],
    });
    Keyboard.keyPress(KEYS.DELETE);
  };

  it("should not drag line and add midpoint until dragged beyond a threshold", () => {
    createTwoPointerLinearElement("line");
    const line = h.elements[0] as ExcalidrawLinearElement;
    const originalX = line.x;
    const originalY = line.y;
    expect(line.points.length).toEqual(2);

    mouse.clickAt(midpoint[0], midpoint[1]);
    drag(midpoint, pointFrom(midpoint[0] + 1, midpoint[1] + 1));

    expect(line.points.length).toEqual(2);

    expect(line.x).toBe(originalX);
    expect(line.y).toBe(originalY);
    expect(line.points.length).toEqual(2);

    drag(midpoint, pointFrom(midpoint[0] + delta, midpoint[1] + delta));
    expect(line.x).toBe(originalX);
    expect(line.y).toBe(originalY);
    expect(line.points.length).toEqual(3);
  });

  it("should allow dragging line from midpoint in 2 pointer lines outside editor", async () => {
    createTwoPointerLinearElement("line");
    const line = h.elements[0] as ExcalidrawLinearElement;

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect((h.elements[0] as ExcalidrawLinearElement).points.length).toEqual(2);

    // drag line from midpoint
    drag(midpoint, pointFrom(midpoint[0] + delta, midpoint[1] + delta));
    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`9`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);
    expect(line.points.length).toEqual(3);
    expect(line.points).toMatchInlineSnapshot(`
      [
        [
          0,
          0,
        ],
        [
          70,
          50,
        ],
        [
          40,
          0,
        ],
      ]
    `);
  });

  it("should allow entering and exiting line editor via context menu", () => {
    createTwoPointerLinearElement("line");
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    // Enter line editor
    const contextMenu = document.querySelector(".context-menu");
    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    fireEvent.click(queryByText(contextMenu as HTMLElement, "Edit line")!);

    expect(h.state.editingLinearElement?.elementId).toEqual(h.elements[0].id);
  });

  it("should enter line editor when using double clicked with ctrl key", () => {
    createTwoPointerLinearElement("line");
    expect(h.state.editingLinearElement?.elementId).toBeUndefined();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.doubleClick();
    });
    expect(h.state.editingLinearElement?.elementId).toEqual(h.elements[0].id);
  });

  describe("Inside editor", () => {
    it("should not drag line and add midpoint when dragged irrespective of threshold", () => {
      createTwoPointerLinearElement("line");
      const line = h.elements[0] as ExcalidrawLinearElement;
      const originalX = line.x;
      const originalY = line.y;
      enterLineEditingMode(line);

      expect(line.points.length).toEqual(2);

      mouse.clickAt(midpoint[0], midpoint[1]);
      expect(line.points.length).toEqual(2);

      drag(midpoint, pointFrom(midpoint[0] + 1, midpoint[1] + 1));
      expect(line.x).toBe(originalX);
      expect(line.y).toBe(originalY);
      expect(line.points.length).toEqual(3);
    });

    it("should allow dragging line from midpoint in 2 pointer lines", async () => {
      createTwoPointerLinearElement("line");

      const line = h.elements[0] as ExcalidrawLinearElement;
      enterLineEditingMode(line);

      // drag line from midpoint
      drag(midpoint, pointFrom(midpoint[0] + delta, midpoint[1] + delta));
      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `12`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`6`);

      expect(line.points.length).toEqual(3);
      expect(line.points).toMatchInlineSnapshot(`
        [
          [
            0,
            0,
          ],
          [
            70,
            50,
          ],
          [
            40,
            0,
          ],
        ]
      `);
    });

    it("should update the midpoints when element roundness changed", async () => {
      createThreePointerLinearElement("line");

      const line = h.elements[0] as ExcalidrawLinearElement;
      expect(line.points.length).toEqual(3);

      enterLineEditingMode(line);

      const midPointsWithSharpEdge = LinearElementEditor.getEditorMidPoints(
        line,
        h.app.scene.getNonDeletedElementsMap(),
        h.state,
      );

      // update roundness
      fireEvent.click(screen.getByTitle("Round"));

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `9`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`6`);

      const midPointsWithRoundEdge = LinearElementEditor.getEditorMidPoints(
        h.elements[0] as ExcalidrawLinearElement,
        h.app.scene.getNonDeletedElementsMap(),
        h.state,
      );
      expect(midPointsWithRoundEdge[0]).not.toEqual(midPointsWithSharpEdge[0]);
      expect(midPointsWithRoundEdge[1]).not.toEqual(midPointsWithSharpEdge[1]);

      expect(midPointsWithRoundEdge).toMatchInlineSnapshot(`
        [
          [
            "55.96978",
            "47.44233",
          ],
          [
            "76.08587",
            "43.29417",
          ],
        ]
      `);
    });

    it("should update all the midpoints when element position changed", async () => {
      const elementsMap = arrayToMap(h.elements);

      createThreePointerLinearElement("line", {
        type: ROUNDNESS.PROPORTIONAL_RADIUS,
      });

      const line = h.elements[0] as ExcalidrawLinearElement;
      expect(line.points.length).toEqual(3);
      enterLineEditingMode(line);

      const points = LinearElementEditor.getPointsGlobalCoordinates(
        line,
        elementsMap,
      );
      expect([line.x, line.y]).toEqual(points[0]);

      const midPoints = LinearElementEditor.getEditorMidPoints(
        line,
        h.app.scene.getNonDeletedElementsMap(),
        h.state,
      );

      const startPoint = pointCenter(points[0], midPoints[0]!);
      const deltaX = 50;
      const deltaY = 20;
      const endPoint = pointFrom<GlobalPoint>(
        startPoint[0] + deltaX,
        startPoint[1] + deltaY,
      );

      // Move the element
      drag(startPoint, endPoint);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `12`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);

      expect([line.x, line.y]).toEqual([
        points[0][0] + deltaX,
        points[0][1] + deltaY,
      ]);

      const newMidPoints = LinearElementEditor.getEditorMidPoints(
        line,
        h.app.scene.getNonDeletedElementsMap(),
        h.state,
      );
      expect(midPoints[0]).not.toEqual(newMidPoints[0]);
      expect(midPoints[1]).not.toEqual(newMidPoints[1]);
      expect(newMidPoints).toMatchInlineSnapshot(`
        [
          [
            "105.96978",
            "67.44233",
          ],
          [
            "126.08587",
            "63.29417",
          ],
        ]
      `);
    });

    describe("When edges are round", () => {
      // This is the expected midpoint for line with round edge
      // hence hardcoding it so if later some bug is introduced
      // this will fail and we can fix it
      const firstSegmentMidpoint = pointFrom<GlobalPoint>(55, 45);
      const lastSegmentMidpoint = pointFrom<GlobalPoint>(75, 40);

      let line: ExcalidrawLinearElement;

      beforeEach(() => {
        line = createThreePointerLinearElement("line");

        expect(line.points.length).toEqual(3);

        enterLineEditingMode(line);
      });

      it("should allow dragging lines from midpoints in between segments", async () => {
        // drag line via first segment midpoint
        drag(
          firstSegmentMidpoint,
          pointFrom(
            firstSegmentMidpoint[0] + delta,
            firstSegmentMidpoint[1] + delta,
          ),
        );
        expect(line.points.length).toEqual(4);

        // drag line from last segment midpoint
        drag(
          lastSegmentMidpoint,
          pointFrom(
            lastSegmentMidpoint[0] + delta,
            lastSegmentMidpoint[1] + delta,
          ),
        );

        expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
          `16`,
        );
        expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);

        expect(line.points.length).toEqual(5);

        expect((h.elements[0] as ExcalidrawLinearElement).points)
          .toMatchInlineSnapshot(`
            [
              [
                0,
                0,
              ],
              [
                85,
                75,
              ],
              [
                70,
                50,
              ],
              [
                105,
                70,
              ],
              [
                40,
                0,
              ],
            ]
          `);
      });

      it("should update only the first segment midpoint when its point is dragged", async () => {
        const elementsMap = arrayToMap(h.elements);
        const points = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        const midPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );

        const hitCoords = pointFrom<GlobalPoint>(points[0][0], points[0][1]);

        // Drag from first point
        drag(hitCoords, pointFrom(hitCoords[0] - delta, hitCoords[1] - delta));

        expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
          `12`,
        );
        expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`6`);

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] - delta,
          points[0][1] - delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );

        expect(midPoints[0]).not.toEqual(newMidPoints[0]);
        expect(midPoints[1]).toEqual(newMidPoints[1]);
      });

      it("should hide midpoints in the segment when points moved close", async () => {
        const elementsMap = arrayToMap(h.elements);
        const points = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        const midPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );

        const hitCoords = pointFrom<GlobalPoint>(points[0][0], points[0][1]);

        // Drag from first point
        drag(hitCoords, pointFrom(hitCoords[0] + delta, hitCoords[1] + delta));

        expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
          `12`,
        );
        expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`6`);

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] + delta,
          points[0][1] + delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );
        // This midpoint is hidden since the points are too close
        expect(newMidPoints[0]).toBeNull();
        expect(midPoints[1]).toEqual(newMidPoints[1]);
      });

      it("should remove the midpoint when one of the points in the segment is deleted", async () => {
        const line = h.elements[0] as ExcalidrawLinearElement;
        enterLineEditingMode(line);
        const points = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          arrayToMap(h.elements),
        );

        // dragging line from last segment midpoint
        drag(
          lastSegmentMidpoint,
          pointFrom(lastSegmentMidpoint[0] + 50, lastSegmentMidpoint[1] + 50),
        );
        expect(line.points.length).toEqual(4);

        const midPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );

        // delete 3rd point
        deletePoint(points[2]);
        expect(line.points.length).toEqual(3);
        expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
          `18`,
        );
        expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
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
      const firstSegmentMidpoint = pointFrom<GlobalPoint>(
        55.9697848965255,
        47.442326230998205,
      );
      const lastSegmentMidpoint = pointFrom<GlobalPoint>(
        76.08587175006699,
        43.294165939653226,
      );
      let line: ExcalidrawLinearElement;

      beforeEach(() => {
        line = createThreePointerLinearElement("line", {
          type: ROUNDNESS.PROPORTIONAL_RADIUS,
        });
        expect(line.points.length).toEqual(3);

        enterLineEditingMode(line);
      });

      it("should allow dragging lines from midpoints in between segments", async () => {
        // drag line from first segment midpoint
        drag(
          firstSegmentMidpoint,
          pointFrom(
            firstSegmentMidpoint[0] + delta,
            firstSegmentMidpoint[1] + delta,
          ),
        );
        expect(line.points.length).toEqual(4);

        // drag line from last segment midpoint
        drag(
          lastSegmentMidpoint,
          pointFrom(
            lastSegmentMidpoint[0] + delta,
            lastSegmentMidpoint[1] + delta,
          ),
        );
        expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
          `16`,
        );
        expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);
        expect(line.points.length).toEqual(5);

        expect((h.elements[0] as ExcalidrawLinearElement).points)
          .toMatchInlineSnapshot(`
            [
              [
                0,
                0,
              ],
              [
                "85.96978",
                "77.44233",
              ],
              [
                70,
                50,
              ],
              [
                "106.08587",
                "73.29417",
              ],
              [
                40,
                0,
              ],
            ]
          `);
      });

      it("should update all the midpoints when its point is dragged", async () => {
        const elementsMap = arrayToMap(h.elements);
        const points = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        const midPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );

        const hitCoords = pointFrom<GlobalPoint>(points[0][0], points[0][1]);

        // Drag from first point
        drag(hitCoords, pointFrom(hitCoords[0] - delta, hitCoords[1] - delta));

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] - delta,
          points[0][1] - delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );

        expect(midPoints[0]).not.toEqual(newMidPoints[0]);
        expect(midPoints[1]).not.toEqual(newMidPoints[1]);
        expect(newMidPoints).toMatchInlineSnapshot(`
          [
            [
              "31.88408",
              "23.13276",
            ],
            [
              "77.74793",
              "44.57841",
            ],
          ]
        `);
      });

      it("should hide midpoints in the segment when points moved close", async () => {
        const elementsMap = arrayToMap(h.elements);
        const points = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        const midPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );

        const hitCoords = pointFrom<GlobalPoint>(points[0][0], points[0][1]);

        // Drag from first point
        drag(hitCoords, pointFrom(hitCoords[0] + delta, hitCoords[1] + delta));

        expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
          `12`,
        );
        expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`6`);

        const newPoints = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );
        expect([newPoints[0][0], newPoints[0][1]]).toEqual([
          points[0][0] + delta,
          points[0][1] + delta,
        ]);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );
        // This mid point is hidden due to point being too close
        expect(newMidPoints[0]).toBeNull();
        expect(newMidPoints[1]).not.toEqual(midPoints[1]);
      });

      it("should update all the midpoints when a point is deleted", async () => {
        const elementsMap = arrayToMap(h.elements);

        drag(
          lastSegmentMidpoint,
          pointFrom(
            lastSegmentMidpoint[0] + delta,
            lastSegmentMidpoint[1] + delta,
          ),
        );
        expect(line.points.length).toEqual(4);

        const midPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );
        const points = LinearElementEditor.getPointsGlobalCoordinates(
          line,
          elementsMap,
        );

        // delete 3rd point
        deletePoint(points[2]);
        expect(line.points.length).toEqual(3);

        const newMidPoints = LinearElementEditor.getEditorMidPoints(
          line,
          h.app.scene.getNonDeletedElementsMap(),
          h.state,
        );
        expect(newMidPoints.length).toEqual(2);
        expect(midPoints[0]).not.toEqual(newMidPoints[0]);
        expect(midPoints[1]).not.toEqual(newMidPoints[1]);
        expect(newMidPoints).toMatchInlineSnapshot(`
          [
            [
              "55.96978",
              "47.44233",
            ],
            [
              "76.08587",
              "43.29417",
            ],
          ]
        `);
      });
    });

    it("in-editor dragging a line point covered by another element", () => {
      createTwoPointerLinearElement("line");
      const line = h.elements[0] as ExcalidrawLinearElement;
      API.setElements([
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
      ]);
      const dragEndPositionOffset = [100, 100] as const;
      API.setSelectedElements([line]);
      enterLineEditingMode(line, true);
      drag(
        pointFrom(line.points[0][0] + line.x, line.points[0][1] + line.y),
        pointFrom(
          dragEndPositionOffset[0] + line.x,
          dragEndPositionOffset[1] + line.y,
        ),
      );
      expect(line.points).toMatchInlineSnapshot(`
        [
          [
            0,
            0,
          ],
          [
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
        text: wrapText(text, font, getBoundTextMaxWidth(container, null)),
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
      API.setElements([...elements, updatedTextElement]);
      return { textElement: updatedTextElement, container };
    };

    describe("Test getBoundTextElementPosition", () => {
      it("should return correct position for 2 pointer arrow", () => {
        createTwoPointerLinearElement("arrow");
        const arrow = h.elements[0] as ExcalidrawLinearElement;
        const { textElement, container } = createBoundTextElement(
          DEFAULT_TEXT,
          arrow,
        );
        const position = LinearElementEditor.getBoundTextElementPosition(
          container,
          textElement,
          arrayToMap(h.elements),
        );
        expect(position).toMatchInlineSnapshot(`
          {
            "x": 25,
            "y": 10,
          }
        `);
      });

      it("should return correct position for arrow with odd points", () => {
        createThreePointerLinearElement("arrow", {
          type: ROUNDNESS.PROPORTIONAL_RADIUS,
        });
        const arrow = h.elements[0] as ExcalidrawLinearElement;
        const { textElement, container } = createBoundTextElement(
          DEFAULT_TEXT,
          arrow,
        );

        const position = LinearElementEditor.getBoundTextElementPosition(
          container,
          textElement,
          arrayToMap(h.elements),
        );
        expect(position).toMatchInlineSnapshot(`
          {
            "x": 75,
            "y": 60,
          }
        `);
      });

      it("should return correct position for arrow with even points", () => {
        createThreePointerLinearElement("arrow", {
          type: ROUNDNESS.PROPORTIONAL_RADIUS,
        });
        const arrow = h.elements[0] as ExcalidrawLinearElement;
        const { textElement, container } = createBoundTextElement(
          DEFAULT_TEXT,
          arrow,
        );
        enterLineEditingMode(container);
        // This is the expected midpoint for line with round edge
        // hence hardcoding it so if later some bug is introduced
        // this will fail and we can fix it
        const firstSegmentMidpoint = pointFrom<GlobalPoint>(
          55.9697848965255,
          47.442326230998205,
        );
        // drag line from first segment midpoint
        drag(
          firstSegmentMidpoint,
          pointFrom(
            firstSegmentMidpoint[0] + delta,
            firstSegmentMidpoint[1] + delta,
          ),
        );

        const position = LinearElementEditor.getBoundTextElementPosition(
          container,
          textElement,
          arrayToMap(h.elements),
        );
        expect(position).toMatchInlineSnapshot(`
          {
            "x": "85.82202",
            "y": "75.63461",
          }
        `);
      });
    });

    it("should match styles for text editor", () => {
      createTwoPointerLinearElement("arrow");
      Keyboard.keyPress(KEYS.ENTER);
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      expect(editor).toMatchSnapshot();
    });

    it("should bind text to arrow when double clicked", async () => {
      createTwoPointerLinearElement("arrow");
      const arrow = h.elements[0] as ExcalidrawLinearElement;

      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(arrow.id);
      mouse.doubleClickAt(arrow.x, arrow.y);
      expect(h.elements.length).toBe(2);

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.type).toBe("text");
      expect(text.containerId).toBe(arrow.id);
      mouse.down();
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, {
        target: { value: DEFAULT_TEXT },
      });

      Keyboard.exitTextEditor(editor);
      expect(arrow.boundElements).toStrictEqual([
        { id: text.id, type: "text" },
      ]);
      expect(
        (h.elements[1] as ExcalidrawTextElementWithContainer).text,
      ).toMatchSnapshot();
    });

    it("should bind text to arrow when clicked on arrow and enter pressed", async () => {
      const arrow = createTwoPointerLinearElement("arrow");

      expect(h.elements.length).toBe(1);
      expect(h.elements[0].id).toBe(arrow.id);

      Keyboard.keyPress(KEYS.ENTER);

      expect(h.elements.length).toBe(2);

      const textElement = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(textElement.type).toBe("text");
      expect(textElement.containerId).toBe(arrow.id);
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;

      fireEvent.change(editor, {
        target: { value: DEFAULT_TEXT },
      });
      Keyboard.exitTextEditor(editor);
      expect(arrow.boundElements).toStrictEqual([
        { id: textElement.id, type: "text" },
      ]);
      expect(
        (h.elements[1] as ExcalidrawTextElementWithContainer).text,
      ).toMatchSnapshot();
    });

    it("should not bind text to line when double clicked", async () => {
      const line = createTwoPointerLinearElement("line");

      expect(h.elements.length).toBe(1);
      mouse.doubleClickAt(line.x, line.y);

      expect(h.elements.length).toBe(2);

      const text = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(text.type).toBe("text");
      expect(text.containerId).toBeNull();
      expect(line.boundElements).toBeNull();
    });

    // TODO fix #7029 and rewrite this test
    it.todo(
      "should not rotate the bound text and update position of bound text and bounding box correctly when arrow rotated",
    );

    it("should resize and position the bound text and bounding box correctly when 3 pointer arrow element resized", () => {
      createThreePointerLinearElement("arrow", {
        type: ROUNDNESS.PROPORTIONAL_RADIUS,
      });

      const arrow = h.elements[0] as ExcalidrawLinearElement;

      const { textElement, container } = createBoundTextElement(
        DEFAULT_TEXT,
        arrow,
      );
      expect(container.width).toBe(70);
      expect(container.height).toBe(50);
      expect(
        getBoundTextElementPosition(
          container,
          textElement,
          arrayToMap(h.elements),
        ),
      ).toMatchInlineSnapshot(`
        {
          "x": 75,
          "y": 60,
        }
      `);
      expect(textElement.text).toMatchSnapshot();
      expect(
        LinearElementEditor.getElementAbsoluteCoords(
          container,
          h.app.scene.getNonDeletedElementsMap(),
          true,
        ),
      ).toMatchInlineSnapshot(`
        [
          20,
          20,
          105,
          80,
          "55.45894",
          45,
        ]
      `);

      UI.resize(container, "ne", [300, 200]);

      expect({ width: container.width, height: container.height })
        .toMatchInlineSnapshot(`
          {
            "height": 130,
            "width": "366.11716",
          }
        `);

      expect(
        getBoundTextElementPosition(
          container,
          textElement,
          arrayToMap(h.elements),
        ),
      ).toMatchInlineSnapshot(`
        {
          "x": "271.11716",
          "y": 45,
        }
      `);
      expect(
        (h.elements[1] as ExcalidrawTextElementWithContainer).text,
      ).toMatchSnapshot();
      expect(
        LinearElementEditor.getElementAbsoluteCoords(
          container,
          h.app.scene.getNonDeletedElementsMap(),
          true,
        ),
      ).toMatchInlineSnapshot(`
        [
          20,
          35,
          "501.11716",
          95,
          "205.45894",
          "52.50000",
        ]
      `);
    });

    it("should resize and position the bound text correctly when 2 pointer linear element resized", () => {
      createTwoPointerLinearElement("arrow");

      const arrow = h.elements[0] as ExcalidrawLinearElement;
      const { textElement, container } = createBoundTextElement(
        DEFAULT_TEXT,
        arrow,
      );
      expect(container.width).toBe(40);
      const elementsMap = arrayToMap(h.elements);
      expect(getBoundTextElementPosition(container, textElement, elementsMap))
        .toMatchInlineSnapshot(`
          {
            "x": 25,
            "y": 10,
          }
        `);
      expect(textElement.text).toMatchSnapshot();
      const points = LinearElementEditor.getPointsGlobalCoordinates(
        container,
        elementsMap,
      );

      // Drag from last point
      drag(points[1], pointFrom(points[1][0] + 300, points[1][1]));

      expect({ width: container.width, height: container.height })
        .toMatchInlineSnapshot(`
          {
            "height": 130,
            "width": 340,
          }
        `);

      expect(getBoundTextElementPosition(container, textElement, elementsMap))
        .toMatchInlineSnapshot(`
          {
            "x": 75,
            "y": -5,
          }
        `);
      expect(textElement.text).toMatchSnapshot();
    });

    it("should not render vertical align tool when element selected", () => {
      createTwoPointerLinearElement("arrow");
      const arrow = h.elements[0] as ExcalidrawLinearElement;

      createBoundTextElement(DEFAULT_TEXT, arrow);
      API.setSelectedElements([arrow]);

      expect(queryByTestId(container, "align-top")).toBeNull();
      expect(queryByTestId(container, "align-middle")).toBeNull();
      expect(queryByTestId(container, "align-bottom")).toBeNull();
    });

    it("should wrap the bound text when arrow bound container moves", async () => {
      const rect = UI.createElement("rectangle", {
        x: 400,
        width: 200,
        height: 500,
      });
      const arrow = UI.createElement("arrow", {
        x: -10,
        y: 250,
        width: 400,
        height: 1,
      });

      mouse.select(arrow);
      Keyboard.keyPress(KEYS.ENTER);
      const editor = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: DEFAULT_TEXT } });
      Keyboard.exitTextEditor(editor);

      const textElement = h.elements[2] as ExcalidrawTextElementWithContainer;

      expect(arrow.endBinding?.elementId).toBe(rect.id);
      expect(arrow.width).toBe(400);
      expect(rect.x).toBe(400);
      expect(rect.y).toBe(0);
      expect(
        wrapText(
          textElement.originalText,
          font,
          getBoundTextMaxWidth(arrow, null),
        ),
      ).toMatchSnapshot();
      const handleBindTextResizeSpy = vi.spyOn(
        textElementUtils,
        "handleBindTextResize",
      );

      mouse.select(rect);
      mouse.downAt(rect.x, rect.y);
      mouse.moveTo(200, 0);
      mouse.upAt(200, 0);

      expect(arrow.width).toBe(205);
      expect(rect.x).toBe(200);
      expect(rect.y).toBe(0);
      expect(handleBindTextResizeSpy).toHaveBeenCalledWith(
        h.elements[0],
        arrayToMap(h.elements),
        "nw",
        false,
      );
      expect(
        wrapText(
          textElement.originalText,
          font,
          getBoundTextMaxWidth(arrow, null),
        ),
      ).toMatchSnapshot();
    });

    it("should not render horizontal align tool when element selected", () => {
      createTwoPointerLinearElement("arrow");
      const arrow = h.elements[0] as ExcalidrawLinearElement;

      createBoundTextElement(DEFAULT_TEXT, arrow);
      API.setSelectedElements([arrow]);

      expect(queryByTestId(container, "align-left")).toBeNull();
      expect(queryByTestId(container, "align-horizontal-center")).toBeNull();
      expect(queryByTestId(container, "align-right")).toBeNull();
    });

    it("should update label coords when a label binded via context menu is unbinded", async () => {
      createTwoPointerLinearElement("arrow");
      const text = API.createElement({
        type: "text",
        text: "Hello Excalidraw",
      });
      expect(text.x).toBe(0);
      expect(text.y).toBe(0);

      API.setElements([h.elements[0], text]);

      const container = h.elements[0];
      API.setSelectedElements([container, text]);
      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 20,
        clientY: 30,
      });
      let contextMenu = document.querySelector(".context-menu");

      fireEvent.click(
        queryByText(contextMenu as HTMLElement, "Bind text to the container")!,
      );
      expect(container.boundElements).toStrictEqual([
        { id: h.elements[1].id, type: "text" },
      ]);
      expect(text.containerId).toBe(container.id);
      expect(text.verticalAlign).toBe(VERTICAL_ALIGN.MIDDLE);

      mouse.reset();
      mouse.clickAt(
        container.x + container.width / 2,
        container.y + container.height / 2,
      );
      mouse.down();
      mouse.up();
      API.setSelectedElements([h.elements[0], h.elements[1]]);

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 20,
        clientY: 30,
      });
      contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Unbind text")!);
      expect(container.boundElements).toEqual([]);
      expect(text).toEqual(
        expect.objectContaining({
          containerId: null,
          width: 160,
          height: 25,
          x: -40,
          y: 7.5,
        }),
      );
    });

    it("should not update label position when arrow dragged", () => {
      createTwoPointerLinearElement("arrow");
      let arrow = h.elements[0] as ExcalidrawLinearElement;
      createBoundTextElement(DEFAULT_TEXT, arrow);
      let label = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(arrow.x).toBe(20);
      expect(arrow.y).toBe(20);
      expect(label.x).toBe(0);
      expect(label.y).toBe(0);
      mouse.reset();
      mouse.select(arrow);
      mouse.select(label);
      mouse.downAt(arrow.x, arrow.y);
      mouse.moveTo(arrow.x + 20, arrow.y + 30);
      mouse.up(arrow.x + 20, arrow.y + 30);

      arrow = h.elements[0] as ExcalidrawLinearElement;
      label = h.elements[1] as ExcalidrawTextElementWithContainer;
      expect(arrow.x).toBe(80);
      expect(arrow.y).toBe(100);
      expect(label.x).toBe(0);
      expect(label.y).toBe(0);
    });
  });

  describe("Test moving linear element points", () => {
    it("should move the endpoint in the negative direction correctly when the start point is also moved in the positive direction", async () => {
      const line = createThreePointerLinearElement("arrow");
      const [origStartX, origStartY] = [line.x, line.y];

      act(() => {
        LinearElementEditor.movePoints(
          line,
          [
            {
              index: 0,
              point: pointFrom(line.points[0][0] + 10, line.points[0][1] + 10),
            },
            {
              index: line.points.length - 1,
              point: pointFrom(
                line.points[line.points.length - 1][0] - 10,
                line.points[line.points.length - 1][1] - 10,
              ),
            },
          ],
          new Map() as SceneElementsMap,
        );
      });
      expect(line.x).toBe(origStartX + 10);
      expect(line.y).toBe(origStartY + 10);

      expect(line.points[line.points.length - 1][0]).toBe(20);
      expect(line.points[line.points.length - 1][1]).toBe(-20);
    });
  });
});
