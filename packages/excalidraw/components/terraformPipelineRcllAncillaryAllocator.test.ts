import { describe, expect, it } from "vitest";

import {
  allocateRcllAncillarySlackForTesting,
  buildValidatedAncillaryInsertion,
} from "./terraformPipelineRcllAncillaryAllocator";

import type { RcllAncillaryBandDiagnostic } from "./terraformPipelineRcllAncillaryAllocator";

import type { AncillaryStrip } from "./terraformPipelineLayoutShared";
import type { CompoundNode } from "./terraformPipelineRcllTypes";

function fakeAncillaryStrip(
  scopeKey: string,
  widths: readonly number[],
): AncillaryStrip {
  return {
    scopeRole: "vpc",
    scopeKey,
    placement: {
      providerFamily: "aws",
      accountId: "111111111111",
      region: "us-east-1",
      vpcId: scopeKey,
    },
    stripFrameId: `strip:${scopeKey}`,
    cards: widths.map((width, i) => ({
      address: `${scopeKey}:card:${i}`,
      placement: {
        providerFamily: "aws",
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: scopeKey,
      },
      build: {
        skeleton: [],
        width,
        height: 80,
        clusterFrameId: `${scopeKey}:frame:${i}`,
      },
    })),
  };
}

function fakePrimary(hostKey: string, y: number): CompoundNode {
  return {
    key: `${hostKey}:primary`,
    role: "primaryCluster",
    level: 2,
    minDescendantSequence: 1,
    box: { x: 60, y, width: 260, height: 90 },
    cluster: {
      id: `${hostKey}:primary`,
      primaryAddress: `${hostKey}:primary`,
      firstSequence: 1,
      depth: 0,
      placement: {
        providerFamily: "aws",
        accountId: "111111111111",
        region: "us-east-1",
        vpcId: hostKey,
      },
      build: {
        skeleton: [],
        width: 260,
        height: 90,
        clusterFrameId: `${hostKey}:primary`,
      },
    },
    children: [],
  };
}

function fakeAllocatorTree(options?: {
  rootWidth?: number;
  hostBFirst?: boolean;
  rightSiblingX?: number;
}): CompoundNode {
  const rootWidth = options?.rootWidth ?? 1000;
  const hostA: CompoundNode = {
    key: "scope:a",
    role: "vpc",
    level: 1,
    minDescendantSequence: options?.hostBFirst ? 2 : 1,
    box: { x: 40, y: 40, width: 300, height: 180 },
    children: [fakePrimary("scope:a", 70)],
  };
  const hostB: CompoundNode = {
    key: "scope:b",
    role: "vpc",
    level: 1,
    minDescendantSequence: options?.hostBFirst ? 1 : 2,
    box: { x: 40, y: 300, width: 300, height: 180 },
    children: [fakePrimary("scope:b", 330)],
  };
  const children = options?.hostBFirst ? [hostB, hostA] : [hostA, hostB];
  if (options?.rightSiblingX != null) {
    children.push({
      key: "scope:right",
      role: "vpc",
      level: 1,
      minDescendantSequence: 3,
      box: { x: options.rightSiblingX, y: 40, width: 120, height: 180 },
      children: [],
    });
  }
  return {
    key: "__rcll_root__",
    role: "root",
    level: 0,
    minDescendantSequence: 0,
    box: { x: 0, y: 0, width: rootWidth, height: 520 },
    children,
  };
}

describe("RCLL ancillary recursive slack allocator", () => {
  it("allocates existing right slack when it reduces measured strip height", () => {
    const result = allocateRcllAncillarySlackForTesting(
      fakeAllocatorTree(),
      [fakeAncillaryStrip("scope:a", [120, 120, 120, 120])],
      {},
    );
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]!.scopeKey).toBe("scope:a");
    expect(result.allocations[0]!.allocatedWidthPx).toBeGreaterThan(0);
    expect(result.meta.rowSavings).toBeGreaterThan(0);
    expect(result.meta.widenedHullCount).toBe(1);
  });

  it("chooses the largest row-height reduction, then larger card count, then scope key", () => {
    const result = allocateRcllAncillarySlackForTesting(
      fakeAllocatorTree({ hostBFirst: true }),
      [
        fakeAncillaryStrip("scope:b", [120, 120, 120, 120]),
        fakeAncillaryStrip("scope:a", [120, 120, 120, 120]),
      ],
      {},
    );
    expect(result.allocations[0]!.scopeKey).toBe("scope:a");
  });

  it("ignores breakpoints that do not reduce rows", () => {
    const result = allocateRcllAncillarySlackForTesting(
      fakeAllocatorTree(),
      [fakeAncillaryStrip("scope:a", [120])],
      {},
    );
    expect(result.allocations).toEqual([]);
    expect(result.meta.allocationCount).toBe(0);
  });

  it("stops at right siblings whose vertical span overlaps", () => {
    const result = allocateRcllAncillarySlackForTesting(
      fakeAllocatorTree({ rightSiblingX: 360 }),
      [fakeAncillaryStrip("scope:a", [120, 120, 120, 120])],
      {},
    );
    expect(result.allocations).toEqual([]);
  });

  it("does not allocate beyond the baseline root right edge", () => {
    const result = allocateRcllAncillarySlackForTesting(
      fakeAllocatorTree({ rootWidth: 360 }),
      [fakeAncillaryStrip("scope:a", [120, 120, 120, 120])],
      {},
    );
    expect(result.allocations).toEqual([]);
  });

  // DI-ANC-6 — a right sibling positioned only beside the BAND (below the
  // dataflow primary). At the band's tall baseline height the ceiling clamps
  // against it; once the band is widened (and shortened) the sibling no longer
  // blocks it (it sits below the now-short host and is a permitted lower-sibling
  // push). The live greedy never tries it because `recursiveRightSlackCeiling`
  // measures overlap against the TALL pre-widen band.
  function fakeRightSibling(
    key: string,
    x: number,
    y: number,
    height: number,
  ): CompoundNode {
    return {
      key,
      role: "vpc",
      level: 1,
      minDescendantSequence: 3,
      box: { x, y, width: 120, height },
      children: [],
    };
  }

  function diagnosticTree(rightSibling: CompoundNode): CompoundNode {
    return {
      key: "__rcll_root__",
      role: "root",
      level: 0,
      minDescendantSequence: 0,
      box: { x: 0, y: 0, width: 700, height: 520 },
      children: [
        {
          key: "scope:a",
          role: "vpc",
          level: 1,
          minDescendantSequence: 1,
          box: { x: 40, y: 40, width: 300, height: 180 },
          children: [fakePrimary("scope:a", 70)],
        },
        {
          key: "scope:b",
          role: "vpc",
          level: 1,
          minDescendantSequence: 2,
          box: { x: 40, y: 300, width: 300, height: 180 },
          children: [fakePrimary("scope:b", 330)],
        },
        rightSibling,
      ],
    };
  }

  const targetDiag = (
    diagnostics: RcllAncillaryBandDiagnostic[] | undefined,
  ): RcllAncillaryBandDiagnostic =>
    diagnostics!.find((d) => d.scopeKey === "scope:a")!;

  it("diagnoses a movement-free missed gap as gap-exists-current-algo-missed", () => {
    // right sibling sits beside the tall band only (y starts well below the
    // primary), so a shorter widened candidate clears it.
    const baseline = diagnosticTree(
      fakeRightSibling("scope:right", 380, 500, 150),
    );
    const result = buildValidatedAncillaryInsertion(
      baseline,
      [fakeAncillaryStrip("scope:a", [120, 120, 120, 120])],
      {},
    );
    const diag = targetDiag(result.allocatorMeta.diagnostics);
    expect(diag.bandBlockStatus).toBe("gap-exists-current-algo-missed");
    // the live greedy left the band tall (the bug), yet a wider candidate validates
    expect(result.allocatorMeta.allocatedWidthPx).toBe(0);
    expect(diag.bestValidWrapWidth).not.toBeNull();
    expect(diag.bestValidWrapWidth!).toBeGreaterThan(
      diag.currentCeilingWrapWidth,
    );
  });

  it("diagnoses a genuinely boxed-in band as all-candidates-fail-validation", () => {
    // right sibling spans the dataflow height too (y from the primary down), so
    // it is NOT a lower-sibling push and overlaps every widened candidate.
    const baseline = diagnosticTree(
      fakeRightSibling("scope:right", 380, 40, 700),
    );
    const result = buildValidatedAncillaryInsertion(
      baseline,
      [fakeAncillaryStrip("scope:a", [120, 120, 120, 120])],
      {},
    );
    const diag = targetDiag(result.allocatorMeta.diagnostics);
    expect(diag.bandBlockStatus).toBe("all-candidates-fail-validation");
    expect(diag.bestValidWrapWidth).toBeNull();
    expect(result.allocatorMeta.allocatedWidthPx).toBe(0);
  });

  it("emits a deterministic diagnostic and never perturbs the returned geometry", () => {
    const strips = [fakeAncillaryStrip("scope:a", [120, 120, 120, 120])];
    const sibling = fakeRightSibling("scope:right", 380, 500, 150);
    const a = buildValidatedAncillaryInsertion(
      diagnosticTree(sibling),
      strips,
      {},
    );
    const b = buildValidatedAncillaryInsertion(
      diagnosticTree(fakeRightSibling("scope:right", 380, 500, 150)),
      strips,
      {},
    );
    expect(a.allocatorMeta.diagnostics).toEqual(b.allocatorMeta.diagnostics);
    // the diagnostic clones throughout — adding it must not change the geometry
    // the allocator returns (the live allocation is byte-identical to DI-ANC-5).
    const noDiag = (m: typeof a.allocatorMeta) => {
      const { diagnostics, ...rest } = m;
      void diagnostics;
      return rest;
    };
    expect(noDiag(a.allocatorMeta)).toEqual(noDiag(b.allocatorMeta));
    expect(a.tree).toEqual(b.tree);
  });

  it("preserves allocated wrap width in the inserted band so the host hull widens", () => {
    const baseline = fakeAllocatorTree();
    const result = buildValidatedAncillaryInsertion(
      baseline,
      [fakeAncillaryStrip("scope:a", [120, 120, 120, 120])],
      {},
    );
    const host = result.tree.children.find((child) => child.key === "scope:a");
    const band = host?.children.find((child) => child.role === "ancillaryBand");
    expect(result.allocatorMeta.allocatedWidthPx).toBeGreaterThan(0);
    expect(band?.box?.width).toBe(band?.ancillaryWrapWidth);
    expect(host?.box?.width).toBeGreaterThan(
      baseline.children.find((child) => child.key === "scope:a")!.box!.width,
    );
  });
});
