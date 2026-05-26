/**
 * Layout non-AWS (and multi-provider composition) provider frames for semantic import.
 */

import {
  convertToExcalidrawElements,
  newFrameElement,
} from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  applyTerraformResourceRectangleSoftDelete,
  buildTerraformResourceCardCustomData,
  getTerraformActionStyle,
  getTerraformPlanNodeAction,
  mirrorAndDetachTerraformResourceLabels,
  TERRAFORM_RESOURCE_LABEL_STROKE,
} from "./terraformElkLayout";
import { terraformResourceCardLabel } from "./terraformResourceCardLabel";

import {
  type TerraformProviderFamily,
  type TerraformResourceChangeLike,
  providerFamilySortOrder,
} from "./terraformProviderClassification";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

const px = (n: number) => n;

const MARGIN = px(50);
const INNER_PAD = px(28);
const BAND_GAP = px(24);
const RESOURCE_GAP = px(16);
const PROVIDER_GAP = px(64);
const PROVIDER_FRAME_PAD = px(32);
const PROVIDER_TITLE_PAD = px(40);
const RESOURCE_RECT_W = px(200);
const RESOURCE_RECT_H = px(88);
const MIN_BAND_W = px(480);
const MIN_BAND_H = px(160);

export type ProviderTopologyRole =
  | "provider"
  | "providerAccount"
  | "providerBand";

export type ProviderSceneMeta = {
  providerFamily: TerraformProviderFamily;
  resourceCount: number;
  accountCount: number;
};

type LayoutBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function tfComfortFontSize(n: number): number {
  return n;
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function resourceValues(
  rc: TerraformResourceChangeLike,
): Record<string, unknown> {
  const change = rc.change;
  if (!change) {
    return {};
  }
  if (
    change.after &&
    typeof change.after === "object" &&
    !Array.isArray(change.after)
  ) {
    return change.after as Record<string, unknown>;
  }
  if (
    change.before &&
    typeof change.before === "object" &&
    !Array.isArray(change.before)
  ) {
    return change.before as Record<string, unknown>;
  }
  return {};
}

function providerFrameCustomData(
  role: ProviderTopologyRole,
  family: TerraformProviderFamily,
  key: string,
  extras?: Record<string, unknown>,
) {
  return {
    terraform: true as const,
    terraformSemanticOverview: true as const,
    terraformTopologyRole: role,
    terraformTopologyKey: key,
    terraformProviderFamily: family,
    ...extras,
  };
}

function gridColsRows(count: number): { cols: number; rows: number } {
  if (count <= 0) {
    return { cols: 1, rows: 1 };
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

function growBounds(
  bounds: LayoutBounds | null,
  x: number,
  y: number,
  w: number,
  h: number,
): LayoutBounds {
  const maxX = x + w;
  const maxY = y + h;
  if (!bounds) {
    return { minX: x, minY: y, maxX, maxY };
  }
  return {
    minX: Math.min(bounds.minX, x),
    minY: Math.min(bounds.minY, y),
    maxX: Math.max(bounds.maxX, maxX),
    maxY: Math.max(bounds.maxY, maxY),
  };
}

function pushProviderResourceSkeleton(
  skeleton: ExcalidrawElementSkeleton[],
  addr: string,
  x: number,
  y: number,
  nodes: TerraformPlanNodesMap,
  family: TerraformProviderFamily,
  plan?: unknown,
): string {
  const node = nodes[addr] as TerraformPlanGraphNode | undefined;
  const resource = getPrimaryResource(node);
  const actionStyle = getTerraformActionStyle(getTerraformPlanNodeAction(node));

  skeleton.push({
    type: "rectangle",
    id: addr,
    x,
    y,
    width: RESOURCE_RECT_W,
    height: RESOURCE_RECT_H,
    strokeWidth: 1.5,
    strokeColor: actionStyle.strokeColor,
    backgroundColor: actionStyle.backgroundColor,
    strokeStyle: "solid",
    roundness: { type: 3, value: px(10) },
    label: {
      text: terraformResourceCardLabel(
        addr,
        resource as Record<string, unknown> | null,
      ),
      fontSize: tfComfortFontSize(12),
      strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
    },
    customData: {
      terraform: true,
      terraformSemanticOverview: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: addr,
      terraformNodeKind: "resource",
      terraformInitiallyVisible: true,
      terraformExplodeParentKeys: [],
      terraformExplodeParent: null,
      terraformExpandAllView: false,
      terraformProviderFamily: family,
      ...buildTerraformResourceCardCustomData(
        addr,
        resource as Record<string, unknown> | undefined,
        node,
        plan,
      ),
    },
  });
  return addr;
}

function layoutResourceGrid(
  skeleton: ExcalidrawElementSkeleton[],
  addresses: string[],
  originX: number,
  originY: number,
  nodes: TerraformPlanNodesMap,
  family: TerraformProviderFamily,
  plan?: unknown,
): { width: number; height: number; childIds: string[] } {
  const { cols, rows } = gridColsRows(addresses.length);
  const childIds: string[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = originX + col * (RESOURCE_RECT_W + RESOURCE_GAP);
    const y = originY + row * (RESOURCE_RECT_H + RESOURCE_GAP);
    childIds.push(
      pushProviderResourceSkeleton(
        skeleton,
        addresses[i],
        x,
        y,
        nodes,
        family,
        plan,
      ),
    );
  }
  const width = Math.max(
    MIN_BAND_W,
    cols * RESOURCE_RECT_W + Math.max(0, cols - 1) * RESOURCE_GAP,
  );
  const height = Math.max(
    MIN_BAND_H,
    rows * RESOURCE_RECT_H + Math.max(0, rows - 1) * RESOURCE_GAP,
  );
  return { width, height, childIds };
}

type CloudflareBand = "zone" | "pages" | "workers" | "other";

const CLOUDFLARE_BAND_LABELS: Record<CloudflareBand, string> = {
  zone: "Zone",
  pages: "Pages",
  workers: "Workers",
  other: "Other",
};

function cloudflareBandFor(rc: TerraformResourceChangeLike): CloudflareBand {
  const type = rc.type || "";
  if (type === "cloudflare_zone" || type === "cloudflare_dns_record") {
    return "zone";
  }
  if (type === "cloudflare_ruleset") {
    const values = resourceValues(rc);
    if (values.kind === "zone" || values.zone_id) {
      return "zone";
    }
    return "other";
  }
  if (type.startsWith("cloudflare_pages_")) {
    return "pages";
  }
  if (
    type.startsWith("cloudflare_workers_") ||
    type === "cloudflare_d1_database"
  ) {
    return "workers";
  }
  return "other";
}

function resolveCloudflareAccountContext(
  changes: readonly TerraformResourceChangeLike[],
): {
  zoneAccountById: Map<string, string>;
  primaryAccountId: string | null;
} {
  const zoneAccountById = new Map<string, string>();

  for (const rc of changes) {
    if (rc.type !== "cloudflare_zone") {
      continue;
    }
    const values = resourceValues(rc);
    const zoneId =
      typeof values.id === "string"
        ? values.id
        : typeof values.zone_id === "string"
        ? values.zone_id
        : null;
    const direct = values.account_id;
    const accountObj = values.account;
    const accountId =
      typeof direct === "string" && direct.trim()
        ? direct.trim()
        : accountObj &&
          typeof accountObj === "object" &&
          typeof (accountObj as { id?: unknown }).id === "string"
        ? ((accountObj as { id: string }).id as string).trim()
        : null;
    if (zoneId && accountId) {
      zoneAccountById.set(zoneId, accountId);
    }
  }

  const accountCounts = new Map<string, number>();
  for (const rc of changes) {
    const accountId = cloudflareAccountId(rc, zoneAccountById, null);
    if (accountId !== "unknown-account") {
      accountCounts.set(accountId, (accountCounts.get(accountId) ?? 0) + 1);
    }
  }

  const sortedAccounts = [...accountCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  return {
    zoneAccountById,
    primaryAccountId: sortedAccounts[0]?.[0] ?? null,
  };
}

function cloudflareAccountId(
  rc: TerraformResourceChangeLike,
  zoneAccountById: Map<string, string>,
  primaryAccountId: string | null,
): string {
  const values = resourceValues(rc);
  const direct = values.account_id;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const account = values.account;
  if (account && typeof account === "object" && !Array.isArray(account)) {
    const id = (account as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }
  }
  const zoneId = values.zone_id;
  if (typeof zoneId === "string" && zoneAccountById.has(zoneId)) {
    return zoneAccountById.get(zoneId)!;
  }
  if (primaryAccountId) {
    return primaryAccountId;
  }
  return "unknown-account";
}

function shortAccountLabel(accountId: string): string {
  if (accountId === "unknown-account") {
    return "Account";
  }
  if (accountId.length <= 12) {
    return `Account ${accountId}`;
  }
  return `Account ${accountId.slice(0, 8)}…`;
}

async function finalizeProviderSkeleton(
  skeleton: ExcalidrawElementSkeleton[],
): Promise<ExcalidrawElement[]> {
  let elements = convertToExcalidrawElements(skeleton, {
    regenerateIds: false,
  }) as ExcalidrawElement[];

  elements = applyTerraformResourceRectangleSoftDelete(elements, {
    semanticAllVisible: true,
  });
  elements = mirrorAndDetachTerraformResourceLabels(elements);
  elements = reconcileTerraformVisibility(
    repairTerraformEdgeBindings(elements),
    {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: null,
    },
  );
  return elements;
}

export async function buildCloudflareProviderScene(
  changes: readonly TerraformResourceChangeLike[],
  nodes: TerraformPlanNodesMap,
  plan?: unknown,
): Promise<{ elements: ExcalidrawElement[]; meta: ProviderSceneMeta }> {
  if (changes.length === 0) {
    return {
      elements: [],
      meta: { providerFamily: "cloudflare", resourceCount: 0, accountCount: 0 },
    };
  }

  const byAccount = new Map<string, Map<CloudflareBand, string[]>>();
  const accountContext = resolveCloudflareAccountContext(changes);
  for (const rc of changes) {
    const address = rc.address;
    if (typeof address !== "string" || !address) {
      continue;
    }
    const accountId = cloudflareAccountId(
      rc,
      accountContext.zoneAccountById,
      accountContext.primaryAccountId,
    );
    const band = cloudflareBandFor(rc);
    let accountMap = byAccount.get(accountId);
    if (!accountMap) {
      accountMap = new Map();
      byAccount.set(accountId, accountMap);
    }
    const list = accountMap.get(band) ?? [];
    list.push(address);
    accountMap.set(band, list);
  }

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const bandOrder: CloudflareBand[] = ["zone", "pages", "workers", "other"];
  let accountCursorY = MARGIN;

  for (const [accountId, bands] of [...byAccount.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const accountSkId = `tf-provider:cloudflare:account:${encodeURIComponent(
      accountId,
    )}`;
    let bandCursorY = accountCursorY + INNER_PAD + PROVIDER_TITLE_PAD;
    const bandFrameIds: string[] = [];
    let accountBounds: LayoutBounds | null = null;

    for (const band of bandOrder) {
      const addresses = (bands.get(band) ?? []).sort();
      if (addresses.length === 0) {
        continue;
      }
      const bandSkId = `${accountSkId}:band:${band}`;
      const grid = layoutResourceGrid(
        skeleton,
        addresses,
        MARGIN + INNER_PAD,
        bandCursorY,
        nodes,
        "cloudflare",
        plan,
      );
      skeleton.push({
        type: "frame",
        id: bandSkId,
        name: CLOUDFLARE_BAND_LABELS[band],
        x: MARGIN + INNER_PAD - px(8),
        y: bandCursorY - px(8),
        width: grid.width + px(16),
        height: grid.height + px(16),
        children: grid.childIds as readonly string[],
        customData: providerFrameCustomData(
          "providerBand",
          "cloudflare",
          bandSkId,
          { terraformProviderBand: band },
        ),
      });
      bandFrameIds.push(bandSkId);
      accountBounds = growBounds(
        accountBounds,
        MARGIN + INNER_PAD - px(8),
        bandCursorY - px(8),
        grid.width + px(16),
        grid.height + px(16),
      );
      bandCursorY += grid.height + px(16) + BAND_GAP;
    }

    if (bandFrameIds.length === 0) {
      continue;
    }

    const b = accountBounds!;
    const accountWidth = b.maxX - b.minX + 2 * INNER_PAD;
    const accountHeight = b.maxY - b.minY + 2 * INNER_PAD + PROVIDER_TITLE_PAD;

    skeleton.push({
      type: "frame",
      id: accountSkId,
      name: shortAccountLabel(accountId),
      x: MARGIN,
      y: accountCursorY,
      width: accountWidth,
      height: accountHeight,
      children: bandFrameIds as readonly string[],
      customData: providerFrameCustomData(
        "providerAccount",
        "cloudflare",
        accountSkId,
        { terraformProviderAccountId: accountId },
      ),
    });

    accountCursorY += accountHeight + BAND_GAP;
  }

  const elements = await finalizeProviderSkeleton(skeleton);
  return {
    elements,
    meta: {
      providerFamily: "cloudflare",
      resourceCount: changes.length,
      accountCount: byAccount.size,
    },
  };
}

export async function buildGenericProviderScene(
  family: TerraformProviderFamily,
  label: string,
  changes: readonly TerraformResourceChangeLike[],
  nodes: TerraformPlanNodesMap,
  plan?: unknown,
): Promise<{ elements: ExcalidrawElement[]; meta: ProviderSceneMeta }> {
  if (changes.length === 0) {
    return {
      elements: [],
      meta: { providerFamily: family, resourceCount: 0, accountCount: 0 },
    };
  }

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const addresses = changes
    .map((rc) => rc.address)
    .filter((a): a is string => typeof a === "string" && a.length > 0)
    .sort();

  const accountSkId = `tf-provider:${family}:account:default`;
  const grid = layoutResourceGrid(
    skeleton,
    addresses,
    MARGIN + INNER_PAD,
    MARGIN + INNER_PAD + PROVIDER_TITLE_PAD,
    nodes,
    family,
    plan,
  );

  skeleton.push({
    type: "frame",
    id: accountSkId,
    name: label,
    x: MARGIN,
    y: MARGIN,
    width: grid.width + 2 * INNER_PAD,
    height: grid.height + 2 * INNER_PAD + PROVIDER_TITLE_PAD,
    children: grid.childIds as readonly string[],
    customData: providerFrameCustomData("providerAccount", family, accountSkId),
  });

  const elements = await finalizeProviderSkeleton(skeleton);
  return {
    elements,
    meta: {
      providerFamily: family,
      resourceCount: changes.length,
      accountCount: 1,
    },
  };
}

function elementBounds(
  elements: readonly ExcalidrawElement[],
): LayoutBounds | null {
  let bounds: LayoutBounds | null = null;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    const w = "width" in el ? (el as { width: number }).width : 0;
    const h = "height" in el ? (el as { height: number }).height : 0;
    bounds = growBounds(bounds, el.x, el.y, w, h);
  }
  return bounds;
}

function shiftElements(elements: ExcalidrawElement[], dx: number, dy: number) {
  if (dx === 0 && dy === 0) {
    return;
  }
  for (const el of elements) {
    (el as { x: number; y: number }).x = el.x + dx;
    (el as { y: number }).y = el.y + dy;
  }
}

function topLevelFrameChildIds(
  elements: readonly ExcalidrawElement[],
): string[] {
  const ids = new Set(elements.map((e) => e.id));
  const childIds = new Set<string>();
  for (const el of elements) {
    if (el.type === "frame") {
      const children = (el as { children?: readonly { id: string }[] })
        .children;
      if (Array.isArray(children)) {
        for (const child of children) {
          if (child?.id) {
            childIds.add(child.id);
          }
        }
      }
    }
  }

  const accountFrames = elements
    .filter(
      (el) =>
        el.type === "frame" &&
        (el.customData?.terraformTopologyRole === "account" ||
          el.customData?.terraformTopologyRole === "providerAccount"),
    )
    .map((el) => el.id);

  if (accountFrames.length > 0) {
    return accountFrames;
  }

  return elements
    .filter(
      (el) =>
        ids.has(el.id) &&
        !childIds.has(el.id) &&
        el.type !== "arrow" &&
        el.type !== "line",
    )
    .map((el) => el.id);
}

export type ProviderTopologyBlock = {
  family: TerraformProviderFamily;
  label: string;
  elements: ExcalidrawElement[];
};

/** Lay out provider blocks side-by-side and wrap each in a labeled provider frame. */
export function composeMultiProviderTopologyScene(
  blocks: readonly ProviderTopologyBlock[],
): ExcalidrawElement[] {
  const nonEmpty = blocks.filter((b) => b.elements.length > 0);
  if (nonEmpty.length === 0) {
    return [];
  }
  if (nonEmpty.length === 1) {
    const block = nonEmpty[0];
    return wrapProviderBlock(block.family, block.label, block.elements);
  }

  const sorted = [...nonEmpty].sort(
    (a, b) =>
      providerFamilySortOrder(a.family) - providerFamilySortOrder(b.family),
  );

  let cursorX = MARGIN;
  const cursorY = MARGIN;
  const composed: ExcalidrawElement[] = [];

  for (const block of sorted) {
    const wrapped = wrapProviderBlock(
      block.family,
      block.label,
      block.elements,
      {
        originX: cursorX,
        originY: cursorY,
      },
    );
    const bounds = elementBounds(wrapped);
    if (bounds) {
      cursorX = bounds.maxX + PROVIDER_GAP;
    }
    composed.push(...wrapped);
  }

  return composed;
}

function wrapProviderBlock(
  family: TerraformProviderFamily,
  label: string,
  elements: ExcalidrawElement[],
  offset?: { originX: number; originY: number },
): ExcalidrawElement[] {
  const bounds = elementBounds(elements);
  if (!bounds) {
    return elements;
  }

  const targetX = offset?.originX ?? MARGIN;
  const targetY = offset?.originY ?? MARGIN;
  const dx = targetX + PROVIDER_FRAME_PAD - bounds.minX;
  const dy = targetY + PROVIDER_FRAME_PAD + PROVIDER_TITLE_PAD - bounds.minY;
  shiftElements(elements, dx, dy);

  const shiftedBounds = elementBounds(elements)!;
  const providerSkId = `tf-provider:${family}:root`;
  const childIds = topLevelFrameChildIds(elements);

  const frame = newFrameElement({
    x: shiftedBounds.minX - PROVIDER_FRAME_PAD,
    y: shiftedBounds.minY - PROVIDER_FRAME_PAD - PROVIDER_TITLE_PAD,
    width: shiftedBounds.maxX - shiftedBounds.minX + 2 * PROVIDER_FRAME_PAD,
    height:
      shiftedBounds.maxY -
      shiftedBounds.minY +
      2 * PROVIDER_FRAME_PAD +
      PROVIDER_TITLE_PAD,
    name: label,
    customData: providerFrameCustomData("provider", family, providerSkId),
  });

  for (const childId of childIds) {
    const child = elements.find((el) => el.id === childId);
    if (child) {
      (child as { frameId?: string | null }).frameId = frame.id;
    }
  }

  return [...elements, frame];
}

export async function buildProviderFamilyScene(
  family: TerraformProviderFamily,
  label: string,
  changes: readonly TerraformResourceChangeLike[],
  nodes: TerraformPlanNodesMap,
  plan?: unknown,
): Promise<{ elements: ExcalidrawElement[]; meta: ProviderSceneMeta }> {
  if (family === "cloudflare") {
    return buildCloudflareProviderScene(changes, nodes, plan);
  }
  return buildGenericProviderScene(family, label, changes, nodes, plan);
}
