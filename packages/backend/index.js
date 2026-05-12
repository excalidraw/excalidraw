/**
 * Express API for Terraform/OpenTofu uploads: multipart plan+DOT and/or raw state → SQLite row
 * and JSON graph; `GET …/excalidraw` runs `nodesToExcalidraw` for the web app import flow.
 */
const fs = require("fs");

const path = require("path");

const express = require("express");
const cors = require("cors");
const multer = require("multer");

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
  buildNetworkingEdges,
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

const STRUCTURAL_PRUNE_MODES = new Set(["module-only", "global", "off"]);
const FALSEY_FLAG_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

function normalizeStructuralPruneMode(rawMode) {
  const mode = String(rawMode || "module-only")
    .trim()
    .toLowerCase();
  return STRUCTURAL_PRUNE_MODES.has(mode) ? mode : "module-only";
}

function parseBooleanFlag(rawValue, fallback = false) {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  if (rawValue == null) {
    return fallback;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return !FALSEY_FLAG_VALUES.has(normalized);
}

app.use(cors());
app.use(express.json());

/** Serves `test-client.html` for manual upload / facet inspection without the full Excalidraw app. */
app.get("/terraform/test-client", (_req, res) => {
  const filePath = path.join(__dirname, "test-client.html");
  return res.sendFile(filePath);
});

/**
 * Accepts `planFile`+`dotFile` together, and/or `stateFile`.
 * State-only: raw Terraform state JSON (`resources` array, e.g. `terraform state pull`).
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

      const hasPlan = Boolean(planFile);
      const hasDot = Boolean(dotFile);
      const hasState = Boolean(stateFile);

      if ((hasPlan && !hasDot) || (!hasPlan && hasDot)) {
        return res.status(400).json({
          error:
            'planFile and dotFile must be supplied together, or omit both and upload stateFile only (raw Terraform state JSON with a top-level "resources" array).',
        });
      }

      if (!hasPlan && !hasDot && !hasState) {
        return res.status(400).json({
          error:
            "Upload planFile+dotFile (optional stateFile), or stateFile alone.",
        });
      }

      let plan;
      let state = null;
      let dotContent;

      if (hasPlan && hasDot) {
        const planContent = fs.readFileSync(planFile.path, "utf-8");
        dotContent = fs.readFileSync(dotFile.path, "utf-8");
        try {
          plan = JSON.parse(planContent);
        } catch {
          return res
            .status(400)
            .json({ error: "planFile must be valid JSON." });
        }
        if (stateFile) {
          const stateContent = fs.readFileSync(stateFile.path, "utf-8");
          try {
            state = JSON.parse(stateContent);
          } catch {
            return res
              .status(400)
              .json({ error: "stateFile must be valid JSON." });
          }
        }
      } else {
        const stateContent = fs.readFileSync(stateFile.path, "utf-8");
        let parsedState;
        try {
          parsedState = JSON.parse(stateContent);
        } catch {
          return res
            .status(400)
            .json({ error: "stateFile must be valid JSON." });
        }
        if (!Array.isArray(parsedState.resources)) {
          return res.status(400).json({
            error:
              'state-only uploads require raw Terraform state JSON (top-level "resources" array), e.g. output of terraform state pull.',
          });
        }
        state = parsedState;
        plan = { resource_changes: [] };
        dotContent = "digraph G {}\n";
      }

      const graph = dot.read(dotContent);
      const structuralPruneMode = normalizeStructuralPruneMode(
        req.body?.structuralPruneMode || req.query?.structuralPruneMode,
      );
      const debugPipeline = parseBooleanFlag(
        req.body?.debugPipeline ?? req.query?.debugPipeline,
        false,
      );
      let debugOutputDir = null;
      let debugStep = 0;
      const writeDebugSnapshot = (stepName, value) => {
        if (!debugPipeline) {
          return;
        }
        if (!debugOutputDir) {
          const debugRunId = `upload-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
          debugOutputDir = path.join(__dirname, "debug-upload", debugRunId);
          fs.mkdirSync(debugOutputDir, { recursive: true });
        }
        debugStep += 1;
        const filename = `${String(debugStep).padStart(
          2,
          "0",
        )}-${stepName}.json`;
        fs.writeFileSync(
          path.join(debugOutputDir, filename),
          JSON.stringify(value, null, 2),
        );
      };

      const adjlist = getAdjacencyListFromDot(graph);
      writeDebugSnapshot("adjacency-list", adjlist);

      // Graph transforms (see pipeline.js module banner for semantics):
      // loadPlan → mergeState → moduleNodes → moduleMeta → filterDataSources → dotEdges →
      // diffs → existingEdges → filterDataSources → genericEdges → edgeLists → pruneShortcuts →
      // externals → edgeLists → dataFlow → edgeLists → facetStore → omitVpcPlumbing → orphans →
      // roleCleanup → visualIgnore → orphans → enrichment → persist.
      // Parse the Terraform plan into the initial node map.
      let nodes = loadPlanAndNodes(plan);
      writeDebugSnapshot("load-plan-and-nodes", nodes);
      // Merge state-only details (if present) into the plan-derived nodes.
      nodes = mergeTerraformState(nodes, state);
      writeDebugSnapshot("merge-terraform-state", nodes);
      // Ensure module container nodes exist for nested resources.
      nodes = ensureTerraformModuleNodes(nodes);
      writeDebugSnapshot("ensure-terraform-module-nodes", nodes);
      // Attach module metadata (paths/names) from the raw plan.
      nodes = applyModuleMetadata(nodes, plan);
      writeDebugSnapshot("apply-module-metadata", nodes);
      // Drop data source nodes that are not in the allowlist.
      nodes = omitNonAllowlistedDataSourceNodes(nodes);
      writeDebugSnapshot("omit-non-allowlisted-data-sources-1", nodes);
      // Build edges discovered from the DOT adjacency list.
      nodes = buildNewEdges(nodes, adjlist);
      writeDebugSnapshot("build-new-edges", nodes);

      // Compute create/update/delete/no-op diff status per resource.
      nodes = computeResourceDiffs(nodes);
      writeDebugSnapshot("compute-resource-diffs", nodes);
      // Add edges that can be inferred directly from plan references.
      nodes = buildExistingEdges(nodes, plan);
      writeDebugSnapshot("build-existing-edges", nodes);
      // Re-apply allowlist filtering after edge reconstruction.
      nodes = omitNonAllowlistedDataSourceNodes(nodes);
      writeDebugSnapshot("omit-non-allowlisted-data-sources-2", nodes);
      // Remove data sources that only exist in state and not in plan.
      nodes = omitStateOnlyDataSourceNodes(nodes);
      writeDebugSnapshot("omit-state-only-data-sources", nodes);
      // Detect generic parent/child structural relationships as edges.
      nodes = detectGenericStructuralEdges(nodes);
      writeDebugSnapshot("detect-generic-structural-edges", nodes);
      // Normalize edge containers so later passes can safely append.
      nodes = ensureEdgeLists(nodes);
      writeDebugSnapshot("ensure-edge-lists-1", nodes);
      // Remove duplicate or shortcut structural edges (scope configurable on upload).
      nodes = pruneRedundantStructuralEdges(nodes, {
        mode: structuralPruneMode,
      });
      writeDebugSnapshot("prune-redundant-structural-edges", nodes);
      // Mark or normalize references to external (out-of-graph) resources.
      nodes = externalResources(nodes);
      writeDebugSnapshot("external-resources", nodes);
      // Re-normalize edge lists after external resource adjustments.
      nodes = ensureEdgeLists(nodes);
      writeDebugSnapshot("ensure-edge-lists-2", nodes);
      // Infer IAM semantic data-flow edges and SG networking edges.
      nodes = buildDataFlowEdges(nodes);
      writeDebugSnapshot("build-data-flow-edges", nodes);
      nodes = buildNetworkingEdges(nodes);
      writeDebugSnapshot("build-networking-edges", nodes);
      // Ensure edge lists are present before final pruning passes.
      nodes = ensureEdgeLists(nodes);
      writeDebugSnapshot("ensure-edge-lists-3", nodes);
      // Drop synthetic IAM policy document nodes that should not render.
      nodes = omitGhostIamPolicyDocumentNodes(nodes);
      writeDebugSnapshot("omit-ghost-iam-policy-document-nodes", nodes);
      // Facets must capture routing plumbing before those nodes are removed.
      nodes.__networkingFacetStore = extractVpcNetworkingFacetStore(nodes);
      writeDebugSnapshot("extract-vpc-networking-facet-store", nodes);
      // Remove low-level VPC plumbing nodes after facet extraction.
      nodes = omitVpcPlumbingNodes(nodes);
      writeDebugSnapshot("omit-vpc-plumbing-nodes", nodes);
      // Prune nodes that no longer have valid graph connectivity.
      nodes = deleteOrphanedNodes(nodes);
      writeDebugSnapshot("delete-orphaned-nodes-1", nodes);
      // Clean inconsistent or stale IAM role linkage metadata.
      nodes = cleanUpRoleLinks(nodes);
      writeDebugSnapshot("clean-up-role-links", nodes);
      // Remove nodes flagged to be hidden from visual output.
      nodes = filterVisualIgnore(nodes);
      writeDebugSnapshot("filter-visual-ignore", nodes);
      // Run orphan cleanup again after visibility filtering.
      nodes = deleteOrphanedNodes(nodes);
      writeDebugSnapshot("delete-orphaned-nodes-2", nodes);

      const enrichment = mockLanggraphEnrichment(nodes);
      applyEnrichment(nodes, enrichment);

      const inserted = db
        .insert(uploads)
        .values({
          data: JSON.stringify(nodes),
          planFilename: planFile?.originalname ?? null,
          dotFilename: dotFile?.originalname ?? null,
          stateFilename: stateFile?.originalname || null,
          nodeCount: Object.keys(nodes).filter((k) => !k.startsWith("__"))
            .length,
        })
        .returning({ id: uploads.id })
        .get();

      return res.json({
        id: inserted.id,
        debugPipeline: debugPipeline
          ? { enabled: true, outputDir: debugOutputDir }
          : undefined,
      });
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
  const row = db
    .select()
    .from(uploads)
    .where(eq(uploads.id, Number(req.params.id)))
    .get();
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
      options: {
        layoutEngine: req.query.layoutEngine,
        vpcEndpointSnapping: req.query.vpcEndpointSnapping,
      },
    });

    res.setHeader("Content-Type", result.contentType || renderer.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="terraform-${row.id}.${
        result.fileExtension || renderer.fileExtension
      }"`,
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
