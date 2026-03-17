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
  /** Shared vertex IDs per point index (for wireframe vertex binding) */
  vertexIds?: string[];
}

export interface EllipseGeom {
  kind: "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  dashed: boolean;
}

export interface ArcGeom {
  kind: "arc";
  /** Element x (left edge of visible arc bbox) */
  x: number;
  /** Element y (top edge of visible arc bbox) */
  y: number;
  /** Visible arc width */
  width: number;
  /** Visible arc height */
  height: number;
  startAngle: number;
  endAngle: number;
  dashed: boolean;
}

export type ElementGeom = LineGeom | EllipseGeom | ArcGeom;

// ─── Geometry primitives (pure functions) ──────────────────────────

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashed = false,
  v1?: string,
  v2?: string,
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
    vertexIds: v1 && v2 ? [v1, v2] : undefined,
  };
}

function poly(
  x: number,
  y: number,
  pts: LocalPoint[],
  dashed = false,
  vertexIds?: string[],
): LineGeom {
  return {
    kind: "line",
    x,
    y,
    points: pts,
    dashed,
    polygon: true,
    vertexIds,
  };
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
  vTL?: string,
  vTR?: string,
  vBR?: string,
  vBL?: string,
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
    vTL ? [vTL, vTR!, vBR!, vBL!, vTL] : undefined,
  );
}

/**
 * Generate arc geometry using core ellipse arc support (smooth curve).
 * The element bbox covers the visible arc area. shape.ts renders via
 * rough.js generator.path() with SVG arc command.
 *
 * cx, cy: center of the full ellipse
 * rx, ry: semi-axes of the full ellipse
 * startAngle, endAngle: arc extent in radians
 */
function arcGeom(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle: number,
  endAngle: number,
  dashed: boolean,
): ArcGeom {
  // Compute visible bbox from arc endpoints + axis crossings
  const pts: [number, number][] = [
    [cx + rx * Math.cos(startAngle), cy + ry * Math.sin(startAngle)],
    [cx + rx * Math.cos(endAngle), cy + ry * Math.sin(endAngle)],
  ];
  const norm = (a: number) =>
    ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const s0 = norm(startAngle);
  const e0 = norm(endAngle);
  for (const axAng of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const na = norm(axAng);
    const inArc = s0 < e0 ? na >= s0 && na <= e0 : na >= s0 || na <= e0;
    if (inArc) {
      pts.push([cx + rx * Math.cos(axAng), cy + ry * Math.sin(axAng)]);
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of pts) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return {
    kind: "arc",
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    startAngle,
    endAngle,
    dashed,
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
    rect(FTL.x, FTL.y, fw, fh, false, "FTL", "FTR", "FBR", "FBL"),
    // Top edges — solid
    line(FTL.x, FTL.y, BTL.x, BTL.y, false, "FTL", "BTL"),
    line(FTR.x, FTR.y, BTR.x, BTR.y, false, "FTR", "BTR"),
    line(BTL.x, BTL.y, BTR.x, BTR.y, false, "BTL", "BTR"),
    // Right edges — solid
    line(FBR.x, FBR.y, BBR.x, BBR.y, false, "FBR", "BBR"),
    line(BTR.x, BTR.y, BBR.x, BBR.y, false, "BTR", "BBR"),
    // Hidden edges (3 edges at BBL) — dashed
    line(BTL.x, BTL.y, BBL.x, BBL.y, true, "BTL", "BBL"),
    line(BBL.x, BBL.y, BBR.x, BBR.y, true, "BBL", "BBR"),
    line(FBL.x, FBL.y, BBL.x, BBL.y, true, "FBL", "BBL"),
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
    line(FL.x, FL.y, FR.x, FR.y, false, "FL", "FR"),
    // Base right edge — solid
    line(FR.x, FR.y, BR.x, BR.y, false, "FR", "BR"),
    // Base back edge — dashed
    line(BL.x, BL.y, BR.x, BR.y, true, "BL", "BR"),
    // Base left edge — dashed
    line(FL.x, FL.y, BL.x, BL.y, true, "FL", "BL"),
    // Lateral: front + right — solid
    line(A.x, A.y, FL.x, FL.y, false, "A", "FL"),
    line(A.x, A.y, FR.x, FR.y, false, "A", "FR"),
    line(A.x, A.y, BR.x, BR.y, false, "A", "BR"),
    // Lateral: back-left — dashed
    line(A.x, A.y, BL.x, BL.y, true, "A", "BL"),
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
    line(A.x, A.y, B.x, B.y, false, "A", "B"),
    line(A.x, A.y, D.x, D.y, false, "A", "D"),
    // Front-right face (B-C-D) — solid
    line(B.x, B.y, D.x, D.y, false, "B", "D"),
    line(B.x, B.y, C.x, C.y, false, "B", "C"),
    line(D.x, D.y, C.x, C.y, false, "D", "C"),
    // Hidden back edge — dashed
    line(A.x, A.y, C.x, C.y, true, "A", "C"),
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
    arcGeom(bcx, bcy, rx, ry, 0, Math.PI, false),
    // Bottom back arc (dashed): π → 2π (left → top → right)
    arcGeom(bcx, bcy, rx, ry, Math.PI, 2 * Math.PI, true),
    // Side lines — solid
    line(x, tcy, x, bcy, false),
    line(x + w, tcy, x + w, bcy, false),
  ];
}

// ─── SPHERE ────────────────────────────────────────────────────────
// Outer circle solid. Equator: front arc solid, back arc dashed.
function sphereGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const rx = w / 2;
  const ry = h / 2;
  const cx = x + rx;
  const cy = y + ry;
  const mry = h * 0.15; // equator semi-minor axis

  return [
    // Main ellipse — solid (ellipsoid when w ≠ h)
    ellipseGeom(x, y, w, h, false),
    // Equator front arc (solid): 0 → π (right → bottom → left)
    arcGeom(cx, cy, rx, mry, 0, Math.PI, false),
    // Equator back arc (dashed): π → 2π (left → top → right)
    arcGeom(cx, cy, rx, mry, Math.PI, 2 * Math.PI, true),
  ];
}

// ─── CONE ─────────────────────────────────────────────────────────
// Apex at top, elliptical base. Front arc solid, back arc dashed.
// Two lateral lines from apex to base edges.
function coneGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const eh = Math.min(h * 0.2, w * 0.3);
  const rx = w / 2;
  const ry = eh / 2;
  const bcx = x + rx;
  const bcy = y + h - ry;
  const apex = { x: x + w * 0.5, y };

  return [
    // Base front arc (solid)
    arcGeom(bcx, bcy, rx, ry, 0, Math.PI, false),
    // Base back arc (dashed)
    arcGeom(bcx, bcy, rx, ry, Math.PI, 2 * Math.PI, true),
    // Lateral edges — solid
    line(apex.x, apex.y, x, bcy, false),
    line(apex.x, apex.y, x + w, bcy, false),
  ];
}

// ─── TRIANGULAR PRISM ─────────────────────────────────────────────
// Triangular bases on top and bottom (like geometry textbooks).
// Oblique view: front-left lateral face visible.
// Hidden vertex BBL: edges to it dashed.
function triangularPrismGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const d = Math.min(w, h) * 0.25; // oblique depth offset

  // Top triangle (upper base)
  const TL = { x, y: y + d };
  const TR = { x: x + w - d, y: y + d };
  const TB = { x: x + d, y }; // back vertex (up-left in oblique)

  // Bottom triangle (lower base)
  const BL = { x, y: y + h };
  const BR = { x: x + w - d, y: y + h };
  const BB = { x: x + d, y: y + h - d }; // back vertex

  return [
    // Top base — front edge solid, back edges: right solid, left dashed
    line(TL.x, TL.y, TR.x, TR.y, false, "TL", "TR"),
    line(TR.x, TR.y, TB.x, TB.y, false, "TR", "TB"),
    line(TL.x, TL.y, TB.x, TB.y, true, "TL", "TB"),
    // Bottom base — front edge solid, back edges dashed
    line(BL.x, BL.y, BR.x, BR.y, false, "BL", "BR"),
    line(BR.x, BR.y, BB.x, BB.y, false, "BR", "BB"),
    line(BL.x, BL.y, BB.x, BB.y, true, "BL", "BB"),
    // Lateral edges — front two solid, back dashed
    line(TL.x, TL.y, BL.x, BL.y, false, "TL", "BL"),
    line(TR.x, TR.y, BR.x, BR.y, false, "TR", "BR"),
    line(TB.x, TB.y, BB.x, BB.y, true, "TB", "BB"),
  ];
}

// ─── BIPYRAMID (3D diamond) ───────────────────────────────────────
// Two square pyramids joined at base. Symmetric: axis of symmetry
// passes through midpoints of the base's side edges (vertical center).
// Oblique view with BL hidden.
function bipyramidGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const d = Math.min(w, h) * 0.2; // oblique depth

  // Apexes centered horizontally
  const TA = { x: x + w * 0.5, y }; // top apex
  const BA = { x: x + w * 0.5, y: y + h }; // bottom apex

  // Base rhombus at middle height, centered on the axis
  const midY = y + h * 0.5;
  const FL = { x, y: midY + d * 0.3 }; // front-left
  const FR = { x: x + w - d, y: midY + d * 0.3 }; // front-right
  const BR = { x: x + w, y: midY - d * 0.7 }; // back-right
  const BL = { x: x + d, y: midY - d * 0.7 }; // back-left

  return [
    // Base — front+right solid, back+left dashed
    line(FL.x, FL.y, FR.x, FR.y, false, "FL", "FR"),
    line(FR.x, FR.y, BR.x, BR.y, false, "FR", "BR"),
    line(BL.x, BL.y, BR.x, BR.y, true, "BL", "BR"),
    line(FL.x, FL.y, BL.x, BL.y, true, "FL", "BL"),
    // Top apex — visible edges solid, hidden dashed
    line(TA.x, TA.y, FL.x, FL.y, false, "TA", "FL"),
    line(TA.x, TA.y, FR.x, FR.y, false, "TA", "FR"),
    line(TA.x, TA.y, BR.x, BR.y, false, "TA", "BR"),
    line(TA.x, TA.y, BL.x, BL.y, true, "TA", "BL"),
    // Bottom apex — visible edges solid, hidden dashed
    line(BA.x, BA.y, FL.x, FL.y, false, "BA", "FL"),
    line(BA.x, BA.y, FR.x, FR.y, false, "BA", "FR"),
    line(BA.x, BA.y, BR.x, BR.y, false, "BA", "BR"),
    line(BA.x, BA.y, BL.x, BL.y, true, "BA", "BL"),
  ];
}

// ─── TRUNCATED PYRAMID (frustum) ──────────────────────────────────
// Square pyramid with top cut off. Same oblique view as pyramid.
function truncatedPyramidGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;

  // Bottom base (larger)
  const BFL = { x: x + w * 0.0, y: y + h };
  const BFR = { x: x + w * 0.6, y: y + h };
  const BBR = { x: x + w * 1.0, y: y + h * 0.65 };
  const BBL = { x: x + w * 0.4, y: y + h * 0.65 };
  // Top base (smaller, inset)
  const TFL = { x: x + w * 0.15, y: y + h * 0.3 };
  const TFR = { x: x + w * 0.52, y: y + h * 0.3 };
  const TBR = { x: x + w * 0.82, y: y + h * 0.08 };
  const TBL = { x: x + w * 0.45, y: y + h * 0.08 };

  return [
    // Bottom base — front+right solid, back+left dashed
    line(BFL.x, BFL.y, BFR.x, BFR.y, false, "BFL", "BFR"),
    line(BFR.x, BFR.y, BBR.x, BBR.y, false, "BFR", "BBR"),
    line(BBL.x, BBL.y, BBR.x, BBR.y, true, "BBL", "BBR"),
    line(BFL.x, BFL.y, BBL.x, BBL.y, true, "BFL", "BBL"),
    // Top base — all edges solid (visible from above)
    line(TFL.x, TFL.y, TFR.x, TFR.y, false, "TFL", "TFR"),
    line(TFR.x, TFR.y, TBR.x, TBR.y, false, "TFR", "TBR"),
    line(TBL.x, TBL.y, TBR.x, TBR.y, false, "TBL", "TBR"),
    line(TFL.x, TFL.y, TBL.x, TBL.y, false, "TFL", "TBL"),
    // Lateral — front+right solid, back-left dashed
    line(BFL.x, BFL.y, TFL.x, TFL.y, false, "BFL", "TFL"),
    line(BFR.x, BFR.y, TFR.x, TFR.y, false, "BFR", "TFR"),
    line(BBR.x, BBR.y, TBR.x, TBR.y, false, "BBR", "TBR"),
    line(BBL.x, BBL.y, TBL.x, TBL.y, true, "BBL", "TBL"),
  ];
}

// ─── TRUNCATED CONE ───────────────────────────────────────────────
// Cone with top cut off. Top and bottom ellipses, lateral edges.
function truncatedConeGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const eh = Math.min(h * 0.15, w * 0.25);

  // Bottom ellipse (larger)
  const brx = w / 2;
  const bry = eh / 2;
  const bcx = x + brx;
  const bcy = y + h - bry;

  // Top ellipse (smaller, ~40% of bottom)
  const topRatio = 0.4;
  const trx = brx * topRatio;
  const tryy = bry * topRatio;
  const tcx = x + w / 2;
  const tcy = y + eh / 2;

  return [
    // Top ellipse — solid
    ellipseGeom(tcx - trx, tcy - tryy, trx * 2, tryy * 2, false),
    // Bottom front arc (solid)
    arcGeom(bcx, bcy, brx, bry, 0, Math.PI, false),
    // Bottom back arc (dashed)
    arcGeom(bcx, bcy, brx, bry, Math.PI, 2 * Math.PI, true),
    // Lateral edges — solid
    line(tcx - trx, tcy, x, bcy, false),
    line(tcx + trx, tcy, x + w, bcy, false),
  ];
}

// ─── OBLIQUE RECTANGULAR PRISM ────────────────────────────────────
// Rectangular bases top and bottom. Lateral edges slanted (oblique).
// Same oblique view as regular prism but top base shifted sideways.
function obliqueRectPrismGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const d = Math.min(w, h) * 0.2; // depth offset
  const shift = w * 0.2; // oblique lateral shift

  // Bottom base (oblique view)
  const BFL = { x, y: y + h - d };
  const BFR = { x: x + w - d - shift, y: y + h - d };
  const BBR = { x: x + w - shift, y: y + h - d - d };
  const BBL = { x: x + d, y: y + h - d - d };

  // Top base (shifted right by 'shift' for obliqueness)
  const TFL = { x: BFL.x + shift, y: y + d };
  const TFR = { x: BFR.x + shift, y: y + d };
  const TBR = { x: BBR.x + shift, y };
  const TBL = { x: BBL.x + shift, y };

  return [
    // Top base — all edges visible (solid)
    line(TFL.x, TFL.y, TFR.x, TFR.y, false, "TFL", "TFR"),
    line(TFR.x, TFR.y, TBR.x, TBR.y, false, "TFR", "TBR"),
    line(TBR.x, TBR.y, TBL.x, TBL.y, false, "TBR", "TBL"),
    line(TFL.x, TFL.y, TBL.x, TBL.y, false, "TFL", "TBL"),
    // Bottom base — front+right solid, back+left dashed
    line(BFL.x, BFL.y, BFR.x, BFR.y, false, "BFL", "BFR"),
    line(BFR.x, BFR.y, BBR.x, BBR.y, false, "BFR", "BBR"),
    line(BBR.x, BBR.y, BBL.x, BBL.y, true, "BBR", "BBL"),
    line(BFL.x, BFL.y, BBL.x, BBL.y, true, "BFL", "BBL"),
    // Lateral edges (slanted) — front two solid, back dashed
    line(TFL.x, TFL.y, BFL.x, BFL.y, false, "TFL", "BFL"),
    line(TFR.x, TFR.y, BFR.x, BFR.y, false, "TFR", "BFR"),
    line(TBR.x, TBR.y, BBR.x, BBR.y, false, "TBR", "BBR"),
    line(TBL.x, TBL.y, BBL.x, BBL.y, true, "TBL", "BBL"),
  ];
}

// ─── OBLIQUE TRIANGULAR PRISM ─────────────────────────────────────
// Triangular bases top and bottom. Lateral edges slanted (oblique).
function obliqueTriPrismGeom(bbox: BBox): ElementGeom[] {
  const { x, y, w, h } = bbox;
  const d = Math.min(w, h) * 0.2; // depth offset
  const shift = w * 0.2; // oblique lateral shift

  // Top triangle
  const TL = { x: x + shift, y: y + d };
  const TR = { x: x + w - d + shift * 0.3, y: y + d };
  const TB = { x: x + d + shift * 0.6, y }; // back vertex

  // Bottom triangle (shifted left by 'shift')
  const BL = { x, y: y + h };
  const BR = { x: x + w - d - shift * 0.7, y: y + h };
  const BB = { x: x + d - shift * 0.4, y: y + h - d }; // back vertex

  return [
    // Top base — front solid, back: right solid, left dashed
    line(TL.x, TL.y, TR.x, TR.y, false, "TL", "TR"),
    line(TR.x, TR.y, TB.x, TB.y, false, "TR", "TB"),
    line(TL.x, TL.y, TB.x, TB.y, true, "TL", "TB"),
    // Bottom base
    line(BL.x, BL.y, BR.x, BR.y, false, "BL", "BR"),
    line(BR.x, BR.y, BB.x, BB.y, false, "BR", "BB"),
    line(BL.x, BL.y, BB.x, BB.y, true, "BL", "BB"),
    // Lateral edges (slanted) — front two solid, back dashed
    line(TL.x, TL.y, BL.x, BL.y, false, "TL", "BL"),
    line(TR.x, TR.y, BR.x, BR.y, false, "TR", "BR"),
    line(TB.x, TB.y, BB.x, BB.y, true, "TB", "BB"),
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
    case "cone":
      return coneGeom(bbox);
    case "triangularPrism":
      return triangularPrismGeom(bbox);
    case "bipyramid":
      return bipyramidGeom(bbox);
    case "truncatedPyramid":
      return truncatedPyramidGeom(bbox);
    case "truncatedCone":
      return truncatedConeGeom(bbox);
    case "obliqueRectPrism":
      return obliqueRectPrismGeom(bbox);
    case "obliqueTriPrism":
      return obliqueTriPrismGeom(bbox);
    default:
      throw new Error(`Unknown solid preset: ${type}`);
  }
}

function createElementFromGeom(
  geom: ElementGeom,
  styles: SolidPresetStyles,
): ExcalidrawElement {
  if (geom.kind === "line") {
    const el = newLinearElement({
      type: "line",
      x: geom.x,
      y: geom.y,
      strokeColor: styles.strokeColor,
      backgroundColor: "transparent",
      fillStyle: styles.fillStyle,
      strokeWidth: styles.strokeWidth,
      strokeStyle: geom.dashed ? "dashed" : "solid",
      // Dashed arcs need roughness: 0 so the core continuous-path fix
      // in shape.ts activates (condition: roughness === 0 && !solid)
      roughness: geom.dashed ? 0 : styles.roughness,
      opacity: styles.opacity,
      locked: false,
      frameId: styles.frameId,
      points: geom.points,
      polygon: geom.polygon,
    });
    // Add shared vertex mapping for wireframe vertex binding
    if (geom.vertexIds?.length) {
      const sharedVertices: Record<number, string> = {};
      geom.vertexIds.forEach((vid, idx) => {
        if (vid) {
          sharedVertices[idx] = vid;
        }
      });
      return newElementWith(el, { sharedVertices } as any);
    }
    return el;
  }
  if (geom.kind === "arc") {
    const el = newElement({
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
      roughness: geom.dashed ? 0 : styles.roughness,
      opacity: styles.opacity,
      locked: false,
      frameId: styles.frameId,
    });
    return newElementWith(el, {
      startAngle: geom.startAngle,
      endAngle: geom.endAngle,
    } as any);
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
