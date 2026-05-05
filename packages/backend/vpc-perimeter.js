/**
 * VPC “perimeter” layout: classifies ALBs, endpoints, VPN, and Direct Connect resources to a
 * wall of the VPC frame so they pin outside the inner workload layout (`excalidraw.js` uses this
 * with `filterLayoutSimulationKeys` and `snapVpcPerimeterResourcePositions`).
 */

const {
  getCurrentResourceConfig,
  getPrimaryResourceFromNode,
} = require("./terraform-graph-utils");

const VPC_PERIMETER_LAYOUT_ENABLED = true;

const CORNER_PADDING = 8;

/** Terraform types always evaluated by classifyVpcApplianceWall (may still return null). */
const VPC_APPLIANCE_CANDIDATE_TYPES = new Set([
  "aws_vpc_endpoint",
  "aws_lb",
  "aws_ec2_transit_gateway_vpc_attachment",
  "aws_ec2_transit_gateway_connect",
  "aws_ec2_transit_gateway_peering_attachment",
  "aws_vpn_connection",
  "aws_customer_gateway",
  "aws_ec2_client_vpn_endpoint",
  "aws_dx_gateway",
  "aws_dx_connection",
  "aws_dx_lag",
  "aws_dx_private_virtual_interface",
  "aws_dx_public_virtual_interface",
  "aws_dx_hosted_private_virtual_interface",
  "aws_dx_hosted_public_virtual_interface",
]);

/** Primary Terraform resource object for a node (first entry with a `type`). */
function getPrimaryResource(nodePath, node) {
  return getPrimaryResourceFromNode(node);
}

/** Merged config view: `change.after`, else `values`, else `change.before`. */
function getResourceConfig(resource) {
  return getCurrentResourceConfig(resource);
}

/**
 * Picks left vs bottom wall for a VPC endpoint from service name and endpoint type.
 * @param {object} cfg — aws_vpc_endpoint after config
 * @returns {"leftWall"|"bottomWall"}
 */
function classifyVpcEndpointWallFromConfig(cfg) {
  const service = String(cfg.service_name || "").toLowerCase();
  const endpointType = String(cfg.vpc_endpoint_type || "").toLowerCase();
  if (endpointType === "gatewayloadbalancer") {
    return "leftWall";
  }
  if (
    service.includes("execute-api") ||
    service.includes("cloudfront") ||
    service.includes("api.gateway")
  ) {
    return "leftWall";
  }
  return "bottomWall";
}

/**
 * Maps a supported perimeter resource to a VPC frame wall, or null if not a perimeter appliance.
 * @param {string} nodePath
 * @param {object} node
 * @returns {"leftWall"|"topWall"|"bottomWall"|"rightWall"|null}
 */
function classifyVpcApplianceWall(nodePath, node) {
  if (!VPC_PERIMETER_LAYOUT_ENABLED || !node) {
    return null;
  }
  const resource = getPrimaryResource(nodePath, node);
  const type = resource.type || "";
  if (!VPC_APPLIANCE_CANDIDATE_TYPES.has(type)) {
    return null;
  }
  const cfg = getResourceConfig(resource);

  if (type === "aws_lb") {
    if (cfg.internal === true) {
      return "topWall";
    }
    const scheme = String(cfg.scheme || "").toLowerCase();
    if (scheme === "internal") {
      return "topWall";
    }
    return "leftWall";
  }

  if (type === "aws_vpc_endpoint") {
    return classifyVpcEndpointWallFromConfig(cfg);
  }

  if (
    type === "aws_ec2_transit_gateway_vpc_attachment" ||
    type === "aws_ec2_transit_gateway_connect" ||
    type === "aws_ec2_transit_gateway_peering_attachment" ||
    type === "aws_vpn_connection" ||
    type === "aws_customer_gateway" ||
    type === "aws_ec2_client_vpn_endpoint" ||
    type === "aws_dx_gateway" ||
    type === "aws_dx_connection" ||
    type === "aws_dx_lag" ||
    type === "aws_dx_private_virtual_interface" ||
    type === "aws_dx_public_virtual_interface" ||
    type === "aws_dx_hosted_private_virtual_interface" ||
    type === "aws_dx_hosted_public_virtual_interface"
  ) {
    return "bottomWall";
  }

  return null;
}

/**
 * Display kind for styling / customData (facet tiles use applianceKind directly).
 * @param {string} nodePath
 * @param {object} node
 */
function getVpcApplianceKindForNode(nodePath, node) {
  const resource = getPrimaryResource(nodePath, node);
  const type = resource.type || "";
  if (type === "aws_vpc_endpoint") {
    return "endpoint";
  }
  if (type === "aws_lb") {
    return "load_balancer";
  }
  if (
    type === "aws_ec2_transit_gateway_vpc_attachment" ||
    type === "aws_ec2_transit_gateway_connect" ||
    type === "aws_ec2_transit_gateway_peering_attachment"
  ) {
    return "transit_gateway";
  }
  if (
    type === "aws_vpn_connection" ||
    type === "aws_customer_gateway" ||
    type === "aws_ec2_client_vpn_endpoint"
  ) {
    return "vpn";
  }
  if (type.startsWith("aws_dx_")) {
    return "direct_connect";
  }
  return "appliance";
}

/** True when this node is laid out on the VPC frame perimeter (has a wall assignment). */
function isVpcPerimeterAppliance(nodePath, node) {
  return classifyVpcApplianceWall(nodePath, node) !== null;
}

/** Alias of `isVpcPerimeterAppliance` for readability at call sites. */
function isVpcPerimeterNode(nodePath, node) {
  return isVpcPerimeterAppliance(nodePath, node);
}

/** True if `type` is a candidate for perimeter classification (may still yield null wall). */
function isVpcPerimeterResourceType(type) {
  return VPC_APPLIANCE_CANDIDATE_TYPES.has(type);
}

/**
 * Synthetic facet tile → wall (matches classifyVpcApplianceWall semantics).
 * @param {object} tile — applianceKind, gatewayKind?, service_name?, vpc_endpoint_type?, label?
 */
function classifySyntheticVpcTileWall(tile) {
  const kind = tile.applianceKind;
  if (kind === "gateway") {
    if (tile.gatewayKind === "igw") {
      return "leftWall";
    }
    if (tile.gatewayKind === "nat") {
      return "rightWall";
    }
    const label = String(tile.label || "").toLowerCase();
    if (label.includes("internet_gateway") || label.includes("igw")) {
      return "leftWall";
    }
    if (label.includes("nat_gateway") || label.includes("nat")) {
      return "rightWall";
    }
    return "topWall";
  }
  if (kind === "route_table") {
    return "topWall";
  }
  if (kind === "route_assoc") {
    return "bottomWall";
  }
  if (kind === "endpoint") {
    return classifyVpcEndpointWallFromConfig({
      service_name: tile.service_name || "",
      vpc_endpoint_type: tile.vpc_endpoint_type || "",
    });
  }
  return "topWall";
}

/**
 * Frame is the outer dashed VPC rectangle (same coordinates as snap + facet box).
 * Items per wall are placed with centers on the frame edge, half inside / half outside,
 * distributed along a segment inset from corners.
 *
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} frame
 * @param {{ leftWall?: unknown[], topWall?: unknown[], rightWall?: unknown[], bottomWall?: unknown[] }} buckets
 * @param {(item: unknown) => { w: number, h: number }} getSize
 * @returns {{ item: unknown, x: number, y: number, wall: string, w: number, h: number }[]}
 */
function layoutVpcApplianceRectanglesOnFrame(frame, buckets, getSize) {
  const { minX, maxX, minY, maxY } = frame;
  const placements = [];

  const cornerInset = (w, h) => Math.max(w, h) * 0.5 + CORNER_PADDING;

  const placeHorizontalWall = (wall, items) => {
    items.forEach((item, i) => {
      const { w, h } = getSize(item);
      const inset = cornerInset(w, h);
      const xLeftMin = minX + inset;
      const xLeftMax = maxX - inset - w;
      let xLeft;
      if (xLeftMin > xLeftMax) {
        xLeft = (minX + maxX) / 2 - w / 2;
      } else {
        const n = items.length;
        const t = n === 1 ? 0.5 : i / (n - 1);
        xLeft = xLeftMin + t * (xLeftMax - xLeftMin);
      }
      const yy = wall === "topWall" ? minY - h / 2 : maxY - h / 2;
      placements.push({
        item,
        x: xLeft,
        y: yy,
        wall,
        w,
        h,
      });
    });
  };

  const placeVerticalWall = (wall, items) => {
    items.forEach((item, i) => {
      const { w, h } = getSize(item);
      const inset = cornerInset(w, h);
      const yTopMin = minY + inset;
      const yTopMax = maxY - inset - h;
      let yTop;
      if (yTopMin > yTopMax) {
        yTop = (minY + maxY) / 2 - h / 2;
      } else {
        const n = items.length;
        const t = n === 1 ? 0.5 : i / (n - 1);
        yTop = yTopMin + t * (yTopMax - yTopMin);
      }
      let xx;
      if (wall === "leftWall") {
        xx = minX - w / 2;
      } else {
        xx = maxX - w / 2;
      }
      placements.push({
        item,
        x: xx,
        y: yTop,
        wall,
        w,
        h,
      });
    });
  };

  placeHorizontalWall("topWall", buckets.topWall || []);
  placeHorizontalWall("bottomWall", buckets.bottomWall || []);
  placeVerticalWall("leftWall", buckets.leftWall || []);
  placeVerticalWall("rightWall", buckets.rightWall || []);

  return placements;
}

/**
 * When perimeter layout is on, excludes pure-perimeter module layout ids from force-layout so
 * their members are positioned by perimeter snapping instead.
 */
function filterLayoutSimulationKeys(
  layoutNodeKeys,
  moduleMembers,
  perimeterSet,
) {
  if (!VPC_PERIMETER_LAYOUT_ENABLED || perimeterSet.size === 0) {
    return layoutNodeKeys;
  }
  return layoutNodeKeys.filter((layoutId) => {
    const members = moduleMembers.get(layoutId);
    if (members && members.length > 0) {
      return members.some((p) => !perimeterSet.has(p));
    }
    return !perimeterSet.has(layoutId);
  });
}

/** Provider type string for the node's primary resource. */
function getPrimaryResourceType(nodePath, node) {
  return getPrimaryResource(nodePath, node).type || "";
}

module.exports = {
  VPC_PERIMETER_LAYOUT_ENABLED,
  VPC_APPLIANCE_CANDIDATE_TYPES,
  /** @deprecated use VPC_APPLIANCE_CANDIDATE_TYPES + classifyVpcApplianceWall */
  VPC_PERIMETER_RESOURCE_TYPES: VPC_APPLIANCE_CANDIDATE_TYPES,
  getPrimaryResourceType,
  getPrimaryResource,
  classifyVpcApplianceWall,
  classifyVpcEndpointWallFromConfig,
  classifySyntheticVpcTileWall,
  getVpcApplianceKindForNode,
  isVpcPerimeterAppliance,
  isVpcPerimeterResourceType,
  isVpcPerimeterNode,
  layoutVpcApplianceRectanglesOnFrame,
  filterLayoutSimulationKeys,
};
