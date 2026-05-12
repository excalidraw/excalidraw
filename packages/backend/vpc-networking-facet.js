/**
 * Derives VPC/subnet networking facet payloads from Terraform node configs before
 * low-level plumbing nodes are stripped (`omitVpcPlumbingNodes` in `pipeline.js`).
 * Output is stored on the graph as `nodes.__networkingFacetStore` for Excalidraw labels.
 */
const {
  getCurrentResourceConfig,
  getPrimaryResourceFromNode: getPrimaryResource,
  normalizeVpcId,
  normalizeSubnetId,
  extractVpcIdsFromConfig,
  extractSubnetIdsFromConfig,
} = require("./terraform-graph-utils");

/** Returns canonical `rtb-…` id or null. */
function normalizeRouteTableId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^rtb-[0-9a-f]+$/i.test(trimmed) ? trimmed : null;
}

/** Terraform provider type for the node, from the primary resource or address heuristics. */
function getResourceTypeFromNode(nodePath, node) {
  return (
    getPrimaryResource(node).type || String(nodePath).split(".").at(-2) || ""
  );
}

/** All non-metadata keys on the nodes map (Terraform addresses). */
function getTerraformNodePaths(nodes) {
  return Object.keys(nodes || {}).filter((k) => !k.startsWith("__"));
}

/**
 * Builds networking-v2 facet payloads keyed like Excalidraw VPC/subnet groups (vpc-xxx, subnet-xxx).
 * Must run on the full node graph before plumbing resources are omitted.
 */
function extractVpcNetworkingFacetStore(nodes) {
  const byVpcKey = {};
  const bySubnetKey = {};

  const subnetIdToVpcKey = new Map();
  const rtIdToVpcKey = new Map();
  const routeTables = [];
  const routes = [];
  const associations = [];
  const internetGateways = [];
  const natGateways = [];
  const defaultRouteTables = [];
  const mainRtAssocs = [];
  const vpcEndpoints = [];

  for (const nodePath of getTerraformNodePaths(nodes)) {
    const node = nodes[nodePath];
    for (const resource of Object.values(node.resources || {})) {
      const type = resource.type || "";
      const config = getCurrentResourceConfig(resource);
      const address = resource.address || nodePath;

      if (type === "aws_subnet") {
        const vpcIds = extractVpcIdsFromConfig(config);
        const subnetIds = extractSubnetIdsFromConfig(config);
        const vpcKey = vpcIds[0];
        const subnetKey = normalizeSubnetId(config.id) || subnetIds[0] || null;
        if (vpcKey && subnetKey) {
          subnetIdToVpcKey.set(subnetKey, vpcKey);
        }
      }
    }
  }

  for (const nodePath of getTerraformNodePaths(nodes)) {
    const node = nodes[nodePath];
    for (const resource of Object.values(node.resources || {})) {
      const type = resource.type || "";
      const config = getCurrentResourceConfig(resource);
      const address = resource.address || nodePath;

      if (type === "aws_route_table") {
        const vpcIds = extractVpcIdsFromConfig(config);
        const rtId = normalizeRouteTableId(config.id);
        const vpcKey = vpcIds[0];
        if (vpcKey && rtId) {
          rtIdToVpcKey.set(rtId, vpcKey);
        }
        routeTables.push({ address, nodePath, config, type });
      } else if (type === "aws_route") {
        routes.push({ address, nodePath, config, type });
      } else if (type === "aws_route_table_association") {
        associations.push({ address, nodePath, config, type });
      } else if (type === "aws_internet_gateway") {
        internetGateways.push({ address, nodePath, config, type });
      } else if (type === "aws_nat_gateway") {
        natGateways.push({ address, nodePath, config, type });
      } else if (type === "aws_default_route_table") {
        defaultRouteTables.push({ address, nodePath, config, type });
      } else if (type === "aws_main_route_table_association") {
        mainRtAssocs.push({ address, nodePath, config, type });
      } else if (type === "aws_vpc_endpoint") {
        vpcEndpoints.push({ address, nodePath, config, type });
      }
    }
  }

  const resolveVpcKeyForRoute = (config) => {
    const rtId = normalizeRouteTableId(config.route_table_id);
    if (rtId && rtIdToVpcKey.has(rtId)) {
      return rtIdToVpcKey.get(rtId);
    }
    const vpcIds = extractVpcIdsFromConfig(config);
    return vpcIds[0] || null;
  };

  const routesByRtId = new Map();
  for (const r of routes) {
    const rtId = normalizeRouteTableId(r.config.route_table_id);
    if (!rtId) {
      continue;
    }
    if (!routesByRtId.has(rtId)) {
      routesByRtId.set(rtId, []);
    }
    routesByRtId.get(rtId).push(r);
  }

  const assocsByRtId = new Map();
  const assocsBySubnetId = new Map();
  for (const a of associations) {
    const rtId = normalizeRouteTableId(a.config.route_table_id);
    const subnetIds = extractSubnetIdsFromConfig(a.config);
    const subnetId = subnetIds[0] || null;
    if (rtId) {
      if (!assocsByRtId.has(rtId)) {
        assocsByRtId.set(rtId, []);
      }
      assocsByRtId.get(rtId).push(a);
    }
    if (subnetId) {
      if (!assocsBySubnetId.has(subnetId)) {
        assocsBySubnetId.set(subnetId, []);
      }
      assocsBySubnetId.get(subnetId).push(a);
    }
  }

  const vpcKeys = new Set([
    ...subnetIdToVpcKey.values(),
    ...rtIdToVpcKey.values(),
    ...internetGateways.flatMap((igw) => extractVpcIdsFromConfig(igw.config)),
    ...natGateways.flatMap((nat) => extractVpcIdsFromConfig(nat.config)),
    ...defaultRouteTables.flatMap((d) => extractVpcIdsFromConfig(d.config)),
    ...mainRtAssocs.flatMap((m) => extractVpcIdsFromConfig(m.config)),
    ...vpcEndpoints.flatMap((ep) => extractVpcIdsFromConfig(ep.config)),
  ]);

  for (const rt of routeTables) {
    const vpcIds = extractVpcIdsFromConfig(rt.config);
    if (vpcIds[0]) {
      vpcKeys.add(vpcIds[0]);
    }
  }

  for (const r of routes) {
    const vk = resolveVpcKeyForRoute(r.config);
    if (vk) {
      vpcKeys.add(vk);
    }
  }

  const sourcesAccumulator = new Map();

  const pushSource = (vpcKey, address) => {
    if (!vpcKey || !address) {
      return;
    }
    if (!sourcesAccumulator.has(vpcKey)) {
      sourcesAccumulator.set(vpcKey, new Set());
    }
    sourcesAccumulator.get(vpcKey).add(address);
  };

  for (const vpcKey of vpcKeys) {
    const rtSections = [];

    for (const rt of routeTables) {
      const vpcIds = extractVpcIdsFromConfig(rt.config);
      if (vpcIds[0] !== vpcKey) {
        continue;
      }
      const rtId = normalizeRouteTableId(rt.config.id);
      const inlineRoutes = Array.isArray(rt.config.route)
        ? rt.config.route
        : [];
      const standalone = rtId ? routesByRtId.get(rtId) || [] : [];
      const assocList = rtId ? assocsByRtId.get(rtId) || [] : [];

      pushSource(vpcKey, rt.address);
      for (const x of standalone) {
        pushSource(vpcKey, x.address);
      }
      for (const x of assocList) {
        pushSource(vpcKey, x.address);
      }

      const nested = [
        {
          id: `${rt.address}-inline-routes`,
          label: "Inline routes",
          data: { routes: inlineRoutes },
        },
        {
          id: `${rt.address}-standalone-routes`,
          label: "Route resources",
          sections: standalone.map((sr) => ({
            id: sr.address,
            label: sr.address,
            data: {
              terraform_address: sr.address,
              route_config: sr.config,
              destination_cidr_block: sr.config.destination_cidr_block,
              destination_ipv6_cidr_block:
                sr.config.destination_ipv6_cidr_block,
              gateway_id: sr.config.gateway_id,
              nat_gateway_id: sr.config.nat_gateway_id,
              egress_only_gateway_id: sr.config.egress_only_gateway_id,
              vpc_peering_connection_id: sr.config.vpc_peering_connection_id,
              transit_gateway_id: sr.config.transit_gateway_id,
              network_interface_id: sr.config.network_interface_id,
              vpc_endpoint_id: sr.config.vpc_endpoint_id,
              carrier_gateway_id: sr.config.carrier_gateway_id,
            },
          })),
        },
        {
          id: `${rt.address}-associations`,
          label: "Subnet associations",
          data: {
            items: assocList.map((x) => ({
              association_id: x.config.id,
              subnet_id: extractSubnetIdsFromConfig(x.config)[0] || null,
              route_table_id: normalizeRouteTableId(x.config.route_table_id),
              address: x.address,
              association_config: x.config,
            })),
          },
        },
      ];

      rtSections.push({
        id: rt.address,
        label: rt.address.split(".").slice(-2).join(".") || rt.address,
        summary: rtId ? rtId : "route table",
        data: {
          terraform_address: rt.address,
          route_table_id: rtId,
          route_table_config: rt.config,
          propagating_vgws: rt.config.propagating_vgws,
          tags: rt.config.tags,
        },
        sections: nested,
      });
    }

    const gatewaySections = [];

    for (const igw of internetGateways) {
      const vpcIds = extractVpcIdsFromConfig(igw.config);
      if (vpcIds[0] !== vpcKey) {
        continue;
      }
      pushSource(vpcKey, igw.address);
      gatewaySections.push({
        id: igw.address,
        label: igw.address,
        data: {
          terraform_address: igw.address,
          id: igw.config.id,
          tags: igw.config.tags,
        },
      });
    }

    for (const nat of natGateways) {
      const vpcIds = extractVpcIdsFromConfig(nat.config);
      if (vpcIds[0] !== vpcKey) {
        continue;
      }
      pushSource(vpcKey, nat.address);
      gatewaySections.push({
        id: nat.address,
        label: nat.address,
        data: {
          terraform_address: nat.address,
          id: nat.config.id,
          subnet_id: nat.config.subnet_id,
          allocation_id: nat.config.allocation_id,
          connectivity_type: nat.config.connectivity_type,
          tags: nat.config.tags,
        },
      });
    }

    const endpointSections = [];
    for (const ep of vpcEndpoints) {
      const vpcIds = extractVpcIdsFromConfig(ep.config);
      if (vpcIds[0] !== vpcKey) {
        continue;
      }
      pushSource(vpcKey, ep.address);
      endpointSections.push({
        id: ep.address,
        label: ep.address.split(".").slice(-2).join(".") || ep.address,
        summary: ep.config.service_name || ep.config.vpc_endpoint_type || "",
        data: {
          terraform_address: ep.address,
          vpc_endpoint_config: ep.config,
          service_name: ep.config.service_name,
          vpc_endpoint_type: ep.config.vpc_endpoint_type,
        },
      });
    }

    const extraRtSections = [];
    for (const d of defaultRouteTables) {
      const vpcIds = extractVpcIdsFromConfig(d.config);
      if (vpcIds[0] !== vpcKey) {
        continue;
      }
      pushSource(vpcKey, d.address);
      extraRtSections.push({
        id: d.address,
        label: "Default route table",
        data: {
          terraform_address: d.address,
          default_route_table_id: d.config.default_route_table_id,
          tags: d.config.tags,
        },
      });
    }

    for (const m of mainRtAssocs) {
      const vpcIds = extractVpcIdsFromConfig(m.config);
      if (vpcIds[0] !== vpcKey) {
        continue;
      }
      pushSource(vpcKey, m.address);
      extraRtSections.push({
        id: m.address,
        label: "Main route table association",
        data: {
          terraform_address: m.address,
          vpc_id: extractVpcIdsFromConfig(m.config)[0],
          route_table_id: normalizeRouteTableId(m.config.route_table_id),
        },
      });
    }

    const topSections = [];
    if (rtSections.length > 0) {
      topSections.push({
        id: `${vpcKey}-route-tables`,
        label: "Route tables",
        sections: rtSections,
      });
    }
    if (gatewaySections.length > 0) {
      topSections.push({
        id: `${vpcKey}-gateways`,
        label: "Gateways",
        sections: gatewaySections,
      });
    }
    if (endpointSections.length > 0) {
      topSections.push({
        id: `${vpcKey}-vpc-endpoints`,
        label: "VPC endpoints",
        sections: endpointSections,
      });
    }
    if (extraRtSections.length > 0) {
      topSections.push({
        id: `${vpcKey}-route-table-meta`,
        label: "Route table associations (VPC)",
        sections: extraRtSections,
      });
    }

    const rtCount = rtSections.length;
    const assocCount = associations.filter((a) => {
      const sid = extractSubnetIdsFromConfig(a.config)[0];
      const rtId = normalizeRouteTableId(a.config.route_table_id);
      const sk = sid ? subnetIdToVpcKey.get(sid) : null;
      const rk = rtId ? rtIdToVpcKey.get(rtId) : null;
      return sk === vpcKey || rk === vpcKey;
    }).length;

    let routeTotal = 0;
    let natFlag = false;
    let igwFlag = false;
    for (const rt of routeTables) {
      const vpcIds = extractVpcIdsFromConfig(rt.config);
      if (vpcIds[0] !== vpcKey) {
        continue;
      }
      routeTotal += Array.isArray(rt.config.route) ? rt.config.route.length : 0;
      for (const r of rt.config.route || []) {
        if (r?.nat_gateway_id) {
          natFlag = true;
        }
        if (typeof r?.gateway_id === "string" && /^igw-/i.test(r.gateway_id)) {
          igwFlag = true;
        }
      }
    }
    for (const r of routes) {
      if (resolveVpcKeyForRoute(r.config) !== vpcKey) {
        continue;
      }
      routeTotal += 1;
      if (r.config.nat_gateway_id) {
        natFlag = true;
      }
      if (
        typeof r.config.gateway_id === "string" &&
        /^igw-/i.test(r.config.gateway_id)
      ) {
        igwFlag = true;
      }
    }

    const summary = `rt:${rtCount} assoc:${assocCount} routes:${routeTotal} nat:${natFlag} igw:${igwFlag}`;

    if (topSections.length === 0) {
      continue;
    }

    byVpcKey[vpcKey] = {
      id: "networking-v2",
      label: "Networking",
      summary,
      sections: topSections,
      sources: [...(sourcesAccumulator.get(vpcKey) || [])].sort(),
    };
  }

  for (const subnetId of subnetIdToVpcKey.keys()) {
    const vpcKey = subnetIdToVpcKey.get(subnetId);
    const assocForSubnet = assocsBySubnetId.get(subnetId) || [];
    const sources = assocForSubnet.map((a) => a.address);
    const subnetFacetSections = [
      {
        id: `${subnetId}-vpc`,
        label: "VPC",
        data: { vpcKey },
      },
      {
        id: `${subnetId}-associations`,
        label: "Route table associations",
        data: {
          items: assocForSubnet.map((x) => ({
            address: x.address,
            route_table_id: normalizeRouteTableId(x.config.route_table_id),
            association_id: x.config.id,
          })),
        },
      },
    ];

    const rtSet = new Set();
    for (const x of assocForSubnet) {
      const rtId = normalizeRouteTableId(x.config.route_table_id);
      if (rtId) {
        rtSet.add(rtId);
      }
    }

    bySubnetKey[subnetId] = {
      id: "networking-v2",
      label: "Networking",
      summary: `rt_assoc:${assocForSubnet.length} rt:${rtSet.size}`,
      sections: subnetFacetSections,
      sources: [...new Set(sources)].sort(),
    };
  }

  return { byVpcKey, bySubnetKey };
}

module.exports = {
  extractVpcNetworkingFacetStore,
  getTerraformNodePaths,
  getResourceTypeFromNode,
};
