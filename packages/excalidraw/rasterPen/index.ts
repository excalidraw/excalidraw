import type { DataURL } from "../types";

export type RasterStrokePoint = {
  /** Offset from stroke origin in scene coordinates */
  dx: number;
  dy: number;
};

export type RasterStrokeResult = {
  dataURL: DataURL;
  /** Bounding box in scene coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
};

export class RasterPenManager {
  private points: RasterStrokePoint[] = [];
  private originX = 0;
  private originY = 0;
  private strokeWidth = 1;
  private strokeColor = "#000000";
  private opacity = 1;
  private active = false;

  isDrawing(): boolean {
    return this.active;
  }

  getPoints(): readonly RasterStrokePoint[] {
    return this.points;
  }

  getOrigin(): { x: number; y: number } {
    return { x: this.originX, y: this.originY };
  }

  getStrokeWidth(): number {
    return this.strokeWidth;
  }

  getStrokeColor(): string {
    return this.strokeColor;
  }

  getOpacity(): number {
    return this.opacity;
  }

  startStroke(
    originSceneX: number,
    originSceneY: number,
    strokeWidth: number,
    color: string,
    opacity: number,
  ): void {
    this.cancelStroke();
    this.originX = originSceneX;
    this.originY = originSceneY;
    this.strokeWidth = strokeWidth;
    this.strokeColor = color;
    this.opacity = opacity;
    this.active = true;
  }

  addPoint(sceneX: number, sceneY: number): void {
    this.points.push({
      dx: sceneX - this.originX,
      dy: sceneY - this.originY,
    });
  }

  endStroke(dpr: number): RasterStrokeResult | null {
    if (this.points.length === 0) {
      this.cancelStroke();
      return null;
    }

    const result = this.rasterize(dpr);
    this.cancelStroke();
    return result;
  }

  private rasterize(dpr: number): RasterStrokeResult | null {
    if (this.points.length === 0) {
      return null;
    }

    const scale = Math.max(dpr, 1);
    const padding = Math.ceil(this.strokeWidth / 2) * scale + 2;

    let minDx = Infinity;
    let minDy = Infinity;
    let maxDx = -Infinity;
    let maxDy = -Infinity;

    for (const p of this.points) {
      minDx = Math.min(minDx, p.dx);
      minDy = Math.min(minDy, p.dy);
      maxDx = Math.max(maxDx, p.dx);
      maxDy = Math.max(maxDy, p.dy);
    }

    const width = Math.max(1, Math.ceil((maxDx - minDx) * scale) + padding * 2);
    const height = Math.max(1, Math.ceil((maxDy - minDy) * scale) + padding * 2);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = this.strokeWidth * scale;
    ctx.strokeStyle = this.strokeColor;
    ctx.globalAlpha = this.opacity;

    ctx.beginPath();
    for (let i = 0; i < this.points.length; i++) {
      const x = (this.points[i].dx - minDx) * scale + padding;
      const y = (this.points[i].dy - minDy) * scale + padding;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw circle at start and end for rounded caps
    if (this.points.length === 1) {
      const x = (this.points[0].dx - minDx) * scale + padding;
      const y = (this.points[0].dy - minDy) * scale + padding;
      ctx.beginPath();
      ctx.arc(x, y, (this.strokeWidth * scale) / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const dataURL = canvas.toDataURL("image/png") as DataURL;
    const x = this.originX + minDx - padding / scale;
    const y = this.originY + minDy - padding / scale;

    return {
      dataURL,
      x,
      y,
      width: width / scale,
      height: height / scale,
    };
  }

  cancelStroke(): void {
    this.points = [];
    this.originX = 0;
    this.originY = 0;
    this.strokeWidth = 1;
    this.strokeColor = "#000000";
    this.opacity = 1;
    this.active = false;
  }
}
