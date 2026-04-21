import { LaserPointer } from "@excalidraw/laser-pointer";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import type { AnimationFrameHandler } from "./animation-frame-handler";
import type App from "./components/App";
import type { AppState } from "./types";

export interface CanvasTrailOptions {
  fill: string;
  glowColor?: string;
  glowBlur?: number;
}

export class CanvasTrail {
  private currentTrail?: LaserPointer;
  private pastTrails: LaserPointer[] = [];
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private app: App;
  private containerElement?: HTMLElement;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    app: App,
    private options: Partial<LaserPointerOptions> & CanvasTrailOptions,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));
    this.app = app;
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
    if (container && !this.canvas) {
      this.containerElement = container.parentElement || undefined;
      this.createCanvas();
    }

    this.animationFrameHandler.start(this);
  }

  stop() {
    this.animationFrameHandler.stop(this);
    this.clearCanvas();
  }

  private createCanvas() {
    if (!this.containerElement) {
      return;
    }

    this.canvas = document.createElement("canvas");
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.position = "fixed";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    this.canvas.style.imageRendering = "auto";
    this.canvas.style.zIndex = "calc(var(--zIndex-svgLayer) + 1)";

    this.ctx = this.canvas.getContext("2d")!;

    this.containerElement.appendChild(this.canvas);

    this.updateCanvasSize();
  }

  private updateCanvasSize() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private clearCanvas() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  startPath(x: number, y: number) {
    this.currentTrail = new LaserPointer(this.options);
    this.currentTrail.addPoint([x, y, performance.now()]);
    this.start();
  }

  addPointToPath(x: number, y: number) {
    if (this.currentTrail) {
      this.currentTrail.addPoint([x, y, performance.now()]);
      this.start();
    }
  }

  endPath() {
    if (this.currentTrail) {
      this.currentTrail.close();
      this.currentTrail.options.keepHead = false;
      this.pastTrails.push(this.currentTrail);
      this.currentTrail = undefined;
      this.start();
    }
  }

  getCurrentTrail() {
    return this.currentTrail;
  }

  clearTrails() {
    this.pastTrails = [];
    this.currentTrail = undefined;
    this.clearCanvas();
  }

  private onFrame(_timestamp: number) {
    if (!this.canvas || !this.ctx) {
      this.updateCanvasSize();
      return;
    }

    this.clearCanvas();
    this.updateCanvasSize();

    const state = this.app.state;

    for (const trail of this.pastTrails) {
      this.drawTrail(trail, state);
    }

    if (this.currentTrail) {
      this.drawTrail(this.currentTrail, state);
    }

    this.pastTrails = this.pastTrails.filter((trail) => {
      return trail.getStrokeOutline().length !== 0;
    });

    const hasActiveTrails = this.pastTrails.length > 0 || !!this.currentTrail;
    if (!hasActiveTrails) {
      this.stop();
    }
  }

  private drawTrail(trail: LaserPointer, state: AppState) {
    if (!this.ctx) {
      return;
    }

    const stroke = trail
      .getStrokeOutline(trail.options.size / state.zoom.value)
      .map(([x, y]) => {
        const result = sceneCoordsToViewportCoords(
          { sceneX: x, sceneY: y },
          state,
        );
        return [result.x, result.y];
      });

    if (stroke.length < 4) {
      return;
    }

    this.ctx.save();

    const fillColor = this.options.fill || "#ff6464";
    const glowColor = this.options.glowColor || fillColor;
    const glowBlur = this.options.glowBlur || 6;

    if (glowBlur > 0) {
      this.ctx.shadowBlur = glowBlur;
      this.ctx.shadowColor = glowColor;
    }

    this.ctx.fillStyle = fillColor;
    this.ctx.beginPath();

    let a = stroke[0];
    let b = stroke[1];
    const c = stroke[2];

    this.ctx.moveTo(a[0], a[1]);
    this.ctx.quadraticCurveTo(b[0], b[1], (b[0] + c[0]) / 2, (b[1] + c[1]) / 2);

    for (let i = 2, max = stroke.length - 1; i < max; i++) {
      a = stroke[i];
      b = stroke[i + 1];
      this.ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }

    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }
}
