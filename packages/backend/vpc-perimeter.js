/** VPC perimeter resources: pinned to VPC frame; excluded from dependency layout/arrows. */

const VPC_PERIMETER_LAYOUT_ENABLED = true;

const VPC_PERIMETER_RESOURCE_TYPES = new Set(["aws_vpc_endpoint"]);

function getPrimaryResourceType(nodePath, node) {
  const primary =
    Object.values(node?.resources || {}).find((r) => r?.type) || {};
  return primary.type || "";
}

function isVpcPerimeterResourceType(type) {
  if (!VPC_PERIMETER_LAYOUT_ENABLED) {
    return false;
  }
  return VPC_PERIMETER_RESOURCE_TYPES.has(type);
}

function isVpcPerimeterNode(nodePath, node) {
  return isVpcPerimeterResourceType(getPrimaryResourceType(nodePath, node));
}

function filterLayoutSimulationKeys(layoutNodeKeys, moduleMembers, perimeterSet) {
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

module.exports = {
  VPC_PERIMETER_LAYOUT_ENABLED,
  VPC_PERIMETER_RESOURCE_TYPES,
  getPrimaryResourceType,
  isVpcPerimeterResourceType,
  isVpcPerimeterNode,
  filterLayoutSimulationKeys,
};
