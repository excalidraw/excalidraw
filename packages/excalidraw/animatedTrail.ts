import { LaserPointer } from "@excalidraw/laser-pointer";
import {
  SVG_NS,
  getSvgPathFromStroke,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { AnimationController } from "./renderer/animation";

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
  private key: string;

  static readonly instances = new Map<string, AnimatedTrail>();
  private static counter = 0;

  constructor(
    private animationController: typeof AnimationController,
    protected app: App,
    private options: Partial<LaserPointerOptions> &
      Partial<AnimatedTrailOptions>,
  ) {
    this.key = `animated-trail-${AnimatedTrail.counter++}`;
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

    AnimatedTrail.instances.set(this.key, this);

    if (!AnimationController.running(this.key)) {
      AnimationController.start<Set<string>>(this.key, ({ state }) => {
        return AnimatedTrail.onFrame(state ?? new Set([this.key]));
      });
    }
  }

  stop() {
    AnimatedTrail.instances.delete(this.key);
    AnimationController.cancel(this.key);

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

  private static onFrame(activeKeys: Set<string>): Set<string> | null {
    const allPaths: string[] = [];
    const keysToRemove: string[] = [];

    for (const [instanceKey, trail] of AnimatedTrail.instances) {
      const paths: string[] = [];

      for (const t of trail.pastTrails) {
        paths.push(trail.drawTrail(t, trail.app.state));
      }

      if (trail.currentTrail) {
        const currentPath = trail.drawTrail(
          trail.currentTrail,
          trail.app.state,
        );
        paths.push(currentPath);
      }

      trail.pastTrails = trail.pastTrails.filter(
        (t) => t.getStrokeOutline().length !== 0,
      );

      if (paths.length === 0) {
        keysToRemove.push(instanceKey);
      }

      allPaths.push(...paths);
    }

    for (const instanceKey of keysToRemove) {
      AnimatedTrail.instances.get(instanceKey)?.stop();
    }

    const svgPaths = allPaths.join(" ").trim();

    for (const [, trail] of AnimatedTrail.instances) {
      trail.trailElement.setAttribute("d", svgPaths);
      if (trail.trailAnimation) {
        trail.trailElement.setAttribute(
          "fill",
          (trail.options.fill ?? (() => "black"))(trail),
        );
        trail.trailElement.setAttribute(
          "stroke",
          (trail.options.stroke ?? (() => "black"))(trail),
        );
      } else {
        trail.trailElement.setAttribute(
          "fill",
          (trail.options.fill ?? (() => "black"))(trail),
        );
      }
    }

    return AnimatedTrail.instances.size > 0 ? activeKeys : null;
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
