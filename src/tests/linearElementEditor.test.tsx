import ReactDOM from "react-dom";
import { ExcalidrawLinearElement } from "../element/types";
import ExcalidrawApp from "../excalidraw-app";
import { centerPoint } from "../math";
import { reseed } from "../random";
import * as Renderer from "../renderer/renderScene";
import { Keyboard } from "./helpers/ui";
import { screen } from "./test-utils";

import { render, fireEvent } from "./test-utils";
import { Point } from "../types";
import { KEYS } from "../keys";
import { LinearElementEditor } from "../element/linearElementEditor";

const renderScene = jest.spyOn(Renderer, "renderScene");

const { h } = window;

describe(" Test Linear Elements", () => {
  let getByToolName: (...args: string[]) => HTMLElement;
  let container: HTMLElement;
  let canvas: HTMLCanvasElement;

  beforeEach(async () => {
    // Unmount ReactDOM from root
    ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
    localStorage.clear();
    renderScene.mockClear();
    reseed(7);
    const comp = await render(<ExcalidrawApp />);
    getByToolName = comp.getByToolName;
    container = comp.container;
    canvas = container.querySelector("canvas")!;
    canvas.width = 1000;
    canvas.height = 1000;
  });

  const p1: Point = [20, 20];
  const p2: Point = [60, 20];
  const midpoint = centerPoint(p1, p2);
  const delta = 50;

  const createTwoPointerLinearElement = (
    type: ExcalidrawLinearElement["type"],
    edge: "Sharp" | "Round" = "Sharp",
    roughness: "Architect" | "Cartoonist" | "Artist" = "Architect",
  ) => {
    const tool = getByToolName(type);
    fireEvent.click(tool);
    fireEvent.click(screen.getByTitle(edge));
    fireEvent.click(screen.getByTitle(roughness));
    fireEvent.pointerDown(canvas, { clientX: p1[0], clientY: p1[1] });
    fireEvent.pointerMove(canvas, { clientX: p2[0], clientY: p2[1] });
    fireEvent.pointerUp(canvas, { clientX: p2[0], clientY: p2[1] });
  };

  const createThreePointerLinearElement = (
    type: ExcalidrawLinearElement["type"],
    edge: "Sharp" | "Round" = "Sharp",
    roughness: "Architect" | "Cartoonist" | "Artist" = "Architect",
  ) => {
    createTwoPointerLinearElement(type, edge, roughness);
    // Extending line via midpoint
    fireEvent.pointerDown(canvas, {
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    fireEvent.pointerMove(canvas, {
      clientX: midpoint[0] + delta,
      clientY: midpoint[1] + delta,
    });
    fireEvent.pointerUp(canvas, {
      clientX: midpoint[0] + delta,
      clientY: midpoint[1] + delta,
    });
  };

  const enterLineEditingMode = (line: ExcalidrawLinearElement) => {
    Keyboard.keyPress(KEYS.ENTER);
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

    expect(renderScene).toHaveBeenCalledTimes(9);
    expect((h.elements[0] as ExcalidrawLinearElement).points.length).toEqual(2);

    // drag line from midpoint
    drag(midpoint, [midpoint[0] + delta, midpoint[1] + delta]);
    expect(renderScene).toHaveBeenCalledTimes(12);
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

  describe("Inside editor", () => {
    it("should allow dragging line from midpoint in 2 pointer lines", async () => {
      createTwoPointerLinearElement("line");
      const line = h.elements[0] as ExcalidrawLinearElement;
      enterLineEditingMode(line);

      // drag line from midpoint
      drag(midpoint, [midpoint[0] + delta, midpoint[1] + delta]);
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
      createThreePointerLinearElement("line", "Round");

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
        createThreePointerLinearElement("line");
        line = h.elements[0] as ExcalidrawLinearElement;
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

        const hitCoords = [points[0][0], points[0][1]];

        // Drag first point
        fireEvent.pointerDown(canvas, {
          clientX: hitCoords[0],
          clientY: hitCoords[1],
        });
        fireEvent.pointerMove(canvas, {
          clientX: hitCoords[0] - delta,
          clientY: hitCoords[1] - delta,
        });
        fireEvent.pointerUp(canvas, {
          clientX: hitCoords[0] - delta,
          clientY: hitCoords[0] - delta,
        });

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
        createThreePointerLinearElement("line", "Round");
        line = h.elements[0] as ExcalidrawLinearElement;
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

        const hitCoords = [points[0][0], points[0][1]];

        // Drag first point
        fireEvent.pointerDown(canvas, {
          clientX: hitCoords[0],
          clientY: hitCoords[1],
        });
        fireEvent.pointerMove(canvas, {
          clientX: hitCoords[0] - delta,
          clientY: hitCoords[1] - delta,
        });
        fireEvent.pointerUp(canvas, {
          clientX: hitCoords[0] - delta,
          clientY: hitCoords[0] - delta,
        });

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
  });
});
