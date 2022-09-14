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
  });

  const p1: Point = [20, 20];
  const p2: Point = [60, 20];
  const midpoint = centerPoint(p1, p2);

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
  ) => {
    createTwoPointerLinearElement("line");
    // Extending line via midpoint
    fireEvent.pointerDown(canvas, {
      clientX: midpoint[0],
      clientY: midpoint[1],
    });
    fireEvent.pointerMove(canvas, {
      clientX: midpoint[0] + 50,
      clientY: midpoint[1] + 50,
    });
    fireEvent.pointerUp(canvas, {
      clientX: midpoint[0] + 50,
      clientY: midpoint[1] + 50,
    });
  };

  const dragLinearElementFromPoint = (point: Point) => {
    fireEvent.pointerDown(canvas, {
      clientX: point[0],
      clientY: point[1],
    });
    fireEvent.pointerMove(canvas, {
      clientX: point[0] + 50,
      clientY: point[1] + 50,
    });
    fireEvent.pointerUp(canvas, {
      clientX: point[0] + 50,
      clientY: point[1] + 50,
    });
  };

  it("should allow dragging line from midpoint in 2 pointer lines outside editor", async () => {
    createTwoPointerLinearElement("line");
    const line = h.elements[0] as ExcalidrawLinearElement;

    expect(renderScene).toHaveBeenCalledTimes(10);
    expect((h.elements[0] as ExcalidrawLinearElement).points.length).toEqual(2);

    // drag line from midpoint
    dragLinearElementFromPoint(midpoint);
    expect(renderScene).toHaveBeenCalledTimes(13);
    expect(line.points.length).toEqual(3);
    expect(line.points).toMatchSnapshot();
  });

  describe("Inside editor", () => {
    it("should allow dragging line from midpoint in 2 pointer lines", async () => {
      createTwoPointerLinearElement("line");
      const line = h.elements[0] as ExcalidrawLinearElement;

      fireEvent.click(canvas, { clientX: p1[0], clientY: p1[1] });

      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.editingLinearElement?.elementId).toEqual(h.elements[0].id);

      // drag line from midpoint
      dragLinearElementFromPoint(midpoint);
      expect(line.points.length).toEqual(3);
      expect(line.points).toMatchSnapshot();
    });

    it("should allow dragging lines from midpoints in between segments", async () => {
      createThreePointerLinearElement("line");

      const line = h.elements[0] as ExcalidrawLinearElement;
      expect(line.points.length).toEqual(3);
      fireEvent.click(canvas, { clientX: p1[0], clientY: p1[1] });

      Keyboard.keyPress(KEYS.ENTER);
      expect(h.state.editingLinearElement?.elementId).toEqual(h.elements[0].id);

      let points = LinearElementEditor.getPointsGlobalCoordinates(line);
      const firstSegmentMidpoint = centerPoint(points[0], points[1]);
      // drag line via first segment midpoint
      dragLinearElementFromPoint(firstSegmentMidpoint);
      expect(line.points.length).toEqual(4);

      // drag line from last segment midpoint
      points = LinearElementEditor.getPointsGlobalCoordinates(line);
      const lastSegmentMidpoint = centerPoint(points.at(-2)!, points.at(-1)!);
      dragLinearElementFromPoint(lastSegmentMidpoint);
      expect(line.points.length).toEqual(5);

      expect(
        (h.elements[0] as ExcalidrawLinearElement).points,
      ).toMatchSnapshot();
    });
  });
});
