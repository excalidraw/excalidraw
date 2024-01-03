import { LaserPointer } from "@excalidraw/laser-pointer";
import { AnimationFrameHandler } from "./animation-frame-handler";
import { AppState } from "./types";
import { getSvgPathFromStroke, sceneCoordsToViewportCoords } from "./utils";
import type App from "./components/App";

const DECAY_TIME = 200;
const DECAY_LENGTH = 10;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export class AnimatedTrail {
  private currentTrail?: LaserPointer;
  private pastTrails: LaserPointer[] = [];

  private container?: SVGSVGElement;

  private groupElement: SVGClipPathElement;
  private backgroundElement: SVGRectElement;
  private trailElement: SVGPathElement;
  private headElement: SVGCircleElement;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    private app: App,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));

    this.groupElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "clipPath",
    );

    this.backgroundElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );

    this.trailElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );

    this.headElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );

    this.groupElement.appendChild(this.trailElement);
    this.groupElement.appendChild(this.headElement);

    this.groupElement.id = Math.random().toString(32).slice(2);

    this.backgroundElement.setAttribute(
      "clip-path",
      `url(#${this.groupElement.id})`,
    );

    this.backgroundElement.setAttribute("width", "100%");
    this.backgroundElement.setAttribute("height", "100%");
    this.backgroundElement.setAttribute("fill", "rgba(0, 0, 0, 0.25)");
  }

  start(container: SVGSVGElement) {
    this.container = container;

    this.container.appendChild(this.groupElement);
    this.container.appendChild(this.backgroundElement);

    this.animationFrameHandler.start(this);
  }

  stop() {
    this.animationFrameHandler.stop(this);
  }

  startPath(x: number, y: number) {
    this.currentTrail = new LaserPointer({
      simplify: 0,
      streamline: 0.4,
      size: 7,
      sizeMapping: (c) => {
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOutCubic(l), easeOutCubic(t));
      },
    });

    this.currentTrail.addPoint([x, y, performance.now()]);

    this.update();
  }

  addPointToPath(x: number, y: number) {
    if (this.currentTrail) {
      this.currentTrail.addPoint([x, y, performance.now()]);
      this.update();
    }
  }

  endPath() {
    if (this.currentTrail) {
      this.currentTrail.close();
      this.pastTrails.push(this.currentTrail);
      this.currentTrail = undefined;
      this.update();
    }
  }

  private update() {
    this.animationFrameHandler.start(this);
  }

  private onFrame() {
    const paths: string[] = [];

    for (const trail of this.pastTrails) {
      paths.push(this.drawTrail(trail, this.app.state));
    }

    if (this.currentTrail) {
      const currentPath = this.drawTrail(this.currentTrail, this.app.state);

      paths.push(currentPath);

      this.drawHead(this.currentTrail, this.app.state);
    } else {
      this.clearHead();
    }

    this.pastTrails = this.pastTrails.filter((trail) => {
      const lastPoint = trail.originalPoints[trail.originalPoints.length - 1];

      return !(lastPoint && lastPoint[2] < performance.now() - DECAY_TIME);
    });

    if (paths.length === 0) {
      this.stop();
    }

    const svgPaths = paths.join(" ").trim();

    this.trailElement.setAttribute("d", svgPaths);
    this.trailElement.setAttribute("fill-rule", "non-zero");
    this.groupElement.setAttribute("fill", "rgb(0, 0, 0)");
    this.groupElement.setAttribute("fill-opacity", "0.25");
  }

  private drawTrail(trail: LaserPointer, state: AppState): string {
    const stroke = trail
      .getStrokeOutline(trail.options.size / state.zoom.value)
      .map(([x, y]) => {
        const result = sceneCoordsToViewportCoords(
          { sceneX: x, sceneY: y },
          state,
        );

        return [result.x, result.y];
      });

    return getSvgPathFromStroke(stroke, true);
  }

  private drawHead(trail: LaserPointer, state: AppState) {
    const lastPoint = trail.originalPoints[trail.originalPoints.length - 1];

    const { x: cx, y: cy } = sceneCoordsToViewportCoords(
      {
        sceneX: lastPoint[0],
        sceneY: lastPoint[1],
      },
      state,
    );

    this.headElement.setAttribute("cx", `${cx}`);
    this.headElement.setAttribute("cy", `${cy}`);
    this.headElement.setAttribute("r", `${trail.options.size}`);
  }

  private clearHead() {
    this.headElement.removeAttribute("cx");
    this.headElement.removeAttribute("cy");
    this.headElement.removeAttribute("r");
    this.headElement.removeAttribute("fill");
  }
}
