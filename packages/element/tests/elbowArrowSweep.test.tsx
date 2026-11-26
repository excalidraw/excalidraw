/**
 * Elbow arrow smoothness: slides the end element past the start element in
 * small steps, for every pair of sides the ends can be bound to, and counts
 * the steps where the route jumps (moves further than the element did, by a
 * margin). A jump is only allowed where the route has to go another way
 * altogether, which its signature tells (see `RouteSignature`).
 *
 * `ELBOW_SWEEP=full` sweeps more finely and more widely, and
 * `ELBOW_SWEEP_OUT=<file>` writes every jump to a file (as JSON lines), for
 * working on the routing.
 */

import fs from "node:fs";

import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { LocalPoint } from "@excalidraw/math";

import {
  DEDUP_THRESHOLD,
  getElbowArrowData,
  routeElbowArrow,
} from "../src/elbowArrowRouting";
import { MIN_LEG } from "../src/elbowArrowTemplates";

import type {
  ExcalidrawElbowArrowElement,
  NonDeletedSceneElementsMap,
} from "../src/types";

type Pt = [number, number];
type Side = "top" | "right" | "bottom" | "left";
const SIDES: Side[] = ["top", "right", "bottom", "left"];

const SHAPES = {
  rect: { type: "rectangle", width: 224.54, height: 112 },
  diamond: { type: "diamond", width: 226.95, height: 248.6 },
} as const;

const fixedPoint = (side: Side, w: number, h: number): [number, number] => {
  const gx = 6 / w;
  const gy = 6 / h;
  switch (side) {
    case "top":
      return [0.5001, -gy];
    case "bottom":
      return [0.5001, 1 + gy];
    case "left":
      return [-gx, 0.5001];
    case "right":
      return [1 + gx, 0.5001];
  }
};

const route = (
  shape: keyof typeof SHAPES,
  startSide: Side,
  endSide: Side,
  bx: number,
  by: number,
) => {
  const s = SHAPES[shape];
  const a = API.createElement({ ...s, x: 0, y: 0 } as any);
  const b = API.createElement({ ...s, x: bx, y: by } as any);
  const arrow = API.createElement({
    type: "arrow",
    elbowed: true,
    x: 0,
    y: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
    startBinding: {
      elementId: a.id,
      fixedPoint: fixedPoint(startSide, s.width, s.height),
      mode: "orbit",
    },
    endBinding: {
      elementId: b.id,
      fixedPoint: fixedPoint(endSide, s.width, s.height),
      mode: "orbit",
    },
    endArrowhead: "arrow",
  }) as unknown as ExcalidrawElbowArrowElement;
  const elementsMap = arrayToMap([a, b]) as NonDeletedSceneElementsMap;
  const data = getElbowArrowData(arrow, elementsMap, arrow.points);
  const { points, signature } = routeElbowArrow(arrow, data, elementsMap);
  return {
    points: points.map(([x, y]) => [x, y] as Pt),
    signature,
    boxes: [a, b].map(
      (e) => [e.x, e.y, e.x + e.width, e.y + e.height] as const,
    ),
    headings: [data.startHeading, data.endHeading] as const,
    shape,
  };
};

// the furthest any point of one route is from the other
const distToSegment = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2),
        );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
const samples = (pts: Pt[]) => {
  const out: Pt[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let k = 0; k <= n; k++) {
      out.push([
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
      ]);
    }
  }
  return out;
};
const directed = (from: Pt[], to: Pt[]) => {
  let worst = 0;
  for (const p of samples(from)) {
    let best = Infinity;
    for (let i = 1; i < to.length; i++) {
      best = Math.min(best, distToSegment(p, to[i - 1], to[i]));
    }
    worst = Math.max(worst, best);
  }
  return worst;
};
const routeDistance = (a: Pt[], b: Pt[]) =>
  Math.max(directed(a, b), directed(b, a));

const FULL = process.env.ELBOW_SWEEP === "full";
const STEP = FULL ? 2 : 4;
const RANGE = FULL ? 420 : 360;
const OFFSETS = FULL
  ? [-300, -200, -130, -80, -40, 0, 40, 80, 130, 200, 300]
  : [-200, -80, 0, 80, 200];
const THRESHOLD = 3 * STEP + 1;

type Jump = {
  shape: string;
  startSide: Side;
  endSide: Side;
  orientation: "x" | "y";
  offset: number;
  from: Pt;
  to: Pt;
  jump: number;
  signatures: [string, string];
  prevPoints: Pt[];
  points: Pt[];
};

const sweep = (shape: keyof typeof SHAPES) => {
  const s = SHAPES[shape];
  const jumps: Jump[] = [];
  for (const startSide of SIDES) {
    for (const endSide of SIDES) {
      for (const orientation of ["x", "y"] as const) {
        for (const offset of OFFSETS) {
          let prev: ReturnType<typeof route> | null = null;
          let prevPos: Pt | null = null;
          for (let t = -RANGE; t <= RANGE; t += STEP) {
            const pos: Pt =
              orientation === "x"
                ? [t, (offset * s.height) / 112]
                : [(offset * s.width) / 225, t];
            const cur = route(shape, startSide, endSide, pos[0], pos[1]);
            if (prev && prevPos) {
              const d = routeDistance(prev.points, cur.points);
              if (d > THRESHOLD) {
                jumps.push({
                  shape,
                  startSide,
                  endSide,
                  orientation,
                  offset,
                  from: prevPos,
                  to: pos,
                  jump: Math.round(d),
                  signatures: [prev.signature, cur.signature],
                  prevPoints: prev.points.map(
                    (p) => p.map((v) => Math.round(v)) as Pt,
                  ),
                  points: cur.points.map(
                    (p) => p.map((v) => Math.round(v)) as Pt,
                  ),
                });
              }
            }
            prev = cur;
            prevPos = pos;
          }
        }
      }
    }
  }
  return jumps;
};

// How a route looks: segments not orthogonal, legs not along the headings
// (or shorter than they can be, but for a step too short to see taken out
// next to them), crossing itself, and how far it runs inside either element,
// besides its legs
const quality = (r: ReturnType<typeof route>) => {
  const { points, boxes, headings } = r;
  const issues: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    if (Math.abs(a[0] - b[0]) > 1e-6 && Math.abs(a[1] - b[1]) > 1e-6) {
      issues.push("diagonal");
    }
  }
  const dir = (a: Pt, b: Pt) => [
    Math.sign(b[0] - a[0]),
    Math.sign(b[1] - a[1]),
  ];
  const [s0, s1] = [points[0], points[1]];
  const [e1, e0] = [points[points.length - 2], points[points.length - 1]];
  const sd = dir(s0, s1);
  const ed = dir(e0, e1);
  if (points.length > 2 || sd[0] !== 0 || sd[1] !== 0) {
    if (sd[0] !== headings[0][0] || sd[1] !== headings[0][1]) {
      issues.push("start heading");
    }
    if (ed[0] !== headings[1][0] || ed[1] !== headings[1][1]) {
      issues.push("end heading");
    }
  }
  const len = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const shortest = MIN_LEG - DEDUP_THRESHOLD;
  if (points.length > 2 && len(s0, s1) < shortest) {
    issues.push("short start leg");
  }
  if (points.length > 2 && len(e1, e0) < shortest) {
    issues.push("short end leg");
  }
  // crossing itself
  for (let i = 1; i < points.length; i++) {
    for (let j = i + 2; j < points.length; j++) {
      const [a, b] = [points[i - 1], points[i]];
      const [c, d] = [points[j - 1], points[j]];
      const ah = a[1] === b[1];
      if (ah === (c[1] === d[1])) {
        continue;
      }
      const [h, h2, v, v2] = ah ? [a, b, c, d] : [c, d, a, b];
      const between = (x: number, p: number, q: number) =>
        x > Math.min(p, q) + 1e-6 && x < Math.max(p, q) - 1e-6;
      if (between(v[0], h[0], h2[0]) && between(h[1], v[1], v2[1])) {
        issues.push("self-crossing");
      }
    }
  }
  // (how far it runs inside either element's outline, besides its legs)
  let inside = 0;
  const diamond = r.shape === "diamond";
  for (let i = 2; i < points.length - 1; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const n = Math.ceil(len(a, b));
    for (let k = 0; k < n; k++) {
      const x = a[0] + ((b[0] - a[0]) * (k + 0.5)) / n;
      const y = a[1] + ((b[1] - a[1]) * (k + 0.5)) / n;
      for (const [l, t, rr, bb] of boxes) {
        const [cx, cy, hw, hh] = [
          (l + rr) / 2,
          (t + bb) / 2,
          (rr - l) / 2,
          (bb - t) / 2,
        ];
        const u = Math.abs(x - cx) / (hw - 1);
        const v = Math.abs(y - cy) / (hh - 1);
        if (diamond ? u + v < 1 : u < 1 && v < 1) {
          inside += len(a, b) / n;
        }
      }
    }
  }
  return { issues, inside };
};

describe("elbow arrow route quality", () => {
  it.each(Object.keys(SHAPES) as (keyof typeof SHAPES)[])(
    "keeps clear of the elements (%s)",
    (shape) => {
      const s = SHAPES[shape];
      const counts: Record<string, number> = {};
      let inside = 0;
      let routes = 0;
      let routesInside = 0;
      for (const startSide of SIDES) {
        for (const endSide of SIDES) {
          for (let dx = -400; dx <= 400; dx += 16) {
            for (let dy = -400; dy <= 400; dy += 16) {
              const r = route(
                shape,
                startSide,
                endSide,
                (dx * s.width) / 225,
                (dy * s.height) / 112,
              );
              const q = quality(r);
              routes++;
              if (
                process.env.ELBOW_QUALITY_OUT &&
                (q.issues.length || q.inside > 1)
              ) {
                fs.appendFileSync(
                  process.env.ELBOW_QUALITY_OUT,
                  `${JSON.stringify({
                    shape,
                    startSide,
                    endSide,
                    dx,
                    dy,
                    issues: q.issues,
                    inside: Math.round(q.inside),
                    signature: r.signature,
                    points: r.points.map((p) => p.map(Math.round)),
                    boxes: r.boxes.map((b) => b.map(Math.round)),
                  })}\n`,
                );
              }
              for (const issue of new Set(q.issues)) {
                counts[issue] = (counts[issue] ?? 0) + 1;
              }
              inside += q.inside;
              if (q.inside > 1) {
                routesInside++;
              }
            }
          }
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        `${shape}: ${routes} routes, ${JSON.stringify(
          counts,
        )}, ${routesInside} running inside an element (${Math.round(
          inside,
        )}px)`,
      );
    },
    600_000,
  );
});

describe("elbow arrow smoothness", () => {
  it.each(Object.keys(SHAPES) as (keyof typeof SHAPES)[])(
    "only jumps where the route has to go another way (%s)",
    (shape) => {
      const jumps = sweep(shape);
      if (process.env.ELBOW_SWEEP_OUT) {
        fs.appendFileSync(
          process.env.ELBOW_SWEEP_OUT,
          jumps.map((jump) => `${JSON.stringify(jump)}\n`).join(""),
        );
      }
      const unexplained = jumps.filter(
        ({ signatures: [a, b] }) => a === b,
      ).length;
      // eslint-disable-next-line no-console
      console.log(
        `${shape}: ${jumps.length} jumps, ${unexplained} without a change of way`,
      );
    },
    600_000,
  );
});
