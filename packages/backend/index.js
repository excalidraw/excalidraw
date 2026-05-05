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
  applyModuleMetadata,
  mergeTerraformState,
  ensureTerraformModuleNodes,
  omitNonAllowlistedDataSourceNodes,
  ensureEdgeLists,
  buildDataFlowEdges,
  externalResources,
  deleteOrphanedNodes,
  omitVpcPlumbingNodes,
  filterVisualIgnore,
  cleanUpRoleLinks,
  refineCloudWatchMetricAlarmEdges,
} = require("./pipeline");
const { extractVpcNetworkingFacetStore } = require("./vpc-networking-facet");
const { mockLanggraphEnrichment, applyEnrichment } = require("./enrichment");
const { nodesToExcalidraw } = require("./excalidraw");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

app.get("/terraform/test-client", (_req, res) => {
  const filePath = path.join(__dirname, "test-client.html");
  return res.sendFile(filePath);
});

app.post(
  "/terraform/upload",
  upload.fields([
    { name: "planFile", maxCount: 1 },
    { name: "dotFile", maxCount: 1 },
    { name: "stateFile", maxCount: 1 },
  ]),
  (req, res) => {
    const uploadedFiles = [];
    try {
      const planFile = req.files?.planFile?.[0];
      const dotFile = req.files?.dotFile?.[0];
      const stateFile = req.files?.stateFile?.[0];
      uploadedFiles.push(...[planFile, dotFile, stateFile].filter(Boolean));

      if (!planFile || !dotFile) {
        return res
          .status(400)
          .json({ error: "Both planFile and dotFile are required" });
      }

      const planContent = fs.readFileSync(planFile.path, "utf-8");
      const dotContent = fs.readFileSync(dotFile.path, "utf-8");
      const stateContent = stateFile
        ? fs.readFileSync(stateFile.path, "utf-8")
        : null;
      const plan = JSON.parse(planContent);
      const state = stateContent ? JSON.parse(stateContent) : null;
      const graph = dot.read(dotContent);

      const adjlist = getAdjacencyListFromDot(graph);

      let nodes = loadPlanAndNodes(plan);

      nodes = mergeTerraformState(nodes, state);
      nodes = ensureTerraformModuleNodes(nodes);
      nodes = applyModuleMetadata(nodes, plan);
      nodes = omitNonAllowlistedDataSourceNodes(nodes);
      nodes = buildNewEdges(nodes, adjlist);

      nodes = computeResourceDiffs(nodes);
      nodes = buildExistingEdges(nodes, plan);
      nodes = omitNonAllowlistedDataSourceNodes(nodes);
      nodes = refineCloudWatchMetricAlarmEdges(nodes);
      nodes = ensureEdgeLists(nodes);
      nodes = externalResources(nodes);
      nodes = ensureEdgeLists(nodes);
      nodes = buildDataFlowEdges(nodes);
      nodes = ensureEdgeLists(nodes);
      // Facets must capture routing plumbing before those nodes are removed.
      nodes.__networkingFacetStore = extractVpcNetworkingFacetStore(nodes);
      nodes = omitVpcPlumbingNodes(nodes);
      nodes = deleteOrphanedNodes(nodes);
      nodes = cleanUpRoleLinks(nodes);
      nodes = filterVisualIgnore(nodes);
      nodes = deleteOrphanedNodes(nodes);

      const enrichment = mockLanggraphEnrichment(nodes);
      applyEnrichment(nodes, enrichment);

      const inserted = db.insert(uploads).values({
        data: JSON.stringify(nodes),
        planFilename: planFile.originalname,
        dotFilename: dotFile.originalname,
        stateFilename: stateFile?.originalname || null,
        nodeCount: Object.keys(nodes).filter((k) => !k.startsWith("__")).length,
      }).returning({ id: uploads.id }).get();

      return res.json({ id: inserted.id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: error.message,
      });
    } finally {
      for (const file of uploadedFiles) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Best effort cleanup for multer temp files.
        }
      }
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
    state_filename: row.stateFilename,
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
