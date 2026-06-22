/**
 * Unit tests for RCLL M3a placement (Stage 1d/2, docs/pipeline-rcll-layout-design.md
 * §7.2 / §8 / §13). Pure-data tests over synthetic CompoundNode trees with
 * `localColumn` pre-set (placement consumes M2's columns, not D_H):
 *
 *   - layoutPlacement: packed column-stack (disjoint X/Y), forced bands (disjoint
 *     Y), staircase X (CON-6 from M2), mixed vpc (bands + leaves below), single-child
 *     / empty container (finite box), containment, purity, determinism
 *   - cyclic container (M3b, DEC-8(C) refined): a multi-hull SCC → SWIMLANE (shared
 *     cluster axis + Y-lanes); a 1-way condensation → STAIRCASE (greater X) + DEC-1
 *     Y-rise (X-disjoint groups share rows; off ⇒ sequential)
 *   - placementMeta: containment + sibling 2D-overlap violations = 0; leaf/cyclic count
 *   - backwardEdgeGate: the iron rule (CON-12) — no acyclic edge reads backward OR
 *     shares a column; excusal RE-BASED on genuine cluster-graph `D` cycles
 *   - placementStage: clones, returns scalar meta
 *
 * Run: yarn vitest run packages/excalidraw/components/terraformPipelineRcllPlacement.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  PIPELINE_COLUMN_GAP,
  PIPELINE_FRAME_PAD,
  PIPELINE_CLUSTER_GAP_Y,
  type AncillaryStrip,
  type CollapsedPipelineEdge,
  type PipelineCluster,
} from "./terraformPipelineLayoutShared";
import {
  backwardEdgeGate,
  boxByKey,
  layoutPlacement,
  placementMeta,
  placementStage,
  policyForContainer,
} from "./terraformPipelineRcllPlacement";

import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";
import type { CompoundNode, Lattice } from "./terraformPipelineRcllTypes";

// ── fixtures ────────────────────────────────────────────────────────────────

/** A leaf primaryCluster with a card of the given size + a localColumn. */
const leaf = (
  key: string,
  localColumn: number,
  mds: number,
  width = 200,
  height = 96,
): CompoundNode => ({
  key,
  role: "primaryCluster",
  level: 2,
  minDescendantSequence: mds,
  localColumn,
  cluster: {
    id: key,
    primaryAddress: key,
    firstSequence: mds,
    depth: localColumn,
    placement: {} as PipelineCluster["placement"],
    build: { skeleton: [], width, height, clusterFrameId: `${key}:frame` },
  },
  children: [],
});

const container = (
  key: string,
  children: CompoundNode[],
  role: CompoundNode["role"] = "region",
  localColumn = 0,
): CompoundNode => ({
  key,
  role,
  level: 1,
  minDescendantSequence: children.length
    ? Math.min(...children.map((c) => c.minDescendantSequence))
    : Number.MAX_SAFE_INTEGER,
  localColumn,
  children,
});

const ancillaryBand = (scopeKey: string, wrapWidth: number): CompoundNode => {
  const strip: AncillaryStrip = {
    scopeRole: "region",
    scopeKey,
    placement: {
      providerFamily: "aws",
      accountId: "acct",
      region: "us-east-1",
      vpcId: null,
    },
    stripFrameId: `${scopeKey}:ancillary`,
    cards: [
      {
        address: "aws_s3_bucket.extra",
        placement: {
          providerFamily: "aws",
          accountId: "acct",
          region: "us-east-1",
          vpcId: null,
        },
        build: {
          skeleton: [],
          width: 120,
          height: 60,
          clusterFrameId: "aws_s3_bucket.extra:frame",
        },
      },
      {
        address: "aws_sqs_queue.extra",
        placement: {
          providerFamily: "aws",
          accountId: "acct",
          region: "us-east-1",
          vpcId: null,
        },
        build: {
          skeleton: [],
          width: 120,
          height: 60,
          clusterFrameId: "aws_sqs_queue.extra:frame",
        },
      },
    ],
  };
  return {
    key: `__ancillaryBand__:${scopeKey}`,
    role: "ancillaryBand",
    level: 2,
    minDescendantSequence: Number.MAX_SAFE_INTEGER,
    ancillaryStrip: strip,
    ancillaryWrapWidth: wrapWidth,
    children: [],
  };
};

const lattice = (
  cyclic: string[] = [],
  floor?: Record<string, number>,
  hullEdges?: Record<string, { from: string; to: string }[]>,
  adjacency?: {
    fanout?: Record<string, string[]>;
    fanin?: Record<string, string[]>;
  },
): Lattice => ({
  cyclicContainers: new Set(cyclic),
  // Swimlane placement of a cyclic container derives its shared cluster column
  // axis from the global `LB` floor; supply it for cyclic fixtures.
  floor: floor ? new Map(Object.entries(floor)) : undefined,
  // Per-container hull edges drive the SCC decomposition (2-way SCC → swimlane,
  // one-way condensation → staircase). Supply for cyclic fixtures.
  hullEdges: hullEdges
    ? new Map(
        Object.entries(hullEdges).map(([k, es]) => [
          k,
          es.map((e) => ({ ...e, weight: 1, declared: false })),
        ]),
      )
    : undefined,
  fanout: adjacency?.fanout
    ? new Map(Object.entries(adjacency.fanout))
    : undefined,
  fanin: adjacency?.fanin
    ? new Map(Object.entries(adjacency.fanin))
    : undefined,
});

const overlapXY = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

// ── policyForContainer ───────────────────────────────────────────────────────

describe("policyForContainer", () => {
  it("maps roles per §8 (cyclic containers are SCC-placed upstream)", () => {
    expect(policyForContainer("root")).toBe("passthrough");
    expect(policyForContainer("provider")).toBe("forced");
    expect(policyForContainer("account")).toBe("forced");
    expect(policyForContainer("region")).toBe("packed");
    expect(policyForContainer("vpc")).toBe("mixed");
    expect(policyForContainer("subnetZone")).toBe("packed");
    // Cyclicity does not change the role policy: a cyclic D_H is decomposed into
    // SCCs by `arrangeCyclicContainer` BEFORE policy is consulted (M3b, DEC-8(C)
    // refined — multi-hull SCC → swimlane, one-way condensation → staircase).
  });
});

// ── packed column-stack ───────────────────────────────────────────────────────

describe("layoutPlacement — packed column-stack", () => {
  // subnetZone (packed): A,B at column 0 (stack); C at column 1 (own X).
  const tree = (): CompoundNode =>
    container("sz", [leaf("A", 0, 0), leaf("B", 0, 1), leaf("C", 1, 2)]);

  it("stacks same-column leaves in Y, separates columns in X, no overlap", () => {
    const laid = layoutPlacement(tree(), lattice());
    const by = boxByKey(laid);
    const A = by.get("A")!;
    const B = by.get("B")!;
    const C = by.get("C")!;
    // A above B (same column, disjoint Y)
    expect(A.x).toBe(B.x);
    expect(A.y).toBeLessThan(B.y);
    expect(A.y + A.height).toBeLessThanOrEqual(B.y);
    // C in a different (right) column, X-disjoint from A/B
    expect(C.x).toBeGreaterThanOrEqual(A.x + A.width);
    // no pairwise overlap
    expect(overlapXY(A, B)).toBe(false);
    expect(overlapXY(A, C)).toBe(false);
    expect(overlapXY(B, C)).toBe(false);
  });

  it("sizes the container box = children bbox + pad", () => {
    const laid = layoutPlacement(tree(), lattice());
    const by = boxByKey(laid);
    const sz = by.get("sz")!;
    const kids = ["A", "B", "C"].map((k) => by.get(k)!);
    const minX = Math.min(...kids.map((b) => b.x));
    const maxX = Math.max(...kids.map((b) => b.x + b.width));
    const maxY = Math.max(...kids.map((b) => b.y + b.height));
    // right + bottom padded by PAD; left/top padded too (children inset)
    expect(sz.x + sz.width).toBe(maxX + PIPELINE_FRAME_PAD);
    expect(sz.y + sz.height).toBe(maxY + PIPELINE_FRAME_PAD);
    expect(minX - sz.x).toBe(PIPELINE_FRAME_PAD);
  });

  it("column X gap is at least PIPELINE_COLUMN_GAP", () => {
    const laid = layoutPlacement(tree(), lattice());
    const by = boxByKey(laid);
    const A = by.get("A")!;
    const C = by.get("C")!;
    expect(C.x - (A.x + A.width)).toBeGreaterThanOrEqual(PIPELINE_COLUMN_GAP);
  });
});

// ── ancillary bands ──────────────────────────────────────────────────────────

describe("layoutPlacement — ancillary bands", () => {
  it("places ancillary bands below normal children without polluting primary metrics", () => {
    const host = container("aws\0acct\0us-east-1", [
      leaf("A", 0, 0, 200, 96),
      leaf("B", 1, 1, 200, 96),
      ancillaryBand("aws\0acct\0us-east-1", 600),
    ]);
    const laid = layoutPlacement(host, lattice());
    const by = boxByKey(laid);
    const A = by.get("A")!;
    const B = by.get("B")!;
    const band = by.get("__ancillaryBand__:aws\0acct\0us-east-1")!;
    const normalBottom = Math.max(A.y + A.height, B.y + B.height);

    expect(band.y).toBeGreaterThanOrEqual(
      normalBottom + PIPELINE_CLUSTER_GAP_Y,
    );
    expect(band.x).toBe(A.x);
    expect(laid.box!.width).toBeGreaterThanOrEqual(B.x + B.width - laid.box!.x);

    const meta = placementMeta(laid, lattice());
    expect(meta.placedLeafCount).toBe(2);
    expect(meta.siblingOverlapViolations).toBe(0);
    expect(meta.containmentViolations).toBe(0);
  });
});

// ── forced bands ──────────────────────────────────────────────────────────────

describe("layoutPlacement — forced bands", () => {
  // account (forced) with two region sub-hulls, each holding one leaf.
  const tree = (): CompoundNode =>
    container(
      "acct",
      [
        container("r0", [leaf("x", 0, 0)], "region", 0),
        container("r1", [leaf("y", 0, 1)], "region", 1),
      ],
      "account",
    );

  it("gives sibling sub-hulls disjoint Y bands", () => {
    const laid = layoutPlacement(tree(), lattice());
    const by = boxByKey(laid);
    const r0 = by.get("r0")!;
    const r1 = by.get("r1")!;
    expect(r0.y + r0.height).toBeLessThanOrEqual(r1.y);
    expect(overlapXY(r0, r1)).toBe(false);
  });

  it("band order follows (localColumn, mds): r0 above r1", () => {
    const laid = layoutPlacement(tree(), lattice());
    const by = boxByKey(laid);
    expect(by.get("r0")!.y).toBeLessThan(by.get("r1")!.y);
  });

  it("staircase X (CON-6 from M2): localColumn 1 sits right of column 0", () => {
    const laid = layoutPlacement(tree(), lattice());
    const by = boxByKey(laid);
    // r1 is at localColumn 1, r0 at 0 → r1.x strictly greater
    expect(by.get("r1")!.x).toBeGreaterThan(by.get("r0")!.x);
  });
});

// ── mixed vpc ─────────────────────────────────────────────────────────────────

describe("layoutPlacement — mixed vpc", () => {
  // vpc: one subnetZone sub-hull (forced band) + two vpc-direct leaves (packed below)
  const tree = (): CompoundNode =>
    container(
      "vpc",
      [
        container("sz", [leaf("c", 0, 0)], "subnetZone", 0),
        leaf("d1", 0, 1),
        leaf("d2", 1, 2),
      ],
      "vpc",
    );

  it("places the packed leaf block below the forced band, no overlap", () => {
    const laid = layoutPlacement(tree(), lattice());
    const by = boxByKey(laid);
    const sz = by.get("sz")!;
    const d1 = by.get("d1")!;
    const d2 = by.get("d2")!;
    // both direct leaves start below the subnet-zone band
    expect(d1.y).toBeGreaterThanOrEqual(sz.y + sz.height);
    expect(d2.y).toBeGreaterThanOrEqual(sz.y + sz.height);
    expect(overlapXY(sz, d1)).toBe(false);
    expect(overlapXY(sz, d2)).toBe(false);
    expect(overlapXY(d1, d2)).toBe(false);
  });
});

// ── cyclic container → swimlanes (DEC-8(C)) ────────────────────────────────────

describe("layoutPlacement — cyclic container → swimlane (multi-hull SCC)", () => {
  // A VPC whose two subnet zones form a genuine 2-way hull cycle (public⇄private)
  // — a multi-hull SCC ⇒ ONE swimlane on a shared axis (DEC-8(C) refined). The
  // underlying clusters are acyclic; their LB floors interleave across subnets:
  //   public:  p0 (LB 0), p1 (LB 2)
  //   private: q0 (LB 1), q1 (LB 3)
  // so the chain p0→q0→p1→q1 reads strictly left→right across the shared axis.
  const tree = (): CompoundNode =>
    container(
      "vpc",
      [
        container("public", [leaf("p0", 0, 0), leaf("p1", 0, 2)], "subnetZone"),
        container(
          "private",
          [leaf("q0", 0, 1), leaf("q1", 0, 3)],
          "subnetZone",
        ),
      ],
      "vpc",
    );
  const floor = { p0: 0, q0: 1, p1: 2, q1: 3 };
  // public⇄private: a 2-way hull cycle ⇒ {public, private} is one SCC.
  const he = {
    vpc: [
      { from: "public", to: "private" },
      { from: "private", to: "public" },
    ],
  };
  const lat = (): Lattice => lattice(["vpc"], floor, he);

  it("shares ONE column axis across both subnets (no two clusters on the same X)", () => {
    const by = boxByKey(layoutPlacement(tree(), lat()));
    // dense-rank(LB): p0→col0, q0→col1, p1→col2, q1→col3 — four distinct X.
    const xs = [
      by.get("p0")!.x,
      by.get("q0")!.x,
      by.get("p1")!.x,
      by.get("q1")!.x,
    ];
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
    expect(xs[2]).toBeLessThan(xs[3]!);
  });

  it("places the two subnet zones as disjoint Y-lanes (CON-5 preserved)", () => {
    const by = boxByKey(layoutPlacement(tree(), lat()));
    const pub = by.get("public")!;
    const priv = by.get("private")!;
    expect(overlapXY(pub, priv)).toBe(false);
    expect(pub.y + pub.height).toBeLessThanOrEqual(priv.y);
  });

  it("each subnet frame spans MULTIPLE columns (one contiguous lane)", () => {
    const by = boxByKey(layoutPlacement(tree(), lat()));
    // public wraps p0 (col0) + p1 (col2): its width must exceed a single card.
    expect(by.get("public")!.width).toBeGreaterThan(by.get("p0")!.width);
    // p1 (col2) sits to the right of q0 (col1) — the lane truly interleaves.
    expect(by.get("p1")!.x).toBeGreaterThan(by.get("q0")!.x);
  });

  it("no TFD edge reads backward OR shares a column (the iron rule, CON-12)", () => {
    const by = boxByKey(layoutPlacement(tree(), lat()));
    const clusters = ["p0", "q0", "p1", "q1"].map(
      (id) => leaf(id, 0, 0).cluster!,
    );
    // Cluster graph `D` is acyclic (a linear chain) ⇒ nothing excused.
    const edges = [
      { source: "p0", target: "q0" },
      { source: "q0", target: "p1" },
      { source: "p1", target: "q1" },
    ] as CollapsedPipelineEdge[];
    const g = backwardEdgeGate(by, edges, clusters);
    expect(g.acyclicBackwardEdges).toBe(0);
    expect(g.acyclicSameColumnEdges).toBe(0);
    expect(g.cyclicBackwardEdges).toBe(0);
    expect(g.cyclicSameColumnEdges).toBe(0);
  });

  it("keeps ancillary bands out of the cyclic hull matrix and below normal lanes", () => {
    const base = boxByKey(layoutPlacement(tree(), lat()));
    const withBandTree = tree();
    withBandTree.children.push(ancillaryBand("vpc", base.get("vpc")!.width));
    const withBand = boxByKey(layoutPlacement(withBandTree, lat()));

    for (const key of ["public", "private", "p0", "q0", "p1", "q1"]) {
      expect(withBand.get(key)!.x, `${key} x unchanged`).toBe(base.get(key)!.x);
    }
    const band = withBand.get("__ancillaryBand__:vpc")!;
    const normalBottom = Math.max(
      withBand.get("public")!.y + withBand.get("public")!.height,
      withBand.get("private")!.y + withBand.get("private")!.height,
    );
    expect(band.y).toBeGreaterThanOrEqual(
      normalBottom + PIPELINE_CLUSTER_GAP_Y,
    );
    expect(withBand.get("vpc")!.width).toBe(base.get("vpc")!.width);
  });
});

// ── cyclic container → 1-way condensation staircase + Y-rise ────────────────────

describe("layoutPlacement — cyclic container → staircase + Y-rise", () => {
  // A cyclic container `prov` with THREE singleton-SCC account hulls and one-way
  // hull edges a→b→c. They are NOT mutually dependent ⇒ each is its own SCC ⇒ the
  // condensation staircases them in X; the DEC-1 Y-rise pulls the X-disjoint
  // groups up to share rows (the height lever).
  const tree = (): CompoundNode =>
    container(
      "prov",
      [
        container("a", [leaf("a0", 0, 0)], "account"),
        container("b", [leaf("b0", 0, 1)], "account"),
        container("c", [leaf("c0", 0, 2)], "account"),
      ],
      "provider",
    );
  const floor = { a0: 0, b0: 0, c0: 0 };
  const he = {
    prov: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
  };

  it("staircases the singleton groups L→R by the condensation (greater X)", () => {
    const by = boxByKey(layoutPlacement(tree(), lattice(["prov"], floor, he)));
    expect(by.get("a")!.x).toBeLessThan(by.get("b")!.x);
    expect(by.get("b")!.x).toBeLessThan(by.get("c")!.x);
  });

  it("rises X-disjoint groups to share Y (DEC-1 on) — and stacks them when off", () => {
    const on = boxByKey(layoutPlacement(tree(), lattice(["prov"], floor, he)));
    const off = boxByKey(
      layoutPlacement(tree(), lattice(["prov"], floor, he), {
        staircaseBandOverlap: false,
      }),
    );
    // ON: b and c (X-disjoint from a) rise to a's row → same top Y.
    expect(on.get("b")!.y).toBe(on.get("a")!.y);
    expect(on.get("c")!.y).toBe(on.get("a")!.y);
    // OFF: sequential stack → strictly taller container.
    expect(off.get("prov")!.height).toBeGreaterThan(on.get("prov")!.height);
  });

  it("no 2D overlap among the risen groups (collision-safe by construction)", () => {
    const laid = layoutPlacement(tree(), lattice(["prov"], floor, he));
    expect(
      placementMeta(laid, lattice(["prov"], floor, he))
        .siblingOverlapViolations,
    ).toBe(0);
  });
});

// ── swimlane interior lane-rise (M4, swimlaneLaneRise) ──────────────────────────

describe("layoutPlacement — swimlane lane-rise (M4)", () => {
  // A cyclic `prov` whose two accounts form a 2-way SCC ⇒ ONE swimlane on a shared
  // denseRank(LB) axis. Each account nests two single-leaf regions whose leaves sit
  // at DISJOINT shared columns, so the regions are X-disjoint lanes that can RISE to
  // share a Y row (M4) instead of pure Y-stacking (M3b).
  //   accA: rA(lA @LB0), rB(lB @LB3)   accB: rC(lC @LB1), rD(lD @LB2)
  const tree = (): CompoundNode =>
    container(
      "prov",
      [
        container(
          "accA",
          [
            container("rA", [leaf("lA", 0, 0)], "region"),
            container("rB", [leaf("lB", 0, 3)], "region"),
          ],
          "account",
        ),
        container(
          "accB",
          [
            container("rC", [leaf("lC", 0, 1)], "region"),
            container("rD", [leaf("lD", 0, 2)], "region"),
          ],
          "account",
        ),
      ],
      "provider",
    );
  const floor = { lA: 0, lC: 1, lD: 2, lB: 3 };
  const he = {
    prov: [
      { from: "accA", to: "accB" },
      { from: "accB", to: "accA" },
    ],
  };
  const lat = (): Lattice => lattice(["prov"], floor, he);

  it("rise ON makes the swimlane strictly shorter than rise OFF", () => {
    const on = boxByKey(
      layoutPlacement(tree(), lat(), { swimlaneLaneRise: true }),
    );
    const off = boxByKey(layoutPlacement(tree(), lat()));
    expect(on.get("prov")!.height).toBeLessThan(off.get("prov")!.height);
  });

  it("rise ON lifts the second region in an account to share the first's row", () => {
    const on = boxByKey(
      layoutPlacement(tree(), lat(), { swimlaneLaneRise: true }),
    );
    // rA (col0) and rB (col3) are X-disjoint ⇒ rB rises to rA's top Y.
    expect(on.get("rB")!.y).toBe(on.get("rA")!.y);
    expect(overlapXY(on.get("rA")!, on.get("rB")!)).toBe(false);
  });

  it("CON-12-safe: every leaf keeps the SAME absolute X with rise ON vs OFF", () => {
    const on = boxByKey(
      layoutPlacement(tree(), lat(), { swimlaneLaneRise: true }),
    );
    const off = boxByKey(layoutPlacement(tree(), lat()));
    for (const id of ["lA", "lB", "lC", "lD"]) {
      expect(on.get(id)!.x).toBe(off.get(id)!.x);
    }
  });

  it("no sibling 2D overlap with rise ON (collision-safe)", () => {
    const laid = layoutPlacement(tree(), lat(), { swimlaneLaneRise: true });
    expect(placementMeta(laid, lat()).siblingOverlapViolations).toBe(0);
    expect(placementMeta(laid, lat()).containmentViolations).toBe(0);
  });

  it("deterministic with rise ON (two builds positionally identical)", () => {
    const a = boxByKey(
      layoutPlacement(tree(), lat(), { swimlaneLaneRise: true }),
    );
    const b = boxByKey(
      layoutPlacement(tree(), lat(), { swimlaneLaneRise: true }),
    );
    for (const id of ["lA", "lB", "lC", "lD", "rA", "rB", "accA", "prov"]) {
      expect(`${a.get(id)!.x},${a.get(id)!.y}`).toBe(
        `${b.get(id)!.x},${b.get(id)!.y}`,
      );
    }
  });
});

// ── straighten leaf-rise beside swimlane lanes ───────────────────────────────

describe("layoutPlacement — straighten lifts direct swimlane leaves", () => {
  const tree = (directFloor: number): CompoundNode =>
    container(
      "vpc",
      [container("subnet", [leaf("A", 0, 0)], "subnetZone"), leaf("B", 0, 1)],
      "vpc",
    );
  const lat = (directFloor: number): Lattice =>
    lattice(
      ["vpc"],
      { A: 0, B: directFloor },
      {
        vpc: [
          { from: "subnet", to: "B" },
          { from: "B", to: "subnet" },
        ],
      },
      { fanout: { A: ["B"] }, fanin: { B: ["A"] } },
    );

  it("raises a direct non-overlapping leaf into free Y beside a lane", () => {
    const by = boxByKey(layoutPlacement(tree(1), lat(1), { straighten: true }));
    const lane = by.get("subnet")!;
    const direct = by.get("B")!;
    const a = by.get("A")!;

    expect(direct.x).toBeGreaterThanOrEqual(lane.x + lane.width);
    expect(direct.y).toBe(lane.y);
    expect(overlapXY(lane, direct)).toBe(false);
    expect(a.x).toBeLessThan(direct.x);
  });

  it("keeps an overlapping direct leaf below the lane", () => {
    const by = boxByKey(layoutPlacement(tree(0), lat(0), { straighten: true }));
    const lane = by.get("subnet")!;
    const direct = by.get("B")!;

    expect(direct.x).toBeLessThan(lane.x + lane.width);
    expect(direct.y).toBeGreaterThanOrEqual(lane.y + lane.height);
    expect(overlapXY(lane, direct)).toBe(false);
  });
});

// ── degenerate ────────────────────────────────────────────────────────────────

describe("layoutPlacement — degenerate inputs", () => {
  it("single-child container → finite box, child contained", () => {
    const laid = layoutPlacement(
      container("sz", [leaf("only", 0, 0)]),
      lattice(),
    );
    const by = boxByKey(laid);
    const sz = by.get("sz")!;
    const only = by.get("only")!;
    expect(Number.isFinite(sz.width)).toBe(true);
    expect(Number.isFinite(sz.height)).toBe(true);
    expect(sz.width).toBeGreaterThan(0);
    expect(only.x).toBeGreaterThanOrEqual(sz.x);
  });

  it("empty container (no children) → finite zero-ish box, no NaN", () => {
    const laid = layoutPlacement(container("empty", []), lattice());
    const box = boxByKey(laid).get("empty")!;
    expect(Number.isFinite(box.width)).toBe(true);
    expect(Number.isFinite(box.height)).toBe(true);
    expect(Number.isNaN(box.x)).toBe(false);
  });
});

// ── purity + determinism ──────────────────────────────────────────────────────

describe("layoutPlacement — purity + determinism", () => {
  const tree = (): CompoundNode =>
    container(
      "acct",
      [
        container("r0", [leaf("x", 0, 0)], "region", 0),
        container("r1", [leaf("y", 0, 1)], "region", 1),
      ],
      "account",
    );

  it("does not mutate the input tree (box stays undefined)", () => {
    const t = tree();
    expect(t.box).toBeUndefined();
    expect(t.children[0]!.box).toBeUndefined();
    layoutPlacement(t, lattice());
    expect(t.box).toBeUndefined();
    expect(t.children[0]!.box).toBeUndefined();
  });

  it("is deterministic over two runs", () => {
    const flat = (laid: CompoundNode): Array<[string, string]> =>
      [...boxByKey(laid).entries()]
        .map(
          ([k, b]) =>
            [k, `${b.x},${b.y},${b.width},${b.height}`] as [string, string],
        )
        .sort((a, b) => a[0].localeCompare(b[0]));
    expect(flat(layoutPlacement(tree(), lattice()))).toEqual(
      flat(layoutPlacement(tree(), lattice())),
    );
  });
});

// ── placementMeta + placementStage ─────────────────────────────────────────────

describe("placementMeta", () => {
  it("reports zero containment + forced-band violations on a clean tree", () => {
    const tree = container(
      "acct",
      [
        container("r0", [leaf("x", 0, 0)], "region", 0),
        container("r1", [leaf("y", 0, 1)], "region", 1),
      ],
      "account",
    );
    const laid = layoutPlacement(tree, lattice());
    const meta = placementMeta(laid, lattice());
    expect(meta.containmentViolations).toBe(0);
    expect(meta.siblingOverlapViolations).toBe(0);
    expect(meta.placedLeafCount).toBe(2);
    expect(meta.cyclicContainerCount).toBe(0);
  });

  it("a cyclic container's SCC-placed children keep 2D-disjoint siblings", () => {
    const tree = container("cyc", [leaf("a", 0, 0), leaf("b", 1, 1)]);
    const laid = layoutPlacement(tree, lattice(["cyc"]));
    const meta = placementMeta(laid, lattice(["cyc"]));
    expect(meta.cyclicContainerCount).toBe(1);
    expect(meta.siblingOverlapViolations).toBe(0);
  });
});

describe("placementStage", () => {
  it("returns a cloned tree with boxes + scalar meta", () => {
    const tree = container("sz", [leaf("A", 0, 0)]);
    const result = placementStage(tree, lattice(), { compact: true });
    expect(result.tree).not.toBe(tree);
    expect(result.tree.box).toBeDefined();
    expect(typeof result.meta!.containmentViolations).toBe("number");
    expect(typeof result.meta!.maxWidthPx).toBe("number");
  });
});

// ── backwardEdgeGate (CON-12 iron rule) ────────────────────────────────────────

describe("backwardEdgeGate", () => {
  // Excusal is RE-BASED on the CLUSTER graph `D` SCCs (not the LCA container):
  // an edge is excused only when its two clusters are mutually reachable in `D`.
  const cl = (id: string): PipelineCluster => leaf(id, 0, 0).cluster!;
  const box = (x: number, width = 100): TerraformDependencyLayoutBox => ({
    x,
    y: 0,
    width,
    height: 50,
  });
  const edge = (source: string, target: string): CollapsedPipelineEdge =>
    ({ source, target } as CollapsedPipelineEdge);

  it("counts no backward edge when the target box is right of the source", () => {
    const boxes = new Map([
      ["u", box(0)],
      ["v", box(300)],
    ]);
    const g = backwardEdgeGate(boxes, [edge("u", "v")], [cl("u"), cl("v")]);
    expect(g.acyclicBackwardEdges).toBe(0);
    expect(g.cyclicBackwardEdges).toBe(0);
  });

  it("flags an acyclic backward edge (target left of source, no D cycle)", () => {
    const boxes = new Map([
      ["u", box(300)],
      ["v", box(0)],
    ]);
    const g = backwardEdgeGate(boxes, [edge("u", "v")], [cl("u"), cl("v")]);
    expect(g.acyclicBackwardEdges).toBe(1);
    expect(g.cyclicBackwardEdges).toBe(0);
  });

  it("excuses a backward edge inside a genuine cluster-graph `D` cycle", () => {
    const boxes = new Map([
      ["u", box(300)],
      ["v", box(0)],
    ]);
    // u->v and v->u => {u,v} is one D-SCC; u->v reads backward but is excused.
    const g = backwardEdgeGate(
      boxes,
      [edge("u", "v"), edge("v", "u")],
      [cl("u"), cl("v")],
    );
    expect(g.acyclicBackwardEdges).toBe(0);
    expect(g.cyclicBackwardEdges).toBe(1);
  });
});
