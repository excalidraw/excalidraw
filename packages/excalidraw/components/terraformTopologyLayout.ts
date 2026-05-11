/**
 * Deterministic nested **frame** layout for AWS topology (`extractTerraformTopologyFromPlan`).
 */

import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { TerraformTopologyModel } from "./terraformTopologyExtract";

export type TerraformTopologySceneMeta = {
  layoutEngine: "topology";
  accountCount: number;
  regionCount: number;
  vpcCount: number;
  subnetCount: number;
  skippedLayout?: boolean;
  skipReason?: string;
};

const MARGIN = 50;
const ACCOUNT_GAP = 48;
const REGION_GAP = 32;
const VPC_GAP = 28;
/** Space below frame title before child grid (matches nested frame chrome). */
const VPC_TOP_PAD = 44;
/** Padding between a parent frame’s inner edge and laid-out children. */
const INNER_PAD = 28;
/** Extra slack so auto-sized parent frames do not clip children (title bar + rounding). */
const FRAME_CONTENT_SLACK_X = 24;
const FRAME_CONTENT_SLACK_Y = 28;
const MIN_SUBNET_W = 220;
const MIN_SUBNET_H = 160;
const MIN_VPC_W = 480;
const MIN_VPC_H = 360;
/** Minimum margin from outermost account frame to canvas when normalizing origin. */
const CANVAS_EDGE_PAD = MARGIN;

export type TerraformTopologyRole = "account" | "region" | "vpc" | "subnet";

function skeletonId(
  role: TerraformTopologyRole,
  accountId: string,
  region: string,
  vpcId: string | null,
  subnetId: string | null,
): string {
  if (role === "account") {
    return `tf-topo:a=${encodeURIComponent(accountId)}`;
  }
  const base = `tf-topo:a=${encodeURIComponent(accountId)}:r=${encodeURIComponent(region)}`;
  if (role === "region") {
    return base;
  }
  if (role === "vpc" && vpcId) {
    return `${base}:vpc=${encodeURIComponent(vpcId)}`;
  }
  if (role === "subnet" && vpcId && subnetId) {
    return `${base}:vpc=${encodeURIComponent(vpcId)}:sn=${encodeURIComponent(subnetId)}`;
  }
  return base;
}

function topologyPath(
  role: TerraformTopologyRole,
  accountId: string,
  region: string,
  vpcId: string | null,
  subnetId: string | null,
): string[] {
  if (role === "account") {
    return [accountId];
  }
  if (role === "region") {
    return [accountId, region];
  }
  if (role === "vpc" && vpcId) {
    return [accountId, region, vpcId];
  }
  if (role === "subnet" && vpcId && subnetId) {
    return [accountId, region, vpcId, subnetId];
  }
  return [accountId, region];
}

function frameCustomData(
  role: TerraformTopologyRole,
  accountId: string,
  region: string,
  vpcId: string | null,
  subnetId: string | null,
  key: string,
) {
  return {
    terraform: true as const,
    terraformTopologyRole: role,
    terraformTopologyKey: key,
    terraformTopologyPath: topologyPath(role, accountId, region, vpcId, subnetId),
  };
}

function gridColsRows(count: number): { cols: number; rows: number } {
  if (count <= 0) {
    return { cols: 1, rows: 1 };
  }
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/** Inner size needed for one VPC frame to hold its subnet grid (or empty minimum). */
function vpcInnerSize(subnetCount: number): { w: number; h: number } {
  if (subnetCount === 0) {
    return {
      w: MIN_VPC_W + FRAME_CONTENT_SLACK_X,
      h: MIN_VPC_H + FRAME_CONTENT_SLACK_Y,
    };
  }
  const { cols, rows } = gridColsRows(subnetCount);
  const w =
    2 * INNER_PAD +
    cols * (MIN_SUBNET_W + INNER_PAD) -
    INNER_PAD +
    FRAME_CONTENT_SLACK_X;
  const h =
    VPC_TOP_PAD +
    2 * INNER_PAD +
    rows * (MIN_SUBNET_H + INNER_PAD) -
    INNER_PAD +
    FRAME_CONTENT_SLACK_Y;
  return {
    w: Math.max(MIN_VPC_W + FRAME_CONTENT_SLACK_X, w),
    h: Math.max(MIN_VPC_H + FRAME_CONTENT_SLACK_Y, h),
  };
}

function countTopology(model: TerraformTopologyModel): {
  accounts: number;
  regions: number;
  vpcs: number;
  subnets: number;
} {
  let regions = 0;
  let vpcs = 0;
  let subnets = 0;
  for (const acc of model.accounts.values()) {
    regions += acc.regions.size;
    for (const reg of acc.regions.values()) {
      vpcs += reg.vpcs.size;
      for (const vpc of reg.vpcs.values()) {
        subnets += vpc.subnets.size;
      }
    }
  }
  return { accounts: model.accounts.size, regions, vpcs, subnets };
}

function shortLabel(kind: string, value: string): string {
  if (!value) {
    return kind;
  }
  const max = 52;
  return value.length > max ? `${kind}: ${value.slice(0, max - 3)}…` : `${kind}: ${value}`;
}

function normalizeTopologyOrigin(elements: readonly ExcalidrawElement[]) {
  let minX = Infinity;
  let minY = Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return;
  }
  const dx = CANVAS_EDGE_PAD - minX;
  const dy = CANVAS_EDGE_PAD - minY;
  if (dx === 0 && dy === 0) {
    return;
  }
  for (const el of elements) {
    (el as { x: number; y: number }).x = el.x + dx;
    (el as { x: number; y: number }).y = el.y + dy;
  }
}

/**
 * Builds nested Excalidraw frames (deepest-first skeleton order) for AWS topology.
 * Subnet and empty VPC shells use explicit minimum sizes; parents with children omit
 * width/height so `convertToExcalidrawElements` sizes them from child bounds.
 */
export async function buildTerraformTopologyExcalidrawScene(
  model: TerraformTopologyModel,
): Promise<{
  elements: ExcalidrawElement[];
  meta: TerraformTopologySceneMeta;
}> {
  const counts = countTopology(model);

  if (model.accounts.size === 0) {
    return {
      elements: [],
      meta: {
        layoutEngine: "topology",
        accountCount: 0,
        regionCount: 0,
        vpcCount: 0,
        subnetCount: 0,
        skippedLayout: true,
        skipReason: "empty_topology",
      },
    };
  }

  const skeleton: ExcalidrawElementSkeleton[] = [];

  let accountCursorX = MARGIN;
  const accountCursorY = MARGIN;

  const sortedAccounts = [...model.accounts.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [accountId, account] of sortedAccounts) {
    const accountSkId = skeletonId("account", accountId, "", null, null);
    const regionEntries = [...account.regions.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    let regionRowX = accountCursorX + INNER_PAD;
    const regionRowY = accountCursorY + VPC_TOP_PAD;
    let maxRegionBottom = regionRowY;
    let maxRegionRight = accountCursorX;

    const regionFrameIds: string[] = [];

    for (const [regionName, region] of regionEntries) {
      const vpcEntries = [...region.vpcs.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );

      if (vpcEntries.length === 0) {
        continue;
      }

      const regionSkId = skeletonId("region", accountId, regionName, null, null);
      regionFrameIds.push(regionSkId);

      let vpcCellW = MIN_VPC_W;
      let vpcCellH = MIN_VPC_H;
      for (const [, vpc] of vpcEntries) {
        const inner = vpcInnerSize(vpc.subnets.size);
        vpcCellW = Math.max(vpcCellW, inner.w);
        vpcCellH = Math.max(vpcCellH, inner.h);
      }

      const { cols: vpcCols, rows: vpcRows } = gridColsRows(vpcEntries.length);
      const vpcGridOriginX = regionRowX + INNER_PAD;
      const vpcGridOriginY = regionRowY + VPC_TOP_PAD;

      const vpcFrameIds: string[] = [];
      const emptyVpcShell = vpcInnerSize(0);

      for (let vi = 0; vi < vpcEntries.length; vi++) {
        const [vpcId, vpc] = vpcEntries[vi]!;
        const col = vi % vpcCols;
        const row = Math.floor(vi / vpcCols);
        const vpcX = vpcGridOriginX + col * (vpcCellW + VPC_GAP);
        const vpcY = vpcGridOriginY + row * (vpcCellH + VPC_GAP);
        const vpcSkId = skeletonId("vpc", accountId, regionName, vpcId, null);
        vpcFrameIds.push(vpcSkId);

        const subnetEntries = [...vpc.subnets.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        );

        if (subnetEntries.length === 0) {
          skeleton.push({
            type: "frame",
            id: vpcSkId,
            name: shortLabel("VPC", vpcId),
            x: vpcX,
            y: vpcY,
            width: emptyVpcShell.w,
            height: emptyVpcShell.h,
            children: [],
            customData: frameCustomData(
              "vpc",
              accountId,
              regionName,
              vpcId,
              null,
              vpcSkId,
            ),
          });
        } else {
          const subnetFrameIds: string[] = [];
          const { cols: snCols, rows: _snRows } = gridColsRows(
            subnetEntries.length,
          );
          void _snRows;

          for (let si = 0; si < subnetEntries.length; si++) {
            const [subnetId] = subnetEntries[si]!;
            const sc = si % snCols;
            const sr = Math.floor(si / snCols);
            const snX =
              vpcX + INNER_PAD + sc * (MIN_SUBNET_W + INNER_PAD);
            const snY =
              vpcY + VPC_TOP_PAD + sr * (MIN_SUBNET_H + INNER_PAD);
            const snSkId = skeletonId(
              "subnet",
              accountId,
              regionName,
              vpcId,
              subnetId,
            );
            subnetFrameIds.push(snSkId);
            skeleton.push({
              type: "frame",
              id: snSkId,
              name: shortLabel("Subnet", subnetId),
              x: snX,
              y: snY,
              width: MIN_SUBNET_W,
              height: MIN_SUBNET_H,
              children: [],
              customData: frameCustomData(
                "subnet",
                accountId,
                regionName,
                vpcId,
                subnetId,
                snSkId,
              ),
            });
          }

          skeleton.push({
            type: "frame",
            id: vpcSkId,
            name: shortLabel("VPC", vpcId),
            x: vpcX,
            y: vpcY,
            width: vpcCellW,
            height: vpcCellH,
            children: subnetFrameIds as readonly string[],
            customData: frameCustomData(
              "vpc",
              accountId,
              regionName,
              vpcId,
              null,
              vpcSkId,
            ),
          });
        }
      }

      const regionWidth =
        vpcCols * (vpcCellW + VPC_GAP) -
        VPC_GAP +
        2 * INNER_PAD +
        FRAME_CONTENT_SLACK_X;
      const regionHeight =
        vpcRows * (vpcCellH + VPC_GAP) -
        VPC_GAP +
        VPC_TOP_PAD +
        2 * INNER_PAD +
        FRAME_CONTENT_SLACK_Y;

      skeleton.push({
        type: "frame",
        id: regionSkId,
        name: shortLabel("Region", regionName),
        x: regionRowX,
        y: regionRowY,
        width: regionWidth,
        height: regionHeight,
        children: vpcFrameIds as readonly string[],
        customData: frameCustomData(
          "region",
          accountId,
          regionName,
          null,
          null,
          regionSkId,
        ),
      });

      maxRegionRight = Math.max(
        maxRegionRight,
        regionRowX + regionWidth + INNER_PAD,
      );
      maxRegionBottom = Math.max(
        maxRegionBottom,
        regionRowY + regionHeight + INNER_PAD,
      );
      regionRowX += regionWidth + REGION_GAP;
    }

    if (regionFrameIds.length === 0) {
      continue;
    }

    const accountWidth = Math.max(
      maxRegionRight - accountCursorX + INNER_PAD + FRAME_CONTENT_SLACK_X,
      MIN_VPC_W + 2 * INNER_PAD,
    );
    const accountHeight = Math.max(
      maxRegionBottom - accountCursorY + INNER_PAD + FRAME_CONTENT_SLACK_Y,
      MIN_VPC_H + 2 * INNER_PAD,
    );

    skeleton.push({
      type: "frame",
      id: accountSkId,
      name: shortLabel("Account", accountId),
      x: accountCursorX,
      y: accountCursorY,
      width: accountWidth,
      height: accountHeight,
      children: regionFrameIds as readonly string[],
      customData: frameCustomData(
        "account",
        accountId,
        "",
        null,
        null,
        accountSkId,
      ),
    });

    accountCursorX += accountWidth + ACCOUNT_GAP;
  }

  const elements = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  }) as ExcalidrawElement[];

  normalizeTopologyOrigin(elements);

  return {
    elements,
    meta: {
      layoutEngine: "topology",
      accountCount: counts.accounts,
      regionCount: counts.regions,
      vpcCount: counts.vpcs,
      subnetCount: counts.subnets,
    },
  };
}
