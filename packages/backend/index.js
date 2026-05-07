/**
 * Express API for Terraform/OpenTofu uploads: multipart plan + DOT (+ optional state) → SQLite row
 * and JSON graph; `GET …/excalidraw` runs `nodesToExcalidraw` for the web app import flow.
 */
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
  omitStateOnlyDataSourceNodes,
  omitGhostIamPolicyDocumentNodes,
  ensureEdgeLists,
  buildDataFlowEdges,
  externalResources,
  deleteOrphanedNodes,
  omitVpcPlumbingNodes,
  filterVisualIgnore,
  cleanUpRoleLinks,
  detectGenericStructuralEdges,
  pruneRedundantStructuralEdges,
} = require("./pipeline");
const { extractVpcNetworkingFacetStore } = require("./vpc-networking-facet");
const { mockLanggraphEnrichment, applyEnrichment } = require("./enrichment");
const { buildDiagramIR } = require("./diagram-ir");
const { getRenderer, listRenderers } = require("./connectors");
const {
  RendererNotImplementedError,
  UnknownRendererError,
} = require("./connectors/errors");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

/** Serves `test-client.html` for manual upload / facet inspection without the full Excalidraw app. */
app.get("/terraform/test-client", (_req, res) => {
  const filePath = path.join(__dirname, "test-client.html");
  return res.sendFile(filePath);
});

/**
 * Accepts `planFile`, `dotFile`, optional `stateFile`; runs the pipeline; stores JSON `nodes` in SQLite.
 * Temp multer files are always unlinked in `finally`.
 */
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

      // Graph transforms (see pipeline.js module banner for semantics):
      // loadPlan → mergeState → moduleNodes → moduleMeta → filterDataSources → dotEdges →
      // diffs → existingEdges → filterDataSources → genericEdges → edgeLists → pruneShortcuts →
      // externals → edgeLists → dataFlow → edgeLists → facetStore → omitVpcPlumbing → orphans →
      // roleCleanup → visualIgnore → orphans → enrichment → persist.
      let nodes = loadPlanAndNodes(plan);
      nodes = mergeTerraformState(nodes, state);
      nodes = ensureTerraformModuleNodes(nodes);
      nodes = applyModuleMetadata(nodes, plan);
      nodes = omitNonAllowlistedDataSourceNodes(nodes);
      nodes = buildNewEdges(nodes, adjlist);

      nodes = computeResourceDiffs(nodes);
      nodes = buildExistingEdges(nodes, plan);
      nodes = omitNonAllowlistedDataSourceNodes(nodes);
      nodes = omitStateOnlyDataSourceNodes(nodes);
      nodes = detectGenericStructuralEdges(nodes);
      nodes = ensureEdgeLists(nodes);
      nodes = pruneRedundantStructuralEdges(nodes);
      nodes = externalResources(nodes);
      nodes = ensureEdgeLists(nodes);
      nodes = buildDataFlowEdges(nodes);
      nodes = ensureEdgeLists(nodes);
      nodes = omitGhostIamPolicyDocumentNodes(nodes);
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

/** Returns stored graph JSON and upload metadata for debugging or alternate clients. */
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

/** Lists available frontend connectors. */
app.get("/terraform/renderers", (_req, res) => {
  return res.json({ renderers: listRenderers() });
});

/**
 * Materializes a frontend-specific document from stored `nodes`.
 *
 * Connectors live in `connectors/`. Each one consumes the post-pipeline
 * `nodes` map plus a neutral `DiagramIR`. New frontend bindings (tldraw,
 * mermaid, drawio, ...) plug in by adding a module to that registry.
 */
app.get("/terraform/upload/:id/render/:renderer", async (req, res) => {
  return await renderUploadAs(req.params.renderer, req, res);
});

/**
 * Back-compat alias for the legacy Excalidraw endpoint. Kept stable so the
 * React import dialog and existing fetchers keep working. Sets a
 * `Deprecation` header pointing callers at `/render/:renderer`.
 */
app.get("/terraform/upload/:id/excalidraw", async (req, res) => {
  res.setHeader("Deprecation", "true");
  res.setHeader(
    "Link",
    '</terraform/upload/:id/render/excalidraw>; rel="successor-version"',
  );
  return await renderUploadAs("excalidraw", req, res);
});

async function renderUploadAs(rendererId, req, res) {
  try {
    const row = db
      .select()
      .from(uploads)
      .where(eq(uploads.id, Number(req.params.id)))
      .get();
    if (!row) {
      return res.status(404).json({ error: "Not found" });
    }

    let renderer;
    try {
      renderer = getRenderer(rendererId);
    } catch (error) {
      if (error instanceof UnknownRendererError) {
        return res
          .status(404)
          .json({ error: error.message, available: error.available });
      }
      throw error;
    }

    const nodes = JSON.parse(row.data);
    const ir = buildDiagramIR(nodes);
    const result = await renderer.render({
      nodes,
      ir,
      options: { layoutEngine: req.query.layoutEngine },
    });

    res.setHeader("Content-Type", result.contentType || renderer.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="terraform-${row.id}.${result.fileExtension || renderer.fileExtension}"`,
    );
    return res.json(result.body);
  } catch (error) {
    if (error instanceof RendererNotImplementedError) {
      return res.status(501).json({
        error: error.message,
        renderer: error.rendererId,
        details: error.details,
      });
    }
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
