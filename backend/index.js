const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const dot = require("graphlib-dot");

const { db, uploads, eq } = require("./db");
const {
  getAdjacencyListFromDot,
  loadPlanAndNodes,
  buildNewEdges,
  computeResourceDiffs,
  buildExistingEdges,
  ensureEdgeLists,
  externalResources,
  deleteOrphanedNodes,
  cleanUpRoleLinks,
} = require("./pipeline");
const { mockLanggraphEnrichment, applyEnrichment } = require("./enrichment");
const { nodesToExcalidraw } = require("./excalidraw");

const app = express();
const PORT = 3000;
const upload = multer({ dest: "uploads/" });
const TEMP_DIR = path.join(__dirname, "temp");

app.use(cors());
app.use(express.json());

function writeJsonToTemp(data, filename) {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  const filePath = path.join(TEMP_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
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

      const inserted = db.insert(uploads).values({
        data: JSON.stringify(nodes),
        planFilename: planFile.originalname,
        dotFilename: dotFile.originalname,
        nodeCount: Object.keys(nodes).length,
      }).returning({ id: uploads.id }).get();

      return res.json({ id: inserted.id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: error.message,
        trace: error.stack,
      });
    }
  },
);

app.get("/terraform/upload/:id", (req, res) => {
  const row = db.select().from(uploads).where(eq(uploads.id, Number(req.params.id))).get();
  if (!row) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.json({
    id: row.id,
    nodes: JSON.parse(row.data),
    plan_filename: row.planFilename,
    dot_filename: row.dotFilename,
    node_count: row.nodeCount,
    created_at: row.createdAt,
  });
});

app.get("/terraform/upload/:id/excalidraw", async (req, res) => {
  try {
    const row = db
      .select()
      .from(uploads)
      .where(eq(uploads.id, Number(req.params.id)))
      .get();
    if (!row) {
      return res.status(404).json({ error: "Not found" });
    }
    const nodes = JSON.parse(row.data);
    const excalidraw = await nodesToExcalidraw(nodes);
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="terraform-${row.id}.excalidraw"`,
    );
    return res.json(excalidraw);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
