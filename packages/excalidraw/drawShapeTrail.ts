import { THEME } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import type { LocalPoint } from "@excalidraw/math";

import { AnimatedTrail } from "./animated-trail";

import type { Trail } from "./animated-trail";
import type { AnimationFrameHandler } from "./animation-frame-handler";
import type App from "./components/App";

export class DrawShapeTrail implements Trail {
  private trail: AnimatedTrail;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    private app: App,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));

    this.trail = new AnimatedTrail(animationFrameHandler, app, {
      ...this.getTrailOptions(),
      fill: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(0, 0, 0, 0.2)"
          : "rgba(255, 255, 255, 0.2)",
    });
  }

  private getTrailOptions() {
    return {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: () => 1,
    } as Partial<LaserPointerOptions>;
  }

  startPath(x: number, y: number): void {
    this.trail.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    this.trail.addPointToPath(x, y);
  }

  endPath(): void {
    this.trail.endPath();
  }

  clearTrails(): void {
    this.trail.clearTrails();
  }

  getCurrentPoints(): LocalPoint[] {
    const currentTrail = this.trail.getCurrentTrail();
    if (!currentTrail) {
      return [];
    }

    const points = currentTrail.originalPoints;
    return points.map(([x, y]) => [x, y] as LocalPoint);
  }

  start(container: SVGSVGElement) {
    this.animationFrameHandler.start(this);
    this.trail.start(container);
  }

  stop() {
    this.animationFrameHandler.stop(this);
    this.trail.stop();
  }

  onFrame() {}
}
