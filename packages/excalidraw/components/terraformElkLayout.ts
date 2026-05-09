/**
 * ELK layout for browser-side Terraform plan import (`terraformPlanParsing`).
 *
 * ## Plan
 *
 * 1. **Hierarchical graph** — Walk `TerraformModuleTreeNode` (from
 *    `nodes[TERRAFORM_MODULE_TREE_KEY]`) and emit one ELK *compound* node per Terraform module
 *    (including synthetic `path: "root"`). Resources that exist in `nodes` become fixed-size
 *    leaf rectangles inside the owning module compound. Child modules nest recursively so ELK’s
 *    `INCLUDE_CHILDREN` layered algorithm matches module containment.
 *
 * 2. **Edges** — Use `edges_new` (DOT-derived) as directed edges. Endpoints are resolved the same
 *    way as `resolveCanonicalNodePath` (exact address, then index-stripped key). Unknown
 *    endpoints are skipped. Antiparallel duplicates are collapsed to one edge.
 *
 * 3. **ELK options** — Align with `packages/backend/excalidraw-layout.js`: layered, RIGHT,
 *    `INCLUDE_CHILDREN`, generous spacing, separate components.
 *
 * 4. **Geometry** — Read ELK’s hierarchical coordinates (child `x`/`y` are **relative to
 *    parent**). Then **per module (deepest first)**: lay direct **submodules** in a horizontal
 *    row, lay **resources** in a **grid** under that row, and **shrink-wrap** the compound so
 *    nested boxes stay non-overlapping. Finally normalize the global origin.
 *
 * 5. **Excalidraw** — Emit **frames** per module, resource rectangles, and bound **arrows**
 *    (`convertToExcalidrawElements`).
 *
 * 6. **Scale guard** — Very large graphs skip layout so the main thread stays responsive; callers
 *    read `meta.skippedLayout` / `meta.skipReason`.
 */

/** Browser / Vite-safe build: default `elkjs` entry pulls optional `web-worker` (see elkjs `lib/main.js`). */
import ELK from "elkjs/lib/elk.bundled.js";
import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import type {
  TerraformModuleTreeNode,
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

/** Align with backend `packages/backend/excalidraw-layout.js` defaults. */
const ELK_ROOT_LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.spacing.nodeNodeBetweenLayers": "140",
  "elk.layered.spacing.edgeNodeBetweenLayers": "60",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "30",
  "elk.spacing.nodeNode": "120",
  "elk.spacing.edgeNode": "40",
  "elk.spacing.componentComponent": "200",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.layered.thoroughness": "10",
  "elk.padding": "[top=40,left=40,bottom=40,right=40]",
  "elk.separateConnectedComponents": "true",
};

const ELK_MODULE_COMPOUND_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.spacing.nodeNodeBetweenLayers": "140",
  "elk.spacing.nodeNode": "120",
  "elk.padding": "[top=140,left=100,bottom=100,right=100]",
};

const MODULE_COMPOUND_PREFIX = "__tf_m__:";

const DEFAULT_RESOURCE_RECT = { w: 200, h: 88 };

const GRID_GAP_X = 20;
const GRID_GAP_Y = 20;
const SUBMODULE_GAP_X = 32;
const SUBMODULE_GAP_Y = 32;
const MODULE_CONTENT_PAD_L = 28;
const MODULE_CONTENT_PAD_T = 40;
const MODULE_SHRINK_WRAP_PAD = 24;

/** Excalidraw frame id for a Terraform module path (`root`, `module.a`, …). */
function moduleFrameSkeletonId(modulePath: string) {
  return `tf-frame:${modulePath}`;
}

/** Above this many graph vertices, skip ELK to avoid long main-thread stalls. */
export const TERRAFORM_ELK_MAX_VERTICES = 600;

export type TerraformElkSceneMeta = {
  layoutEngine: "elk";
  vertexCount: number;
  edgeCount: number;
  skippedLayout?: boolean;
  skipReason?: string;
};

type ElkJsonNode = {
  id: string;
  width?: number;
  height?: number;
  layoutOptions?: Record<string, string>;
  children?: ElkJsonNode[];
};

type ElkJsonEdge = {
  id: string;
  sources: string[];
  targets: string[];
};

type ElkLayoutedNode = {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkLayoutedNode[];
};

function stripIndexes(address: string) {
  return address.replace(/\[[^\]]+\]/g, "");
}

function resolveVertexId(
  nodes: TerraformPlanNodesMap,
  address: string,
): string | null {
  if (!address || address === TERRAFORM_MODULE_TREE_KEY) {
    return null;
  }
  if (nodes[address]) {
    return address;
  }
  const stripped = stripIndexes(address);
  if (nodes[stripped]) {
    return stripped;
  }
  return null;
}

function moduleCompoundId(modulePath: string) {
  return `${MODULE_COMPOUND_PREFIX}${modulePath}`;
}

function collectGraphVertexIds(nodes: TerraformPlanNodesMap): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(nodes)) {
    if (key === TERRAFORM_MODULE_TREE_KEY || key.startsWith("__")) {
      continue;
    }
    out.add(key);
  }
  return out;
}

function collectDirectedEdges(
  nodes: TerraformPlanNodesMap,
  vertexSet: Set<string>,
): { source: string; target: string }[] {
  const edges: { source: string; target: string }[] = [];
  const seen = new Set<string>();

  for (const sourceRaw of vertexSet) {
    const node = nodes[sourceRaw] as TerraformPlanGraphNode | undefined;
    const outs = node?.edges_new || [];
    for (const targetRaw of outs) {
      const source = resolveVertexId(nodes, sourceRaw);
      const target = resolveVertexId(nodes, targetRaw);
      if (!source || !target || source === target) {
        continue;
      }
      if (!vertexSet.has(source) || !vertexSet.has(target)) {
        continue;
      }
      const key = `${source}|||${target}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      edges.push({ source, target });
    }
  }

  return edges;
}

function buildModuleCompound(
  mod: TerraformModuleTreeNode,
  vertexSet: Set<string>,
): ElkJsonNode | null {
  const children: ElkJsonNode[] = [];

  for (const childPath of Object.keys(mod.modules).sort()) {
    const nested = buildModuleCompound(mod.modules[childPath], vertexSet);
    if (nested) {
      children.push(nested);
    }
  }

  for (const addr of mod.resourceAddresses) {
    if (!vertexSet.has(addr)) {
      continue;
    }
    children.push({
      id: addr,
      width: DEFAULT_RESOURCE_RECT.w,
      height: DEFAULT_RESOURCE_RECT.h,
    });
  }

  if (children.length === 0) {
    return null;
  }

  return {
    id: moduleCompoundId(mod.path),
    layoutOptions: { ...ELK_MODULE_COMPOUND_OPTIONS },
    children,
  };
}

function shortResourceLabel(address: string): string {
  const withoutModules = address.replace(/^(?:module\.[^.]+\.)+/, "");
  return withoutModules.length > 52
    ? `${withoutModules.slice(0, 49)}…`
    : withoutModules;
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, any> {
  return (Object.values(node?.resources || {})[0] || {}) as Record<string, any>;
}

function getResourceTypeFromAddress(address: string) {
  const withoutModules = address.replace(/^(?:module\.[^.]+\.)+/, "");
  const parts = withoutModules.split(".");
  return parts[0] || "";
}

function getTerraformAction(resource: Record<string, any>) {
  const actions = resource.change?.actions;
  if (Array.isArray(actions)) {
    const actionSet = new Set(actions);
    if (actionSet.has("delete") && actionSet.has("create")) {
      return "replace";
    }
    return actions[0] || "existing";
  }
  return typeof actions === "string" && actions ? actions : "existing";
}

const TERRAFORM_ACTION_STYLES: Record<
  string,
  { backgroundColor: string; strokeColor: string }
> = {
  create: { backgroundColor: "#d3f9d8", strokeColor: "#2b8a3e" },
  delete: { backgroundColor: "#ffe3e3", strokeColor: "#c92a2a" },
  update: { backgroundColor: "#fff3bf", strokeColor: "#e67700" },
  replace: { backgroundColor: "#ffe8cc", strokeColor: "#f08c00" },
  "no-op": { backgroundColor: "#e7f5ff", strokeColor: "#1971c2" },
  existing: { backgroundColor: "#f8f9fa", strokeColor: "#868e96" },
  read: { backgroundColor: "#f8f9fa", strokeColor: "#868e96" },
  external: { backgroundColor: "#f8f9fa", strokeColor: "#868e96" },
};

function getTerraformActionStyle(action: string) {
  return TERRAFORM_ACTION_STYLES[action] || TERRAFORM_ACTION_STYLES.existing;
}

const UNKNOWN_VALUE_PLACEHOLDER = "Known after apply";

const HIDDEN_ATTRIBUTES_BY_TYPE: Record<string, Set<string>> = {
  aws_iam_role_policy: new Set(["id", "name_prefix"]),
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCurrentResourceConfig(resource: Record<string, any>) {
  const change = resource.change || {};
  if (isPlainObject(change.after)) {
    return change.after;
  }
  if (isPlainObject(resource.values)) {
    return resource.values;
  }
  if (isPlainObject(change.before)) {
    return change.before;
  }
  return {};
}

function isDisplayableConfigValue(value: unknown) {
  return (
    value !== null &&
    typeof value !== "undefined" &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0) &&
    !(isPlainObject(value) && Object.keys(value).length === 0)
  );
}

function hasUnknownAfterMarker(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasUnknownAfterMarker(entry));
  }
  if (isPlainObject(value)) {
    return Object.values(value).some((entry) => hasUnknownAfterMarker(entry));
  }
  return false;
}

function getUnknownTopLevelKeys(afterUnknown: unknown) {
  if (!isPlainObject(afterUnknown)) {
    return [];
  }
  return Object.entries(afterUnknown)
    .filter(([, marker]) => hasUnknownAfterMarker(marker))
    .map(([key]) => key);
}

function shouldHideTerraformAttribute(resourceType: string, key: string) {
  const hidden = HIDDEN_ATTRIBUTES_BY_TYPE[resourceType];
  return Boolean(hidden && hidden.has(key));
}

function computeLocalResourceDiff(
  beforeRaw: unknown,
  afterRaw: unknown,
): Record<string, { before: unknown; after: unknown }> {
  const before = isPlainObject(beforeRaw) ? beforeRaw : {};
  const after = isPlainObject(afterRaw) ? afterRaw : {};
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const inBefore = Object.prototype.hasOwnProperty.call(before, key);
    const inAfter = Object.prototype.hasOwnProperty.call(after, key);
    const beforeValue = before[key];
    const afterValue = after[key];

    if (inBefore && !inAfter) {
      if (beforeValue !== null) {
        diff[key] = { before: beforeValue, after: null };
      }
      continue;
    }

    if (!inBefore && inAfter) {
      if (isDisplayableConfigValue(afterValue)) {
        diff[key] = { before: null, after: afterValue };
      }
      continue;
    }

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = { before: beforeValue, after: afterValue };
    }
  }

  return diff;
}

function getLocalResourceDiff(change: Record<string, any>) {
  if (isPlainObject(change.diff)) {
    return change.diff as Record<string, { before?: unknown; after?: unknown }>;
  }
  return computeLocalResourceDiff(change.before, change.after);
}

function buildLocalTerraformResourceDetails(
  address: string,
  resource: Record<string, any>,
) {
  const change = resource.change || {};
  const config = getCurrentResourceConfig(resource);
  const diff = getLocalResourceDiff(change);
  const resourceType = resource.type || getResourceTypeFromAddress(address);
  const unknownAfterKeys = getUnknownTopLevelKeys(change.after_unknown || {});
  const unknownAfterSet = new Set(unknownAfterKeys);
  const keys = new Set([
    ...Object.keys(config),
    ...Object.keys(diff),
    ...unknownAfterKeys,
  ]);
  const attributes = [...keys]
    .filter((key) => {
      if (shouldHideTerraformAttribute(resourceType, key)) {
        return false;
      }
      return (
        isDisplayableConfigValue(config[key]) ||
        Boolean(diff[key]) ||
        unknownAfterSet.has(key)
      );
    })
    .sort((a, b) => {
      const aUnknown = unknownAfterSet.has(a) ? 0 : 1;
      const bUnknown = unknownAfterSet.has(b) ? 0 : 1;
      if (aUnknown !== bUnknown) {
        return aUnknown - bUnknown;
      }

      const aChanged = diff[a] ? 0 : 1;
      const bChanged = diff[b] ? 0 : 1;
      return aChanged - bChanged || a.localeCompare(b);
    })
    .map((key) => {
      const fieldDiff = diff[key];
      const unknownAfter = unknownAfterSet.has(key);
      return {
        key,
        value: Object.prototype.hasOwnProperty.call(config, key)
          ? config[key]
          : unknownAfter
            ? UNKNOWN_VALUE_PLACEHOLDER
            : fieldDiff?.after ?? null,
        changed: Boolean(fieldDiff),
        unknownAfter,
        before: fieldDiff?.before,
        after: fieldDiff?.after,
      };
    });

  return [
    {
      address: resource.address || address,
      type: resourceType,
      name: resource.name || "",
      mode: resource.mode || "",
      actions: change.actions || [],
      attributes,
    },
  ];
}

type LayoutBox = { x: number; y: number; width: number; height: number };

/** Collects absolute layout for resource leaves and `__tf_m__:*` module compounds. */
function collectElkLayoutBoxes(
  node: ElkLayoutedNode,
  baseX: number,
  baseY: number,
  vertexSet: Set<string>,
  out: Record<string, LayoutBox>,
) {
  const x = (node.x ?? 0) + baseX;
  const y = (node.y ?? 0) + baseY;
  const id = node.id || "";
  if (vertexSet.has(id)) {
    out[id] = {
      x,
      y,
      width: node.width ?? DEFAULT_RESOURCE_RECT.w,
      height: node.height ?? DEFAULT_RESOURCE_RECT.h,
    };
  } else if (id.startsWith(MODULE_COMPOUND_PREFIX)) {
    out[id] = {
      x,
      y,
      width: node.width ?? 0,
      height: node.height ?? 0,
    };
  }
  for (const child of node.children || []) {
    collectElkLayoutBoxes(child, x, y, vertexSet, out);
  }
}

function collectSubtreeModulePaths(mod: TerraformModuleTreeNode): string[] {
  const out = [mod.path];
  for (const path of Object.keys(mod.modules).sort()) {
    out.push(...collectSubtreeModulePaths(mod.modules[path]));
  }
  return out;
}

function collectSubtreeResourceAddresses(
  mod: TerraformModuleTreeNode,
  vertexSet: Set<string>,
): string[] {
  const out: string[] = [];
  for (const addr of mod.resourceAddresses) {
    if (vertexSet.has(addr)) {
      out.push(addr);
    }
  }
  for (const path of Object.keys(mod.modules).sort()) {
    out.push(...collectSubtreeResourceAddresses(mod.modules[path], vertexSet));
  }
  return out;
}

function translateModuleSubtree(
  layoutBoxes: Record<string, LayoutBox>,
  subRoot: TerraformModuleTreeNode,
  dx: number,
  dy: number,
  vertexSet: Set<string>,
) {
  for (const path of collectSubtreeModulePaths(subRoot)) {
    const cid = moduleCompoundId(path);
    const b = layoutBoxes[cid];
    if (b) {
      b.x += dx;
      b.y += dy;
    }
  }
  for (const addr of collectSubtreeResourceAddresses(subRoot, vertexSet)) {
    const b = layoutBoxes[addr];
    if (b) {
      b.x += dx;
      b.y += dy;
    }
  }
}

/** Places submodule compounds in a wrapped row, then resources in a sqrt-based grid. */
function applyModuleGridLayout(
  mod: TerraformModuleTreeNode,
  vertexSet: Set<string>,
  layoutBoxes: Record<string, LayoutBox>,
) {
  const compoundId = moduleCompoundId(mod.path);
  const compound = layoutBoxes[compoundId];
  if (!compound) {
    return;
  }

  const innerLeft = compound.x + MODULE_CONTENT_PAD_L;
  const innerTop = compound.y + MODULE_CONTENT_PAD_T;
  const innerRight = compound.x + compound.width - MODULE_CONTENT_PAD_L;
  const innerWidth = Math.max(0, innerRight - innerLeft);

  const subPaths = Object.keys(mod.modules).sort();
  const resourceAddrs = mod.resourceAddresses.filter((a) => vertexSet.has(a)).sort();

  let cursorX = innerLeft;
  let cursorY = innerTop;
  let subRowMaxH = 0;

  for (const p of subPaths) {
    const childCompoundId = moduleCompoundId(p);
    const cb = layoutBoxes[childCompoundId];
    if (!cb) {
      continue;
    }
    if (cursorX + cb.width > innerLeft + innerWidth && cursorX > innerLeft) {
      cursorX = innerLeft;
      cursorY += subRowMaxH + SUBMODULE_GAP_Y;
      subRowMaxH = 0;
    }
    const dx = cursorX - cb.x;
    const dy = cursorY - cb.y;
    translateModuleSubtree(layoutBoxes, mod.modules[p], dx, dy, vertexSet);
    cursorX += cb.width + SUBMODULE_GAP_X;
    subRowMaxH = Math.max(subRowMaxH, cb.height);
  }

  const resourceStartY =
    subPaths.length > 0 ? cursorY + subRowMaxH + SUBMODULE_GAP_Y : innerTop;

  const cellW = DEFAULT_RESOURCE_RECT.w;
  const cellH = DEFAULT_RESOURCE_RECT.h;
  const n = resourceAddrs.length;
  if (n === 0) {
    return;
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const b = layoutBoxes[resourceAddrs[i]];
    if (!b) {
      continue;
    }
    b.x = innerLeft + col * (cellW + GRID_GAP_X);
    b.y = resourceStartY + row * (cellH + GRID_GAP_Y);
    b.width = cellW;
    b.height = cellH;
  }
}

function shrinkWrapModuleCompound(
  mod: TerraformModuleTreeNode,
  vertexSet: Set<string>,
  layoutBoxes: Record<string, LayoutBox>,
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const bump = (b: LayoutBox) => {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  };

  for (const addr of mod.resourceAddresses) {
    if (!vertexSet.has(addr)) {
      continue;
    }
    const b = layoutBoxes[addr];
    if (b) {
      bump(b);
    }
  }
  for (const p of Object.keys(mod.modules)) {
    const b = layoutBoxes[moduleCompoundId(p)];
    if (b) {
      bump(b);
    }
  }

  if (!Number.isFinite(minX)) {
    return;
  }

  const cid = moduleCompoundId(mod.path);
  const c = layoutBoxes[cid];
  if (!c) {
    return;
  }

  const pad = MODULE_SHRINK_WRAP_PAD;
  c.x = minX - pad;
  c.y = minY - pad;
  c.width = maxX - minX + 2 * pad;
  c.height = maxY - minY + 2 * pad;
}

/** Deepest modules first: grid children, then shrink-wrap compound to fit. */
function layoutModuleGeometryDeep(
  mod: TerraformModuleTreeNode,
  vertexSet: Set<string>,
  layoutBoxes: Record<string, LayoutBox>,
) {
  for (const path of Object.keys(mod.modules).sort()) {
    layoutModuleGeometryDeep(mod.modules[path], vertexSet, layoutBoxes);
  }
  applyModuleGridLayout(mod, vertexSet, layoutBoxes);
  shrinkWrapModuleCompound(mod, vertexSet, layoutBoxes);
}

function frameTitleForModulePath(modulePath: string): string {
  if (modulePath === "root") {
    return "Root module";
  }
  return modulePath.length > 56 ? `${modulePath.slice(0, 53)}…` : modulePath;
}

/** Direct frame children: resources in this module, then nested module frames (sorted). */
function moduleFrameChildIds(mod: TerraformModuleTreeNode, vertexSet: Set<string>): string[] {
  const ids: string[] = [];
  for (const addr of [...mod.resourceAddresses].sort()) {
    if (vertexSet.has(addr)) {
      ids.push(addr);
    }
  }
  for (const path of Object.keys(mod.modules).sort()) {
    ids.push(moduleFrameSkeletonId(path));
  }
  return ids;
}

/** Post-order so inner module frames appear before outer frames in the skeleton array. */
function pushModuleFrameSkeletonsPostOrder(
  mod: TerraformModuleTreeNode,
  vertexSet: Set<string>,
  layoutBoxes: Record<string, LayoutBox>,
  out: ExcalidrawElementSkeleton[],
) {
  for (const path of Object.keys(mod.modules).sort()) {
    pushModuleFrameSkeletonsPostOrder(mod.modules[path], vertexSet, layoutBoxes, out);
  }
  const children = moduleFrameChildIds(mod, vertexSet);
  if (children.length === 0) {
    return;
  }
  const box = layoutBoxes[moduleCompoundId(mod.path)];
  if (!box) {
    return;
  }
  out.push({
    type: "frame",
    id: moduleFrameSkeletonId(mod.path),
    name: frameTitleForModulePath(mod.path),
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    children: children as readonly string[],
  });
}

function normalizeOrigin(boxes: Record<string, LayoutBox>) {
  let minX = Infinity;
  let minY = Infinity;
  for (const b of Object.values(boxes)) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
  }
  if (!Number.isFinite(minY)) {
    minY = 0;
  }
  const margin = 50;
  for (const b of Object.values(boxes)) {
    b.x = b.x - minX + margin;
    b.y = b.y - minY + margin;
  }
}

/**
 * Runs ELK on the Terraform graph + module tree and returns Excalidraw elements plus metadata.
 */
export async function buildTerraformElkExcalidrawScene(nodes: TerraformPlanNodesMap): Promise<{
  elements: ReturnType<typeof convertToExcalidrawElements>;
  meta: TerraformElkSceneMeta;
}> {
  const vertexSet = collectGraphVertexIds(nodes);
  const vertexCount = vertexSet.size;

  if (vertexCount === 0) {
    return {
      elements: [],
      meta: {
        layoutEngine: "elk",
        vertexCount: 0,
        edgeCount: 0,
        skippedLayout: true,
        skipReason: "no_vertices",
      },
    };
  }

  if (vertexCount > TERRAFORM_ELK_MAX_VERTICES) {
    return {
      elements: [],
      meta: {
        layoutEngine: "elk",
        vertexCount,
        edgeCount: 0,
        skippedLayout: true,
        skipReason: `vertex_count_exceeds_${TERRAFORM_ELK_MAX_VERTICES}`,
      },
    };
  }

  const tree = nodes[TERRAFORM_MODULE_TREE_KEY];
  if (!tree) {
    return {
      elements: [],
      meta: {
        layoutEngine: "elk",
        vertexCount,
        edgeCount: 0,
        skippedLayout: true,
        skipReason: "missing_module_tree",
      },
    };
  }

  const directedEdges = collectDirectedEdges(nodes, vertexSet);
  const moduleRoot = buildModuleCompound(tree, vertexSet);
  if (!moduleRoot) {
    return {
      elements: [],
      meta: {
        layoutEngine: "elk",
        vertexCount,
        edgeCount: directedEdges.length,
        skippedLayout: true,
        skipReason: "empty_module_tree",
      },
    };
  }

  const elkEdges: ElkJsonEdge[] = [];
  for (let i = 0; i < directedEdges.length; i++) {
    const { source, target } = directedEdges[i];
    elkEdges.push({
      id: `e-${i}`,
      sources: [source],
      targets: [target],
    });
  }

  const elkGraph = {
    id: "terraform_elk_root",
    layoutOptions: { ...ELK_ROOT_LAYOUT_OPTIONS },
    children: [moduleRoot],
    edges: elkEdges,
  };

  const elk = new ELK();
  const laidOut = (await elk.layout(elkGraph)) as ElkLayoutedNode;

  const layoutBoxes: Record<string, LayoutBox> = {};
  const rootBaseX = laidOut.x ?? 0;
  const rootBaseY = laidOut.y ?? 0;
  for (const child of laidOut.children || []) {
    collectElkLayoutBoxes(child, rootBaseX, rootBaseY, vertexSet, layoutBoxes);
  }
  layoutModuleGeometryDeep(tree, vertexSet, layoutBoxes);
  normalizeOrigin(layoutBoxes);

  const skeleton: ExcalidrawElementSkeleton[] = [];

  for (const id of [...vertexSet].sort()) {
    const box = layoutBoxes[id];
    if (!box) {
      continue;
    }
    const resource = getPrimaryResource(nodes[id]);
    const resourceType = resource.type || getResourceTypeFromAddress(id);
    const action = getTerraformAction(resource);
    const actionStyle = getTerraformActionStyle(action);
    skeleton.push({
      type: "rectangle",
      id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      strokeWidth: 1.5,
      strokeColor: actionStyle.strokeColor,
      backgroundColor: actionStyle.backgroundColor,
      roundness: { type: 3, value: 10 },
      label: { text: shortResourceLabel(id), fontSize: 12 },
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: id,
        terraformNodeKind: "resource",
        terraformInitiallyVisible: true,
        resourceType,
        nodePath: id,
        action,
        terraformResources: buildLocalTerraformResourceDetails(id, resource),
      },
    });
  }

  let arrowIndex = 0;
  for (const { source, target } of directedEdges) {
    if (!layoutBoxes[source] || !layoutBoxes[target]) {
      continue;
    }
    skeleton.push({
      type: "arrow",
      id: `tf-edge-${arrowIndex}`,
      x: 0,
      y: 0,
      strokeWidth: 1.5,
      strokeColor: "#94a3b8",
      start: { id: source },
      end: { id: target },
      customData: {
        terraform: true,
        terraformEdgeLayer: "dependency",
        relationship: {
          source,
          target,
          type: "dependency",
          label: null,
          origin: "terraform_local_parse",
          detail: null,
        },
      },
    });
    arrowIndex += 1;
  }

  const frameSkeletons: ExcalidrawElementSkeleton[] = [];
  pushModuleFrameSkeletonsPostOrder(tree, vertexSet, layoutBoxes, frameSkeletons);
  skeleton.push(...frameSkeletons);

  const elements = convertToExcalidrawElements(skeleton, { regenerateIds: true });

  return {
    elements,
    meta: {
      layoutEngine: "elk",
      vertexCount,
      edgeCount: directedEdges.length,
    },
  };
}
