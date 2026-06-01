import fs from "node:fs";

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
