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
 * 2. **Edges** — Merge `edges_new` (DOT-derived) and `edges_existing` (prior-state `depends_on`)
 *    into one directed edge set per `source|||target`. Endpoints resolve like `resolveCanonicalNodePath`
 *    (exact address, then index-stripped key). Stroke color: new-only green, prior-only blue, both yellow.
 *
 * 3. **ELK options** — Align with `packages/backend/excalidraw-layout.js`: layered, RIGHT,
 *    `INCLUDE_CHILDREN`, generous spacing, separate components.
 *
 * 4. **Geometry** — Read ELK’s hierarchical coordinates (child `x`/`y` are **relative to
 *    parent**). Then **per module (deepest first)**: lay direct **submodules** in a horizontal
 *    row, lay **resources** in a **grid** under that row, and **shrink-wrap** the compound so
 *    nested boxes stay non-overlapping. Finally normalize the global origin.
 *
 * 5. **Excalidraw** — Emit **frames** per module, resource rectangles, and relationship **lines**
 *    (`convertToExcalidrawElements`).
 *
 * 6. **Scale guard** — Very large graphs skip layout so the main thread stays responsive; callers
 *    read `meta.skippedLayout` / `meta.skipReason`.
 */

/** Browser / Vite-safe build: default `elkjs` entry pulls optional `web-worker` (see elkjs `lib/main.js`). */
import ELK from "elkjs/lib/elk.bundled.js";
import {
  convertToExcalidrawElements,
  newElementWith,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { LocalPoint } from "@excalidraw/math";

import {
  buildTerraformExplodeParentMap,
  collectDataFlowEdges,
  collectDeclaredDataFlowEdges,
  collectNetworkingEdges,
  type TerraformDataFlowEdgeRecord,
} from "./terraformExplodeGraph";
import { partitionDirectedEdgesByNetworking } from "./terraformNetworkingVertex";
import {
  getTerraformResourceTypeFromNodePath,
  isInitiallyVisibleTerraformResource,
} from "./terraformPrimaryVisibility";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";

import { injectTerraformAwsIconsIntoElements } from "./terraformAwsIcons";
import {
  getTerraformCardResourceType,
  terraformResourceCardLabel,
} from "./terraformResourceCardLabel";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  buildUnknownAfterDependencies,
  buildUnknownAfterIntentPreview,
  type TerraformUnknownAfterDependency,
  type TerraformUnknownAfterIntentRow,
} from "./terraformPlanConfigRefs";

import { tfComfortFontSize, tfComfortPx } from "./terraformLayoutComfort";

import {
  resolveTerraformPlanNodeKey,
  type TerraformModuleTreeNode,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

const px = tfComfortPx;

/** Align with backend `packages/backend/excalidraw-layout.js` defaults (pixel values scaled). */
const ELK_ROOT_LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.spacing.nodeNodeBetweenLayers": String(px(140)),
  "elk.layered.spacing.edgeNodeBetweenLayers": String(px(60)),
  "elk.layered.spacing.edgeEdgeBetweenLayers": String(px(30)),
  "elk.spacing.nodeNode": String(px(120)),
  "elk.spacing.edgeNode": String(px(40)),
  "elk.spacing.componentComponent": String(px(200)),
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.layered.thoroughness": "10",
  "elk.padding": `[top=${px(40)},left=${px(40)},bottom=${px(40)},right=${px(
    40,
  )}]`,
  "elk.separateConnectedComponents": "true",
};

const ELK_MODULE_COMPOUND_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.spacing.nodeNodeBetweenLayers": String(px(140)),
  "elk.spacing.nodeNode": String(px(120)),
  "elk.padding": `[top=${px(140)},left=${px(100)},bottom=${px(100)},right=${px(
    100,
  )}]`,
};

const MODULE_COMPOUND_PREFIX = "__tf_m__:";

const DEFAULT_RESOURCE_RECT = { w: px(200), h: px(88) };

const GRID_GAP_X = px(20);
const GRID_GAP_Y = px(20);
const SUBMODULE_GAP_X = px(32);
const SUBMODULE_GAP_Y = px(32);
const MODULE_CONTENT_PAD_L = px(28);
const MODULE_CONTENT_PAD_T = px(40);
const MODULE_SHRINK_WRAP_PAD = px(24);

/** Excalidraw frame id for a Terraform module path (`root`, `module.a`, …). */
function moduleFrameSkeletonId(modulePath: string) {
  return `tf-frame:${modulePath}`;
}

/** Above this many graph vertices, skip ELK to avoid long main-thread stalls. */
export const TERRAFORM_ELK_MAX_VERTICES = 600;

/** Bound label fill uses `strokeColor`; must stay dark (backend `excalidraw.js` uses `#1e1e1e`). */
export const TERRAFORM_RESOURCE_LABEL_STROKE = "#1e1e1e";

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

export function resolveTerraformPlanVertexId(
  nodes: TerraformPlanNodesMap,
  address: string,
): string | null {
  return resolveTerraformPlanNodeKey(nodes, address);
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

/** DOT / plan-only dependency (`edges_new`). Matches backend resource “create” stroke. */
const TERRAFORM_DEPENDENCY_EDGE_NEW_ONLY = "#2b8a3e";
/** Prior-state / `depends_on` (`edges_existing`); wins over DOT when also in `edges_new`. */
const TERRAFORM_DEPENDENCY_EDGE_EXISTING_ONLY = "#1971c2";
/** Matches backend `strokeColorForTerraformDependencyKinds` delete / replace precedence. */
const TERRAFORM_DEPENDENCY_EDGE_DELETE = "#c92a2a";
const TERRAFORM_DEPENDENCY_EDGE_REPLACE = "#f08c00";

/**
 * Stroke for Terraform dependency lines (browser ELK and backend use the same hexes).
 * `hasNew` = from `edges_new`; `hasExisting` = from `edges_existing` / prior `depends_on`.
 */
export function strokeColorForTerraformDependencyEdge(options: {
  hasNew: boolean;
  hasExisting: boolean;
  sourceAction?: string | null;
  targetAction?: string | null;
}): string {
  const { hasNew, hasExisting, sourceAction, targetAction } = options;
  if (sourceAction === "delete" || targetAction === "delete") {
    return TERRAFORM_DEPENDENCY_EDGE_DELETE;
  }
  if (sourceAction === "replace" || targetAction === "replace") {
    return TERRAFORM_DEPENDENCY_EDGE_REPLACE;
  }
  // Prior-state / depends_on wins over DOT: existing (alone or with new) → blue.
  if (hasExisting) {
    return TERRAFORM_DEPENDENCY_EDGE_EXISTING_ONLY;
  }
  if (hasNew) {
    return TERRAFORM_DEPENDENCY_EDGE_NEW_ONLY;
  }
  return "#94a3b8";
}

export type TerraformDirectedLayoutEdge = {
  source: string;
  target: string;
  hasNew: boolean;
  hasExisting: boolean;
};

/**
 * De-duplicates `edges_new` and `edges_existing` into directed pairs with origin flags
 * (same semantics as `packages/backend/excalidraw-arrows.js` `collectDirectedEdges`).
 */
export function collectDirectedEdges(
  nodes: TerraformPlanNodesMap,
  vertexSet: Set<string>,
): TerraformDirectedLayoutEdge[] {
  const edgeMap = new Map<string, TerraformDirectedLayoutEdge>();

  const addHalfEdge = (
    sourceRaw: string,
    targetRaw: string,
    fromNew: boolean,
  ) => {
    const source = resolveTerraformPlanVertexId(nodes, sourceRaw);
    const target = resolveTerraformPlanVertexId(nodes, targetRaw);
    if (!source || !target || source === target) {
      return;
    }
    if (!vertexSet.has(source) || !vertexSet.has(target)) {
      return;
    }
    const key = `${source}|||${target}`;
    const existing = edgeMap.get(key);
    if (existing) {
      if (fromNew) {
        existing.hasNew = true;
      } else {
        existing.hasExisting = true;
      }
      return;
    }
    edgeMap.set(key, {
      source,
      target,
      hasNew: fromNew,
      hasExisting: !fromNew,
    });
  };

  for (const sourceRaw of vertexSet) {
    const node = nodes[sourceRaw] as TerraformPlanGraphNode | undefined;
    for (const targetRaw of node?.edges_new || []) {
      addHalfEdge(sourceRaw, targetRaw, true);
    }
    for (const targetRaw of node?.edges_existing || []) {
      addHalfEdge(sourceRaw, targetRaw, false);
    }
  }

  return [...edgeMap.values()].sort((a, b) =>
    a.source === b.source
      ? a.target.localeCompare(b.target)
      : a.source.localeCompare(b.source),
  );
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

export function shortTerraformResourceLabel(address: string): string {
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

function getDominantTerraformAction(actions: Iterable<unknown>) {
  const actionSet = new Set(actions);
  if (actionSet.has("delete") && actionSet.has("create")) {
    return "replace";
  }
  if (actionSet.has("create")) {
    return "create";
  }
  if (actionSet.has("delete")) {
    return "delete";
  }
  if (actionSet.has("update")) {
    return "update";
  }
  if (actionSet.has("no-op")) {
    return "no-op";
  }
  if (actionSet.has("read")) {
    return "read";
  }
  if (actionSet.has("external")) {
    return "external";
  }
  for (const action of actionSet) {
    if (typeof action === "string" && action) {
      return action;
    }
  }
  return "existing";
}

/** Mirrors backend `getPrimaryAction` in `packages/backend/excalidraw-elements.js`. */
export function getTerraformPlanNodeAction(
  node: TerraformPlanGraphNode | undefined,
) {
  const actions: unknown[] = [];
  for (const resource of Object.values(node?.resources || {})) {
    const resourceActions = (resource as Record<string, any>).change?.actions;
    if (Array.isArray(resourceActions)) {
      actions.push(...resourceActions);
    } else if (typeof resourceActions === "string" && resourceActions) {
      actions.push(resourceActions);
    }
  }
  if (actions.length > 0) {
    return getDominantTerraformAction(actions);
  }
  return "existing";
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

export function getTerraformActionStyle(action: string) {
  return TERRAFORM_ACTION_STYLES[action] || TERRAFORM_ACTION_STYLES.existing;
}

export const UNKNOWN_VALUE_PLACEHOLDER = "Known after apply";

export type { TerraformUnknownAfterDependency, TerraformUnknownAfterIntentRow };

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

/** True when `after` is a hollow shell but `after_unknown` marks nested content unknown. */
export function isUnknownAfterShellValue(
  afterValue: unknown,
  afterUnknownMarker: unknown,
): boolean {
  if (!hasUnknownAfterMarker(afterUnknownMarker)) {
    return false;
  }
  if (afterValue === true || afterValue == null) {
    return true;
  }
  if (Array.isArray(afterValue)) {
    return afterValue.every(
      (entry) =>
        entry == null ||
        (isPlainObject(entry) && Object.keys(entry).length === 0) ||
        isUnknownAfterShellValue(entry, afterUnknownMarker),
    );
  }
  if (isPlainObject(afterValue)) {
    return Object.keys(afterValue).length === 0;
  }
  return false;
}

export type TerraformResourcePanelAttribute = {
  key: string;
  value: unknown;
  changed: boolean;
  unknownAfter: boolean;
  before?: unknown;
  after?: unknown;
  unknownAfterDependencies?: TerraformUnknownAfterDependency[];
  unknownAfterPreview?: TerraformUnknownAfterIntentRow[];
};

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

export function buildTerraformResourcePanelDetails(
  address: string,
  resource: Record<string, any>,
  plan?: unknown,
) {
  const change = resource.change || {};
  const config = getCurrentResourceConfig(resource);
  const diff = getLocalResourceDiff(change);
  const resourceType =
    (typeof resource.type === "string" && resource.type) ||
    getTerraformResourceTypeFromNodePath(address);
  const afterUnknownObj = change.after_unknown || {};
  const unknownAfterKeys = getUnknownTopLevelKeys(afterUnknownObj);
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
      const displayValue = unknownAfter
        ? UNKNOWN_VALUE_PLACEHOLDER
        : Object.prototype.hasOwnProperty.call(config, key)
        ? config[key]
        : fieldDiff?.after ?? null;
      const attr: TerraformResourcePanelAttribute = {
        key,
        value: displayValue,
        changed: Boolean(fieldDiff),
        unknownAfter,
        before: fieldDiff?.before,
        after: unknownAfter ? UNKNOWN_VALUE_PLACEHOLDER : fieldDiff?.after,
      };
      if (unknownAfter && plan) {
        attr.unknownAfterPreview = buildUnknownAfterIntentPreview(
          plan,
          address,
          key,
          resourceType,
          fieldDiff?.before,
        );
        if ((attr.unknownAfterPreview?.length ?? 0) === 0) {
          attr.unknownAfterDependencies = buildUnknownAfterDependencies(
            plan,
            address,
            key,
            resourceType,
          );
        }
      }
      return attr;
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

/** Shared resource-card metadata for any provider (panel fields + action/type). */
export function buildTerraformResourceCardCustomData(
  address: string,
  resource: Record<string, any> | null | undefined,
  node: TerraformPlanGraphNode | undefined,
  plan?: unknown,
) {
  const resourceType = getTerraformCardResourceType(address, resource);
  const action = getTerraformPlanNodeAction(node);
  return {
    resourceType,
    nodePath: address,
    action,
    ...(resource
      ? {
          terraformResources: buildTerraformResourcePanelDetails(
            address,
            resource,
            plan,
          ),
        }
      : {}),
  };
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
  const resourceAddrs = mod.resourceAddresses
    .filter((a) => vertexSet.has(a))
    .sort();

  let cursorX = innerLeft;
  let cursorY = innerTop;
  let subRowMaxH = 0;
  const submoduleCols = Math.max(1, Math.ceil(Math.sqrt(subPaths.length)));
  let submoduleCol = 0;

  for (const p of subPaths) {
    const childCompoundId = moduleCompoundId(p);
    const cb = layoutBoxes[childCompoundId];
    if (!cb) {
      continue;
    }
    if (
      (submoduleCol >= submoduleCols ||
        cursorX + cb.width > innerLeft + innerWidth) &&
      cursorX > innerLeft
    ) {
      cursorX = innerLeft;
      cursorY += subRowMaxH + SUBMODULE_GAP_Y;
      subRowMaxH = 0;
      submoduleCol = 0;
    }
    const dx = cursorX - cb.x;
    const dy = cursorY - cb.y;
    translateModuleSubtree(layoutBoxes, mod.modules[p], dx, dy, vertexSet);
    cursorX += cb.width + SUBMODULE_GAP_X;
    subRowMaxH = Math.max(subRowMaxH, cb.height);
    submoduleCol += 1;
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
function moduleFrameChildIds(
  mod: TerraformModuleTreeNode,
  vertexSet: Set<string>,
): string[] {
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
    pushModuleFrameSkeletonsPostOrder(
      mod.modules[path],
      vertexSet,
      layoutBoxes,
      out,
    );
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
  const margin = px(50);
  for (const b of Object.values(boxes)) {
    b.x = b.x - minX + margin;
    b.y = b.y - minY + margin;
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getEdgePointTowardTarget = (
  pos: { x: number; y: number },
  w: number,
  h: number,
  target: { x: number; y: number },
) => {
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return { x: cx, y: cy };
  }

  const halfW = Math.max(w / 2, 1e-6);
  const halfH = Math.max(h / 2, 1e-6);
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
};

const getCenterClippedLine = (boxA: LayoutBox, boxB: LayoutBox) => {
  const posA = { x: boxA.x, y: boxA.y };
  const posB = { x: boxB.x, y: boxB.y };
  const centerA = { x: boxA.x + boxA.width / 2, y: boxA.y + boxA.height / 2 };
  const centerB = { x: boxB.x + boxB.width / 2, y: boxB.y + boxB.height / 2 };
  const startPoint = getEdgePointTowardTarget(
    posA,
    boxA.width,
    boxA.height,
    centerB,
  );
  const endPoint = getEdgePointTowardTarget(
    posB,
    boxB.width,
    boxB.height,
    centerA,
  );

  return { startPoint, endPoint };
};

const fixedPointForLayoutPoint = (
  box: LayoutBox,
  point: { x: number; y: number },
): [number, number] => [
  clamp((point.x - box.x) / (box.width || 1), 0, 1),
  clamp((point.y - box.y) / (box.height || 1), 0, 1),
];

/** Layout box keyed by Terraform resource address (same shape as ELK `LayoutBox`). */
export type TerraformDependencyLayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Dependency `line` skeletons for Terraform graph edges (ELK and topology layout share this).
 */
export function buildTerraformDependencyLineSkeletons(
  nodes: TerraformPlanNodesMap,
  layoutBoxes: Record<string, TerraformDependencyLayoutBox>,
  directedEdges: TerraformDirectedLayoutEdge[],
  options?: { terraformSemanticOverview?: boolean },
): ExcalidrawElementSkeleton[] {
  const edgeSkeletons: ExcalidrawElementSkeleton[] = [];
  let edgeIndex = 0;
  for (const { source, target, hasNew, hasExisting } of directedEdges) {
    const sourceBox = layoutBoxes[source] as LayoutBox | undefined;
    const targetBox = layoutBoxes[target] as LayoutBox | undefined;
    if (!sourceBox || !targetBox) {
      continue;
    }
    const { startPoint, endPoint } = getCenterClippedLine(sourceBox, targetBox);
    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;
    const dependencyStrokeColor = strokeColorForTerraformDependencyEdge({
      hasNew,
      hasExisting,
      sourceAction: getTerraformPlanNodeAction(nodes[source]),
      targetAction: getTerraformPlanNodeAction(nodes[target]),
    });
    edgeSkeletons.push({
      type: "arrow",
      id: `tf-edge-${edgeIndex}`,
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      strokeWidth: 1.5,
      strokeColor: dependencyStrokeColor,
      startArrowhead: null,
      endArrowhead: "arrow",
      startBinding: {
        elementId: source,
        fixedPoint: fixedPointForLayoutPoint(sourceBox, startPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: target,
        fixedPoint: fixedPointForLayoutPoint(targetBox, endPoint),
        mode: "orbit",
      },
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
        ...(options?.terraformSemanticOverview
          ? { terraformSemanticOverview: true as const }
          : {}),
      },
    });
    edgeIndex += 1;
  }
  return edgeSkeletons;
}

/** SG / DOT networking dependency stroke (blue). */
export const TERRAFORM_NETWORKING_EDGE_STROKE = "#228be6";

/** DOT dependency edges whose endpoints are both networking primitives (VPC, subnet, SG, …). */
export function buildTerraformNetworkingDependencyLineSkeletons(
  nodes: TerraformPlanNodesMap,
  layoutBoxes: Record<string, TerraformDependencyLayoutBox>,
  directedEdges: TerraformDirectedLayoutEdge[],
  options?: { terraformSemanticOverview?: boolean },
): ExcalidrawElementSkeleton[] {
  const edgeSkeletons: ExcalidrawElementSkeleton[] = [];
  let edgeIndex = 0;
  for (const { source, target } of directedEdges) {
    const sourceBox = layoutBoxes[source] as LayoutBox | undefined;
    const targetBox = layoutBoxes[target] as LayoutBox | undefined;
    if (!sourceBox || !targetBox) {
      continue;
    }
    const { startPoint, endPoint } = getCenterClippedLine(sourceBox, targetBox);
    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;
    edgeSkeletons.push({
      type: "arrow",
      id: `tf-netdep-${edgeIndex}`,
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      strokeWidth: 2,
      strokeColor: TERRAFORM_NETWORKING_EDGE_STROKE,
      strokeStyle: "solid",
      startArrowhead: null,
      endArrowhead: "arrow",
      startBinding: {
        elementId: source,
        fixedPoint: fixedPointForLayoutPoint(sourceBox, startPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: target,
        fixedPoint: fixedPointForLayoutPoint(targetBox, endPoint),
        mode: "orbit",
      },
      customData: {
        terraform: true,
        terraformEdgeLayer: "networking",
        relationship: {
          source,
          target,
          type: "networking_dependency",
          label: "depends on",
          origin: "terraform_graph",
          detail: null,
        },
        ...(options?.terraformSemanticOverview
          ? { terraformSemanticOverview: true as const }
          : {}),
      },
    });
    edgeIndex += 1;
  }
  return edgeSkeletons;
}

/** Semantic data-flow layer — IAM policy semantics only (grey). */
export const TERRAFORM_DATAFLOW_EDGE_STROKE = "#868e96";
/** Declared `.tfd` dataflow layer (blue). */
export const TERRAFORM_DECLARED_DATAFLOW_EDGE_STROKE = "#339af0";
const TERRAFORM_DATAFLOW_OFFSET_PX = 18;
const TERRAFORM_DECLARED_DATAFLOW_OFFSET_PX = 10;

function offsetTerraformLineSegment(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
  offset: number,
) {
  if (!offset) {
    return { startPoint, endPoint };
  }
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / length) * offset;
  const offsetY = (dx / length) * offset;
  return {
    startPoint: { x: startPoint.x + offsetX, y: startPoint.y + offsetY },
    endPoint: { x: endPoint.x + offsetX, y: endPoint.y + offsetY },
  };
}

/**
 * Semantic data-flow `line` skeletons ({@link TERRAFORM_DATAFLOW_EDGE_STROKE}), aligned with backend `excalidraw.js`.
 */
export function buildTerraformDataFlowLineSkeletons(
  nodes: TerraformPlanNodesMap,
  layoutBoxes: Record<string, TerraformDependencyLayoutBox>,
  dataFlowEdges: TerraformDataFlowEdgeRecord[],
  dependencyUndirectedPairs: Set<string>,
  options?: { terraformSemanticOverview?: boolean },
): ExcalidrawElementSkeleton[] {
  const out: ExcalidrawElementSkeleton[] = [];
  let edgeIndex = 0;
  for (const edge of dataFlowEdges) {
    const source = resolveTerraformPlanVertexId(nodes, edge.source);
    const target = resolveTerraformPlanVertexId(nodes, edge.target);
    if (!source || !target || source === target) {
      continue;
    }
    const sourceBox = layoutBoxes[source] as LayoutBox | undefined;
    const targetBox = layoutBoxes[target] as LayoutBox | undefined;
    if (!sourceBox || !targetBox) {
      continue;
    }

    let { startPoint, endPoint } = getCenterClippedLine(sourceBox, targetBox);
    const pairKey = [source, target].sort().join("|||");
    if (dependencyUndirectedPairs.has(pairKey)) {
      const shifted = offsetTerraformLineSegment(
        startPoint,
        endPoint,
        TERRAFORM_DATAFLOW_OFFSET_PX,
      );
      startPoint = shifted.startPoint;
      endPoint = shifted.endPoint;
    }

    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;
    const bidirectional = Boolean(edge.bidirectional);

    out.push({
      type: "arrow",
      id: `tf-dataflow-${edgeIndex}`,
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      strokeWidth: 3,
      strokeColor: TERRAFORM_DATAFLOW_EDGE_STROKE,
      strokeStyle: "solid",
      startArrowhead: bidirectional ? "arrow" : null,
      endArrowhead: "arrow",
      roundness: { type: 2 },
      startBinding: {
        elementId: source,
        fixedPoint: fixedPointForLayoutPoint(sourceBox, startPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: target,
        fixedPoint: fixedPointForLayoutPoint(targetBox, endPoint),
        mode: "orbit",
      },
      customData: {
        terraform: true,
        terraformEdgeLayer: "dataFlow",
        relationship: {
          source,
          target,
          type: edge.type,
          label: edge.label,
          origin: edge.origin,
          detail: edge.detail,
          directions: edge.directions ?? [],
          directed: !bidirectional,
          bidirectional,
        },
        ...(options?.terraformSemanticOverview
          ? { terraformSemanticOverview: true as const }
          : {}),
      },
    });
    edgeIndex += 1;
  }
  return out;
}

const DECLARED_DATAFLOW_ORPHAN_W = () => tfComfortPx(128);
const DECLARED_DATAFLOW_ORPHAN_H = () => tfComfortPx(40);
const DECLARED_DATAFLOW_ORPHAN_GAP = () => tfComfortPx(10);

function collectSkeletonRectangleLayoutBoxes(
  skeleton: readonly ExcalidrawElementSkeleton[],
): Record<string, LayoutBox> {
  const layoutBoxes: Record<string, LayoutBox> = {};
  for (const el of skeleton) {
    if (el.type !== "rectangle" || typeof el.id !== "string" || !el.id) {
      continue;
    }
    layoutBoxes[el.id] = {
      x: typeof el.x === "number" ? el.x : 0,
      y: typeof el.y === "number" ? el.y : 0,
      width: typeof el.width === "number" ? el.width : 0,
      height: typeof el.height === "number" ? el.height : 0,
    };
  }
  return layoutBoxes;
}

/**
 * Place small resource cards for declared `.tfd` endpoints that are not part of the
 * semantic topology grid (e.g. `aws_ssm_parameter` outputs next to a Lambda).
 */
export function appendDeclaredDataFlowMissingEndpointRectangles(
  skeleton: ExcalidrawElementSkeleton[],
  nodes: TerraformPlanNodesMap,
  declaredEdges: TerraformDataFlowEdgeRecord[],
  plan?: unknown,
): void {
  const placed = new Set<string>();
  for (const el of skeleton) {
    if (el.type === "rectangle" && typeof el.id === "string") {
      placed.add(el.id);
    }
  }
  const layoutBoxes = collectSkeletonRectangleLayoutBoxes(skeleton);
  const orphansPerPeer = new Map<string, number>();

  for (const edge of declaredEdges) {
    const source =
      resolveTerraformPlanVertexId(nodes, edge.source) ?? edge.source;
    const target =
      resolveTerraformPlanVertexId(nodes, edge.target) ?? edge.target;
    const pairs: Array<{ id: string; peer: string }> = [
      { id: source, peer: target },
      { id: target, peer: source },
    ];
    for (const { id, peer } of pairs) {
      if (placed.has(id) || !nodes[id]) {
        continue;
      }
      const peerId = resolveTerraformPlanVertexId(nodes, peer) ?? peer;
      const peerBox = layoutBoxes[peerId];
      if (!peerBox) {
        continue;
      }
      const orphanIndex = orphansPerPeer.get(peerId) ?? 0;
      orphansPerPeer.set(peerId, orphanIndex + 1);
      const w = DECLARED_DATAFLOW_ORPHAN_W();
      const h = DECLARED_DATAFLOW_ORPHAN_H();
      const gap = DECLARED_DATAFLOW_ORPHAN_GAP();
      const x = peerBox.x + (peerBox.width - w) / 2;
      const y = peerBox.y + peerBox.height + gap + orphanIndex * (h + gap);
      const node = nodes[id];
      const resource = getPrimaryResource(node);
      const resourceType = getTerraformCardResourceType(id, resource);
      const action = getTerraformPlanNodeAction(node);
      const actionStyle = getTerraformActionStyle(action);
      skeleton.push({
        type: "rectangle",
        id,
        x,
        y,
        width: w,
        height: h,
        strokeWidth: 1.5,
        strokeColor: actionStyle.strokeColor,
        backgroundColor: actionStyle.backgroundColor,
        roundness: { type: 3, value: px(10) },
        label: {
          text: terraformResourceCardLabel(id, resource),
          fontSize: tfComfortFontSize(10),
          strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
        },
        customData: {
          terraform: true,
          terraformSemanticOverview: true,
          terraformVisibilityRole: "resource",
          terraformVisibilityKey: id,
          terraformNodeKind: "resource",
          terraformInitiallyVisible: isInitiallyVisibleTerraformResource(
            resourceType,
            action,
          ),
          terraformExplodeParentKeys: [],
          terraformExplodeParent: null,
          terraformDeclaredDataFlowOrphan: true,
          ...buildTerraformResourceCardCustomData(id, resource, node, plan),
        },
      });
      placed.add(id);
      layoutBoxes[id] = { x, y, width: w, height: h };
    }
  }
}

/**
 * Declared `.tfd` dataflow arrows ({@link TERRAFORM_DECLARED_DATAFLOW_EDGE_STROKE}).
 * `sequence` on each edge is stored on `relationship` for ordering tests.
 */
export function buildTerraformDeclaredDataFlowLineSkeletons(
  nodes: TerraformPlanNodesMap,
  layoutBoxes: Record<string, TerraformDependencyLayoutBox>,
  declaredEdges: TerraformDataFlowEdgeRecord[],
  dependencyUndirectedPairs: Set<string>,
  options?: { terraformSemanticOverview?: boolean },
): ExcalidrawElementSkeleton[] {
  const out: ExcalidrawElementSkeleton[] = [];
  let edgeIndex = 0;
  for (const edge of declaredEdges) {
    const source = resolveTerraformPlanVertexId(nodes, edge.source);
    const target = resolveTerraformPlanVertexId(nodes, edge.target);
    if (!source || !target || source === target) {
      continue;
    }
    const sourceBox = layoutBoxes[source] as LayoutBox | undefined;
    const targetBox = layoutBoxes[target] as LayoutBox | undefined;
    if (!sourceBox || !targetBox) {
      continue;
    }

    let { startPoint, endPoint } = getCenterClippedLine(sourceBox, targetBox);
    const pairKey = [source, target].sort().join("|||");
    if (dependencyUndirectedPairs.has(pairKey)) {
      const shifted = offsetTerraformLineSegment(
        startPoint,
        endPoint,
        TERRAFORM_DECLARED_DATAFLOW_OFFSET_PX,
      );
      startPoint = shifted.startPoint;
      endPoint = shifted.endPoint;
    }

    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;
    const sequence =
      edge.detail != null && edge.detail !== ""
        ? Number(edge.detail)
        : edgeIndex;

    out.push({
      type: "arrow",
      id: `tf-declared-dataflow-${edgeIndex}`,
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      strokeWidth: 3,
      strokeColor: TERRAFORM_DECLARED_DATAFLOW_EDGE_STROKE,
      strokeStyle: "solid",
      startArrowhead: null,
      endArrowhead: "arrow",
      roundness: { type: 2 },
      startBinding: {
        elementId: source,
        fixedPoint: fixedPointForLayoutPoint(sourceBox, startPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: target,
        fixedPoint: fixedPointForLayoutPoint(targetBox, endPoint),
        mode: "orbit",
      },
      customData: {
        terraform: true,
        terraformEdgeLayer: "declaredDataFlow",
        relationship: {
          source,
          target,
          type: edge.type,
          label: edge.label,
          origin: edge.origin,
          detail: edge.detail,
          sequence,
          directed: true,
          bidirectional: false,
          directions: [],
        },
        ...(options?.terraformSemanticOverview
          ? { terraformSemanticOverview: true as const }
          : {}),
      },
    });
    edgeIndex += 1;
  }
  return out;
}

/** `edges_networking` semantic lines (SG peers); blue {@link TERRAFORM_NETWORKING_EDGE_STROKE}. */
export function buildTerraformNetworkingRecordLineSkeletons(
  nodes: TerraformPlanNodesMap,
  layoutBoxes: Record<string, TerraformDependencyLayoutBox>,
  networkingEdges: TerraformDataFlowEdgeRecord[],
  structuralUndirectedPairs: Set<string>,
  options?: { terraformSemanticOverview?: boolean },
): ExcalidrawElementSkeleton[] {
  const out: ExcalidrawElementSkeleton[] = [];
  let edgeIndex = 0;
  for (const edge of networkingEdges) {
    const source = resolveTerraformPlanVertexId(nodes, edge.source);
    const target = resolveTerraformPlanVertexId(nodes, edge.target);
    if (!source || !target || source === target) {
      continue;
    }
    const sourceBox = layoutBoxes[source] as LayoutBox | undefined;
    const targetBox = layoutBoxes[target] as LayoutBox | undefined;
    if (!sourceBox || !targetBox) {
      continue;
    }

    let { startPoint, endPoint } = getCenterClippedLine(sourceBox, targetBox);
    const pairKey = [source, target].sort().join("|||");
    if (structuralUndirectedPairs.has(pairKey)) {
      const shifted = offsetTerraformLineSegment(
        startPoint,
        endPoint,
        TERRAFORM_DATAFLOW_OFFSET_PX,
      );
      startPoint = shifted.startPoint;
      endPoint = shifted.endPoint;
    }

    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;
    const bidirectional = Boolean(edge.bidirectional);

    out.push({
      type: "arrow",
      id: `tf-net-rec-${edgeIndex}`,
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      strokeWidth: 3,
      strokeColor: TERRAFORM_NETWORKING_EDGE_STROKE,
      strokeStyle: "solid",
      startArrowhead: bidirectional ? "arrow" : null,
      endArrowhead: "arrow",
      roundness: { type: 2 },
      startBinding: {
        elementId: source,
        fixedPoint: fixedPointForLayoutPoint(sourceBox, startPoint),
        mode: "orbit",
      },
      endBinding: {
        elementId: target,
        fixedPoint: fixedPointForLayoutPoint(targetBox, endPoint),
        mode: "orbit",
      },
      customData: {
        terraform: true,
        terraformEdgeLayer: "networking",
        relationship: {
          source,
          target,
          type: edge.type,
          label: edge.label,
          origin: edge.origin,
          detail: edge.detail,
          directions: edge.directions ?? [],
          directed: !bidirectional,
          bidirectional,
        },
        ...(options?.terraformSemanticOverview
          ? { terraformSemanticOverview: true as const }
          : {}),
      },
    });
    edgeIndex += 1;
  }
  return out;
}

/** Skeleton rectangles cannot set `isDeleted`; apply from `terraformInitiallyVisible` after convert. */
export function applyTerraformResourceRectangleSoftDelete(
  elements: readonly ExcalidrawElement[],
  options?: { semanticAllVisible?: boolean },
): ExcalidrawElement[] {
  return elements.map((el) => {
    if (el.type !== "rectangle") {
      return el;
    }
    const cd = el.customData ?? {};
    if (cd.terraformVisibilityRole !== "resource") {
      return el;
    }
    if (options?.semanticAllVisible) {
      return newElementWith(el, { isDeleted: false });
    }
    const initiallyVisible = cd.terraformInitiallyVisible === true;
    return newElementWith(el, { isDeleted: !initiallyVisible });
  });
}

/**
 * `convertToExcalidrawElements` creates rectangle `label` text as bound text. The backend exporter
 * emits labels as independent grouped text (`containerId: null`), which works better with the
 * Terraform soft-delete / hover focus code. Mirror metadata from the resource rectangle, then
 * detach the label so visibility is controlled by our Terraform customData instead of Excalidraw's
 * container-bound text behavior.
 */
export function mirrorAndDetachTerraformResourceLabels(
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  return elements.map((el) => {
    if (
      el.type === "rectangle" &&
      el.customData?.terraformVisibilityRole === "resource"
    ) {
      const boundElements = el.boundElements?.filter(
        (bound) => bound.type !== "text",
      );
      if (boundElements?.length !== el.boundElements?.length) {
        return newElementWith(el, { boundElements });
      }
      return el;
    }

    if (el.type !== "text") {
      return el;
    }
    if (!("containerId" in el) || !el.containerId) {
      return el;
    }
    const parent = byId.get(el.containerId);
    if (!parent || parent.type !== "rectangle") {
      return el;
    }
    const pcd = parent.customData ?? {};
    if (pcd.terraformVisibilityRole !== "resource") {
      return el;
    }
    return newElementWith(el, {
      isDeleted: parent.isDeleted,
      strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
      containerId: null,
      customData: {
        ...(el.customData ?? {}),
        terraform: true,
        terraformVisibilityRole: pcd.terraformVisibilityRole,
        terraformVisibilityKey: pcd.terraformVisibilityKey,
        terraformNodeKind: pcd.terraformNodeKind,
        terraformInitiallyVisible: pcd.terraformInitiallyVisible,
        terraformExplodeParentKeys: pcd.terraformExplodeParentKeys,
        terraformExplodeParent: pcd.terraformExplodeParent,
        resourceType: pcd.resourceType,
        nodePath: pcd.nodePath,
        ...(pcd.terraformSemanticOverview === true
          ? { terraformSemanticOverview: true as const }
          : {}),
        ...(pcd.terraformExpandAllView === true
          ? { terraformExpandAllView: true as const }
          : {}),
      },
    });
  });
}

/**
 * Runs ELK on the Terraform graph + module tree and returns Excalidraw elements plus metadata.
 */
export async function buildTerraformElkExcalidrawScene(
  nodes: TerraformPlanNodesMap,
  plan?: unknown,
): Promise<{
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
  const { dependencyEdges, networkingDependencyEdges } =
    partitionDirectedEdgesByNetworking(nodes, directedEdges);
  const dataFlowEdges = collectDataFlowEdges(
    nodes as Record<string, { edges_data_flow?: unknown }>,
  );
  const declaredDataFlowEdges = collectDeclaredDataFlowEdges(nodes);
  const networkingRecordEdges = collectNetworkingEdges(
    nodes as Record<
      string,
      { edges_data_flow?: unknown; edges_networking?: unknown }
    >,
  );
  const netDepPairKeys = new Set(
    networkingDependencyEdges.map((e) =>
      [e.source, e.target].sort().join("|||"),
    ),
  );
  const networkingRecordEdgesFiltered = networkingRecordEdges.filter((r) => {
    const s = resolveTerraformPlanVertexId(nodes, r.source);
    const t = resolveTerraformPlanVertexId(nodes, r.target);
    if (!s || !t) {
      return false;
    }
    return !netDepPairKeys.has([s, t].sort().join("|||"));
  });
  const explodeParentMap = buildTerraformExplodeParentMap(
    [...vertexSet],
    directedEdges,
    dataFlowEdges,
    networkingRecordEdges,
  );

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

  const resourceSkeletons: ExcalidrawElementSkeleton[] = [];
  const edgeSkeletons: ExcalidrawElementSkeleton[] = [];

  for (const id of [...vertexSet].sort()) {
    const box = layoutBoxes[id];
    if (!box) {
      continue;
    }
    const resource = getPrimaryResource(nodes[id]);
    const resourceType = getTerraformCardResourceType(id, resource);
    const explodeKeys = [...(explodeParentMap.get(id) || [])].sort();
    const explodeParent = explodeKeys[0] ?? null;
    const action = getTerraformPlanNodeAction(nodes[id]);
    const initiallyVisible = isInitiallyVisibleTerraformResource(
      resourceType,
      action,
    );
    const actionStyle = getTerraformActionStyle(action);
    resourceSkeletons.push({
      type: "rectangle",
      id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      strokeWidth: 1.5,
      strokeColor: actionStyle.strokeColor,
      backgroundColor: actionStyle.backgroundColor,
      roundness: { type: 3, value: px(10) },
      label: {
        text: terraformResourceCardLabel(id, resource),
        fontSize: tfComfortFontSize(12),
        strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
      },
      customData: {
        terraform: true,
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: id,
        terraformNodeKind: "resource",
        terraformInitiallyVisible: initiallyVisible,
        terraformExplodeParentKeys: explodeKeys,
        terraformExplodeParent: explodeParent,
        ...buildTerraformResourceCardCustomData(id, resource, nodes[id], plan),
      },
    });
  }

  const structuralUndirectedPairs = new Set(
    [...dependencyEdges, ...networkingDependencyEdges].map((e) =>
      [e.source, e.target].sort().join("|||"),
    ),
  );

  edgeSkeletons.push(
    ...buildTerraformDependencyLineSkeletons(
      nodes,
      layoutBoxes,
      dependencyEdges,
    ),
  );
  edgeSkeletons.push(
    ...buildTerraformNetworkingDependencyLineSkeletons(
      nodes,
      layoutBoxes,
      networkingDependencyEdges,
    ),
  );
  edgeSkeletons.push(
    ...buildTerraformNetworkingRecordLineSkeletons(
      nodes,
      layoutBoxes,
      networkingRecordEdgesFiltered,
      structuralUndirectedPairs,
    ),
  );
  edgeSkeletons.push(
    ...buildTerraformDataFlowLineSkeletons(
      nodes,
      layoutBoxes,
      dataFlowEdges,
      structuralUndirectedPairs,
    ),
  );
  edgeSkeletons.push(
    ...buildTerraformDeclaredDataFlowLineSkeletons(
      nodes,
      layoutBoxes,
      declaredDataFlowEdges,
      structuralUndirectedPairs,
    ),
  );

  const frameSkeletons: ExcalidrawElementSkeleton[] = [];
  pushModuleFrameSkeletonsPostOrder(
    tree,
    vertexSet,
    layoutBoxes,
    frameSkeletons,
  );
  // Edges first so they render behind frames and resource cards. Cards use orbit
  // binding (`mode: "orbit"`) which clips arrow endpoints to the card boundary, so
  // arrowheads stay visible on the card edge even though the line itself sits behind.
  const skeleton = [...edgeSkeletons, ...frameSkeletons, ...resourceSkeletons];

  let elements = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  }) as ExcalidrawElement[];
  elements = applyTerraformResourceRectangleSoftDelete(elements);
  elements = mirrorAndDetachTerraformResourceLabels(elements);
  elements = await injectTerraformAwsIconsIntoElements(elements);
  elements = reconcileTerraformVisibility(
    repairTerraformEdgeBindings(elements),
    {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: null,
    },
  );

  return {
    elements: elements as ReturnType<typeof convertToExcalidrawElements>,
    meta: {
      layoutEngine: "elk",
      vertexCount,
      edgeCount: directedEdges.length,
    },
  };
}
