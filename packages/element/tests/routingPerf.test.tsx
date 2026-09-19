import { Excalidraw } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Pointer, UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { render } from "@excalidraw/excalidraw/tests/test-utils";
import "@excalidraw/utils/test-utils";

import type { ExcalidrawArrowElement } from "../src/types";

const { h } = window;

const mouse = new Pointer("mouse");

const measure = (label: string, iterations: number, run: () => void) => {
  // warm up, so the first route's lazy work isn't charged to the average
  run();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    run();
  }
  const perRun = (performance.now() - start) / iterations;

  // eslint-disable-next-line no-console
  console.log(`[routing perf] ${label}: ${perRun.toFixed(3)} ms`);

  return perRun;
};

describe("elbow arrow routing performance", () => {
  beforeEach(async () => {
    localStorage.clear();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const buildBoard = (count: number, spread: number, size: number) => {
    UI.createElement("rectangle", {
      x: -300,
      y: -50,
      width: 100,
      height: 100,
    });
    UI.createElement("rectangle", {
      x: 200,
      y: -50,
      width: 100,
      height: 100,
    });

    const filler = [];
    const perRow = Math.ceil(Math.sqrt(count));

    for (let i = 0; i < count; i++) {
      filler.push(
        API.createElement({
          type: "rectangle",
          x: (i % perRow) * spread - (perRow * spread) / 2,
          y: Math.floor(i / perRow) * spread - (perRow * spread) / 2,
          width: size,
          height: size,
        }),
      );
    }

    API.setElements([...h.elements, ...filler]);

    UI.clickTool("arrow");
    UI.clickOnTestId("elbow-arrow");
    mouse.reset();
    mouse.moveTo(-210, 0);
    mouse.click();
    mouse.moveTo(210, 0);
    mouse.click();

    return h.scene.getSelectedElements(h.state)[0] as ExcalidrawArrowElement;
  };

  it("routes a single arrow well under the 4ms budget on a 500 shape board", () => {
    const arrow = buildBoard(500, 160, 80);

    const perRoute = measure("500 shapes, spread out", 60, () => {
      h.scene.mutateElement(arrow, { points: arrow.points });
    });

    expect(perRoute).toBeLessThan(4);
  });

  it("stays within budget when 500 shapes crowd the corridor", () => {
    const arrow = buildBoard(500, 22, 14);

    const perRoute = measure("500 shapes, crowding the corridor", 30, () => {
      h.scene.mutateElement(arrow, { points: arrow.points });
    });

    expect(perRoute).toBeLessThan(4);
  });
});
