import { LaserPointer } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "../animatedTrail";
import { getDefaultAppState } from "../appState";

import type App from "../components/App";
import type { AppState } from "../types";

describe("editor-local trails", () => {
  it("keeps laser, lasso and eraser paths aligned when the editor has a host offset", () => {
    const state: AppState = {
      ...getDefaultAppState(),
      width: 800,
      height: 600,
      offsetLeft: 0,
      offsetTop: 0,
    };
    const animated = new AnimatedTrail({ state } as App, {});
    const trail = new LaserPointer({});
    trail.addPoint([20, 30, performance.now()]);
    trail.addPoint([60, 40, performance.now()]);
    const draw = animated as unknown as {
      drawTrail: (trail: LaserPointer, state: AppState) => string;
    };
    const atOrigin = draw.drawTrail(trail, {
      ...state,
      offsetLeft: 0,
      offsetTop: 0,
    });
    const insideHost = draw.drawTrail(trail, {
      ...state,
      offsetLeft: 220,
      offsetTop: 96,
    });
    expect(atOrigin).not.toBe("");
    expect(insideHost).toBe(atOrigin);
  });
});
