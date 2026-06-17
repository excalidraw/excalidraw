/**
 * Unit fixtures for the RCLL readability metrics (RFC docs/pipeline-rcll-layout-design.md
 * §17/§35) — milestone M0b. These validate the measurement harness against
 * ADVERSARIAL hand-built scenes where each metric's true value is known by
 * construction, not just against the staging preset aggregate.
 *
 * The metrics are pure functions of final Excalidraw geometry, so the fixtures
 * are minimal element sets (primary-cluster frames + arrows carrying the TFD
 * `relationship` customData) fed straight into diagnosePipelineScene. Axis
 * convention: X = flow/column (→), Y = cross axis (↓).
 *
 * Run:
 *   yarn vitest run \
 *     packages/excalidraw/components/terraformPipelineReadabilityMetrics.test.ts
 */
import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { diagnosePipelineScene } from "./terraformPipelineCollisionDiagnostics";

// ── element factories ───────────────────────────────────────────────────────

let idSeq = 0;
const nextId = () => `el-${idSeq++}`;

/** A primary-cluster frame addressable by TFD relationships. */
function cluster(
  address: string,
  x: number,
  y: number,
  width = 40,
  height = 40,
): ExcalidrawElement {
  return {
    id: address,
    type: "frame",
    x,
    y,
    width,
    height,
    angle: 0,
    isDeleted: false,
    customData: {
      terraformTopologyRole: "primaryCluster",
      terraformPrimaryAddress: address,
    },
  } as unknown as ExcalidrawElement;
}

/**
 * A TFD arrow. `pts` are ABSOLUTE polyline points; we store the first as the
 * element origin and the rest as local offsets, matching how real arrows are
 * emitted. `source`/`target` populate the relationship so the arrow is counted.
 */
function arrow(
  source: string,
  target: string,
  pts: Array<[number, number]>,
): ExcalidrawElement {
  const [ox, oy] = pts[0]!;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    id: nextId(),
    type: "arrow",
    x: ox,
    y: oy,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    angle: 0,
    points: pts.map(([px, py]) => [px - ox, py - oy]),
    isDeleted: false,
    customData: { relationship: { source, target, aggregated: false } },
  } as unknown as ExcalidrawElement;
}

const crossingsOf = (els: ExcalidrawElement[]) =>
  diagnosePipelineScene(els).dataflow.crossings;

// ── crossing counter: polyline-aware (RFC DEC-6) ────────────────────────────

describe("crossing counter — polyline-aware (DEC-6)", () => {
  // Same endpoints, two representations. The straight chords cross; elbow
  // polylines routed to opposite corners do not. Proves the counter follows
  // bends, not just endpoints.
  it("chords cross → polylines routed apart do not (1 → 0)", () => {
    const straight = [
      arrow("p1", "q1", [
        [0, 0],
        [100, 100],
      ]),
      arrow("p2", "q2", [
        [0, 100],
        [80, 0],
      ]),
    ];
    expect(crossingsOf(straight), "straight chords cross").toBe(1);

    const elbow = [
      arrow("p1", "q1", [
        [0, 0],
        [0, -50],
        [100, -50],
        [100, 100],
      ]),
      arrow("p2", "q2", [
        [0, 100],
        [0, 150],
        [80, 150],
        [80, 0],
      ]),
    ];
    expect(crossingsOf(elbow), "elbow polylines avoid each other").toBe(0);
  });

  // Reverse: parallel chords don't cross, but one polyline spikes through the
  // other. The two intersecting segment pairs count as ONE crossing (de-dupe).
  it("chords parallel → polyline spike crosses (0 → 1, de-duped)", () => {
    const straight = [
      arrow("a1", "b1", [
        [0, 0],
        [100, 0],
      ]),
      arrow("a2", "b2", [
        [0, 50],
        [100, 50],
      ]),
    ];
    expect(crossingsOf(straight), "parallel chords").toBe(0);

    const spiked = [
      arrow("a1", "b1", [
        [0, 0],
        [100, 0],
      ]),
      arrow("a2", "b2", [
        [0, 50],
        [50, -10],
        [100, 50],
      ]),
    ];
    expect(crossingsOf(spiked), "spike crosses once (both segs de-duped)").toBe(
      1,
    );
  });

  // Two arrows leaving a shared hub origin must not count as crossing at the
  // point they share (the endpoint guard) — fan-out should read clean.
  it("arrows from one hub origin do not cross at the shared point", () => {
    const fanout = [
      arrow("hub", "x", [
        [0, 0],
        [100, 50],
      ]),
      arrow("hub", "y", [
        [0, 0],
        [100, -50],
      ]),
    ];
    expect(crossingsOf(fanout)).toBe(0);
  });

  // CRITICAL regression: on today's 2-point geometry the new counter must
  // equal the old straight-chord count, so existing baselines do not move.
  it("2-point arrows behave as straight chords (regression)", () => {
    expect(
      crossingsOf([
        arrow("p1", "q1", [
          [0, 0],
          [100, 100],
        ]),
        arrow("p2", "q2", [
          [0, 100],
          [100, 0],
        ]),
      ]),
      "X pattern → 1",
    ).toBe(1);
    expect(
      crossingsOf([
        arrow("a", "b", [
          [0, 0],
          [100, 0],
        ]),
        arrow("c", "d", [
          [0, 50],
          [100, 50],
        ]),
      ]),
      "parallel → 0",
    ).toBe(0);
  });
});

// ── ΔY / near-straight on polyline vertical extent (review D2) ───────────────

describe("vertical deviation / near-straight — polyline extent (D2)", () => {
  it("an orthogonal jog with equal endpoints is NOT near-straight", () => {
    const d = diagnosePipelineScene([
      // near-straight: vertical extent 10 ≤ 24
      arrow("a", "b", [
        [0, 0],
        [100, 10],
      ]),
      // jog: endpoints share Y=0 (chord ΔY 0) but extent 100 ⇒ not straight
      arrow("c", "d", [
        [0, 0],
        [50, 100],
        [100, 0],
      ]),
    ]).dataflow;
    // Endpoint-based would have called both straight (1.0). Extent-based: 1/2.
    expect(d.fractionNearStraight).toBe(0.5);
    // extents [10, 100] → median index floor(2/2)=1 → 100; mean 55.
    expect(d.medianVerticalDeviationPx).toBe(100);
    expect(d.meanVerticalDeviationPx).toBe(55);
  });
});

// ── fanoutColumnRate + fanoutSetCount (REQ-3/T4, review D1) ──────────────────

describe("fanoutColumnRate", () => {
  it("targets sharing a column → rate 1, count 1", () => {
    // hub S → A,B,C all at centerX 320 (within ±75), varied Y.
    const els = [
      cluster("S", 0, 100),
      cluster("A", 300, 0),
      cluster("B", 300, 100),
      cluster("C", 300, 200),
      arrow("S", "A", [
        [40, 120],
        [300, 20],
      ]),
      arrow("S", "B", [
        [40, 120],
        [300, 120],
      ]),
      arrow("S", "C", [
        [40, 120],
        [300, 220],
      ]),
    ];
    const d = diagnosePipelineScene(els).dataflow;
    expect(d.fanoutSetCount).toBe(1);
    expect(d.fanoutColumnRate).toBe(1);
  });

  it("targets spread beyond tolerance → rate 0", () => {
    // centerX 320 / 420 / 620 → spread 300 > 75.
    const els = [
      cluster("S", 0, 100),
      cluster("A", 300, 0),
      cluster("B", 400, 100),
      cluster("C", 600, 200),
      arrow("S", "A", [
        [40, 120],
        [300, 20],
      ]),
      arrow("S", "B", [
        [40, 120],
        [400, 120],
      ]),
      arrow("S", "C", [
        [40, 120],
        [600, 220],
      ]),
    ];
    const d = diagnosePipelineScene(els).dataflow;
    expect(d.fanoutSetCount).toBe(1);
    expect(d.fanoutColumnRate).toBe(0);
  });

  it("no fan-out sets → rate 0, count 0 (degenerate, not 1.0)", () => {
    const els = [
      cluster("S", 0, 0),
      cluster("T", 300, 0),
      arrow("S", "T", [
        [40, 20],
        [300, 20],
      ]),
    ];
    const d = diagnosePipelineScene(els).dataflow;
    expect(d.fanoutSetCount).toBe(0);
    expect(d.fanoutColumnRate).toBe(0);
    expect(d.hubCount).toBe(0);
    expect(d.hubCenteringRate).toBe(0);
  });
});

// ── hubCenteringRate + hubCount (REQ-6/T5, ε=36, review D1) ──────────────────

describe("hubCenteringRate", () => {
  // hub S over targets whose centerYs are 20/120/220 → median 120.
  const fanTargets = () => [
    cluster("A", 300, 0),
    cluster("B", 300, 100),
    cluster("C", 300, 200),
  ];
  const fanArrows = () => [
    arrow("S", "A", [
      [40, 120],
      [300, 20],
    ]),
    arrow("S", "B", [
      [40, 120],
      [300, 120],
    ]),
    arrow("S", "C", [
      [40, 120],
      [300, 220],
    ]),
  ];

  it("hub at the median → centered (rate 1, count 1)", () => {
    const d = diagnosePipelineScene([
      cluster("S", 0, 100), // centerY 120 == median
      ...fanTargets(),
      ...fanArrows(),
    ]).dataflow;
    expect(d.hubCount).toBe(1);
    expect(d.hubCenteringRate).toBe(1);
  });

  it("hub offset beyond ε → not centered (rate 0)", () => {
    const d = diagnosePipelineScene([
      cluster("S", 0, 200), // centerY 220, |220-120|=100 > 36
      ...fanTargets(),
      ...fanArrows(),
    ]).dataflow;
    expect(d.hubCount).toBe(1);
    expect(d.hubCenteringRate).toBe(0);
  });

  it("hub exactly ε away → still centered (≤ boundary)", () => {
    const d = diagnosePipelineScene([
      cluster("S", 0, 64), // centerY 84, |84-120| = 36 == ε
      ...fanTargets(),
      ...fanArrows(),
    ]).dataflow;
    expect(d.hubCenteringRate).toBe(1);
  });

  it("even fan-out → median is the midpoint of the two central targets", () => {
    // targets centerY 20 and 220 → midpoint 120; hub at 120 ⇒ centered.
    const d = diagnosePipelineScene([
      cluster("S", 0, 100), // centerY 120
      cluster("A", 300, 0), // centerY 20
      cluster("B", 300, 200), // centerY 220
      arrow("S", "A", [
        [40, 120],
        [300, 20],
      ]),
      arrow("S", "B", [
        [40, 120],
        [300, 220],
      ]),
    ]).dataflow;
    expect(d.hubCount).toBe(1);
    expect(d.hubCenteringRate).toBe(1);
  });

  it("counts a convergence node (fan-in centering, both directions)", () => {
    // A,B → T : T converges 2 sources (centerY 20 + 220 → median 120).
    // T centered at 120 ⇒ hubCount 1 (T), rate 1. No source has ≥2 targets.
    const d = diagnosePipelineScene([
      cluster("A", 0, 0), // centerY 20
      cluster("B", 0, 200), // centerY 220
      cluster("T", 300, 100), // centerY 120 == median
      arrow("A", "T", [
        [40, 20],
        [300, 120],
      ]),
      arrow("B", "T", [
        [40, 220],
        [300, 120],
      ]),
    ]).dataflow;
    expect(d.hubCount).toBe(1);
    expect(d.hubCenteringRate).toBe(1);
    expect(d.fanoutSetCount).toBe(0); // neither source fans out
  });
});

// ── aspect ───────────────────────────────────────────────────────────────────

describe("aspect", () => {
  it("content bounding box W:H", () => {
    // clusters span x[0,400], y[0,100] ⇒ 400/100 = 4.
    const d = diagnosePipelineScene([
      cluster("A", 0, 0, 40, 40),
      cluster("B", 360, 60, 40, 40),
    ]).dataflow;
    expect(d.aspect).toBe(4);
  });

  it("no frames/clusters → 0 (no divide-by-zero)", () => {
    const d = diagnosePipelineScene([
      arrow("a", "b", [
        [0, 0],
        [100, 0],
      ]),
    ]).dataflow;
    expect(d.aspect).toBe(0);
  });
});

// ── determinism (CON-8) ──────────────────────────────────────────────────────

describe("determinism", () => {
  it("same elements → identical metrics on repeat", () => {
    const build = () => [
      cluster("S", 0, 100),
      cluster("A", 300, 0),
      cluster("B", 300, 100),
      cluster("C", 300, 200),
      arrow("S", "A", [
        [40, 120],
        [300, 20],
      ]),
      arrow("S", "B", [
        [40, 120],
        [300, 120],
      ]),
      arrow("S", "C", [
        [40, 120],
        [300, 220],
      ]),
    ];
    expect(diagnosePipelineScene(build()).dataflow).toEqual(
      diagnosePipelineScene(build()).dataflow,
    );
  });
});
