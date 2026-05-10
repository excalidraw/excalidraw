/**
 * Terraform processed `nodes` map → Excalidraw v2 scene (elements + minimal `appState`).
 *
 * Orchestrates `excalidraw-elements.js`, `excalidraw-layout.js`, and `excalidraw-arrows.js`.
 * See those modules for phase-specific logic (icons/tiers, force layout / VPC snaps, edges/lines).
 */
const { extractVpcNetworkingFacetStore } = require("./vpc-networking-facet");
const {
  VPC_PERIMETER_LAYOUT_ENABLED,
  isVpcPerimeterNode,
  filterLayoutSimulationKeys,
  getVpcApplianceKindForNode,
} = require("./vpc-perimeter");

const {
  rand,
  makeBaseElement,
  buildNodeLocationMap,
  buildNodeVpcMap,
  buildNodeSubnetMap,
  buildContainerFacetContributors,
  collectModuleGroups,
  collectAccountRegionGroups,
  expandNetworkContainerGroupsWithModuleMembership,
  buildTierMap,
  buildTierConfigs,
  applyModulePresets,
  pinSyntheticTerraformModuleHubs,
  getResourceType,
  isInitiallyVisibleTerraformNode,
  getVisibilityCustomData,
  getModulePathChain,
  getPrimaryAction,
  buildTerraformResourceDetails,
  getLabel,
  getIconForType,
  cloneIconElements,
  collectContainerFacets,
  buildContainerFacetSummaryLine,
  buildContainerFacetCustomData,
  ACTION_COLORS,
  ACTION_STROKE,
} = require("./excalidraw-elements");

const {
  forceLayout,
  elkLayout,
  buildCollapsibleModuleSet,
  buildCollapsedLayoutModel,
  estimateModuleLayoutSizes,
  expandCollapsedModulePositions,
  snapVpcPerimeterResourcePositions,
  collectVpcApplianceTilesFromFacets,
  layoutApplianceTilesOnVpcEdges,
  applianceStyleForKind,
  measureBoundsFromNodePositions,
} = require("./excalidraw-layout");

const SUPPORTED_LAYOUT_ENGINES = new Set(["elk", "force"]);
const DEFAULT_LAYOUT_ENGINE = "elk";

/** Picks the layout engine, prioritizing explicit option > env var > default. */
function resolveLayoutEngine(explicit) {
  const candidates = [
    explicit,
    process.env.TF_LAYOUT_ENGINE,
    DEFAULT_LAYOUT_ENGINE,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const normalized = candidate.trim().toLowerCase();
    if (SUPPORTED_LAYOUT_ENGINES.has(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_LAYOUT_ENGINE;
}

const {
  collectDirectedEdges,
  coalesceRelationshipPairs,
  collectDataFlowEdges,
  buildTerraformExplodeParentMap,
  getCenterClippedBindingPoints,
  offsetLineSegment,
  fixedPointForAbsolutePoint,
  strokeColorForTerraformDependencyKinds,
} = require("./excalidraw-arrows");

/**
 * Converts enriched Terraform `nodes` (post-pipeline) into an Excalidraw document: nested frames,
 * resource cards, dependency + data-flow lines, and `customData` consumed by the editor.
 *
 * `options.layoutEngine`: `"elk"` (default, layered) or `"force"` (legacy d3-force). When
 * unset, falls back to the `TF_LAYOUT_ENGINE` env var, then to `"elk"`.
 * `options.vpcEndpointSnapping`: when `false`, excludes `aws_vpc_endpoint` resources from
 * VPC perimeter snapping while keeping other perimeter appliance snapping behavior.
 */
async function nodesToExcalidraw(nodes, options = {}) {
  // Choose layout backend (`elk` layered by default, or `force` if requested).
  const layoutEngineId = resolveLayoutEngine(options.layoutEngine);
  // Feature flag: when false, VPC endpoints are not snapped to perimeter walls.
  const vpcEndpointSnapping = options.vpcEndpointSnapping !== false;
  // Buckets of emitted Excalidraw elements; concatenated at the end in z-order.
  const nodeElements = [];
  const locationElements = [];
  const moduleElements = [];
  const edgeElements = [];
  // 1) Build the core graph model and helper indexes from post-pipeline `nodes`.
  // Real Terraform nodes only (skip metadata keys like `__networkingFacetStore`).
  const nodeKeys = Object.keys(nodes).filter((key) => !key.startsWith("__"));
  // Nodes considered "perimeter appliances" (LB/endpoint/etc.) for optional wall snapping.
  const perimeterSet = new Set(
    nodeKeys.filter((p) => {
      if (!isVpcPerimeterNode(p, nodes[p])) {
        return false;
      }
      if (vpcEndpointSnapping) {
        return true;
      }
      return getResourceType(p) !== "aws_vpc_endpoint";
    }),
  );
  // Structural graph edges merged from pipeline (`edges_new` + `edges_existing`).
  const directedEdges = collectDirectedEdges(nodes);
  // Perimeter appliances are snapped in a post-pass, so keep them out of solver edges.
  const directedEdgesForLayout =
    VPC_PERIMETER_LAYOUT_ENABLED && perimeterSet.size > 0
      ? directedEdges.filter(
          (edge) =>
            !perimeterSet.has(edge.source) && !perimeterSet.has(edge.target),
        )
      : directedEdges;
  const relationships = coalesceRelationshipPairs(directedEdges);
  // Semantic data-flow edges (API calls, IAM references, integration links, etc.).
  const dataFlowEdges = collectDataFlowEdges(nodes);
  // Undirected adjacency map used by frontend "explode neighborhood" interactions.
  const explodeParentMap = buildTerraformExplodeParentMap(
    nodeKeys,
    directedEdges,
    dataFlowEdges,
  );
  const dependencyPairKeys = new Set(
    relationships
      .filter(
        ({ source, target }) =>
          !isVpcPerimeterNode(source, nodes[source]) &&
          !isVpcPerimeterNode(target, nodes[target]),
      )
      .map(({ source, target }) => [source, target].sort().join("|||")),
  );
  // Infer geographic/account placement for account/region containers.
  const nodeLocationMap = buildNodeLocationMap(nodes);
  // Infer VPC membership for each node (explicit refs + heuristics).
  const nodeVpcMap = buildNodeVpcMap(nodes);
  // Infer subnet membership for each node (handles multi-subnet cases).
  const nodeSubnetMap = buildNodeSubnetMap(nodes, nodeVpcMap);
  // Preserve networking summaries before routing-plumbing nodes are stripped from graph.
  const networkingFacetStore =
    nodes.__networkingFacetStore || extractVpcNetworkingFacetStore(nodes);
  // Build per-container (VPC/subnet) facet payloads used for labels/panels/tiles.
  const containerFacetContributors = buildContainerFacetContributors({
    nodes,
    nodeLocationMap,
    nodeVpcMap,
    nodeSubnetMap,
    networkingFacetStore,
  });
  // Module grouping metadata (depth, label, source/version, members).
  const moduleGroups = collectModuleGroups(nodeKeys, nodes);
  // Hierarchy for large framing rectangles: account -> region -> vpc -> subnet.
  const accountRegionGroups = expandNetworkContainerGroupsWithModuleMembership(
    collectAccountRegionGroups(
      nodeKeys,
      nodeLocationMap,
      nodeVpcMap,
      nodeSubnetMap,
    ),
    moduleGroups,
    nodeLocationMap,
    nodeVpcMap,
    nodeSubnetMap,
  );
  const moduleGroupIdByPath = new Map(
    moduleGroups.map((group) => [group.modulePath, `module-group-${rand()}`]),
  );
  // Quick lookup for module metadata when expanding collapsed module layout blocks.
  const moduleGroupByPath = new Map(
    moduleGroups.map((group) => [group.modulePath, group]),
  );

  // 2) Collapse nested modules for the global layout solve.
  // Tier map gives a coarse "importance/level" rank used by both layout engines.
  const tierMap = buildTierMap(nodeKeys);
  // Select modules that should collapse into one synthetic layout vertex.
  const collapsibleModules = buildCollapsibleModuleSet(moduleGroups);
  // Collapsed model: layout ids, reduced edges, per-layout tier, module->member mapping.
  const { layoutNodeKeys, layoutEdges, layoutTierMap, moduleMembers } =
    buildCollapsedLayoutModel(
      nodeKeys,
      directedEdgesForLayout,
      tierMap,
      collapsibleModules,
    );
  // Nodes that actually participate in the solver (exclude perimeter-snap outliers).
  const layoutSimulationKeys = filterLayoutSimulationKeys(
    layoutNodeKeys,
    moduleMembers,
    perimeterSet,
  );
  // Visual size/style presets for concrete nodes and collapsed module blocks.
  const tierConfigs = buildTierConfigs(tierMap, nodeKeys.length);
  const layoutTierConfigs = buildTierConfigs(
    layoutTierMap,
    layoutSimulationKeys.length,
  );
  const layoutSizes = estimateModuleLayoutSizes(
    moduleMembers,
    moduleGroupByPath,
    tierMap,
    tierConfigs,
  );

  // Engine dispatch: ELK layered unless user explicitly requests d3-force.
  const useElk = layoutEngineId !== "force";
  const layoutEngine = useElk ? elkLayout : forceLayout;
  // For fast membership checks while assembling nesting groups.
  const layoutSimulationKeySet = new Set(layoutSimulationKeys);
  // Map every concrete node to the layout id that represents it in collapsed solve.
  const nodeToLayoutId = new Map();
  for (const [modulePath, members] of moduleMembers) {
    for (const member of members) {
      nodeToLayoutId.set(member, modulePath);
    }
  }
  for (const nodePath of nodeKeys) {
    if (!nodeToLayoutId.has(nodePath)) {
      nodeToLayoutId.set(nodePath, nodePath);
    }
  }
  const elkNestingGroups = [];
  // ELK-only grouping hint: keep VPC peers spatially cohesive.
  if (useElk) {
    for (const accountGroup of accountRegionGroups) {
      for (const regionGroup of accountGroup.regions || []) {
        for (const vpcGroup of regionGroup.vpcs || []) {
          const memberLayoutIds = new Set();
          for (const nodePath of vpcGroup.nodePaths) {
            const layoutId = nodeToLayoutId.get(nodePath);
            if (layoutId && layoutSimulationKeySet.has(layoutId)) {
              memberLayoutIds.add(layoutId);
            }
          }
          // Nesting one member gives no value; require at least two.
          if (memberLayoutIds.size < 2) {
            continue;
          }
          elkNestingGroups.push({
            id: `vpc:${accountGroup.accountId}:${regionGroup.region}:${vpcGroup.vpcKey}`,
            members: [...memberLayoutIds],
          });
        }
      }
    }
  }
  const layoutPositions = await layoutEngine(
    layoutSimulationKeys,
    layoutEdges,
    layoutTierMap,
    layoutTierConfigs,
    layoutSizes,
    useElk ? { nestingGroups: elkNestingGroups } : {},
  );
  // 3) Expand collapsed module anchors into per-resource coordinates.
  const positions = expandCollapsedModulePositions(
    layoutPositions,
    nodeKeys,
    moduleMembers,
    moduleGroupByPath,
    tierMap,
    tierConfigs,
  );
  const recursivelyLaidOutModules = new Set();
  // Modules already covered by expansion should skip static presets to avoid double-offsetting.
  for (const members of moduleMembers.values()) {
    for (const nodePath of members) {
      for (const modulePath of getModulePathChain(nodePath)) {
        recursivelyLaidOutModules.add(modulePath);
      }
    }
  }
  applyModulePresets(positions, nodeKeys, moduleGroupByPath, {
    skipModulePaths: recursivelyLaidOutModules,
  });
  // 4) Terraform-specific post-layout passes (perimeter snap + synthetic hub pinning).
  const perimeterWallByNodePath = snapVpcPerimeterResourcePositions(
    positions,
    accountRegionGroups,
    tierMap,
    tierConfigs,
    perimeterSet,
    nodes,
  );
  // Safety net: every perimeter node must have coordinates for downstream element emission.
  for (const path of perimeterSet) {
    const pos = positions[path];
    if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
      positions[path] = { x: 120, y: 120 };
    }
  }
  pinSyntheticTerraformModuleHubs(
    positions,
    nodeKeys,
    nodes,
    tierMap,
    tierConfigs,
  );
  // `posMap`: nodePath -> emitted rectangle/text ids + rectangle geometry.
  const posMap = {};
  // `nodeRectById`: emitted rectangle id -> rectangle element (for edge bindings).
  const nodeRectById = new Map();

  // 5) Emit resource cards (rectangles + labels + optional service icons).
  for (let i = 0; i < nodeKeys.length; i++) {
    const nodePath = nodeKeys[i];
    const tier = tierMap[nodePath];
    const cfg = tierConfigs[tier];
    const { x, y } = positions[nodePath];
    const resourceType = getResourceType(nodePath);
    const initiallyVisible = isInitiallyVisibleTerraformNode(
      nodePath,
      nodes[nodePath],
    );
    const visibilityCustomData = getVisibilityCustomData(
      nodePath,
      initiallyVisible,
      [...(explodeParentMap.get(nodePath) || [])].sort(),
    );
    const groupId = `node-${rand()}`;
    // Group stack: node-local group + ancestor module groups (outermost last).
    const moduleGroupIds = getModulePathChain(nodePath)
      .reverse()
      .map((modulePath) => moduleGroupIdByPath.get(modulePath))
      .filter(Boolean);
    const groupIds = [groupId, ...moduleGroupIds];

    const rectId = `rect-${i}`;
    const textId = `text-${i}`;
    // Store for edge routing/binding and later container membership checks.
    posMap[nodePath] = { x, y, w: cfg.w, h: cfg.h, rectId, textId };

    const action = getPrimaryAction(nodes[nodePath]);
    const isVpcPerimeter = isVpcPerimeterNode(nodePath, nodes[nodePath]);
    const vpcApplianceKind = isVpcPerimeter
      ? getVpcApplianceKindForNode(nodePath, nodes[nodePath])
      : null;
    const applianceStyle = isVpcPerimeter
      ? applianceStyleForKind(vpcApplianceKind)
      : null;
    const bgColor =
      applianceStyle?.backgroundColor || ACTION_COLORS[action] || ACTION_COLORS.existing;
    const strokeColor =
      applianceStyle?.strokeColor || ACTION_STROKE[action] || ACTION_STROKE.existing;
    const label = getLabel(nodePath);
    const terraformResources = buildTerraformResourceDetails(nodes[nodePath]);
    const nodeLocation = nodeLocationMap.get(nodePath) || null;
    const nodeVpc = nodeVpcMap.get(nodePath) || null;
    const nodeSubnet = nodeSubnetMap.get(nodePath) || null;

    // Check for icon
    const iconElements = cfg.iconSize > 0 ? getIconForType(resourceType) : null;
    const hasIcon = iconElements && iconElements.length > 0;
    const iconPad = 12;
    const iconArea = hasIcon ? cfg.iconSize + iconPad : 0;

    const rectElement = makeBaseElement({
      type: "rectangle",
      id: rectId,
      x,
      y,
      width: cfg.w,
      height: cfg.h,
      strokeColor,
      strokeWidth: cfg.strokeWidth,
      backgroundColor: bgColor,
      roundness: { type: 3 },
      groupIds,
      boundElements: [],
      strokeStyle:
        isVpcPerimeter && vpcApplianceKind === "endpoint"
          ? "dotted"
          : action === "external"
            ? "dashed"
            : "solid",
      customData: {
        // Canonical Terraform metadata consumed by UI panels/filters/hover behavior.
        terraform: true,
        ...visibilityCustomData,
        resourceType,
        nodePath,
        action,
        terraformVpcAppliance: isVpcPerimeter,
        terraformVpcApplianceKind: isVpcPerimeter ? vpcApplianceKind : null,
        terraformVpcApplianceWall: isVpcPerimeter
          ? perimeterWallByNodePath.get(nodePath) || null
          : null,
        region: nodeLocation?.region || null,
        accountId: nodeLocation?.accountId || null,
        vpcId: nodeVpc?.vpcKey || null,
        vpcLabel: nodeVpc?.vpcLabel || null,
        subnetId: nodeSubnet?.subnetKey || null,
        subnetLabel: nodeSubnet?.subnetLabel || null,
        terraformResources,
      },
      isDeleted: !initiallyVisible,
    });
    nodeElements.push(rectElement);
    nodeRectById.set(rectId, rectElement);

    // Text label: shifted right to reserve icon gutter when an icon is present.
    const textX = x + iconArea + 8;
    const textW = cfg.w - iconArea - 16;

    nodeElements.push(
      makeBaseElement({
        type: "text",
        id: textId,
        x: textX,
        y: y + 10,
        width: textW,
        height: cfg.h - 20,
        text: label,
        fontSize: cfg.fontSize,
        fontFamily: 3,
        textAlign: hasIcon ? "left" : "center",
        verticalAlign: "middle",
        groupIds,
        containerId: null,
        originalText: label,
        autoResize: false,
        lineHeight: 1.25,
        strokeColor: "#1e1e1e",
        isDeleted: !initiallyVisible,
        customData: {
          terraform: true,
          ...visibilityCustomData,
          resourceType,
          nodePath,
        },
      }),
    );

    // Icon elements (scaled and positioned inside the rectangle)
    if (hasIcon) {
      const iconX = x + iconPad;
      const iconY = y + (cfg.h - cfg.iconSize) / 2;
      const clonedIcons = cloneIconElements(
        iconElements,
        iconX,
        iconY,
        cfg.iconSize,
        groupIds,
      ).map((element) => ({
        ...element,
        isDeleted: !initiallyVisible,
        customData: {
          ...(element.customData || {}),
          terraform: true,
          ...visibilityCustomData,
          resourceType,
          nodePath,
        },
      }));
      nodeElements.push(...clonedIcons);
    }
  }

  // --- module grouping boxes ---
  const MODULE_STROKES = ["#5c7cfa", "#339af0", "#22b8cf", "#20c997"];
  const MODULE_PADDING_X = 52;
  const MODULE_PADDING_TOP = 72;
  const MODULE_PADDING_BOTTOM = 40;
  const moduleBoundsByPath = new Map();

  for (let i = 0; i < moduleGroups.length; i++) {
    const group = moduleGroups[i];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const nodePath of group.nodePaths) {
      const pos = posMap[nodePath];
      if (!pos) {
        continue;
      }
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.w);
      maxY = Math.max(maxY, pos.y + pos.h);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      continue;
    }

    const depthInset = Math.max(0, (group.depth - 1) * 8);
    const padX = Math.max(28, MODULE_PADDING_X - depthInset);
    const padTop = Math.max(48, MODULE_PADDING_TOP - depthInset);
    const padBottom = Math.max(28, MODULE_PADDING_BOTTOM - depthInset);
    const boxX = minX - padX;
    const boxY = minY - padTop;
    const boxW = maxX - minX + padX * 2;
    const boxH = maxY - minY + padTop + padBottom;
    moduleBoundsByPath.set(group.modulePath, {
      x: boxX,
      y: boxY,
      w: boxW,
      h: boxH,
    });
    const groupId = moduleGroupIdByPath.get(group.modulePath);
    const parentGroupIds = getModulePathChain(group.modulePath)
      .slice(0, -1)
      .reverse()
      .map((modulePath) => moduleGroupIdByPath.get(modulePath))
      .filter(Boolean);
    const boxGroupIds = [groupId, ...parentGroupIds];
    const boxId = `module-box-${i}`;
    const labelId = `module-label-${i}`;
    const strokeColor =
      MODULE_STROKES[(group.depth - 1) % MODULE_STROKES.length];
    const initiallyVisible = group.nodePaths.some((nodePath) =>
      isInitiallyVisibleTerraformNode(nodePath, nodes[nodePath]),
    );
    const groupVisibilityCustomData = {
      terraformVisibilityRole: "group",
      terraformVisibilityKey: group.modulePath,
      terraformGroupChildKeys: group.nodePaths,
    };
    const moduleFacets = collectContainerFacets(
      {
        kind: "module",
        key: group.modulePath,
        label: group.moduleLabel,
        nodePaths: group.nodePaths,
      },
      containerFacetContributors,
    );
    const moduleFacetSummary = buildContainerFacetSummaryLine(moduleFacets);
    const moduleLabelText = moduleFacetSummary
      ? `module ${group.moduleLabel}\n${moduleFacetSummary}`
      : `module ${group.moduleLabel}`;

    moduleElements.push(
      makeBaseElement({
        type: "rectangle",
        id: boxId,
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        strokeColor,
        strokeWidth: group.depth <= 1 ? 2 : 1,
        strokeStyle: "dashed",
        backgroundColor: "transparent",
        roundness: { type: 3 },
        groupIds: boxGroupIds,
        boundElements: [{ id: labelId, type: "text" }],
        isDeleted: !initiallyVisible,
        customData: {
          ...buildContainerFacetCustomData(
            {
              terraform: false,
              ...groupVisibilityCustomData,
              terraformModuleGroup: true,
              modulePath: group.modulePath,
              moduleDepth: group.depth,
              moduleSource: group.source,
              moduleVersion: group.version,
            },
            moduleFacets,
          ),
        },
      }),
    );

    moduleElements.push(
      makeBaseElement({
        type: "text",
        id: labelId,
        x: boxX + 10,
        y: boxY + 8,
        width: Math.max(80, boxW - 20),
        height: 24,
        text: moduleLabelText,
        fontSize: group.depth <= 1 ? 18 : 16,
        fontFamily: 3,
        textAlign: "left",
        verticalAlign: "top",
        groupIds: boxGroupIds,
        containerId: boxId,
        originalText: moduleLabelText,
        autoResize: false,
        lineHeight: 1.2,
        strokeColor,
        isDeleted: !initiallyVisible,
        customData: {
          ...buildContainerFacetCustomData(
            {
              terraform: false,
              ...groupVisibilityCustomData,
              terraformModuleGroup: true,
              modulePath: group.modulePath,
              moduleSource: group.source,
              moduleVersion: group.version,
            },
            moduleFacets,
          ),
        },
      }),
    );
  }

  const moduleMemberSetsByPath = new Map(
    moduleGroups.map((group) => [group.modulePath, new Set(group.nodePaths)]),
  );

  const getSemanticModulePathForContainer = (nodePath, containerNodeSet) => {
    const chain = getModulePathChain(nodePath)
      .filter((modulePath) => moduleBoundsByPath.has(modulePath))
      .sort((a, b) => b.length - a.length);

    for (const modulePath of chain) {
      const memberSet = moduleMemberSetsByPath.get(modulePath);
      if (
        memberSet &&
        [...memberSet].every((memberPath) => containerNodeSet.has(memberPath))
      ) {
        return modulePath;
      }
    }
    return null;
  };

  const getVisualBoundsForNodePath = (nodePath, containerNodeSet) => {
    const modulePath = getSemanticModulePathForContainer(
      nodePath,
      containerNodeSet,
    );
    if (modulePath) {
      return moduleBoundsByPath.get(modulePath);
    }
    return posMap[nodePath];
  };

  const getUniqueVisualBounds = (nodePaths, semanticNodePaths = nodePaths) => {
    const boundsByKey = new Map();
    const containerNodeSet = new Set(semanticNodePaths);

    for (const nodePath of nodePaths) {
      const modulePath = getSemanticModulePathForContainer(
        nodePath,
        containerNodeSet,
      );
      const key = modulePath || nodePath;
      const bounds = getVisualBoundsForNodePath(nodePath, containerNodeSet);
      if (bounds && !boundsByKey.has(key)) {
        boundsByKey.set(key, bounds);
      }
    }

    return [...boundsByKey.values()];
  };

  const measureBounds = (boundsList) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const bounds of boundsList) {
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.w);
      maxY = Math.max(maxY, bounds.y + bounds.h);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return null;
    }

    return { minX, minY, maxX, maxY };
  };

  // --- account / region grouping boxes ---
  const ACCOUNT_STROKE = "#0b7285";
  const REGION_STROKE = "#1864ab";
  const ACCOUNT_PADDING_X = 132;
  const ACCOUNT_PADDING_TOP = 168;
  const ACCOUNT_PADDING_BOTTOM = 108;
  const REGION_PADDING_X = 100;
  const REGION_PADDING_TOP = 132;
  const REGION_PADDING_BOTTOM = 78;
  const VPC_STROKE = "#2b8a3e";
  const VPC_PADDING_X = 68;
  const VPC_PADDING_TOP = 96;
  const VPC_PADDING_BOTTOM = 52;
  const SUBNET_STROKE = "#099268";
  const SUBNET_PADDING_X = 36;
  const SUBNET_PADDING_TOP = 58;
  const SUBNET_PADDING_BOTTOM = 28;

  let accountBoxIndex = 0;
  let regionBoxIndex = 0;
  let vpcBoxIndex = 0;
  for (const accountGroup of accountRegionGroups) {
    const accountBounds = measureBounds(
      getUniqueVisualBounds(accountGroup.nodePaths),
    );
    if (!accountBounds) {
      continue;
    }

    const accountGroupId = `account-group-${rand()}`;
    const accountBoxX = accountBounds.minX - ACCOUNT_PADDING_X;
    const accountBoxY = accountBounds.minY - ACCOUNT_PADDING_TOP;
    const accountBoxW =
      accountBounds.maxX - accountBounds.minX + ACCOUNT_PADDING_X * 2;
    const accountBoxH =
      accountBounds.maxY -
      accountBounds.minY +
      ACCOUNT_PADDING_TOP +
      ACCOUNT_PADDING_BOTTOM;
    const accountBoxId = `account-box-${accountBoxIndex}`;
    const accountLabelId = `account-label-${accountBoxIndex}`;
    accountBoxIndex += 1;
    const accountInitiallyVisible = accountGroup.nodePaths.some((nodePath) =>
      isInitiallyVisibleTerraformNode(nodePath, nodes[nodePath]),
    );
    const accountVisibilityCustomData = {
      terraformVisibilityRole: "group",
      terraformVisibilityKey: `account:${accountGroup.accountId}`,
      terraformGroupChildKeys: accountGroup.nodePaths,
    };
    const accountFacets = collectContainerFacets(
      {
        kind: "account",
        key: accountGroup.accountId,
        label: accountGroup.accountId,
        nodePaths: accountGroup.nodePaths,
      },
      containerFacetContributors,
    );
    const accountFacetSummary = buildContainerFacetSummaryLine(accountFacets);
    const accountLabelText = accountFacetSummary
      ? `account ${accountGroup.accountId}\n${accountFacetSummary}`
      : `account ${accountGroup.accountId}`;

    locationElements.push(
      makeBaseElement({
        type: "rectangle",
        id: accountBoxId,
        x: accountBoxX,
        y: accountBoxY,
        width: accountBoxW,
        height: accountBoxH,
        strokeColor: ACCOUNT_STROKE,
        strokeWidth: 2,
        strokeStyle: "solid",
        backgroundColor: "transparent",
        roundness: { type: 3 },
        groupIds: [accountGroupId],
        boundElements: [{ id: accountLabelId, type: "text" }],
        isDeleted: !accountInitiallyVisible,
        customData: {
          ...buildContainerFacetCustomData(
            {
              terraform: false,
              ...accountVisibilityCustomData,
              terraformAccountGroup: true,
              accountId: accountGroup.accountId,
            },
            accountFacets,
          ),
        },
      }),
    );

    locationElements.push(
      makeBaseElement({
        type: "text",
        id: accountLabelId,
        x: accountBoxX + 10,
        y: accountBoxY + 8,
        width: Math.max(120, accountBoxW - 20),
        height: 24,
        text: accountLabelText,
        fontSize: 18,
        fontFamily: 3,
        textAlign: "left",
        verticalAlign: "top",
        groupIds: [accountGroupId],
        containerId: accountBoxId,
        originalText: accountLabelText,
        autoResize: false,
        lineHeight: 1.2,
        strokeColor: ACCOUNT_STROKE,
        isDeleted: !accountInitiallyVisible,
        customData: {
          ...buildContainerFacetCustomData(
            {
              terraform: false,
              ...accountVisibilityCustomData,
              terraformAccountGroup: true,
              accountId: accountGroup.accountId,
            },
            accountFacets,
          ),
        },
      }),
    );

    for (const regionGroup of accountGroup.regions) {
      const regionBounds = measureBounds(
        getUniqueVisualBounds(regionGroup.nodePaths),
      );
      if (!regionBounds) {
        continue;
      }

      const regionGroupId = `region-group-${rand()}`;
      const regionBoxX = regionBounds.minX - REGION_PADDING_X;
      const regionBoxY = regionBounds.minY - REGION_PADDING_TOP;
      const regionBoxW =
        regionBounds.maxX - regionBounds.minX + REGION_PADDING_X * 2;
      const regionBoxH =
        regionBounds.maxY -
        regionBounds.minY +
        REGION_PADDING_TOP +
        REGION_PADDING_BOTTOM;
      const regionBoxId = `region-box-${regionBoxIndex}`;
      const regionLabelId = `region-label-${regionBoxIndex}`;
      regionBoxIndex += 1;
      const regionInitiallyVisible = regionGroup.nodePaths.some((nodePath) =>
        isInitiallyVisibleTerraformNode(nodePath, nodes[nodePath]),
      );
      const regionVisibilityCustomData = {
        terraformVisibilityRole: "group",
        terraformVisibilityKey: `region:${regionGroup.accountId}:${regionGroup.region}`,
        terraformGroupChildKeys: regionGroup.nodePaths,
      };
      const regionFacets = collectContainerFacets(
        {
          kind: "region",
          key: `${regionGroup.accountId}:${regionGroup.region}`,
          label: regionGroup.region,
          nodePaths: regionGroup.nodePaths,
        },
        containerFacetContributors,
      );
      const regionFacetSummary = buildContainerFacetSummaryLine(regionFacets);
      const regionLabelText = regionFacetSummary
        ? `region ${regionGroup.region}\n${regionFacetSummary}`
        : `region ${regionGroup.region}`;

      const regionGroupIds = [regionGroupId, accountGroupId];

      locationElements.push(
        makeBaseElement({
          type: "rectangle",
          id: regionBoxId,
          x: regionBoxX,
          y: regionBoxY,
          width: regionBoxW,
          height: regionBoxH,
          strokeColor: REGION_STROKE,
          strokeWidth: 1,
          strokeStyle: "dashed",
          backgroundColor: "transparent",
          roundness: { type: 3 },
          groupIds: regionGroupIds,
          boundElements: [{ id: regionLabelId, type: "text" }],
          isDeleted: !regionInitiallyVisible,
          customData: {
            ...buildContainerFacetCustomData(
              {
                terraform: false,
                ...regionVisibilityCustomData,
                terraformRegionGroup: true,
                accountId: regionGroup.accountId,
                region: regionGroup.region,
              },
              regionFacets,
            ),
          },
        }),
      );

      locationElements.push(
        makeBaseElement({
          type: "text",
          id: regionLabelId,
          x: regionBoxX + 10,
          y: regionBoxY + 8,
          width: Math.max(100, regionBoxW - 20),
          height: 22,
          text: regionLabelText,
          fontSize: 16,
          fontFamily: 3,
          textAlign: "left",
          verticalAlign: "top",
          groupIds: regionGroupIds,
          containerId: regionBoxId,
          originalText: regionLabelText,
          autoResize: false,
          lineHeight: 1.2,
          strokeColor: REGION_STROKE,
          isDeleted: !regionInitiallyVisible,
          customData: {
            ...buildContainerFacetCustomData(
              {
                terraform: false,
                ...regionVisibilityCustomData,
                terraformRegionGroup: true,
                accountId: regionGroup.accountId,
                region: regionGroup.region,
              },
              regionFacets,
            ),
          },
        }),
      );

      for (const vpcGroup of regionGroup.vpcs || []) {
        const vpcInteriorPaths = vpcGroup.nodePaths.filter(
          (p) => !perimeterSet.has(p),
        );
        const boundsPaths =
          vpcInteriorPaths.length > 0 ? vpcInteriorPaths : vpcGroup.nodePaths;
        const vpcBounds =
          measureBounds(getUniqueVisualBounds(boundsPaths, vpcGroup.nodePaths)) ||
          measureBoundsFromNodePositions(
            boundsPaths,
            positions,
            tierMap,
            tierConfigs,
          );
        if (!vpcBounds) {
          continue;
        }

        const vpcGroupId = `vpc-group-${rand()}`;
        const vpcBoxX = vpcBounds.minX - VPC_PADDING_X;
        const vpcBoxY = vpcBounds.minY - VPC_PADDING_TOP;
        const vpcBoxW = vpcBounds.maxX - vpcBounds.minX + VPC_PADDING_X * 2;
        const vpcBoxH =
          vpcBounds.maxY -
          vpcBounds.minY +
          VPC_PADDING_TOP +
          VPC_PADDING_BOTTOM;
        const vpcBoxId = `vpc-box-${vpcBoxIndex}`;
        const vpcLabelId = `vpc-label-${vpcBoxIndex}`;
        vpcBoxIndex += 1;
        const vpcInitiallyVisible = vpcGroup.nodePaths.some((nodePath) =>
          isInitiallyVisibleTerraformNode(nodePath, nodes[nodePath]),
        );
        const vpcVisibilityCustomData = {
          terraformVisibilityRole: "group",
          terraformVisibilityKey: `vpc:${vpcGroup.accountId}:${vpcGroup.region}:${vpcGroup.vpcKey}`,
          terraformGroupChildKeys: vpcGroup.nodePaths,
        };
        const vpcFacets = collectContainerFacets(
          {
            kind: "vpc",
            key: vpcGroup.vpcKey,
            label: vpcGroup.vpcLabel,
            nodePaths: vpcGroup.nodePaths,
          },
          containerFacetContributors,
        );
        const vpcFacetSummary = buildContainerFacetSummaryLine(vpcFacets);
        const vpcLabelText = vpcFacetSummary
          ? `vpc ${vpcGroup.vpcLabel}\n${vpcFacetSummary}`
          : `vpc ${vpcGroup.vpcLabel}`;

        const vpcGroupIds = [vpcGroupId, regionGroupId, accountGroupId];
        const vpcApplianceTiles = collectVpcApplianceTilesFromFacets(vpcFacets);

        locationElements.push(
          makeBaseElement({
            type: "rectangle",
            id: vpcBoxId,
            x: vpcBoxX,
            y: vpcBoxY,
            width: vpcBoxW,
            height: vpcBoxH,
            strokeColor: VPC_STROKE,
            strokeWidth: 1,
            strokeStyle: "dashed",
            backgroundColor: "transparent",
            roundness: { type: 3 },
            groupIds: vpcGroupIds,
            boundElements: [{ id: vpcLabelId, type: "text" }],
            isDeleted: !vpcInitiallyVisible,
            customData: {
              ...buildContainerFacetCustomData(
                {
                  terraform: false,
                  ...vpcVisibilityCustomData,
                  terraformVpcGroup: true,
                  accountId: vpcGroup.accountId,
                  region: vpcGroup.region,
                  vpcId: vpcGroup.vpcKey,
                  vpcLabel: vpcGroup.vpcLabel,
                },
                vpcFacets,
              ),
            },
          }),
        );

        locationElements.push(
          makeBaseElement({
            type: "text",
            id: vpcLabelId,
            x: vpcBoxX + 10,
            y: vpcBoxY + 8,
            width: Math.max(90, vpcBoxW - 20),
            height: 20,
            text: vpcLabelText,
            fontSize: 14,
            fontFamily: 3,
            textAlign: "left",
            verticalAlign: "top",
            groupIds: vpcGroupIds,
            containerId: vpcBoxId,
            originalText: vpcLabelText,
            autoResize: false,
            lineHeight: 1.2,
            strokeColor: VPC_STROKE,
            isDeleted: !vpcInitiallyVisible,
            customData: {
              ...buildContainerFacetCustomData(
                {
                  terraform: false,
                  ...vpcVisibilityCustomData,
                  terraformVpcGroup: true,
                  accountId: vpcGroup.accountId,
                  region: vpcGroup.region,
                  vpcId: vpcGroup.vpcKey,
                  vpcLabel: vpcGroup.vpcLabel,
                },
                vpcFacets,
              ),
            },
          }),
        );

        if (vpcApplianceTiles.length > 0) {
          const placements = layoutApplianceTilesOnVpcEdges(
            vpcApplianceTiles,
            vpcBoxX,
            vpcBoxY,
            vpcBoxW,
            vpcBoxH,
          );

          for (const placement of placements) {
            const { tile, x, y, tileW, tileH, wall } = placement;
            const style = applianceStyleForKind(tile.applianceKind);
            const tileId = `vpc-appliance-${rand()}`;
            const tileTextId = `vpc-appliance-text-${rand()}`;
            const tileGroupIds = [`vpc-appliance-group-${rand()}`, ...vpcGroupIds];

            locationElements.push(
              makeBaseElement({
                type: "rectangle",
                id: tileId,
                x,
                y,
                width: tileW,
                height: tileH,
                strokeColor: style.strokeColor,
                strokeWidth: 1,
                strokeStyle: "solid",
                backgroundColor: style.backgroundColor,
                roundness: { type: 3 },
                groupIds: tileGroupIds,
                boundElements: [{ id: tileTextId, type: "text" }],
                isDeleted: !vpcInitiallyVisible,
                customData: {
                  terraform: false,
                  ...vpcVisibilityCustomData,
                  terraformVpcAppliance: true,
                  terraformVpcApplianceKind: tile.applianceKind,
                  terraformVpcApplianceWall: wall,
                  vpcId: vpcGroup.vpcKey,
                  applianceLabel: tile.label,
                },
              }),
            );

            locationElements.push(
              makeBaseElement({
                type: "text",
                id: tileTextId,
                x: x + 8,
                y: y + 8,
                width: tileW - 16,
                height: tileH - 16,
                text: tile.label,
                fontSize: 12,
                fontFamily: 3,
                textAlign: "left",
                verticalAlign: "middle",
                groupIds: tileGroupIds,
                containerId: tileId,
                originalText: tile.label,
                autoResize: false,
                lineHeight: 1.2,
                strokeColor: style.strokeColor,
                isDeleted: !vpcInitiallyVisible,
                customData: {
                  terraform: false,
                  ...vpcVisibilityCustomData,
                  terraformVpcAppliance: true,
                  terraformVpcApplianceKind: tile.applianceKind,
                  terraformVpcApplianceWall: wall,
                  vpcId: vpcGroup.vpcKey,
                  applianceLabel: tile.label,
                },
              }),
            );
          }
        }

        for (const subnetGroup of vpcGroup.subnets || []) {
          const subnetBounds = measureBounds(
            getUniqueVisualBounds(subnetGroup.nodePaths),
          );
          if (!subnetBounds) {
            continue;
          }

          const subnetGroupId = `subnet-group-${rand()}`;
          const subnetBoxX = subnetBounds.minX - SUBNET_PADDING_X;
          const subnetBoxY = subnetBounds.minY - SUBNET_PADDING_TOP;
          const subnetBoxW =
            subnetBounds.maxX - subnetBounds.minX + SUBNET_PADDING_X * 2;
          const subnetBoxH =
            subnetBounds.maxY -
            subnetBounds.minY +
            SUBNET_PADDING_TOP +
            SUBNET_PADDING_BOTTOM;
          const subnetBoxId = `subnet-box-${vpcBoxIndex}-${rand()}`;
          const subnetLabelId = `subnet-label-${vpcBoxIndex}-${rand()}`;
          const subnetInitiallyVisible = subnetGroup.nodePaths.some((nodePath) =>
            isInitiallyVisibleTerraformNode(nodePath, nodes[nodePath]),
          );
          const subnetVisibilityCustomData = {
            terraformVisibilityRole: "group",
            terraformVisibilityKey: `subnet:${subnetGroup.accountId}:${subnetGroup.region}:${subnetGroup.vpcKey}:${subnetGroup.subnetKey}`,
            terraformGroupChildKeys: subnetGroup.nodePaths,
          };
          const subnetFacets = collectContainerFacets(
            {
              kind: "subnet",
              key: subnetGroup.subnetKey,
              label: subnetGroup.subnetLabel,
              nodePaths: subnetGroup.nodePaths,
            },
            containerFacetContributors,
          );
          const subnetFacetSummary = buildContainerFacetSummaryLine(subnetFacets);
          const subnetLabelText = subnetFacetSummary
            ? `subnet ${subnetGroup.subnetLabel}\n${subnetFacetSummary}`
            : `subnet ${subnetGroup.subnetLabel}`;

          const subnetGroupIds = [
            subnetGroupId,
            vpcGroupId,
            regionGroupId,
            accountGroupId,
          ];

          locationElements.push(
            makeBaseElement({
              type: "rectangle",
              id: subnetBoxId,
              x: subnetBoxX,
              y: subnetBoxY,
              width: subnetBoxW,
              height: subnetBoxH,
              strokeColor: SUBNET_STROKE,
              strokeWidth: 1,
              strokeStyle: "dashed",
              backgroundColor: "transparent",
              roundness: { type: 3 },
              groupIds: subnetGroupIds,
              boundElements: [{ id: subnetLabelId, type: "text" }],
              isDeleted: !subnetInitiallyVisible,
              customData: {
                ...buildContainerFacetCustomData(
                  {
                    terraform: false,
                    ...subnetVisibilityCustomData,
                    terraformSubnetGroup: true,
                    accountId: subnetGroup.accountId,
                    region: subnetGroup.region,
                    vpcId: subnetGroup.vpcKey,
                    subnetId: subnetGroup.subnetKey,
                    subnetLabel: subnetGroup.subnetLabel,
                  },
                  subnetFacets,
                ),
              },
            }),
          );

          locationElements.push(
            makeBaseElement({
              type: "text",
              id: subnetLabelId,
              x: subnetBoxX + 8,
              y: subnetBoxY + 6,
              width: Math.max(86, subnetBoxW - 16),
              height: 18,
              text: subnetLabelText,
              fontSize: 13,
              fontFamily: 3,
              textAlign: "left",
              verticalAlign: "top",
              groupIds: subnetGroupIds,
              containerId: subnetBoxId,
              originalText: subnetLabelText,
              autoResize: false,
              lineHeight: 1.2,
              strokeColor: SUBNET_STROKE,
              isDeleted: !subnetInitiallyVisible,
              customData: {
                ...buildContainerFacetCustomData(
                  {
                    terraform: false,
                    ...subnetVisibilityCustomData,
                    terraformSubnetGroup: true,
                    accountId: subnetGroup.accountId,
                    region: subnetGroup.region,
                    vpcId: subnetGroup.vpcKey,
                    subnetId: subnetGroup.subnetKey,
                    subnetLabel: subnetGroup.subnetLabel,
                  },
                  subnetFacets,
                ),
              },
            }),
          );
        }
      }
    }
  }

  // 6) Emit structural dependency lines.
  let edgeIdx = 0;
  for (const relationship of relationships) {
    const {
      source,
      target,
      directed,
      bidirectional,
      directions,
      kinds,
      origins,
    } = relationship;
    const posA = posMap[source];
    const posB = posMap[target];
    const edgeId = `edge-${edgeIdx++}`;

    const rectA = nodeRectById.get(posA.rectId);
    const rectB = nodeRectById.get(posB.rectId);
    // Skip malformed relationships where one endpoint never emitted.
    if (!rectA || !rectB) {
      continue;
    }
    rectA.boundElements.push({ id: edgeId, type: "arrow" });
    rectB.boundElements.push({ id: edgeId, type: "arrow" });

    const { startFixed, endFixed, startPoint, endPoint } =
      getCenterClippedBindingPoints(posA, posB, posA.w, posA.h, posB.w, posB.h);

    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;

    const sourceAction = nodes[source]
      ? getPrimaryAction(nodes[source])
      : null;
    const targetAction = nodes[target]
      ? getPrimaryAction(nodes[target])
      : null;
    const dependencyStrokeColor = strokeColorForTerraformDependencyKinds(
      kinds,
      {
        origins,
        sourceAction,
        targetAction,
      },
    );

    const dependencyStartArrowhead = bidirectional ? "arrow" : null;
    const dependencyEndArrowhead = "arrow";

    edgeElements.push(
      makeBaseElement({
        type: "line",
        id: edgeId,
        x: startX,
        y: startY,
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        points: [
          [0, 0],
          [endX - startX, endY - startY],
        ],
        polygon: false,
        strokeColor: dependencyStrokeColor,
        startBinding: {
          elementId: posA.rectId,
          fixedPoint: startFixed,
          mode: "orbit",
        },
        endBinding: {
          elementId: posB.rectId,
          fixedPoint: endFixed,
          mode: "orbit",
        },
        startArrowhead: dependencyStartArrowhead,
        endArrowhead: dependencyEndArrowhead,
        strokeStyle: "solid",
        roundness: { type: 2 },
        isDeleted:
          !isInitiallyVisibleTerraformNode(source, nodes[source]) ||
          !isInitiallyVisibleTerraformNode(target, nodes[target]),
        customData: {
          terraform: true,
          terraformEdgeLayer: "dependency",
          relationship: {
            source,
            target,
            type: "dependency",
            label: "depends on",
            origin: origins.join(", "),
            directions,
            kinds,
            origins,
            directed,
            bidirectional,
          },
        },
      }),
    );
  }

  // 7) Emit data-flow lines (offset when they overlap dependency pairs).
  for (const edge of dataFlowEdges) {
    const {
      source,
      target,
      type,
      label,
      origin,
      detail,
      bidirectional = false,
      directions = [],
    } = edge;
    const posA = posMap[source];
    const posB = posMap[target];
    if (!posA || !posB) {
      continue;
    }

    const rectA = nodeRectById.get(posA.rectId);
    const rectB = nodeRectById.get(posB.rectId);
    if (!rectA || !rectB) {
      continue;
    }

    const edgeId = `data-flow-edge-${edgeIdx++}`;
    rectA.boundElements.push({ id: edgeId, type: "arrow" });
    rectB.boundElements.push({ id: edgeId, type: "arrow" });

    const { startPoint, endPoint } = getCenterClippedBindingPoints(
      posA,
      posB,
      posA.w,
      posA.h,
      posB.w,
      posB.h,
    );
    const pairKey = [source, target].sort().join("|||");
    // If a dependency edge exists on same pair, offset data-flow edge for readability.
    const shifted = offsetLineSegment(
      startPoint,
      endPoint,
      dependencyPairKeys.has(pairKey) ? 18 : 0,
    );
    const startX = shifted.startPoint.x;
    const startY = shifted.startPoint.y;
    const endX = shifted.endPoint.x;
    const endY = shifted.endPoint.y;
    const startFixed = fixedPointForAbsolutePoint(posA, shifted.startPoint);
    const endFixed = fixedPointForAbsolutePoint(posB, shifted.endPoint);

    const dataFlowStartArrowhead = bidirectional ? "arrow" : null;
    const dataFlowEndArrowhead = "arrow";

    edgeElements.push(
      makeBaseElement({
        type: "line",
        id: edgeId,
        x: startX,
        y: startY,
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        points: [
          [0, 0],
          [endX - startX, endY - startY],
        ],
        polygon: false,
        startBinding: {
          elementId: posA.rectId,
          fixedPoint: startFixed,
          mode: "orbit",
        },
        endBinding: {
          elementId: posB.rectId,
          fixedPoint: endFixed,
          mode: "orbit",
        },
        startArrowhead: dataFlowStartArrowhead,
        endArrowhead: dataFlowEndArrowhead,
        strokeColor: "#0ca678",
        strokeWidth: 3,
        strokeStyle: "solid",
        roundness: { type: 2 },
        isDeleted:
          !isInitiallyVisibleTerraformNode(source, nodes[source]) ||
          !isInitiallyVisibleTerraformNode(target, nodes[target]),
        customData: {
          terraform: true,
          terraformEdgeLayer: "dataFlow",
          relationship: {
            source,
            target,
            type,
            label,
            origin,
            detail,
            directions,
            directed: !bidirectional,
            bidirectional,
          },
        },
      }),
    );
  }

  const elementsOrdered = [
    // Order matters: framing containers/modules at bottom, then relationship lines, then resource cards.
    ...locationElements,
    ...moduleElements,
    ...edgeElements,
    ...nodeElements,
  ];

  // 8) Return an Excalidraw v2 scene payload consumed by import/render clients.
  return {
    type: "excalidraw",
    version: 2,
    source: "terraform-pipeline",
    elements: elementsOrdered,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null,
    },
  };
}

module.exports = { nodesToExcalidraw };
