import { pointFrom } from "@excalidraw/math";

import { randomId } from "@excalidraw/common";
import { newLinearElement, newElement } from "@excalidraw/element/newElement";
import { newElementWith } from "@excalidraw/element/mutateElement";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  FillStyle,
  GroupId,
} from "@excalidraw/element/types";

export interface SolidPresetStyles {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  frameId: string | null;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Geometry description (data only, no elements) ─────────────────

export interface LineGeom {
  kind: "line";
  x: number;
  y: number;
  points: LocalPoint[];
  dashed: boolean;
  polygon: boolean;
  /** Force roughness: 0 for clean dashed curves */
  forceSmooth?: boolean;
}

export interface EllipseGeom {
  kind: "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  dashed: boolean;
}

export type ElementGeom = LineGeom | EllipseGeom;

// ─── Geometry primitives (pure functions) ──────────────────────────

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashed = false,
): LineGeom {
  return {
    kind: "line",
    x: x1,
    y: y1,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(x2 - x1, y2 - y1),
    ],
    dashed,
    polygon: false,
  };
}

function poly(
  x: number,
  y: number,
  pts: LocalPoint[],
  dashed = false,
): LineGeom {
  return { kind: "line", x, y, points: pts, dashed, polygon: true };
}

function ellipseGeom(
  x: number,
  y: number,
  w: number,
  h: number,
  dashed = false,
): EllipseGeom {
  return { kind: "ellipse", x, y, width: w, height: h, dashed };
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  dashed = false,
): LineGeom {
  return poly(
    x,
    y,
    [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(w, 0),
      pointFrom<LocalPoint>(w, h),
      pointFrom<LocalPoint>(0, h),
      pointFrom<LocalPoint>(0, 0),
    ],
    dashed,
  );
}

/**
 * Generate arc polyline with uniform arc-length spacing.
 * Oversamples at fine angle intervals, then resamples at equal distances
 * so dashed strokes render uniformly across the curve.
 */
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle: number,
  endAngle: number,
  dashed: boolean,
  segments = 32,
): LineGeom {
  // 1. Oversample at fine angle intervals
  const N = 256;
  const raw: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = startAngle + (endAngle - startAngle) * (i / N);
    raw.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }

  // 2. Cumulative arc lengths
  const cumLen = [0];
  for (let i = 1; i < raw.length; i++) {
    const dx = raw[i].x - raw[i - 1].x;
    const dy = raw[i].y - raw[i - 1].y;
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLen = cumLen[cumLen.length - 1];

  // 3. Resample at uniform arc lengths
  const resampled: { x: number; y: number }[] = [raw[0]];
  const step = totalLen / segments;
  let target = step;
  let j = 1;
  while (resampled.length < segments && j < raw.length) {
    if (cumLen[j] >= target) {
      const prev = cumLen[j - 1];
      const frac = (target - prev) / (cumLen[j] - prev);
      resampled.push({
        x: raw[j - 1].x + frac * (raw[j].x - raw[j - 1].x),
        y: raw[j - 1].y + frac * (raw[j].y - raw[j - 1].y),
      });
      target += step;
    } else {
      j++;
    }
  }
  resampled.push(raw[raw.length - 1]);

  // 4. Convert to local points relative to first point
  const x0 = resampled[0].x;
  const y0 = resampled[0].y;
  const points = resampled.map((p) =>
    pointFrom<LocalPoint>(p.x - x0, p.y - y0),
  );

  return {
    kind: "line",
    x: x0,
    y: y0,
    points,
    dashed,
    polygon: false,
    forceSmooth: true,
  };
}

// ─── PRISM ─────────────────────────────────────────────────────────
// Cube with 1 hidden vertex (back-bottom-left).
// 3 edges meeting at hidden vertex are dashed, rest solid.
function prismGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const d = Math.min(w, h) * 0.25;
  const fw = w - d;
  const fh = h - d;

  const FTL = { x, y: y + d };
  const FTR = { x: x + fw, y: y + d };
  const FBR = { x: x + fw, y: y + d + fh };
  const FBL = { x, y: y + d + fh };

  const BTL = { x: x + d, y };
  const BTR = { x: x + d + fw, y };
  const BBR = { x: x + d + fw, y: y + fh };
  const BBL = { x: x + d, y: y + fh };

  return [
    // Front face — solid
    rect(FTL.x, FTL.y, fw, fh, false),
    // Top edges — solid
    line(FTL.x, FTL.y, BTL.x, BTL.y, false),
    line(FTR.x, FTR.y, BTR.x, BTR.y, false),
    line(BTL.x, BTL.y, BTR.x, BTR.y, false),
    // Right edges — solid
    line(FBR.x, FBR.y, BBR.x, BBR.y, false),
    line(BTR.x, BTR.y, BBR.x, BBR.y, false),
    // Hidden edges (3 edges at BBL) — dashed
    line(BTL.x, BTL.y, BBL.x, BBL.y, true),
    line(BBL.x, BBL.y, BBR.x, BBR.y, true),
    line(FBL.x, FBL.y, BBL.x, BBL.y, true),
  ];
}

// ─── PYRAMID (quadrilateral) ───────────────────────────────────────
// Oblique view: front+right faces visible, back+left faces hidden.
// Hidden vertex BL: 3 edges to it dashed (Apex-BL, FL-BL, BL-BR).
function pyramidGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;

  // Base in oblique perspective
  const FL = { x: x + w * 0.0, y: y + h };
  const FR = { x: x + w * 0.6, y: y + h };
  const BR = { x: x + w * 1.0, y: y + h * 0.65 };
  const BL = { x: x + w * 0.4, y: y + h * 0.65 };
  const A = { x: x + w * 0.45, y };

  return [
    // Base front edge — solid
    line(FL.x, FL.y, FR.x, FR.y, false),
    // Base right edge — solid
    line(FR.x, FR.y, BR.x, BR.y, false),
    // Base back edge — dashed
    line(BL.x, BL.y, BR.x, BR.y, true),
    // Base left edge — dashed
    line(FL.x, FL.y, BL.x, BL.y, true),
    // Lateral: front + right — solid
    line(A.x, A.y, FL.x, FL.y, false),
    line(A.x, A.y, FR.x, FR.y, false),
    line(A.x, A.y, BR.x, BR.y, false),
    // Lateral: back-left — dashed
    line(A.x, A.y, BL.x, BL.y, true),
  ];
}

// ─── TETRAHEDRON ───────────────────────────────────────────────────
// Left+right faces visible, 1 hidden back edge (A-C) dashed.
function tetrahedronGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;

  const D = { x: x + w * 0.45, y }; // apex
  const A = { x: x + w * 0.0, y: y + h * 0.7 }; // front-left
  const B = { x: x + w * 0.55, y: y + h }; // front-bottom
  const C = { x: x + w * 1.0, y: y + h * 0.5 }; // back-right

  return [
    // Front-left face (A-B-D) — solid
    line(A.x, A.y, B.x, B.y, false),
    line(A.x, A.y, D.x, D.y, false),
    // Front-right face (B-C-D) — solid
    line(B.x, B.y, D.x, D.y, false),
    line(B.x, B.y, C.x, C.y, false),
    line(D.x, D.y, C.x, C.y, false),
    // Hidden back edge — dashed
    line(A.x, A.y, C.x, C.y, true),
  ];
}

// ─── CYLINDER ──────────────────────────────────────────────────────
// Top ellipse solid. Bottom: front arc solid, back arc dashed.
// Side lines solid.
function cylinderGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const eh = Math.min(h * 0.2, w * 0.3);
  const rx = w / 2;
  const ry = eh / 2;

  const tcy = y + ry; // top ellipse center y
  const bcx = x + rx; // bottom ellipse center x
  const bcy = y + h - ry; // bottom ellipse center y

  return [
    // Top ellipse — solid
    ellipseGeom(x, y, w, eh, false),
    // Bottom front arc (solid): 0 → π (right → bottom → left)
    arc(bcx, bcy, rx, ry, 0, Math.PI, false),
    // Bottom back arc (dashed): π → 2π (left → top → right)
    arc(bcx, bcy, rx, ry, Math.PI, 2 * Math.PI, true),
    // Side lines — solid
    line(x, tcy, x, bcy, false),
    line(x + w, tcy, x + w, bcy, false),
  ];
}

// ─── SPHERE ────────────────────────────────────────────────────────
// Outer circle solid. Equator: front arc solid, back arc dashed.
function sphereGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const size = Math.min(w, h);
  const sx = x + (w - size) / 2;
  const sy = y + (h - size) / 2;

  const r = size / 2;
  const cx = sx + r;
  const cy = sy + r;
  const mry = size * 0.15; // meridian semi-minor axis (vertical)

  return [
    // Main circle — solid
    ellipseGeom(sx, sy, size, size, false),
    // Equator front arc (solid): 0 → π (right → bottom → left)
    arc(cx, cy, r, mry, 0, Math.PI, false),
    // Equator back arc (dashed): π → 2π (left → top → right)
    arc(cx, cy, r, mry, Math.PI, 2 * Math.PI, true),
  ];
}

// ─── Public API ────────────────────────────────────────────────────

export function computeSolidGeometry(type: string, bbox: BBox): ElementGeom[] {
  switch (type) {
    case "prism":
      return prismGeom(bbox);
    case "pyramid":
      return pyramidGeom(bbox);
    case "tetrahedron":
      return tetrahedronGeom(bbox);
    case "cylinder":
      return cylinderGeom(bbox);
    case "sphere":
      return sphereGeom(bbox);
    default:
      throw new Error(`Unknown solid preset: ${type}`);
  }
}

function createElementFromGeom(
  geom: ElementGeom,
  styles: SolidPresetStyles,
): ExcalidrawElement {
  if (geom.kind === "line") {
    return newLinearElement({
      type: "line",
      x: geom.x,
      y: geom.y,
      strokeColor: styles.strokeColor,
      backgroundColor: "transparent",
      fillStyle: styles.fillStyle,
      strokeWidth: styles.strokeWidth,
      strokeStyle: geom.dashed ? "dashed" : "solid",
      roughness: geom.forceSmooth ? 0 : styles.roughness,
      opacity: styles.opacity,
      locked: false,
      frameId: styles.frameId,
      points: geom.points,
      polygon: geom.polygon,
    });
  }
  return newElement({
    type: "ellipse",
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    strokeColor: styles.strokeColor,
    backgroundColor: "transparent",
    fillStyle: styles.fillStyle,
    strokeWidth: styles.strokeWidth,
    strokeStyle: geom.dashed ? "dashed" : "solid",
    roughness: styles.roughness,
    opacity: styles.opacity,
    locked: false,
    frameId: styles.frameId,
  });
}

export function createSolidElements(
  type: string,
  bbox: BBox,
  styles: SolidPresetStyles,
): { elements: ExcalidrawElement[]; groupId: GroupId } {
  const geoms = computeSolidGeometry(type, bbox);
  const groupId = randomId();
  const elements = geoms.map((g) => {
    const el = createElementFromGeom(g, styles);
    return newElementWith(el, { groupIds: [groupId] });
  });
  return { elements, groupId };
}
