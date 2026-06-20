import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deleteTerraformImportPresetFromDb,
  getTerraformImportCompositionFromDb,
  getTerraformImportPresetDb,
  getTerraformImportPresetFromDb,
  getTerraformImportPresetSourcesFromDb,
  listTerraformImportArtifactsFromDb,
  listTerraformImportPresetsFromDb,
  resolveTerraformImportFilePath,
  saveTerraformImportArtifactToDb,
  saveTerraformImportCompositionToDb,
  saveTerraformImportPresetToDb,
  seedAllBuiltinsFromCatalog,
  syncTerraformImportPresetFromDisk,
  updateTerraformImportPresetInDb,
} from "./terraformImportPresetDb.mjs";

const TERRAFORM_PRESET_FILE_ROUTE = "/__dev/terraform-import/";
const TERRAFORM_PRESET_API_ROUTE = "/api/terraform-import-presets";
const TERRAFORM_ARTIFACT_API_ROUTE = "/api/terraform-import-artifacts";
const TERRAFORM_COMPOSITION_API_ROUTE = "/api/terraform-import-compositions";
const TERRAFORM_LAYOUT_API_ROUTE = "/api/terraform-layout";

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));
// The TS layout engine, loaded headlessly via Vite's ssrLoadModule. Its
// `@excalidraw/*` imports resolve through the dev config's resolve.alias.
const LAYOUT_CORE_MODULE = path.resolve(
  PLUGIN_DIR,
  "../../packages/excalidraw/components/terraformLayoutCore.ts",
);

// RCLL pipeline toggles → `TerraformLayoutOptions` keys. Param names mirror the
// `/demo` URL API (terraformDemoUrlParams.ts); `compact` is endpoint-only.
const LAYOUT_BOOLEAN_PARAMS = [
  ["compact", "pipelineCompact"],
  ["swimlaneRise", "pipelineSwimlaneLaneRise"],
  ["rankSeparate", "pipelineRankSeparate"],
  ["subnetDeBand", "pipelineSubnetDeBand"],
  ["straighten", "pipelineStraighten"],
  ["deDensify", "pipelineDeDensify"],
  ["reorder", "pipelineReorder"],
  ["staircaseBandOverlap", "pipelineStaircaseBandOverlap"],
  ["ancillary", "pipelineIncludeAncillary"],
];

// The layout engine's import graph (appState, element rendering) reads browser
// globals at module-eval time. ssrLoadModule runs in Node, so bootstrap a jsdom
// DOM once — the SAME environment vitest uses, so layout numbers stay faithful.
let domBootstrap = null;
const ensureLayoutDomGlobals = () => {
  if (!domBootstrap) {
    domBootstrap = (async () => {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
        pretendToBeVisual: true,
        url: "http://localhost/",
      });
      const { window } = dom;

      // jsdom has no 2d canvas context, but the layout measures text widths via
      // `ctx.font` + `measureText`. Provide a deterministic metrics-only stub
      // (font-size × 0.5 per char) — enough to size cards; the proof is the
      // OFF-vs-ON delta, which is driven by column ranks, not glyph widths.
      const makeTextMetricsContext = () => {
        let font = "10px sans-serif";
        const noop = () => {};
        return {
          get font() {
            return font;
          },
          set font(value) {
            font = value;
          },
          measureText: (text) => {
            const px = /(\d+(?:\.\d+)?)px/.exec(font);
            const size = px ? parseFloat(px[1]) : 10;
            return { width: String(text).length * size * 0.5 };
          },
          save: noop,
          restore: noop,
          fillText: noop,
          strokeText: noop,
          setTransform: noop,
          scale: noop,
          translate: noop,
          beginPath: noop,
          closePath: noop,
          moveTo: noop,
          lineTo: noop,
          stroke: noop,
          fill: noop,
          fillRect: noop,
          clearRect: noop,
          arc: noop,
        };
      };
      window.HTMLCanvasElement.prototype.getContext = function getContext(
        type,
      ) {
        return type === "2d" ? makeTextMetricsContext() : null;
      };

      const assign = (key, value) => {
        try {
          Object.defineProperty(globalThis, key, {
            value,
            configurable: true,
            writable: true,
          });
        } catch {
          /* keep any existing (read-only) global in place */
        }
      };
      assign("window", window);
      assign("document", window.document);
      assign("navigator", window.navigator);
      assign("location", window.location);
      assign("HTMLElement", window.HTMLElement);
      assign("Element", window.Element);
      assign("Node", window.Node);
      // The scene finalize step fetches the AWS icon library by `file://` URL
      // (icons are decorative — geometry-neutral). undici's fetch rejects the
      // file scheme, so serve file:// from disk; defer other URLs to real fetch.
      const realFetch = globalThis.fetch;
      assign("fetch", async (input, init) => {
        const href =
          input instanceof URL
            ? input.href
            : typeof input === "string"
            ? input
            : String(input?.url ?? input);
        if (href.startsWith("file://")) {
          const { readFile } = await import("node:fs/promises");
          const text = await readFile(fileURLToPath(href), "utf-8");
          return {
            ok: true,
            status: 200,
            text: async () => text,
            json: async () => JSON.parse(text),
          };
        }
        if (realFetch) {
          return realFetch(input, init);
        }
        throw new Error(`fetch unavailable for ${href}`);
      });
      assign("getComputedStyle", window.getComputedStyle.bind(window));
      assign("localStorage", window.localStorage);
      assign("sessionStorage", window.sessionStorage);
      assign("matchMedia", window.matchMedia?.bind(window));
      assign("requestAnimationFrame", window.requestAnimationFrame?.bind(window));
      assign("cancelAnimationFrame", window.cancelAnimationFrame?.bind(window));
      assign("devicePixelRatio", 1);
    })();
  }
  return domBootstrap;
};

/** "1"/"true" → true, "0"/"false" → false, absent → undefined, else null (invalid). */
const parseLayoutBooleanParam = (raw) => {
  if (raw == null || raw.trim() === "") {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") {
    return true;
  }
  if (normalized === "0" || normalized === "false") {
    return false;
  }
  return null;
};

/** Overall bounds (min/max) over the non-deleted elements, or null when empty. */
const computeSceneBounds = (elements) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width ?? 0));
    maxY = Math.max(maxY, el.y + (el.height ?? 0));
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
};

const REGION_KEY_PATTERN = /^tf-pipeline:region:aws%00(\d+)%00(.+)$/;

/** Region frames keyed by `customData.terraformTopologyKey`, sorted account→x. */
const collectRegionFrames = (elements) => {
  const regions = [];
  for (const el of elements) {
    if (el.type !== "frame") {
      continue;
    }
    const key = String(el.customData?.terraformTopologyKey ?? "");
    const match = key.match(REGION_KEY_PATTERN);
    if (!match) {
      continue;
    }
    regions.push({
      account: match[1],
      region: match[2],
      x: Math.round(el.x),
      y: Math.round(el.y),
      width: Math.round(el.width),
      height: Math.round(el.height),
    });
  }
  regions.sort((a, b) =>
    a.account === b.account
      ? a.x - b.x
      : a.account.localeCompare(b.account),
  );
  return regions;
};

/** Shape the proof payload: applied/suppressed flags + bounds + per-region geometry. */
const buildLayoutProofPayload = (presetId, requested, scene) => {
  const elements = (scene.elements ?? []).filter((el) => !el.isDeleted);
  const meta = scene.meta ?? {};
  const placement = meta.rcllStageMeta?.placement ?? {};
  const gates = meta.gates ?? {};
  return {
    preset: presetId,
    view: "rcll",
    requested,
    applied: {
      pipelineRankSeparate: meta.pipelineRankSeparate ?? false,
      pipelineRankSeparateSuppressed: meta.pipelineRankSeparateSuppressed ?? false,
      pipelineSwimlaneLaneRise: meta.pipelineSwimlaneLaneRise ?? false,
      pipelineSubnetDeBand: meta.pipelineSubnetDeBand ?? false,
      pipelineStraighten: meta.pipelineStraighten ?? false,
      pipelineDeDensify: meta.pipelineDeDensify ?? false,
      pipelineReorder: meta.pipelineReorder ?? false,
      rcllMilestone: meta.rcllMilestone ?? null,
    },
    bounds: computeSceneBounds(elements),
    elementCount: elements.length,
    rcll: {
      rankSeparateApplied: placement.rankSeparateApplied ?? null,
      rankSeparatePairCount: placement.rankSeparatePairCount ?? null,
      rankSeparateChangedRankCount: placement.rankSeparateChangedRankCount ?? null,
      rankSeparateFallback: placement.rankSeparateFallback ?? null,
      maxDepthPx: placement.maxDepthPx ?? null,
      acyclicBackwardEdges: gates.acyclicBackwardEdges ?? null,
      acyclicSameColumnEdges: gates.acyclicSameColumnEdges ?? null,
    },
    regions: collectRegionFrames(elements),
  };
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const parsePresetRoute = (url) => {
  const match = url.match(
    /^\/api\/terraform-import-presets\/([^/?]+)(\/[^?]*)?(?:\?.*)?$/,
  );
  if (!match) {
    return null;
  }
  return {
    presetId: decodeURIComponent(match[1]),
    suffix: match[2] ?? "",
  };
};

const parseCompositionRoute = (url) => {
  const match = url.match(
    /^\/api\/terraform-import-compositions\/([^/?]+)(\/[^?]*)?(?:\?.*)?$/,
  );
  if (!match) {
    return null;
  }
  return {
    compositionId: decodeURIComponent(match[1]),
    suffix: match[2] ?? "",
  };
};

export const terraformImportPresetDevPlugin = () => ({
  name: "terraform-import-preset-dev",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url || "";

      // Headless RCLL layout — curl this to prove a toggle changed the geometry.
      // GET /api/terraform-layout?preset=<id>&rankSeparate=1&swimlaneRise=1 → JSON
      // metrics (bounds, applied/suppressed flags, per-region x/y). Read-only.
      if (url.startsWith(TERRAFORM_LAYOUT_API_ROUTE)) {
        if (req.method !== "GET") {
          sendJson(res, 405, { error: "Method not allowed." });
          return;
        }
        const queryString = url.includes("?")
          ? url.slice(url.indexOf("?") + 1)
          : "";
        const params = new URLSearchParams(queryString);
        const presetId = (params.get("preset") ?? "").trim().toLowerCase();
        if (!presetId) {
          sendJson(res, 400, { error: "Missing required ?preset=<id>." });
          return;
        }

        const options = { layoutMode: "rcll" };
        const requested = {};
        for (const [param, optionKey] of LAYOUT_BOOLEAN_PARAMS) {
          const value = parseLayoutBooleanParam(params.get(param));
          if (value === null) {
            sendJson(res, 400, {
              error: `Invalid boolean for ?${param} (use 1/0/true/false).`,
            });
            return;
          }
          if (value !== undefined) {
            options[optionKey] = value;
            requested[param] = value;
          }
        }

        try {
          const sources = getTerraformImportPresetSourcesFromDb(presetId);
          if (!sources) {
            sendJson(res, 404, { error: `Preset "${presetId}" not found.` });
            return;
          }
          await ensureLayoutDomGlobals();
          const core = await server.ssrLoadModule(LAYOUT_CORE_MODULE);
          const result = await core.layoutTerraformFromSources(sources, options);
          if (!result.ok) {
            sendJson(res, result.status ?? 422, { error: result.error });
            return;
          }
          sendJson(
            res,
            200,
            buildLayoutProofPayload(presetId, requested, result.scene),
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("[terraform-layout] failed:", error);
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "Layout failed.",
            ...(error instanceof Error && error.stack
              ? { stack: error.stack }
              : {}),
            ...(error instanceof Error && error.cause
              ? { cause: String(error.cause?.stack ?? error.cause) }
              : {}),
          });
        }
        return;
      }

      if (url.startsWith(TERRAFORM_PRESET_FILE_ROUTE)) {
        const encodedPath = url.slice(TERRAFORM_PRESET_FILE_ROUTE.length);
        let relativePath = "";
        try {
          relativePath = decodeURIComponent(encodedPath).replace(/\\/g, "/");
        } catch {
          res.statusCode = 400;
          res.end("Invalid encoded path");
          return;
        }
        const absolutePath = resolveTerraformImportFilePath(relativePath);
        if (!absolutePath) {
          res.statusCode = 403;
          res.end("Forbidden path");
          return;
        }
        try {
          const text = fs.readFileSync(absolutePath, "utf8");
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(text);
        } catch {
          res.statusCode = 404;
          res.end("File not found");
        }
        return;
      }

      if (url.startsWith(TERRAFORM_ARTIFACT_API_ROUTE)) {
        if (req.method === "GET" && url === TERRAFORM_ARTIFACT_API_ROUTE) {
          sendJson(res, 200, { artifacts: listTerraformImportArtifactsFromDb() });
          return;
        }
        if (req.method === "POST" && url === TERRAFORM_ARTIFACT_API_ROUTE) {
          try {
            const body = await readJsonBody(req);
            const artifact = saveTerraformImportArtifactToDb(body.artifact ?? body);
            sendJson(res, 201, { artifact });
          } catch (error) {
            sendJson(res, 400, {
              error: error instanceof Error ? error.message : "Invalid artifact.",
            });
          }
          return;
        }
        sendJson(res, 405, { error: "Method not allowed." });
        return;
      }

      const compositionRoute = parseCompositionRoute(url);
      if (compositionRoute && url.startsWith(TERRAFORM_COMPOSITION_API_ROUTE)) {
        const { compositionId, suffix } = compositionRoute;
        if (req.method === "GET" && suffix === "/sources") {
          try {
            const composition = getTerraformImportCompositionFromDb(compositionId);
            if (!composition) {
              sendJson(res, 404, { error: "Composition not found." });
              return;
            }
            const presetId = compositionId.replace(/-composition$/, "");
            const sources = getTerraformImportPresetSourcesFromDb(presetId);
            if (!sources) {
              sendJson(res, 404, { error: "Composition sources unavailable." });
              return;
            }
            sources.tfdTexts = [composition.tfdContent];
            sources.tfdLabels = ["composition.tfd"];
            sendJson(res, 200, { sources, composition });
          } catch (error) {
            sendJson(res, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : "Composition sources unavailable.",
            });
          }
          return;
        }
        if (req.method === "POST" && url === TERRAFORM_COMPOSITION_API_ROUTE) {
          try {
            const body = await readJsonBody(req);
            const composition = saveTerraformImportCompositionToDb(
              body.composition ?? body,
            );
            sendJson(res, 201, { composition });
          } catch (error) {
            sendJson(res, 400, {
              error:
                error instanceof Error ? error.message : "Invalid composition.",
            });
          }
          return;
        }
        if (req.method === "GET" && compositionId && !suffix) {
          const composition = getTerraformImportCompositionFromDb(compositionId);
          if (!composition) {
            sendJson(res, 404, { error: "Composition not found." });
            return;
          }
          sendJson(res, 200, { composition });
          return;
        }
        sendJson(res, 405, { error: "Method not allowed." });
        return;
      }

      if (!url.startsWith(TERRAFORM_PRESET_API_ROUTE)) {
        next();
        return;
      }

      if (req.method === "GET" && url === TERRAFORM_PRESET_API_ROUTE) {
        sendJson(res, 200, { presets: listTerraformImportPresetsFromDb() });
        return;
      }

      if (
        req.method === "POST" &&
        url === `${TERRAFORM_PRESET_API_ROUTE}/seed-all`
      ) {
        try {
          const db = getTerraformImportPresetDb();
          const seedResult = seedAllBuiltinsFromCatalog(db);
          sendJson(res, 200, {
            presets: listTerraformImportPresetsFromDb(),
            ...seedResult,
          });
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : "Seed failed.",
          });
        }
        return;
      }

      const route = parsePresetRoute(url);
      const presetId = route?.presetId ?? null;
      const suffix = route?.suffix ?? "";

      if (req.method === "GET" && presetId && suffix === "/sources") {
        try {
          const sources = getTerraformImportPresetSourcesFromDb(presetId);
          if (!sources) {
            sendJson(res, 404, { error: "Preset not found." });
            return;
          }
          sendJson(res, 200, { sources });
        } catch (error) {
          sendJson(res, 400, {
            error:
              error instanceof Error ? error.message : "Sources unavailable.",
          });
        }
        return;
      }

      if (req.method === "GET" && presetId && !suffix) {
        const includeContent = url.includes("includeContent=1");
        const preset = getTerraformImportPresetFromDb(presetId, {
          includeContent,
        });
        if (!preset) {
          sendJson(res, 404, { error: "Preset not found." });
          return;
        }
        sendJson(res, 200, { preset });
        return;
      }

      if (req.method === "POST" && presetId && suffix === "/sync-from-disk") {
        try {
          const result = syncTerraformImportPresetFromDisk(presetId);
          const preset = getTerraformImportPresetFromDb(presetId);
          sendJson(res, 200, { preset, ...result });
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : "Sync failed.",
          });
        }
        return;
      }

      if (req.method === "POST" && url === TERRAFORM_PRESET_API_ROUTE) {
        try {
          const body = await readJsonBody(req);
          const preset = saveTerraformImportPresetToDb(body.preset);
          sendJson(res, 201, { preset });
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : "Invalid preset.",
          });
        }
        return;
      }

      if (req.method === "PUT" && presetId && !suffix) {
        try {
          const body = await readJsonBody(req);
          const preset = updateTerraformImportPresetInDb(presetId, body.preset);
          sendJson(res, 200, { preset });
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : "Update failed.",
          });
        }
        return;
      }

      if (req.method === "DELETE" && presetId && !suffix) {
        try {
          deleteTerraformImportPresetFromDb(presetId);
          sendJson(res, 200, { ok: true });
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : "Delete failed.",
          });
        }
        return;
      }

      sendJson(res, 405, { error: "Method not allowed." });
    });
  },
});
