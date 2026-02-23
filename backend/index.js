const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const dot = require("graphlib-dot");

const app = express();
const PORT = 3000;
const upload = multer({ dest: "uploads/" });
const TEMP_DIR = path.join(__dirname, "temp");

const EDGE_FILTER_RULES = [
  ["aws_iam_role_policy", "aws_lambda_function"],
  ["aws_iam_policy_document", "aws_lambda_function"],
  ["aws_lambda_function", "aws_iam_role_policy"],
  ["aws_lambda_function", "aws_iam_policy_document"],
];

app.use(cors());
app.use(express.json());

const stripIndexes = (address = "") => address.replace(/\[\d+\]/g, "");

const sanitizeDotNodeId = (nodeId = "") => {
  const parts = String(nodeId).trim().split(" ");
  const raw = parts.length >= 2 ? parts[1] : parts[0] || "";
  return raw.replace(/["\\]/g, "");
};

function writeJsonToTemp(data, filename) {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  const filePath = path.join(TEMP_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}

function getAdjacencyListFromDot(graph) {
  const adjacency = {};

  for (const { v, w } of graph.edges()) {
    const source = sanitizeDotNodeId(v);
    const target = sanitizeDotNodeId(w);
    if (!adjacency[source]) {
      adjacency[source] = [];
    }
    if (!adjacency[source].includes(target)) {
      adjacency[source].push(target);
    }
  }

  return adjacency;
}

function loadPlanAndNodes(plan) {
  const nodes = {};
  const resourceChanges = plan.resource_changes || [];

  for (const resourceChange of resourceChanges) {
    const address = resourceChange.address;
    const nodePath = stripIndexes(address);
    if (!nodes[nodePath]) {
      nodes[nodePath] = { resources: {} };
    }
    nodes[nodePath].resources[address] = resourceChange;
  }

  return nodes;
}

function buildNewEdges(nodes, adjacency) {
  for (const nodePath of Object.keys(nodes)) {
    const visited = new Set([nodePath]);
    const queue = [nodePath];
    const connectedNodes = new Set();

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      const neighbors = adjacency[current] || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);

        if (neighbor.startsWith("provider")) {
          continue;
        }
        if (nodes[neighbor]) {
          connectedNodes.add(neighbor);
        } else {
          queue.push(neighbor);
        }
      }
    }

    nodes[nodePath].edges_new = [...connectedNodes];
  }

  for (const [nodePath, node] of Object.entries(nodes)) {
    for (const target of node.edges_new || []) {
      if (!nodes[target]) {
        continue;
      }
      nodes[target].edges_new ||= [];
      if (!nodes[target].edges_new.includes(nodePath)) {
        nodes[target].edges_new.push(nodePath);
      }
    }
  }

  for (const node of Object.values(nodes)) {
    node.edges_new = [...new Set(node.edges_new || [])];
  }

  return nodes;
}

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function computeResourceDiffs(nodes) {
  for (const node of Object.values(nodes)) {
    for (const resource of Object.values(node.resources || {})) {
      const change = resource.change || {};
      const before = change.before || {};
      const after = change.after || {};
      const diff = {};

      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const key of keys) {
        const inBefore = key in before;
        const inAfter = key in after;
        const beforeValue = before[key];
        const afterValue = after[key];

        if (inBefore && !inAfter) {
          if (beforeValue !== null) {
            diff[key] = { before: beforeValue, after: null };
          }
          continue;
        }

        if (!inBefore && inAfter) {
          const isMeaningfulAddedValue =
            afterValue !== null &&
            afterValue !== "" &&
            !(Array.isArray(afterValue) && afterValue.length === 0) &&
            !(isPlainObject(afterValue) && Object.keys(afterValue).length === 0);

          if (isMeaningfulAddedValue) {
            diff[key] = { before: null, after: afterValue };
          }
          continue;
        }

        if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
          diff[key] = { before: beforeValue, after: afterValue };
        }
      }

      resource.change = { ...change, before, after, diff };
    }
  }

  return nodes;
}

function buildExistingEdges(nodes, plan) {
  const rootModule = plan?.prior_state?.values?.root_module;
  if (!rootModule) {
    return nodes;
  }

  const existingEdges = {};
  const addEdge = (from, to) => {
    if (!existingEdges[from]) {
      existingEdges[from] = new Set();
    }
    existingEdges[from].add(to);
  };

  const stack = [rootModule];
  while (stack.length) {
    const currentModule = stack.pop();

    for (const resource of currentModule.resources || []) {
      const nodePath = stripIndexes(resource.address);
      nodes[nodePath] ||= { resources: {} };

      if (!nodes[nodePath].resources[resource.address]) {
        nodes[nodePath].resources[resource.address] = {
          ...resource,
          change: { actions: ["existing"] },
        };
      }

      for (const dependency of resource.depends_on || []) {
        addEdge(resource.address, dependency);
        addEdge(dependency, resource.address);
      }
    }

    for (const childModule of currentModule.child_modules || []) {
      stack.push(childModule);
    }
  }

  for (const [rawSource, targets] of Object.entries(existingEdges)) {
    const source = stripIndexes(rawSource);
    if (!nodes[source]) {
      continue;
    }
    nodes[source].edges_existing ||= [];

    for (const rawTarget of targets) {
      const target = stripIndexes(rawTarget);
      if (!nodes[target]) {
        continue;
      }
      if (!nodes[source].edges_existing.includes(target)) {
        nodes[source].edges_existing.push(target);
      }
    }
  }

  return nodes;
}

function ensureEdgeLists(nodes) {
  for (const node of Object.values(nodes)) {
    node.edges_new ||= [];
    node.edges_existing ||= [];
  }
  return nodes;
}

function makeExternalNode(edge, backRef) {
  return {
    resources: {
      [edge]: {
        address: edge,
        type: edge,
        change: { actions: ["external"] },
      },
    },
    edges_existing: [backRef],
    edges_new: [backRef],
  };
}

function addExternalBackRef(externals, edge, backRef) {
  if (!externals[edge]) {
    externals[edge] = makeExternalNode(edge, backRef);
    return;
  }
  if (!externals[edge].edges_existing.includes(backRef)) {
    externals[edge].edges_existing.push(backRef);
  }
  if (!externals[edge].edges_new.includes(backRef)) {
    externals[edge].edges_new.push(backRef);
  }
}

function externalResources(nodes) {
  const externalNodes = {};

  for (const [nodePath, node] of Object.entries(nodes)) {
    for (const edge of node.edges_existing || []) {
      const shouldAdd =
        !nodes[edge] &&
        !edge.includes(".data.") &&
        !edge.includes("aws_iam_role_policy");
      if (shouldAdd) {
        addExternalBackRef(externalNodes, edge, nodePath);
      }
    }

    for (const edge of node.edges_new || []) {
      if (!nodes[edge]) {
        addExternalBackRef(externalNodes, edge, nodePath);
      }
    }
  }

  for (const [edge, externalNode] of Object.entries(externalNodes)) {
    if (!nodes[edge]) {
      nodes[edge] = externalNode;
    }
  }

  return nodes;
}

function deleteOrphanedNodes(nodes) {
  const filtered = {};

  for (const [nodePath, node] of Object.entries(nodes)) {
    if ((node.edges_existing || []).length || (node.edges_new || []).length) {
      filtered[nodePath] = node;
    }
  }

  return filtered;
}

function cleanUpRoleLinks(nodes) {
  for (const [nodePath, node] of Object.entries(nodes)) {
    node.edges_existing ||= [];
    node.edges_new ||= [];

    for (const [pathMatch, edgeExclude] of EDGE_FILTER_RULES) {
      if (!nodePath.includes(pathMatch)) {
        continue;
      }
      node.edges_existing = node.edges_existing.filter(
        (edge) => !edge.includes(edgeExclude),
      );
      node.edges_new = node.edges_new.filter(
        (edge) => !edge.includes(edgeExclude),
      );
    }
  }

  return nodes;
}

function mockLanggraphEnrichment(nodes) {
  const enrichment = {};

  for (const [nodePath, node] of Object.entries(nodes)) {
    const actions = [];
    for (const resource of Object.values(node.resources || {})) {
      if (resource.change?.actions) {
        actions.push(...resource.change.actions);
      }
    }

    let summary = "";
    const issues = [];
    const recommendations = [];

    if (nodePath.includes("aws_lambda_function")) {
      summary = "Lambda function configuration";
      if (actions.includes("create")) {
        issues.push("New Lambda function - verify memory and timeout settings");
        recommendations.push("Consider setting reserved concurrency");
        recommendations.push("Ensure dead letter queue is configured");
      }
    } else if (nodePath.includes("aws_s3_bucket")) {
      summary = "S3 bucket configuration";
      issues.push("Verify bucket policy and public access settings");
      recommendations.push("Enable versioning for data protection");
      recommendations.push("Consider lifecycle rules for cost optimization");
    } else if (nodePath.includes("aws_iam")) {
      summary = "IAM configuration";
      issues.push("Review IAM policy for least-privilege compliance");
      recommendations.push("Audit policy permissions regularly");
    } else if (nodePath.includes("aws_dynamodb")) {
      summary = "DynamoDB table configuration";
      recommendations.push(
        "Consider on-demand capacity for unpredictable workloads",
      );
      recommendations.push("Enable point-in-time recovery");
    } else if (
      nodePath.includes("aws_api_gateway") ||
      nodePath.includes("aws_apigatewayv2")
    ) {
      summary = "API Gateway configuration";
      recommendations.push("Enable request validation");
      recommendations.push("Configure throttling limits");
    } else if (
      nodePath.includes("aws_security_group") ||
      nodePath.includes("aws_vpc")
    ) {
      summary = "Networking configuration";
      issues.push("Review security group rules for overly permissive access");
      recommendations.push("Restrict ingress to known CIDR ranges");
    } else {
      summary = `Resource: ${nodePath.split(".")[0]}`;
      if (actions.includes("delete")) {
        issues.push("Resource is being destroyed - verify this is intentional");
      }
    }

    if (actions.includes("update")) {
      issues.push("In-place update - verify no breaking changes");
    }

    enrichment[nodePath] = { summary, issues, recommendations };
  }

  return enrichment;
}

function applyEnrichment(nodes, enrichment) {
  for (const nodePath of Object.keys(nodes)) {
    const item = enrichment[nodePath] || {};
    nodes[nodePath].enrichment = {
      summary: item.summary || "",
      issues: item.issues || [],
      recommendations: item.recommendations || [],
    };
    nodes[nodePath].AI = {
      Issues: item.issues || [],
      Summary: item.summary || "",
      Recommendations: item.recommendations || [],
    };
  }
}

app.post(
  "/terraform/upload",
  upload.fields([
    { name: "planFile", maxCount: 1 },
    { name: "dotFile", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const planFile = req.files?.planFile?.[0];
      const dotFile = req.files?.dotFile?.[0];

      if (!planFile || !dotFile) {
        return res
          .status(400)
          .json({ error: "Both planFile and dotFile are required" });
      }

      const planContent = fs.readFileSync(planFile.path, "utf-8");
      const dotContent = fs.readFileSync(dotFile.path, "utf-8");
      const plan = JSON.parse(planContent);
      const graph = dot.read(dotContent);

      console.log(
        "Plan file:",
        planFile.originalname,
        planContent.length,
        "chars",
      );
      console.log("Dot file:", dotFile.originalname, dotContent.length, "chars");

      const adjlist = getAdjacencyListFromDot(graph);
      writeJsonToTemp(adjlist, "adjlist.json");

      let nodes = loadPlanAndNodes(plan);
      writeJsonToTemp(nodes, "nodes_dict.json");

      nodes = buildNewEdges(nodes, adjlist);
      writeJsonToTemp(nodes, "nodes_new_edges.json");

      nodes = computeResourceDiffs(nodes);
      nodes = buildExistingEdges(nodes, plan);
      nodes = ensureEdgeLists(nodes);
      nodes = externalResources(nodes);
      nodes = ensureEdgeLists(nodes);
      nodes = deleteOrphanedNodes(nodes);
      nodes = cleanUpRoleLinks(nodes);
      writeJsonToTemp(nodes, "nodes_final.json");

      const enrichment = mockLanggraphEnrichment(nodes);
      applyEnrichment(nodes, enrichment);
      writeJsonToTemp(nodes, "nodes_enriched.json");

      return res.json(nodes);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: error.message,
        trace: error.stack,
      });
    }
  },
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});