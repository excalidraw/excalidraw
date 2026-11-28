import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawRectangleElement,
} from "@excalidraw/element/types";

import {
  actionChangeRoundness,
  actionChangeStrokeWidth,
} from "../actions/actionProperties";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Pointer, UI } from "./helpers/ui";
import { act, render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

const getRect = (id: string) =>
  h.elements.find((el): el is ExcalidrawRectangleElement => el.id === id)!;

const getArrow = (id: string) =>
  h.elements.find((el): el is ExcalidrawArrowElement => el.id === id)!;

const endGlobal = (arrow: ExcalidrawArrowElement) => {
  const last = arrow.points[arrow.points.length - 1];
  return [arrow.x + last[0], arrow.y + last[1]] as const;
};

const setup = () => {
  const rect = API.createElement({
    type: "rectangle",
    id: "rect1",
    x: 200,
    y: 200,
    width: 200,
    height: 100,
  });

  API.setElements([
    {
      ...rect,
      boundElements: [{ id: "arrow1", type: "arrow" }],
    },
    API.createElement({
      type: "arrow",
      id: "arrow1",
      x: 550,
      y: 240,
      width: 150,
      height: 10,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(-150, 10),
      ],
      endBinding: {
        elementId: "rect1",
        fixedPoint: [1, 0.5],
        mode: "orbit",
      },
    }),
  ]);

  UI.clickTool("selection");
  API.setSelectedElements([getRect("rect1")]);
};

describe("stroke width / roundness re-route bound arrows", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("pushes the bound endpoint out when stroke gets thicker (#12472)", async () => {
    setup();
    const [beforeX] = endGlobal(getArrow("arrow1"));

    await act(async () => {
      h.app.actionManager.executeAction(actionChangeStrokeWidth, "ui", "bold");
    });

    const rectAfter = getRect("rect1");
    expect(rectAfter.strokeWidth).toBeGreaterThan(1);
    const [afterX] = endGlobal(getArrow("arrow1"));
    // thicker stroke widens the binding gap, endpoint must move out (right)
    expect(afterX).toBeGreaterThan(beforeX);
    expect(getArrow("arrow1").endBinding?.elementId).toBe("rect1");
  });

  it("follows the outline when corners are rounded (#12472)", async () => {
    setup();
    const [beforeX, beforeY] = endGlobal(getArrow("arrow1"));

    await act(async () => {
      h.app.actionManager.executeAction(actionChangeRoundness, "ui", "round");
    });

    expect(getRect("rect1").roundness).not.toBeNull();
    const [afterX, afterY] = endGlobal(getArrow("arrow1"));
    // rounded corner cuts the sharp corner: endpoint must move
    expect([afterX, afterY]).not.toEqual([beforeX, beforeY]);
    expect(getArrow("arrow1").endBinding?.elementId).toBe("rect1");
  });
});
