/**
 * Top-level layout (ELK layered + force fallback), collapsed module coalescing, internal module
 * offsets, VPC perimeter snaps, and synthetic networking-facet appliance tiles.
 */
const ELK = require("elkjs");

const {
  VPC_PERIMETER_LAYOUT_ENABLED,
  classifyVpcApplianceWall,
  layoutVpcApplianceRectanglesOnFrame,
  classifySyntheticVpcTileWall,
} = require("./vpc-perimeter");

const {
  lerp,
  getModulePathChain,
  getModuleRelativeResourcePath,
  getOwningModulePath,
  stripTerraformInstanceIndexes,
  isLikelyLambdaModule,
  LAMBDA_MODULE_PRESET_OFFSETS,
} = require("./excalidraw-elements");

/** Avoid duplicate stderr lines when offsets are recomputed (e.g. size estimate + expand). */
const layoutInternalOffsetsDebugLogged = new Set();

const MODULE_PADDING_X = 52;
const MODULE_PADDING_TOP = 72;
const MODULE_PADDING_BOTTOM = 40;
const MODULE_BLOCK_GAP_X = 120;
const MODULE_BLOCK_GAP_Y = 96;
const MODULE_RESOURCE_GAP_X = 280;
const MODULE_RESOURCE_GAP_Y = 160;
const DEFAULT_RESOURCE_RECT = { w: 220, h: 100 };

// --- Force layout ---

/** Runs a bounded d3-force simulation from tiered charge/link/collide parameters; returns id→{x,y}. */
async function forceLayout(
  nodeKeys,
  directedEdges,
  tierMap,
  tierConfigs,
  layoutSizes = {},
) {
  const d3 = await import("d3-force");

  const tiers = Object.values(tierMap);
  const minTier = Math.min(...tiers);
  const maxTier = Math.max(...tiers);
  const tierRange = maxTier - minTier || 1;

  const simNodes = nodeKeys.map((id) => ({
    id,
    tier: tierMap[id],
  }));

  const simLinks = directedEdges.map(({ source, target }) => ({
    source,
    target,
  }));
  const getCollisionRadius = (node) => {
    const size = layoutSizes[node.id];
    if (size) {
      return Math.max(size.w, size.h) / 2 + 90;
    }
    return tierConfigs[node.tier].collide;
  };

  const simulation = d3
    .forceSimulation(simNodes)
    .force(
      "charge",
      d3.forceManyBody().strength((d) => tierConfigs[d.tier].charge),
    )
    .force(
      "link",
      d3
        .forceLink(simLinks)
        .id((d) => d.id)
        .distance((link) => {
          // Prominent nodes (low tier number) push further apart
          const t1 = (link.source.tier - minTier) / tierRange;
          const t2 = (link.target.tier - minTier) / tierRange;
          const avgFrac = (t1 + t2) / 2;
          return Math.round(lerp(500, 150, avgFrac));
        })
        .strength((link) => {
          const maxRelTier =
            Math.max(link.source.tier, link.target.tier) - minTier;
          return maxRelTier >= 1 ? 1.2 : 0.7;
        }),
    )
    .force("center", d3.forceCenter(0, 0))
    .force("collide", d3.forceCollide().radius(getCollisionRadius))
    .stop();

  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const n of simNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  }

  const posMap = {};
  for (const n of simNodes) {
    posMap[n.id] = {
      x: n.x - minX + 50,
      y: n.y - minY + 50,
    };
  }
  return posMap;
}

const ELK_DEFAULT_LAYOUT_OPTIONS = {
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

const ELK_DEFAULT_GROUP_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.spacing.nodeNodeBetweenLayers": "120",
  "elk.spacing.nodeNode": "100",
  "elk.padding": "[top=120,left=80,bottom=80,right=80]",
};

const ELK_GROUP_ID_PREFIX = "__elk_group__:";

/**
 * Lays out collapsed top-level nodes with ELK's layered algorithm.
 *
 * Same contract as `forceLayout`: returns `{ id: { x, y } }` where `(x, y)` is each node's
 * top-left corner in a normalized coordinate space (no negatives, with a small origin
 * margin). Module internals are still expanded afterward by `expandCollapsedModulePositions`.
 *
 * When `options.nestingGroups` is supplied, ELK lays out each group's members as a
 * compound node. Synthetic group ids (`__elk_group__:<id>`) are not emitted in the result;
 * only real layout ids appear, with absolute positions composed from the compound tree.
 *
 * `options.nestingGroups`: `Array<{ id: string, members: string[], layoutOptions?: object }>`.
 * Members must be in `nodeKeys`. Each member belongs to at most one group; the first
 * group that claims it wins.
 */
async function elkLayout(
  nodeKeys,
  directedEdges,
  tierMap,
  tierConfigs,
  layoutSizes = {},
  options = {},
) {
  if (nodeKeys.length === 0) {
    return {};
  }

  // Back-compat: previous signature passed bare layoutOptions as the 6th arg.
  const normalizedOptions =
    options && (options.layoutOptions || options.nestingGroups)
      ? options
      : { layoutOptions: options };
  const layoutOptions = normalizedOptions.layoutOptions || {};
  const nestingGroups = normalizedOptions.nestingGroups || [];

  const elk = new ELK();

  const nodeSet = new Set(nodeKeys);
  const sizeFor = (id) => {
    const size = layoutSizes[id];
    if (size) {
      return { width: size.w, height: size.h };
    }
    const cfg = tierConfigs[tierMap[id]];
    return {
      width: cfg?.w ?? DEFAULT_RESOURCE_RECT.w,
      height: cfg?.h ?? DEFAULT_RESOURCE_RECT.h,
    };
  };

  const memberToGroupId = new Map();
  const compoundChildrenByGroup = new Map();
  for (const group of nestingGroups) {
    if (!group?.id || !Array.isArray(group.members)) {
      continue;
    }
    const groupElkId = `${ELK_GROUP_ID_PREFIX}${group.id}`;
    const claimedMembers = [];
    for (const member of group.members) {
      if (!nodeSet.has(member) || memberToGroupId.has(member)) {
        continue;
      }
      memberToGroupId.set(member, groupElkId);
      claimedMembers.push(member);
    }
    if (claimedMembers.length === 0) {
      continue;
    }
    compoundChildrenByGroup.set(groupElkId, {
      groupElkId,
      members: claimedMembers,
      layoutOptions: group.layoutOptions || {},
    });
  }

  const rootChildren = [];
  for (const [groupElkId, info] of compoundChildrenByGroup) {
    rootChildren.push({
      id: groupElkId,
      layoutOptions: {
        ...ELK_DEFAULT_GROUP_LAYOUT_OPTIONS,
        ...info.layoutOptions,
      },
      children: info.members.map((id) => ({ id, ...sizeFor(id) })),
    });
  }
  for (const id of nodeKeys) {
    if (memberToGroupId.has(id)) {
      continue;
    }
    rootChildren.push({ id, ...sizeFor(id) });
  }

  // ELK requires unique edge ids and edges that reference known nodes.
  // Collapse antiparallel duplicates; ELK handles direction reversal in cycle breaking.
  const seenEdges = new Set();
  const edges = [];
  for (let i = 0; i < directedEdges.length; i++) {
    const { source, target } = directedEdges[i];
    if (!nodeSet.has(source) || !nodeSet.has(target) || source === target) {
      continue;
    }
    const key = `${source}|||${target}`;
    if (seenEdges.has(key)) {
      continue;
    }
    seenEdges.add(key);
    edges.push({
      id: `e-${i}`,
      sources: [source],
      targets: [target],
    });
  }

  const graph = {
    id: "root",
    layoutOptions: { ...ELK_DEFAULT_LAYOUT_OPTIONS, ...layoutOptions },
    children: rootChildren,
    edges,
  };

  const result = await elk.layout(graph);

  // Walk the result tree, composing absolute positions for real (non-group) nodes.
  const absolutePositions = {};
  const collect = (node, baseX, baseY) => {
    const x = (node.x ?? 0) + baseX;
    const y = (node.y ?? 0) + baseY;
    if (
      node.id &&
      !node.id.startsWith(ELK_GROUP_ID_PREFIX) &&
      node.id !== "root"
    ) {
      if (typeof node.x === "number" && typeof node.y === "number") {
        absolutePositions[node.id] = { x, y };
      }
    }
    for (const child of node.children || []) {
      collect(child, x, y);
    }
  };
  for (const child of result.children || []) {
    collect(child, 0, 0);
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const pos of Object.values(absolutePositions)) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
  }
  if (!Number.isFinite(minY)) {
    minY = 0;
  }

  const posMap = {};
  for (const [id, pos] of Object.entries(absolutePositions)) {
    posMap[id] = { x: pos.x - minX + 50, y: pos.y - minY + 50 };
  }
  return posMap;
}

/** Registry-module paths that should collapse to one layout vertex (non-nested under another collapsible). */
function buildCollapsibleModuleSet(moduleGroups) {
  const collapsibleModules = new Set();

  for (const group of moduleGroups) {
    if (!group.source) {
      continue;
    }

    const parentModulePaths = getModulePathChain(
      `${group.modulePath}.placeholder`,
    ).slice(0, -1);
    if (
      parentModulePaths.some((modulePath) => collapsibleModules.has(modulePath))
    ) {
      continue;
    }

    collapsibleModules.add(group.modulePath);
  }

  return collapsibleModules;
}

/** Deepest collapsible module prefix affecting `nodePath`, for layout id assignment. */
function getCollapsedModulePath(nodePath, collapsibleModules) {
  const chain = getModulePathChain(nodePath)
    .filter((modulePath) => collapsibleModules.has(modulePath))
    .sort((a, b) => b.length - a.length);

  return chain[0] || null;
}

/**
 * Coalesces module internals to a single simulation node per collapsible module; returns
 * layout keys, deduped edges, per-layout tier map, and member lists.
 */
function buildCollapsedLayoutModel(
  nodeKeys,
  directedEdges,
  tierMap,
  collapsibleModules,
) {
  const nodeToLayoutId = new Map();
  const moduleMembers = new Map();
  const layoutNodeSet = new Set();

  for (const nodePath of nodeKeys) {
    const modulePath = getCollapsedModulePath(nodePath, collapsibleModules);
    const layoutId = modulePath || nodePath;
    nodeToLayoutId.set(nodePath, layoutId);
    layoutNodeSet.add(layoutId);

    if (modulePath) {
      if (!moduleMembers.has(modulePath)) {
        moduleMembers.set(modulePath, []);
      }
      moduleMembers.get(modulePath).push(nodePath);
    }
  }

  const layoutEdgeMap = new Map();
  for (const edge of directedEdges) {
    const source = nodeToLayoutId.get(edge.source);
    const target = nodeToLayoutId.get(edge.target);
    if (!source || !target || source === target) {
      continue;
    }

    const key = `${source}|||${target}`;
    if (!layoutEdgeMap.has(key)) {
      layoutEdgeMap.set(key, { source, target });
    }
  }

  const layoutTierMap = {};
  for (const layoutId of layoutNodeSet) {
    const members = moduleMembers.get(layoutId);
    layoutTierMap[layoutId] = members
      ? Math.min(...members.map((nodePath) => tierMap[nodePath]))
      : tierMap[layoutId];
  }

  return {
    layoutNodeKeys: [...layoutNodeSet],
    layoutEdges: [...layoutEdgeMap.values()],
    layoutTierMap,
    moduleMembers,
  };
}

function measureResourceRect(nodePath, tierMap = {}, tierConfigs = {}) {
  const cfg = tierConfigs[tierMap[nodePath]];
  return {
    w: cfg?.w ?? DEFAULT_RESOURCE_RECT.w,
    h: cfg?.h ?? DEFAULT_RESOURCE_RECT.h,
  };
}

function measureOffsetsBounds(offsets, tierMap = {}, tierConfigs = {}) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [nodePath, offset] of Object.entries(offsets)) {
    const rect = measureResourceRect(nodePath, tierMap, tierConfigs);
    minX = Math.min(minX, offset.x);
    minY = Math.min(minY, offset.y);
    maxX = Math.max(maxX, offset.x + rect.w);
    maxY = Math.max(maxY, offset.y + rect.h);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function normalizeOffsets(
  offsets,
  tierMap = {},
  tierConfigs = {},
  shiftX = 0,
  shiftY = 0,
) {
  const bounds = measureOffsetsBounds(offsets, tierMap, tierConfigs);
  if (!bounds) {
    return {};
  }

  const normalized = {};
  for (const [nodePath, offset] of Object.entries(offsets)) {
    normalized[nodePath] = {
      x: offset.x - bounds.minX + shiftX,
      y: offset.y - bounds.minY + shiftY,
    };
  }
  return normalized;
}

function packBlocks(blocks, options = {}) {
  const gapX = options.gapX ?? MODULE_BLOCK_GAP_X;
  const gapY = options.gapY ?? MODULE_BLOCK_GAP_Y;
  const maxRowWidth = options.maxRowWidth ?? 1600;
  const placements = [];
  let x = 0;
  let y = 0;
  let rowH = 0;

  for (const block of blocks) {
    if (x > 0 && x + block.w > maxRowWidth) {
      x = 0;
      y += rowH + gapY;
      rowH = 0;
    }
    placements.push({ ...block, x, y });
    x += block.w + gapX;
    rowH = Math.max(rowH, block.h);
  }

  const w = placements.reduce(
    (max, block) => Math.max(max, block.x + block.w),
    0,
  );
  const h = placements.reduce(
    (max, block) => Math.max(max, block.y + block.h),
    0,
  );
  return { placements, w, h };
}

function getImmediateChildModulePaths(members, modulePath) {
  const children = new Set();
  for (const nodePath of members) {
    const chain = getModulePathChain(nodePath);
    const index = chain.indexOf(modulePath);
    if (index >= 0 && chain[index + 1]) {
      children.add(chain[index + 1]);
    }
  }
  return [...children].sort((a, b) => a.localeCompare(b));
}

function buildFlatModuleInternalOffsets(
  members,
  modulePath,
  moduleGroup = null,
) {
  const offsets = {};
  const fragments = new Set(
    members.map((nodePath) =>
      getModuleRelativeResourcePath(nodePath, modulePath),
    ),
  );
  const useLambdaPreset = isLikelyLambdaModule(fragments, moduleGroup);
  const remaining = [];

  for (const nodePath of members) {
    const fragment = getModuleRelativeResourcePath(nodePath, modulePath);
    const presetKey = stripTerraformInstanceIndexes(fragment);
    const offset = useLambdaPreset
      ? LAMBDA_MODULE_PRESET_OFFSETS[presetKey]
      : null;

    if (offset) {
      offsets[nodePath] = offset;
    } else {
      remaining.push(nodePath);
    }
  }

  if (
    process.env.TF_LAYOUT_DEBUG &&
    modulePath.includes(process.env.TF_LAYOUT_DEBUG) &&
    !layoutInternalOffsetsDebugLogged.has(modulePath)
  ) {
    layoutInternalOffsetsDebugLogged.add(modulePath);
    console.error("[tf-layout] buildModuleInternalOffsets", {
      modulePath,
      useLambdaPreset,
      memberCount: members.length,
      remainingGridCount: remaining.length,
      offsets,
    });
  }

  const columns = Math.min(3, Math.max(1, remaining.length));
  const rows = Math.ceil(remaining.length / columns);
  const gapX = 280;
  const gapY = 160;
  const startX = -((columns - 1) * gapX) / 2;
  const startY = useLambdaPreset ? 340 : -((rows - 1) * gapY) / 2;

  for (let index = 0; index < remaining.length; index++) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    offsets[remaining[index]] = {
      x: startX + col * gapX,
      y: startY + row * gapY,
    };
  }

  return offsets;
}

function measureResourceSection(resourcePaths, tierMap, tierConfigs) {
  const blocks = resourcePaths.map((nodePath) => {
    const rect = measureResourceRect(nodePath, tierMap, tierConfigs);
    return { id: nodePath, nodePath, w: rect.w, h: rect.h };
  });
  const packed = packBlocks(blocks, {
    gapX: MODULE_RESOURCE_GAP_X,
    gapY: MODULE_RESOURCE_GAP_Y,
    maxRowWidth: 1060,
  });
  const offsets = {};
  for (const block of packed.placements) {
    offsets[block.nodePath] = { x: block.x, y: block.y };
  }
  return { w: packed.w, h: packed.h, offsets };
}

function measureModuleBlock(
  modulePath,
  members,
  moduleGroupByPath = new Map(),
  tierMap = {},
  tierConfigs = {},
) {
  const childModulePaths = getImmediateChildModulePaths(members, modulePath);
  const moduleGroup = moduleGroupByPath.get(modulePath) || null;

  if (childModulePaths.length === 0) {
    const rawOffsets = buildFlatModuleInternalOffsets(
      members,
      modulePath,
      moduleGroup,
    );
    const bounds = measureOffsetsBounds(rawOffsets, tierMap, tierConfigs);
    if (!bounds) {
      return { w: 0, h: 0, offsets: {} };
    }
    return {
      w: bounds.w + MODULE_PADDING_X * 2,
      h: bounds.h + MODULE_PADDING_TOP + MODULE_PADDING_BOTTOM,
      offsets: normalizeOffsets(
        rawOffsets,
        tierMap,
        tierConfigs,
        MODULE_PADDING_X,
        MODULE_PADDING_TOP,
      ),
    };
  }

  const directResources = members
    .filter((nodePath) => getOwningModulePath(nodePath) === modulePath)
    .sort((a, b) => a.localeCompare(b));
  const sections = [];
  const rawOffsets = {};

  if (directResources.length > 0) {
    const section = measureResourceSection(
      directResources,
      tierMap,
      tierConfigs,
    );
    sections.push({
      id: `${modulePath}::resources`,
      kind: "resources",
      w: section.w,
      h: section.h,
      offsets: section.offsets,
    });
  }

  for (const childModulePath of childModulePaths) {
    const childMembers = members
      .filter(
        (nodePath) =>
          nodePath === childModulePath ||
          nodePath.startsWith(`${childModulePath}.`),
      )
      .sort((a, b) => a.localeCompare(b));
    const childBlock = measureModuleBlock(
      childModulePath,
      childMembers,
      moduleGroupByPath,
      tierMap,
      tierConfigs,
    );
    sections.push({
      id: childModulePath,
      kind: "module",
      w: childBlock.w,
      h: childBlock.h,
      offsets: childBlock.offsets,
    });
  }

  const packed = packBlocks(sections, {
    gapX: MODULE_BLOCK_GAP_X,
    gapY: MODULE_BLOCK_GAP_Y,
    maxRowWidth: 1800,
  });

  for (const section of packed.placements) {
    for (const [nodePath, offset] of Object.entries(section.offsets)) {
      rawOffsets[nodePath] = {
        x: section.x + offset.x,
        y: section.y + offset.y,
      };
    }
  }

  return {
    w: packed.w + MODULE_PADDING_X * 2,
    h: packed.h + MODULE_PADDING_TOP + MODULE_PADDING_BOTTOM,
    offsets: Object.fromEntries(
      Object.entries(rawOffsets).map(([nodePath, offset]) => [
        nodePath,
        {
          x: offset.x + MODULE_PADDING_X,
          y: offset.y + MODULE_PADDING_TOP,
        },
      ]),
    ),
  };
}

/** Relative {x,y} offsets of module members around the collapsed module anchor. */
function buildModuleInternalOffsets(
  members,
  modulePath,
  moduleGroup = null,
  tierMap = {},
  tierConfigs = {},
  moduleGroupByPath = null,
) {
  const childModulePaths = getImmediateChildModulePaths(members, modulePath);
  if (childModulePaths.length === 0) {
    return buildFlatModuleInternalOffsets(members, modulePath, moduleGroup);
  }

  const groups =
    moduleGroupByPath ||
    new Map([[modulePath, moduleGroup]].filter(([, group]) => Boolean(group)));
  return measureModuleBlock(modulePath, members, groups, tierMap, tierConfigs)
    .offsets;
}

/** Bounding box size per collapsed module from internal offsets + tier card dimensions. */
function estimateModuleLayoutSizes(
  moduleMembers,
  moduleGroupByPath,
  tierMap,
  tierConfigs,
) {
  const sizes = {};

  for (const [modulePath, members] of moduleMembers.entries()) {
    const block = measureModuleBlock(
      modulePath,
      members,
      moduleGroupByPath,
      tierMap,
      tierConfigs,
    );
    if (block.w <= 0 || block.h <= 0) {
      continue;
    }
    sizes[modulePath] = { w: block.w + 120, h: block.h + 120 };
  }

  return sizes;
}

/** Maps simulation positions: standalone nodes keep layout coords; module members fan out from module anchor. */
function expandCollapsedModulePositions(
  layoutPositions,
  nodeKeys,
  moduleMembers,
  moduleGroupByPath,
  tierMap = {},
  tierConfigs = {},
) {
  const positions = {};
  const collapsedNodeSet = new Set(
    [...moduleMembers.values()].flatMap((members) => members),
  );

  for (const nodePath of nodeKeys) {
    if (!collapsedNodeSet.has(nodePath)) {
      positions[nodePath] = layoutPositions[nodePath];
    }
  }

  for (const [modulePath, members] of moduleMembers.entries()) {
    const anchor = layoutPositions[modulePath];
    if (!anchor) {
      continue;
    }

    const moduleGroup = moduleGroupByPath.get(modulePath);
    const offsets = buildModuleInternalOffsets(
      members,
      modulePath,
      moduleGroup,
      tierMap,
      tierConfigs,
      moduleGroupByPath,
    );

    for (const nodePath of members) {
      const offset = offsets[nodePath];
      if (!offset) {
        continue;
      }
      positions[nodePath] = {
        x: anchor.x + offset.x,
        y: anchor.y + offset.y,
      };
    }
  }

  return positions;
}

/** Axis-aligned bounds of given nodes using their tier width/height (or null if empty). */
function measureBoundsFromNodePositions(
  nodePaths,
  positions,
  tierMap,
  tierConfigs,
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const nodePath of nodePaths) {
    const pos = positions[nodePath];
    if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
      continue;
    }
    const cfg = tierConfigs[tierMap[nodePath]];
    if (!cfg) {
      continue;
    }
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + cfg.w);
    maxY = Math.max(maxY, pos.y + cfg.h);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Pins perimeter nodes (e.g. VPC endpoints) onto the VPC frame derived from
 * interior member bounds + the same padding used for the dashed VPC rectangle.
 */
function snapVpcPerimeterResourcePositions(
  positions,
  accountRegionGroups,
  tierMap,
  tierConfigs,
  perimeterSet,
  nodes,
) {
  const perimeterWallByNodePath = new Map();
  if (!VPC_PERIMETER_LAYOUT_ENABLED || perimeterSet.size === 0) {
    return perimeterWallByNodePath;
  }

  const VPC_PAD_X = 68;
  const VPC_PAD_TOP = 96;
  const VPC_PAD_BOTTOM = 52;

  for (const accountGroup of accountRegionGroups) {
    for (const regionGroup of accountGroup.regions || []) {
      for (const vpcGroup of regionGroup.vpcs || []) {
        const interiorPaths = vpcGroup.nodePaths.filter(
          (p) => !perimeterSet.has(p),
        );
        const perimeterPaths = vpcGroup.nodePaths.filter((p) =>
          perimeterSet.has(p),
        );
        if (perimeterPaths.length === 0) {
          continue;
        }

        const inner = measureBoundsFromNodePositions(
          interiorPaths,
          positions,
          tierMap,
          tierConfigs,
        );
        if (!inner) {
          continue;
        }

        const frameMinX = inner.minX - VPC_PAD_X;
        const frameMaxX = inner.maxX + VPC_PAD_X;
        const frameMinY = inner.minY - VPC_PAD_TOP;
        const frameMaxY = inner.maxY + VPC_PAD_BOTTOM;

        const sorted = [...perimeterPaths].sort((a, b) => a.localeCompare(b));
        const buckets = {
          leftWall: [],
          topWall: [],
          rightWall: [],
          bottomWall: [],
        };

        for (const p of sorted) {
          const wall = classifyVpcApplianceWall(p, nodes[p]);
          if (wall && buckets[wall]) {
            buckets[wall].push(p);
            perimeterWallByNodePath.set(p, wall);
          }
        }

        const frame = {
          minX: frameMinX,
          maxX: frameMaxX,
          minY: frameMinY,
          maxY: frameMaxY,
        };
        const placements = layoutVpcApplianceRectanglesOnFrame(
          frame,
          buckets,
          (path) => {
            const cfg = tierConfigs[tierMap[path]];
            return { w: cfg?.w ?? 120, h: cfg?.h ?? 80 };
          },
        );
        for (const pl of placements) {
          positions[pl.item] = { x: pl.x, y: pl.y };
        }
      }
    }
  }
  return perimeterWallByNodePath;
}

/** Turns networking-v2 facet sections into small drawable “appliance” tile descriptors on the VPC edge. */
function collectVpcApplianceTilesFromFacets(vpcFacets) {
  const tiles = [];
  for (const facet of vpcFacets || []) {
    if (facet?.id !== "networking-v2" || !Array.isArray(facet.sections)) {
      continue;
    }
    for (const top of facet.sections) {
      const children = Array.isArray(top.sections) ? top.sections : [];
      if (top.label === "Route tables") {
        for (const child of children) {
          tiles.push({
            key: child.id || child.label || `rt-${tiles.length}`,
            label: child.summary
              ? `Route table ${child.summary}`
              : child.label || "Route table",
            applianceKind: "route_table",
          });
        }
      } else if (top.label === "Gateways") {
        for (const child of children) {
          const label = String(child.label || "").toLowerCase();
          let gatewayKind = "other";
          if (label.includes("internet_gateway") || label.includes("igw")) {
            gatewayKind = "igw";
          } else if (
            label.includes("nat_gateway") ||
            label.includes("nat gateway") ||
            (label.includes("nat") && label.includes("gateway"))
          ) {
            gatewayKind = "nat";
          }
          tiles.push({
            key: child.id || child.label || `gw-${tiles.length}`,
            label: child.label || "Gateway",
            applianceKind: "gateway",
            gatewayKind,
          });
        }
      } else if (top.label === "Route table associations (VPC)") {
        for (const child of children) {
          tiles.push({
            key: child.id || child.label || `assoc-${tiles.length}`,
            label: child.label || "Route association",
            applianceKind: "route_assoc",
          });
        }
      }
    }
  }
  return tiles;
}

/** Positions synthetic facet tiles (route tables, gateways, …) along the VPC frame edges. */
function layoutApplianceTilesOnVpcEdges(
  vpcApplianceTiles,
  vpcBoxX,
  vpcBoxY,
  vpcBoxW,
  vpcBoxH,
) {
  const tileW = 180;
  const tileH = 44;
  const sideBuckets = {
    topWall: [],
    rightWall: [],
    bottomWall: [],
    leftWall: [],
  };
  for (const tile of vpcApplianceTiles) {
    sideBuckets[classifySyntheticVpcTileWall(tile)].push(tile);
  }

  const frame = {
    minX: vpcBoxX,
    maxX: vpcBoxX + vpcBoxW,
    minY: vpcBoxY,
    maxY: vpcBoxY + vpcBoxH,
  };
  const raw = layoutVpcApplianceRectanglesOnFrame(frame, sideBuckets, () => ({
    w: tileW,
    h: tileH,
  }));
  return raw.map((pl) => ({
    tile: pl.item,
    x: pl.x,
    y: pl.y,
    tileW: pl.w,
    tileH: pl.h,
    wall: pl.wall,
  }));
}

/** Stroke/fill palette for small VPC appliance / facet tile rectangles by semantic kind. */
function applianceStyleForKind(kind) {
  if (kind === "route_table") {
    return { strokeColor: "#c77d00", backgroundColor: "#fff4cc" };
  }
  if (kind === "gateway") {
    return { strokeColor: "#0c8599", backgroundColor: "#d3f9fa" };
  }
  if (kind === "route_assoc") {
    return { strokeColor: "#5f3dc4", backgroundColor: "#e5dbff" };
  }
  if (kind === "endpoint") {
    return { strokeColor: "#2b8a3e", backgroundColor: "#d8f5a2" };
  }
  if (kind === "load_balancer") {
    return { strokeColor: "#1864ab", backgroundColor: "#d0ebff" };
  }
  if (kind === "transit_gateway") {
    return { strokeColor: "#5c940d", backgroundColor: "#ebfbee" };
  }
  if (kind === "vpn") {
    return { strokeColor: "#9c36b5", backgroundColor: "#f3d9fa" };
  }
  if (kind === "direct_connect") {
    return { strokeColor: "#087f5b", backgroundColor: "#c3fae8" };
  }
  return { strokeColor: "#495057", backgroundColor: "#f1f3f5" };
}

module.exports = {
  forceLayout,
  elkLayout,
  buildCollapsibleModuleSet,
  getCollapsedModulePath,
  buildCollapsedLayoutModel,
  measureResourceRect,
  measureModuleBlock,
  packBlocks,
  normalizeOffsets,
  buildModuleInternalOffsets,
  estimateModuleLayoutSizes,
  expandCollapsedModulePositions,
  measureBoundsFromNodePositions,
  snapVpcPerimeterResourcePositions,
  collectVpcApplianceTilesFromFacets,
  layoutApplianceTilesOnVpcEdges,
  applianceStyleForKind,
};
