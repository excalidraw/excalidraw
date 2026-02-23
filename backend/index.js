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
      adjlist[source].push(target)
    }
  }

  collect_edges(input)
  return adjlist
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
  var adjlist = get_adjacency_list_from_dot(graph)

  res.json({
    success: true,
    plan: { name: planFile.originalname, size: planContent.length },
    dot: { name: dotFile.originalname, size: dotContent.length },
    temp: { adjlist, nodeCount: adjlist.length},
  });
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});