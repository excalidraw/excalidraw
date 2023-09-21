import { getStroke } from "perfect-freehand";
import { getClientColor } from "../../clients";

import { sceneCoordsToViewportCoords } from "../../utils";
import App from "../App";

type Point = [number, number];

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

export type LaserPath = {
  original: [number, number, number][];
  element: SVGPathElement | undefined;
};

declare global {
  interface Window {
    LPM: LaserPathManager;
  }
}

export class LaserPathManager {
  private currentPaths = new Map<string, LaserPath>();

  private rafId: number | undefined;
  private container: SVGSVGElement | undefined;

  constructor(private app: App) {
    window.LPM = this;
  }

  addPointToPath(client: string, point: Point) {
    let currentPath = this.currentPaths.get(client);
    if (typeof currentPath === "undefined") {
      currentPath = {
        original: [[...point, performance.now()]],
        element: undefined,
      };
      this.currentPaths.set(client, currentPath);
    }

    currentPath.original.push([...point, performance.now()]);
  }

  private translatePoint(point: number[]): Point {
    const result = sceneCoordsToViewportCoords(
      { sceneX: point[0], sceneY: point[1] },
      this.app.state,
    );

    return [result.x, result.y];
  }

  loop(time: number = 0) {
    this.rafId = requestAnimationFrame(this.loop.bind(this));

    this.tick(time);
  }

  start(svg: SVGSVGElement) {
    this.container = svg;

    this.stop();
    this.loop();
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  tick(time: number) {
    if (!this.container) {
      return;
    }

    for (const [client, path] of this.currentPaths) {
      let pathElem = path.element;
      if (typeof pathElem === "undefined") {
        pathElem = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        pathElem.setAttribute("fill", getClientColor(client));
        this.container.appendChild(pathElem);
        path.element = pathElem;
      }

      pathElem.setAttribute("d", this.draw(path, time));
    }
  }

  draw(path: LaserPath, time: number) {
    const pointsToDraw: [number, number, number][] = [];
    const DELAY = 500;

    if (path.original.length <= 3) {
      return "";
    }

    path.original = path.original.filter((point, i) => {
      const age = 1 - Math.min(DELAY, time - point[2]) / 500;

      if (age > 0) {
        pointsToDraw.push([...this.translatePoint(point), age]);
      }

      return age > 0;
    });

    const stroke = getStroke(pointsToDraw, {
      size: 4,
      simulatePressure: false,
      thinning: 1,
      streamline: 0,
    });

    return getSvgPathFromStroke(stroke, true);
  }
}
