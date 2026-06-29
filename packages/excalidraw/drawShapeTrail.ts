import { THEME } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";
import type { GlobalPoint } from "@excalidraw/math";

import { AnimatedTrail } from "./animatedTrail";

import type App from "./components/App";
import type { Trail } from "./animatedTrail";

export class DrawShapeTrail implements Trail {
  private trail: AnimatedTrail;

  constructor(private app: App) {
    this.trail = new AnimatedTrail(this.app, {
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

  getCurrentPoints(): GlobalPoint[] {
    const currentTrail = this.trail.getCurrentTrail();
    if (!currentTrail) {
      return [];
    }

    return currentTrail.originalPoints.map(([x, y]) =>
      pointFrom<GlobalPoint>(x, y),
    );
  }

  start(container: SVGSVGElement) {
    this.trail.start(container);
  }

  stop() {
    this.trail.stop();
  }
}
