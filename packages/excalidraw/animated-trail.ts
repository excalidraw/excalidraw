import { LaserPointer } from "@excalidraw/laser-pointer";
import { AnimationFrameHandler } from "./animation-frame-handler";
import { AppState } from "./types";
import {
  easeOut,
  getSvgPathFromStroke,
  sceneCoordsToViewportCoords,
} from "./utils";
import type App from "./components/App";
import { SVG_NS } from "./constants";

const DECAY_TIME = 200;
const DECAY_LENGTH = 10;

export class AnimatedTrail {
  private currentTrail?: LaserPointer;
  private pastTrails: LaserPointer[] = [];

  private container?: SVGSVGElement;
  private trailElement: SVGPathElement;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    private app: App,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));

    this.trailElement = document.createElementNS(SVG_NS, "path");
  }

  start(container: SVGSVGElement) {
    this.container = container;

    this.container.appendChild(this.trailElement);

    this.animationFrameHandler.start(this);
  }

  stop() {
    this.animationFrameHandler.stop(this);
  }

  startPath(x: number, y: number) {
    this.currentTrail = new LaserPointer({
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

        return Math.min(easeOut(l), easeOut(t));
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
    this.trailElement.setAttribute("fill", "rgba(0, 0, 0, 0.25)");
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
}
