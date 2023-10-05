import { LaserPointer } from "@excalidraw/laser-pointer";

import { sceneCoordsToViewportCoords } from "../../utils";
import App from "../App";
import { getClientColor } from "../../clients";

// decay time in milliseconds
const DECAY_TIME = 1000;
// length of line in points before it starts decaying
const DECAY_LENGTH = 50;

const average = (a: number, b: number) => (a + b) / 2;
function getSvgPathFromStroke(points: number[][], closed = true) {
  const len = points.length;

  if (len < 4) {
    return ``;
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2,
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1],
  ).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2,
    )} `;
  }

  if (closed) {
    result += "Z";
  }

  return result;
}

declare global {
  interface Window {
    LPM: LaserPathManager;
  }
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function instantiateCollabolatorState(): CollabolatorState {
  return {
    currentPath: undefined,
    finishedPaths: [],
    lastPoint: [-10000, -10000],
    svg: document.createElementNS("http://www.w3.org/2000/svg", "path"),
  };
}

function instantiatePath() {
  LaserPointer.constants.cornerDetectionMaxAngle = 70;

  return new LaserPointer({
    simplify: 0,
    streamline: 0.4,
    sizeMapping: (c) => {
      const pt = DECAY_TIME;
      const pl = DECAY_LENGTH;
      const t = Math.max(0, 1 - (performance.now() - c.pressure) / pt);
      const l = (pl - Math.min(pl, c.totalLength - c.currentIndex)) / pl;

      return Math.min(easeOutCubic(l), easeOutCubic(t));
    },
  });
}

type CollabolatorState = {
  currentPath: LaserPointer | undefined;
  finishedPaths: LaserPointer[];
  lastPoint: [number, number];
  svg: SVGPathElement;
};

export class LaserPathManager {
  private ownState: CollabolatorState;
  private collaboratorsState: Map<string, CollabolatorState> = new Map();

  private rafId: number | undefined;
  private lastUpdate = 0;
  private container: SVGSVGElement | undefined;

  constructor(private app: App) {
    this.ownState = instantiateCollabolatorState();
  }

  destroy() {
    this.stop();
    this.lastUpdate = 0;
    this.ownState = instantiateCollabolatorState();
    this.collaboratorsState = new Map();
  }

  startPath(x: number, y: number) {
    this.ownState.currentPath = instantiatePath();
    this.ownState.currentPath.addPoint([x, y, performance.now()]);
    this.updatePath(this.ownState);
  }

  addPointToPath(x: number, y: number) {
    if (this.ownState.currentPath) {
      this.ownState.currentPath?.addPoint([x, y, performance.now()]);
      this.updatePath(this.ownState);
    }
  }

  endPath() {
    if (this.ownState.currentPath) {
      this.ownState.currentPath.close();
      this.ownState.finishedPaths.push(this.ownState.currentPath);
      this.updatePath(this.ownState);
    }
  }

  private updatePath(state: CollabolatorState) {
    this.lastUpdate = performance.now();

    if (!this.isRunning) {
      this.start();
    }
  }

  private isRunning = false;

  start(svg?: SVGSVGElement) {
    if (svg) {
      this.container = svg;
      this.container.appendChild(this.ownState.svg);
    }

    this.stop();
    this.isRunning = true;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = undefined;
  }

  loop() {
    this.rafId = requestAnimationFrame(this.loop.bind(this));

    this.updateCollabolatorsState();

    if (performance.now() - this.lastUpdate < DECAY_TIME * 2) {
      this.update();
    } else {
      this.isRunning = false;
    }
  }

  draw(path: LaserPointer) {
    const stroke = path
      .getStrokeOutline(path.options.size / this.app.state.zoom.value)
      .map(([x, y]) => {
        const result = sceneCoordsToViewportCoords(
          { sceneX: x, sceneY: y },
          this.app.state,
        );

        return [result.x, result.y];
      });

    return getSvgPathFromStroke(stroke, true);
  }

  updateCollabolatorsState() {
    if (!this.container || !this.app.state.collaborators.size) {
      return;
    }

    for (const [key, collabolator] of this.app.state.collaborators.entries()) {
      if (!this.collaboratorsState.has(key)) {
        const state = instantiateCollabolatorState();
        this.container.appendChild(state.svg);
        this.collaboratorsState.set(key, state);

        this.updatePath(state);
      }

      const state = this.collaboratorsState.get(key)!;

      if (collabolator.pointer && collabolator.pointer.tool === "laser") {
        if (collabolator.button === "down" && state.currentPath === undefined) {
          state.lastPoint = [collabolator.pointer.x, collabolator.pointer.y];
          state.currentPath = instantiatePath();
          state.currentPath.addPoint([
            collabolator.pointer.x,
            collabolator.pointer.y,
            performance.now(),
          ]);

          this.updatePath(state);
        }

        if (collabolator.button === "down" && state.currentPath !== undefined) {
          if (
            collabolator.pointer.x !== state.lastPoint[0] ||
            collabolator.pointer.y !== state.lastPoint[1]
          ) {
            state.lastPoint = [collabolator.pointer.x, collabolator.pointer.y];
            state.currentPath.addPoint([
              collabolator.pointer.x,
              collabolator.pointer.y,
              performance.now(),
            ]);

            this.updatePath(state);
          }
        }

        if (collabolator.button === "up" && state.currentPath !== undefined) {
          state.lastPoint = [collabolator.pointer.x, collabolator.pointer.y];
          state.currentPath.addPoint([
            collabolator.pointer.x,
            collabolator.pointer.y,
            performance.now(),
          ]);
          state.currentPath.close();

          state.finishedPaths.push(state.currentPath);
          state.currentPath = undefined;

          this.updatePath(state);
        }
      }
    }
  }

  update() {
    if (!this.container) {
      return;
    }

    for (const [key, state] of this.collaboratorsState.entries()) {
      if (!this.app.state.collaborators.has(key)) {
        state.svg.remove();
        this.collaboratorsState.delete(key);
        continue;
      }

      state.finishedPaths = state.finishedPaths.filter((path) => {
        const lastPoint = path.originalPoints[path.originalPoints.length - 1];

        return !(lastPoint && lastPoint[2] < performance.now() - DECAY_TIME);
      });

      let paths = state.finishedPaths.map((path) => this.draw(path)).join(" ");

      if (state.currentPath) {
        paths += ` ${this.draw(state.currentPath)}`;
      }

      state.svg.setAttribute("d", paths);
      state.svg.setAttribute("fill", getClientColor(key));
    }

    this.ownState.finishedPaths = this.ownState.finishedPaths.filter((path) => {
      const lastPoint = path.originalPoints[path.originalPoints.length - 1];

      return !(lastPoint && lastPoint[2] < performance.now() - DECAY_TIME);
    });

    let paths = this.ownState.finishedPaths
      .map((path) => this.draw(path))
      .join(" ");

    if (this.ownState.currentPath) {
      paths += ` ${this.draw(this.ownState.currentPath)}`;
    }

    this.ownState.svg.setAttribute("d", paths);
    this.ownState.svg.setAttribute("fill", "red");
  }
}
