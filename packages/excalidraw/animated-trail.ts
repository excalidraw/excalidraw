import { LaserPointer } from "@excalidraw/laser-pointer";

import {
  SVG_NS,
  getSvgPathFromStroke,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import type { AnimationFrameHandler } from "./animation-frame-handler";
import type App from "./components/App";
import type { AppState } from "./types";

export interface Trail {
  start(container: SVGSVGElement): void;
  stop(): void;

  startPath(x: number, y: number): void;
  addPointToPath(x: number, y: number): void;
  endPath(): void;
}

export interface AnimatedTrailOptions {
  fill: (trail: AnimatedTrail) => string;
  stroke?: (trail: AnimatedTrail) => string;
  animateTrail?: boolean;
}

export class AnimatedTrail implements Trail {
  private currentTrail?: LaserPointer;
  private pastTrails: LaserPointer[] = [];

  private container?: SVGSVGElement;
  private trailElement: SVGPathElement;
  private trailAnimation?: SVGAnimateElement;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    protected app: App,
    private options: Partial<LaserPointerOptions> &
      Partial<AnimatedTrailOptions>,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));

    this.trailElement = document.createElementNS(SVG_NS, "path");
    if (this.options.animateTrail) {
      this.trailAnimation = document.createElementNS(SVG_NS, "animate");
      // TODO: make this configurable
      this.trailAnimation.setAttribute("attributeName", "stroke-dashoffset");
      this.trailElement.setAttribute("stroke-dasharray", "7 7");
      this.trailElement.setAttribute("stroke-dashoffset", "10");
      this.trailAnimation.setAttribute("from", "0");
      this.trailAnimation.setAttribute("to", `-14`);
      this.trailAnimation.setAttribute("dur", "0.3s");
      this.trailElement.appendChild(this.trailAnimation);
    }
  }

  get hasCurrentTrail() {
    return !!this.currentTrail;
  }

  hasLastPoint(x: number, y: number) {
    if (this.currentTrail) {
      const len = this.currentTrail.originalPoints.length;
      return (
        this.currentTrail.originalPoints[len - 1][0] === x &&
        this.currentTrail.originalPoints[len - 1][1] === y
      );
    }

    return false;
  }

  start(container?: SVGSVGElement) {
    if (container) {
      this.container = container;
    }

    if (this.trailElement.parentNode !== this.container && this.container) {
      this.container.appendChild(this.trailElement);
    }

    this.animationFrameHandler.start(this);
  }

  stop() {
    this.animationFrameHandler.stop(this);

    if (this.trailElement.parentNode === this.container) {
      this.container?.removeChild(this.trailElement);
    }
  }

  startPath(x: number, y: number) {
    this.currentTrail = new LaserPointer(this.options);

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
      this.currentTrail.options.keepHead = false;
      this.pastTrails.push(this.currentTrail);
      this.currentTrail = undefined;
      this.update();
    }
  }

  getCurrentTrail() {
    return this.currentTrail;
  }

  clearTrails() {
    this.pastTrails = [];
    this.currentTrail = undefined;
    this.update();
  }

  private update() {
    this.start();
    if (this.trailAnimation) {
      this.trailAnimation.setAttribute("begin", "indefinite");
      this.trailAnimation.setAttribute("repeatCount", "indefinite");
    }
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
      return trail.getStrokeOutline().length !== 0;
    });

    if (paths.length === 0) {
      this.stop();
    }

    const svgPaths = paths.join(" ").trim();

    this.trailElement.setAttribute("d", svgPaths);
    if (this.trailAnimation) {
      this.trailElement.setAttribute(
        "fill",
        (this.options.fill ?? (() => "black"))(this),
      );
      this.trailElement.setAttribute(
        "stroke",
        (this.options.stroke ?? (() => "black"))(this),
      );
    } else {
      this.trailElement.setAttribute(
        "fill",
        (this.options.fill ?? (() => "black"))(this),
      );
    }
  }

  private drawTrail(trail: LaserPointer, state: AppState): string {
    const _stroke = trail
      .getStrokeOutline(trail.options.size / state.zoom.value)
      .map(([x, y]) => {
        const result = sceneCoordsToViewportCoords(
          { sceneX: x, sceneY: y },
          state,
        );

        return [result.x, result.y];
      });

    const stroke = this.trailAnimation
      ? _stroke.slice(0, _stroke.length / 2)
      : _stroke;

    return getSvgPathFromStroke(stroke, true);
  }
}
