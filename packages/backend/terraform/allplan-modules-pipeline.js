/**
 * Shared fixture: run the full pipeline on `allplanmodules.{json,dot}` (same
 * order as `POST /terraform/upload` and `excalidraw.test.js`).
 */
const fs = require("fs");
const path = require("path");

const dot = require("graphlib-dot");

const pipeline = require("../pipeline");
const { extractVpcNetworkingFacetStore } = require("../vpc-networking-facet");

function runAllplanModulesPipeline() {
  const terraformDir = __dirname;
  const plan = JSON.parse(
    fs.readFileSync(path.join(terraformDir, "allplanmodules.json"), "utf8"),
  );
  const graph = dot.read(
    fs.readFileSync(path.join(terraformDir, "allplanmodules.dot"), "utf8"),
  );
  const adjlist = pipeline.getAdjacencyListFromDot(graph);
  let nodes = pipeline.loadPlanAndNodes(plan);
  nodes = pipeline.mergeTerraformState(nodes, null);
  nodes = pipeline.ensureTerraformModuleNodes(nodes);
  nodes = pipeline.applyModuleMetadata(nodes, plan);
  nodes = pipeline.omitNonAllowlistedDataSourceNodes(nodes);
  nodes = pipeline.buildNewEdges(nodes, adjlist);
  nodes = pipeline.computeResourceDiffs(nodes);
  nodes = pipeline.buildExistingEdges(nodes, plan);
  nodes = pipeline.omitNonAllowlistedDataSourceNodes(nodes);
  nodes = pipeline.omitStateOnlyDataSourceNodes(nodes);
  nodes = pipeline.detectGenericStructuralEdges(nodes);
  nodes = pipeline.ensureEdgeLists(nodes);
  nodes = pipeline.pruneRedundantStructuralEdges(nodes);
  nodes = pipeline.externalResources(nodes);
  nodes = pipeline.ensureEdgeLists(nodes);
  nodes = pipeline.buildDataFlowEdges(nodes);
  nodes = pipeline.buildNetworkingEdges(nodes);
  nodes = pipeline.ensureEdgeLists(nodes);
  nodes = pipeline.omitGhostIamPolicyDocumentNodes(nodes);
  nodes.__networkingFacetStore = extractVpcNetworkingFacetStore(nodes);
  nodes = pipeline.omitVpcPlumbingNodes(nodes);
  nodes = pipeline.deleteOrphanedNodes(nodes);
  nodes = pipeline.cleanUpRoleLinks(nodes);
  nodes = pipeline.filterVisualIgnore(nodes);
  nodes = pipeline.deleteOrphanedNodes(nodes);
  return nodes;
}

module.exports = { runAllplanModulesPipeline };
