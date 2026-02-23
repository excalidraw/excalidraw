const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
var fs = require('fs');
var path = require('path');
var dot = require('graphlib-dot');

const TEMP_DIR = path.join(__dirname, 'temp');


app.use(cors());
app.use(express.json());

function get_adjacency_list_from_dot(input) {
  const adjlist = {};

  function extract_resource_name(node_id) {
    const parts = node_id.trim().split(" ");
    if (parts.length >= 2) {
      return parts[1].replace('"','').replace('\\','')
    }
    return parts.replace('"','').replace('\\','')
  }

  function collect_edges(g) {
    //yeah js for loops dont return the element, they return the index, funny stuff
    for (const edge in g.edges()) {
      source = extract_resource_name(g.edges()[edge].v)
      target = extract_resource_name(g.edges()[edge].w)
      if (!(source in adjlist)) {
        adjlist[source] = []
      }
      if (!adjlist[source].includes(target)) {
        adjlist[source].push(target)
      }
    }
  }

  collect_edges(input)

  writeNodesDictToTemp(adjlist,'adjlist.json')

  return adjlist
}

function load_plan_and_nodes(plan) {
  const resource_changes = plan.resource_changes || [];
  const nodes = {};

  for (const resource_change of resource_changes) {
    const address = resource_change.address;
    const res_path = address.replace(/\[\d+\]/g, '');
    if (!(res_path in nodes)) {
      nodes[res_path] = { resources: {} };
    }
    nodes[res_path].resources[address] = resource_change;
  }

  writeNodesDictToTemp(nodes,'nodes_dict.json')

  return nodes;
}

function build_new_edges_nx(nodes,adjlist) {
  for( const address in nodes) {
    nodes[address]["edges_new"] = []
    var visited = new Set();
    visited.add(address)
    var queue = [address]
    while (queue.length != 0) {
      current = queue.shift();
      if (!(current in adjlist)) {
        continue
      }
      for (const neibour of adjlist[current]) {
        if (visited.has(neibour)) {
          continue
        }
        visited.add(neibour)
        if (neibour in nodes && !nodes[address]["edges_new"].includes(neibour)) {
          nodes[address]["edges_new"].push(neibour)
        } else if (neibour.startsWith("provider")) {
          continue
        } else {
          queue.push(neibour)
        }
      }

    }
  }

  //make edges bi directional
  for ( const node in nodes) {
    for (const target of nodes[node]["edges_new"]) {
      if ( target in nodes) {
        const target_edges = nodes[target]["edges_new"];
        if (!target_edges.includes(node)) {
          nodes[target]["edges_new"].push(node)
        }
      }
    }
  }
  writeNodesDictToTemp(nodes,'nodes_new_edges.json')
  return nodes
}

function writeNodesDictToTemp(nodes,filename) {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  const filePath = path.join(TEMP_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(nodes, null, 2), 'utf-8');
  return filePath;
}

app.post("/terraform/upload", upload.fields([
  { name: "planFile", maxCount: 1 },
  { name: "dotFile", maxCount: 1 },
]), (req, res) => {
  const fs = require("fs");
  const planFile = req.files["planFile"]?.[0];
  const dotFile = req.files["dotFile"]?.[0];

  if (!planFile || !dotFile) {
    return res.status(400).json({ error: "Both planFile and dotFile are required" });
  }

  const planContent = fs.readFileSync(planFile.path, "utf-8");
  const dotContent = fs.readFileSync(dotFile.path, "utf-8");

  console.log("Plan file:", planFile.originalname, planContent.length, "chars");
  console.log("Dot file:", dotFile.originalname, dotContent.length, "chars");

  var graph = dot.read(dotContent);
  //console.log(graph);
  //console.log(graph.nodes());
  //console.log(graph.edges());
  var adjlist = get_adjacency_list_from_dot(graph);
  var nodesDict = load_plan_and_nodes(JSON.parse(planContent));
  var nodesDict = build_new_edges_nx(nodesDict,adjlist);

  res.json({
    success: true,
    plan: { name: planFile.originalname, size: planContent.length },
    dot: { name: dotFile.originalname, size: dotContent.length },
    temp: { adjlist, nodeCount: Object.keys(adjlist).length },
  });
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});