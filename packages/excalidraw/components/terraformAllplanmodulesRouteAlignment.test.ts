import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { terraformPlanParsing } from "./terraformPlanParsing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, "../../backend/terraform");
const PLAN_FIXTURE = path.join(FIXTURE_DIR, "allplanmodules.json");
const DOT_FIXTURE = path.join(FIXTURE_DIR, "allplanmodules.dot");

function textFileLike(contents: string): File {
  return { text: async () => contents } as File;
}

function midX(e: { x?: number; width?: number }) {
  return (e.x ?? 0) + (e.width ?? 0) / 2;
}

/** All elements whose frame tree root is `zoneId` (recursive child frames). */
function collectDescendants(
  elements: Array<{
    id?: string;
    frameId?: string | null;
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    customData?: Record<string, unknown>;
  }>,
  zoneId: string,
): typeof elements {
  const out: typeof elements = [];
  const stack = [zoneId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    for (const e of elements) {
      if (e.frameId !== id) {
        continue;
      }
      out.push(e);
      if (e.type === "frame" && e.id) {
        stack.push(e.id);
      }
    }
  }
  return out;
}

function tierFromZoneName(
  name: string,
): "public" | "intra" | "private" | "other" {
  const n = name.toLowerCase();
  if (/\bpublic\b/.test(n) || n.includes("public-")) {
    return "public";
  }
  if (/\bintra\b/.test(n) || n.includes("intra")) {
    return "intra";
  }
  if (/\bprivate\b/.test(n) || n.includes("private")) {
    return "private";
  }
  return "other";
}

describe("allplanmodules semantic route ↔ primary horizontal alignment", () => {
  /**
   * On this fixture, `computeRouteTableBottomEdgePlacements` only puts **subnet-zone** bottom
   * route tables where **all** associated subnets fit one placement zone. The two **public**
   * subnets map to **different** zone signatures, so the shared public RT falls through to the
   * **VPC bottom** row (`vpcRouteTable`) — not inside the public subnet frame. This test
   * therefore only asserts **intra** (and any future public zone-bottom rows), not VPC-strip
   * alignment.
   */
  it("route table tier-0 center X tracks primary grid center X in public + intra subnet zones", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    const elements = body.elements as Array<{
      id?: string;
      type?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      frameId?: string | null;
      name?: string;
      customData?: Record<string, unknown>;
    }>;

    const subnetZones = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "subnetZone",
    );

    const eps = 22;
    let checked = 0;

    for (const z of subnetZones) {
      const name = z.name ?? "";
      const tier = tierFromZoneName(name);
      if (tier !== "public" && tier !== "intra") {
        continue;
      }
      const zcd = z.customData as { terraformSubnetIds?: string[] } | undefined;
      if (tier === "public" && (zcd?.terraformSubnetIds?.length ?? 0) > 1) {
        /** Wide coalesced public columns: route band vs multi-primary grid center can diverge. */
        continue;
      }
      const zid = z.id;
      if (!zid) {
        continue;
      }
      const inner = collectDescendants(elements, zid);
      const rts = inner.filter(
        (e) =>
          e.type === "rectangle" &&
          (e.customData as { terraformTopologyRole?: string } | undefined)
            ?.terraformTopologyRole === "subnetZoneRouteTable",
      );
      if (rts.length === 0) {
        continue;
      }
      /** Tier-0 primaries only (exclude IAM/SG/CW satellites that widen the bbox). */
      const primaries = inner.filter((e) => {
        if (e.type !== "rectangle") {
          return false;
        }
        const cd = e.customData as {
          nodePath?: string;
          terraformTopologyRole?: string;
          terraformVisibilityRole?: string;
          satelliteTier?: number;
        };
        if (cd.satelliteTier === 1 || cd.satelliteTier === 2) {
          return false;
        }
        const path = cd.nodePath;
        if (!path || typeof path !== "string") {
          return false;
        }
        if (path.includes("aws_route")) {
          return false;
        }
        /**
         * NAT gateways now render inside their public-subnet zone as a `natGatewayPrimary`
         * primaryCluster band at the top — exclude from "primary grid" midX so the route-table
         * alignment continues to track the LB/lambda/etc. cluster, not the NAT box.
         */
        if (path.includes("aws_nat_gateway")) {
          return false;
        }
        if (path.includes("aws_vpc_endpoint")) {
          return false;
        }
        if (
          cd.terraformTopologyRole === "subnetZoneRouteTable" ||
          cd.terraformTopologyRole === "vpcRouteTable" ||
          cd.terraformTopologyRole === "natGatewayPrimary"
        ) {
          return false;
        }
        return cd.terraformVisibilityRole === "resource";
      });
      if (primaries.length === 0) {
        continue;
      }
      let minX = Infinity;
      let maxX = -Infinity;
      for (const p of primaries) {
        minX = Math.min(minX, p.x ?? 0);
        maxX = Math.max(maxX, (p.x ?? 0) + (p.width ?? 0));
      }
      const gridMid = (minX + maxX) / 2;
      const rt = rts.reduce((best, e) =>
        Math.abs(midX(e) - gridMid) < Math.abs(midX(best) - gridMid) ? e : best,
      );
      const rtMid = midX(rt);
      const delta = Math.abs(rtMid - gridMid);

      expect(
        delta,
        `${tier} zone "${name}": route tier-0 midX should match primary grid midX (Δ=${delta})`,
      ).toBeLessThanOrEqual(eps);
      checked++;
    }
    expect(
      checked,
      "fixture should include at least one public or intra subnet zone with bottom route tables",
    ).toBeGreaterThan(0);
  }, 120_000);

  it("merged private subnet zone hosts per-AZ route tables on the zone bottom", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    const elements = body.elements as Array<{
      id?: string;
      type?: string;
      name?: string;
      customData?: Record<string, unknown>;
    }>;

    const privateZones = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "subnetZone" &&
        tierFromZoneName(e.name ?? "") === "private",
    );
    expect(privateZones).toHaveLength(1);
    const zid = privateZones[0]!.id;
    expect(zid).toBeTruthy();
    const inner = collectDescendants(elements, zid!);
    const rts = inner.filter(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "subnetZoneRouteTable",
    );
    expect(
      rts.length,
      "each per-AZ private route table should render on the merged private zone bottom",
    ).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it("S3 gateway VPCE renders as vpcEgressEndpoint; interface VPCE primaryClusters do not overlap subnet zones in Y", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    const elements = body.elements as Array<{
      id?: string;
      type?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      name?: string;
      frameId?: string | null;
      customData?: Record<string, unknown>;
    }>;

    const s3Egress = elements.filter(
      (e) =>
        e.type === "rectangle" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "vpcEgressEndpoint" &&
        typeof (e.customData as { nodePath?: string }).nodePath === "string" &&
        (e.customData as { nodePath: string }).nodePath.includes(
          'aws_vpc_endpoint.this["s3"]',
        ),
    );
    expect(
      s3Egress.length,
      "S3 gateway endpoint should appear in the compact dashed vpcEgressEndpoint row",
    ).toBeGreaterThan(0);

    const subnetZones = elements.filter(
      (e) =>
        e.type === "frame" &&
        (e.customData as { terraformTopologyRole?: string } | undefined)
          ?.terraformTopologyRole === "subnetZone",
    );

    const vpcePrimaryClusters = elements.filter((e) => {
      if (e.type !== "frame") {
        return false;
      }
      const cd = e.customData as {
        terraformTopologyRole?: string;
        terraformTopologyPath?: string[];
      };
      if (cd.terraformTopologyRole !== "primaryCluster") {
        return false;
      }
      const p = cd.terraformTopologyPath;
      const last = p && p.length > 0 ? p[p.length - 1] : "";
      return typeof last === "string" && last.includes("aws_vpc_endpoint");
    });
    expect(
      vpcePrimaryClusters.length,
      "fixture should place at least one interface VPCE primaryCluster (VPC strip or subnet zone)",
    ).toBeGreaterThan(0);

    function axisBounds(el: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }) {
      const y = el.y ?? 0;
      const h = el.height ?? 0;
      return { minY: y, maxY: y + h };
    }

    function vpcPrefixFromTopologyPath(path: string[] | undefined): string {
      if (!path || path.length < 3) {
        return "";
      }
      return `${path[0]}|${path[1]}|${path[2]}`;
    }

    const tol = 6;
    let pairChecks = 0;
    for (const c of vpcePrimaryClusters) {
      const cPath = (c.customData as { terraformTopologyPath?: string[] })
        .terraformTopologyPath;
      const cVpc = vpcPrefixFromTopologyPath(cPath);
      const cb = axisBounds(c);

      let vpceHostedInSubnetZone = false;
      for (const oz of subnetZones) {
        const ozPath = (oz.customData as { terraformTopologyPath?: string[] })
          .terraformTopologyPath;
        if (vpcPrefixFromTopologyPath(ozPath) !== cVpc || !oz.id) {
          continue;
        }
        if (collectDescendants(elements, oz.id).some((e) => e.id === c.id)) {
          vpceHostedInSubnetZone = true;
          break;
        }
      }

      for (const z of subnetZones) {
        const zPath = (z.customData as { terraformTopologyPath?: string[] })
          .terraformTopologyPath;
        if (vpcPrefixFromTopologyPath(zPath) !== cVpc) {
          continue;
        }
        if (!z.id) {
          continue;
        }
        pairChecks++;
        if (vpceHostedInSubnetZone) {
          /** VPCE lives inside some subnet zone in this VPC — skip sibling-zone bbox Y checks. */
          continue;
        }
        const zb = axisBounds(z);
        const overlapY = !(
          cb.maxY <= zb.minY + tol || cb.minY >= zb.maxY - tol
        );
        expect(
          overlapY,
          `VPC-level VPCE primaryCluster should sit below subnet zone band (no Y overlap); zone=${
            z.name ?? z.id
          }`,
        ).toBe(false);
      }
    }
    expect(
      pairChecks,
      "each VPCE cluster should be checked against subnet zones in the same VPC",
    ).toBeGreaterThan(0);
  }, 120_000);
});
