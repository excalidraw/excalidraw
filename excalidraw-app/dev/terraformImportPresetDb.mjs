import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DB_PATH = path.join(REPO_ROOT, "terraform-import-presets.db");
const IMPORT_PRESETS_CATALOG_PATH = path.join(
  REPO_ROOT,
  "packages/backend/terraform/import-presets.catalog.json",
);

let dbSingleton = null;

function nowIso() {
  return new Date().toISOString();
}

const joinRootRelative = (rootPath, relativePath) =>
  `${rootPath.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS terraform_import_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      builtin INTEGER NOT NULL DEFAULT 0,
      view TEXT NOT NULL CHECK (view IN ('semantic', 'module')),
      root_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terraform_import_preset_stacks (
      preset_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      stack_id TEXT NOT NULL,
      label TEXT NOT NULL,
      plan_path TEXT NOT NULL,
      dot_path TEXT NOT NULL,
      state_path TEXT,
      plan_text TEXT,
      dot_text TEXT,
      state_text TEXT,
      PRIMARY KEY (preset_id, sort_order),
      FOREIGN KEY (preset_id) REFERENCES terraform_import_presets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS terraform_import_preset_tfd (
      preset_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      path TEXT NOT NULL,
      content TEXT,
      PRIMARY KEY (preset_id, sort_order),
      FOREIGN KEY (preset_id) REFERENCES terraform_import_presets(id) ON DELETE CASCADE
    );
  `);

  const stackColumns = db
    .prepare(`PRAGMA table_info(terraform_import_preset_stacks)`)
    .all()
    .map((column) => column.name);
  if (!stackColumns.includes("plan_text")) {
    db.exec(
      `ALTER TABLE terraform_import_preset_stacks ADD COLUMN plan_text TEXT`,
    );
    db.exec(
      `ALTER TABLE terraform_import_preset_stacks ADD COLUMN dot_text TEXT`,
    );
    db.exec(
      `ALTER TABLE terraform_import_preset_stacks ADD COLUMN state_text TEXT`,
    );
  }

  const tfdColumns = db
    .prepare(`PRAGMA table_info(terraform_import_preset_tfd)`)
    .all()
    .map((column) => column.name);
  if (!tfdColumns.includes("content")) {
    db.exec(`ALTER TABLE terraform_import_preset_tfd ADD COLUMN content TEXT`);
  }
}

function presetHasStoredContent(db, presetId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?
         AND plan_text IS NOT NULL
         AND dot_text IS NOT NULL`,
    )
    .get(presetId);
  return Number(row?.count ?? 0) > 0;
}

function rowToPreset(db, row, { includeContent = false } = {}) {
  const stacks = db
    .prepare(
      `SELECT stack_id AS id, label, plan_path AS planPath, dot_path AS dotPath,
              state_path AS statePath, plan_text AS planText, dot_text AS dotText,
              state_text AS stateText
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(row.id)
    .map((stack) => ({
      id: stack.id,
      label: stack.label,
      planPath: stack.planPath,
      dotPath: stack.dotPath,
      ...(stack.statePath ? { statePath: stack.statePath } : {}),
      ...(includeContent && stack.planText
        ? {
            planText: stack.planText,
            dotText: stack.dotText ?? undefined,
            stateText: stack.stateText ?? undefined,
          }
        : {}),
    }));

  const tfdRows = db
    .prepare(
      `SELECT path, content FROM terraform_import_preset_tfd
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(row.id);

  const tfdPaths = tfdRows.map((entry) => entry.path);
  const tfdFiles = includeContent
    ? tfdRows
        .filter((entry) => typeof entry.content === "string")
        .map((entry) => ({ path: entry.path, text: entry.content }))
    : undefined;

  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    builtin: Boolean(row.builtin),
    view: row.view,
    rootPath: row.root_path,
    stacks,
    tfdPaths,
    hasContent: presetHasStoredContent(db, row.id),
    ...(includeContent && tfdFiles && tfdFiles.length > 0 ? { tfdFiles } : {}),
  };
}

function readTextFileAtRepoPath(relativePath) {
  const absolutePath = resolveTerraformImportFilePath(relativePath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function captureExistingStackContent(db, presetId) {
  const rows = db
    .prepare(
      `SELECT stack_id AS id, plan_text AS planText, dot_text AS dotText, state_text AS stateText
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?`,
    )
    .all(presetId);
  return new Map(rows.map((row) => [row.id, row]));
}

function captureExistingTfdContent(db, presetId) {
  const rows = db
    .prepare(
      `SELECT path, content FROM terraform_import_preset_tfd WHERE preset_id = ?`,
    )
    .all(presetId);
  return new Map(
    rows
      .filter((row) => typeof row.content === "string")
      .map((row) => [row.path, row.content]),
  );
}

function upsertPreset(db, preset) {
  const timestamp = nowIso();
  const existing = db
    .prepare(`SELECT id FROM terraform_import_presets WHERE id = ?`)
    .get(preset.id);

  const existingStackContent = captureExistingStackContent(db, preset.id);
  const existingTfdContent = captureExistingTfdContent(db, preset.id);

  if (existing) {
    db.prepare(
      `UPDATE terraform_import_presets
       SET name = ?, description = ?, builtin = ?, view = ?, root_path = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      preset.name,
      preset.description ?? null,
      preset.builtin ? 1 : 0,
      preset.view,
      preset.rootPath,
      timestamp,
      preset.id,
    );
  } else {
    db.prepare(
      `INSERT INTO terraform_import_presets
       (id, name, description, builtin, view, root_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      preset.id,
      preset.name,
      preset.description ?? null,
      preset.builtin ? 1 : 0,
      preset.view,
      preset.rootPath,
      timestamp,
      timestamp,
    );
  }

  db.prepare(
    `DELETE FROM terraform_import_preset_stacks WHERE preset_id = ?`,
  ).run(preset.id);
  db.prepare(`DELETE FROM terraform_import_preset_tfd WHERE preset_id = ?`).run(
    preset.id,
  );

  const insertStack = db.prepare(
    `INSERT INTO terraform_import_preset_stacks
     (preset_id, sort_order, stack_id, label, plan_path, dot_path, state_path,
      plan_text, dot_text, state_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  preset.stacks.forEach((stack, index) => {
    const previous = existingStackContent.get(stack.id);
    const planText = stack.planText ?? previous?.planText ?? null;
    const dotText = stack.dotText ?? previous?.dotText ?? null;
    const stateText = stack.stateText ?? previous?.stateText ?? null;
    insertStack.run(
      preset.id,
      index,
      stack.id,
      stack.label,
      stack.planPath,
      stack.dotPath,
      stack.statePath ?? null,
      planText,
      dotText,
      stateText,
    );
  });

  const tfdEntries =
    Array.isArray(preset.tfdFiles) && preset.tfdFiles.length > 0
      ? preset.tfdFiles
      : preset.tfdPaths.map((tfdPath) => ({
          path: tfdPath,
          text: existingTfdContent.get(tfdPath) ?? null,
        }));

  const insertTfd = db.prepare(
    `INSERT INTO terraform_import_preset_tfd
     (preset_id, sort_order, path, content) VALUES (?, ?, ?, ?)`,
  );
  tfdEntries.forEach((entry, index) => {
    const pathValue = typeof entry === "string" ? entry : entry.path;
    const textValue =
      typeof entry === "string"
        ? existingTfdContent.get(entry) ?? null
        : entry.text ?? existingTfdContent.get(entry.path) ?? null;
    insertTfd.run(preset.id, index, pathValue, textValue);
  });
}

function hydratePresetContentsFromDisk(db, presetId) {
  const row = db
    .prepare(
      `SELECT id, root_path AS rootPath, builtin FROM terraform_import_presets WHERE id = ?`,
    )
    .get(presetId);
  if (!row) {
    return { hydrated: 0, missing: [] };
  }

  const stacks = db
    .prepare(
      `SELECT sort_order AS sortOrder, stack_id AS id, label, plan_path AS planPath,
              dot_path AS dotPath, state_path AS statePath,
              plan_text AS planText, dot_text AS dotText, state_text AS stateText
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(presetId);

  const updateStack = db.prepare(
    `UPDATE terraform_import_preset_stacks
     SET plan_text = ?, dot_text = ?, state_text = ?
     WHERE preset_id = ? AND sort_order = ?`,
  );

  let hydrated = 0;
  const missing = [];

  for (const stack of stacks) {
    const planFullPath = joinRootRelative(row.rootPath, stack.planPath);
    const dotFullPath = joinRootRelative(row.rootPath, stack.dotPath);
    const planText = stack.planText ?? readTextFileAtRepoPath(planFullPath);
    const dotText = stack.dotText ?? readTextFileAtRepoPath(dotFullPath);
    let stateText = stack.stateText ?? null;
    if (stack.statePath) {
      const stateFullPath = joinRootRelative(row.rootPath, stack.statePath);
      stateText = stateText ?? readTextFileAtRepoPath(stateFullPath);
    }

    if (!planText || !dotText) {
      missing.push(planFullPath, dotFullPath);
      continue;
    }

    updateStack.run(planText, dotText, stateText, presetId, stack.sortOrder);
    hydrated += 1;
  }

  const tfdRows = db
    .prepare(
      `SELECT sort_order AS sortOrder, path, content
       FROM terraform_import_preset_tfd
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(presetId);

  const updateTfd = db.prepare(
    `UPDATE terraform_import_preset_tfd SET content = ? WHERE preset_id = ? AND sort_order = ?`,
  );

  for (const tfdRow of tfdRows) {
    if (tfdRow.content) {
      continue;
    }
    const fullPath = joinRootRelative(row.rootPath, tfdRow.path);
    const text = readTextFileAtRepoPath(fullPath);
    if (text) {
      updateTfd.run(text, presetId, tfdRow.sortOrder);
      hydrated += 1;
    } else {
      missing.push(fullPath);
    }
  }

  db.prepare(
    `UPDATE terraform_import_presets SET updated_at = ? WHERE id = ?`,
  ).run(nowIso(), presetId);

  return { hydrated, missing };
}

export function loadImportPresetsCatalog() {
  const raw = fs.readFileSync(IMPORT_PRESETS_CATALOG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const presets = Array.isArray(parsed.presets) ? parsed.presets : [];
  return presets.map((preset) => ({
    ...preset,
    builtin: preset.builtin !== false,
  }));
}

/** Upsert and hydrate every built-in preset from import-presets.catalog.json. */
export function seedAllBuiltinsFromCatalog(db) {
  const presets = loadImportPresetsCatalog();
  const results = [];

  for (const preset of presets) {
    upsertPreset(db, preset);
    const hydrateResult = hydratePresetContentsFromDisk(db, preset.id);
    results.push({
      id: preset.id,
      ...hydrateResult,
    });
  }

  return { presetCount: presets.length, results };
}

function seedBuiltins(db) {
  seedAllBuiltinsFromCatalog(db);
}

export function resetTerraformImportPresetDbSingleton() {
  if (dbSingleton) {
    dbSingleton.close();
    dbSingleton = null;
  }
}

export function getTerraformImportPresetDb(dbPath = DEFAULT_DB_PATH) {
  if (dbSingleton) {
    return dbSingleton;
  }
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  seedBuiltins(db);
  dbSingleton = db;
  return db;
}

export function listTerraformImportPresetsFromDb() {
  const db = getTerraformImportPresetDb();
  const rows = db
    .prepare(
      `SELECT id, name, description, builtin, view, root_path
       FROM terraform_import_presets
       ORDER BY builtin DESC, name ASC`,
    )
    .all();
  return rows.map((row) => rowToPreset(db, row));
}

export function getTerraformImportPresetFromDb(presetId, options = {}) {
  const db = getTerraformImportPresetDb();
  const row = db
    .prepare(
      `SELECT id, name, description, builtin, view, root_path
       FROM terraform_import_presets
       WHERE id = ?`,
    )
    .get(presetId);
  if (!row) {
    return null;
  }
  return rowToPreset(db, row, options);
}

export function getTerraformImportPresetSourcesFromDb(presetId) {
  const db = getTerraformImportPresetDb();
  const preset = getTerraformImportPresetFromDb(presetId);
  if (!preset) {
    return null;
  }

  if (!preset.hasContent) {
    throw new Error(
      `Preset "${presetId}" has no stored file content. Run sync-from-disk or save files into the preset.`,
    );
  }

  const stackRows = db
    .prepare(
      `SELECT stack_id AS id, label, plan_text AS planText, dot_text AS dotText,
              state_text AS stateText
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(presetId);

  const warnings = [];
  const planDotBundles = [];

  for (const stack of stackRows) {
    if (!stack.planText || !stack.dotText) {
      throw new Error(
        `Preset "${presetId}" is missing stored plan or graph for stack "${stack.id}".`,
      );
    }
    let parsedPlan;
    try {
      parsedPlan = JSON.parse(stack.planText);
    } catch {
      throw new Error(`Stored plan JSON is invalid for stack "${stack.id}".`);
    }
    planDotBundles.push({
      plan: parsedPlan,
      dotText: stack.dotText,
      label: stack.label,
    });
  }

  const states = [];
  const stateLabels = [];
  for (const stack of stackRows) {
    if (!stack.stateText) {
      warnings.push({
        code: "missing_state_file",
        message: `Optional state file missing for stack "${stack.id}".`,
      });
      continue;
    }
    let parsedState;
    try {
      parsedState = JSON.parse(stack.stateText);
    } catch {
      throw new Error(`Stored state JSON is invalid for stack "${stack.id}".`);
    }
    states.push(parsedState);
    stateLabels.push(stack.label);
  }

  const tfdRows = db
    .prepare(
      `SELECT path, content FROM terraform_import_preset_tfd
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(presetId);

  const tfdTexts = [];
  const tfdLabels = [];
  for (const tfdRow of tfdRows) {
    if (!tfdRow.content) {
      warnings.push({
        code: "missing_optional_tfd",
        message: `Optional dataflow file missing: ${tfdRow.path}`,
      });
      continue;
    }
    tfdTexts.push(tfdRow.content);
    tfdLabels.push(tfdRow.path);
  }

  return {
    planDotBundles,
    states,
    stateLabels,
    tfdTexts,
    tfdLabels,
    warnings,
  };
}

export function syncTerraformImportPresetFromDisk(presetId) {
  const db = getTerraformImportPresetDb();
  const row = db
    .prepare(`SELECT id FROM terraform_import_presets WHERE id = ?`)
    .get(presetId);
  if (!row) {
    throw new Error("Preset does not exist.");
  }
  return hydratePresetContentsFromDisk(db, presetId);
}

export function saveTerraformImportPresetToDb(preset) {
  if (preset.builtin) {
    throw new Error("Built-in presets cannot be saved.");
  }
  const db = getTerraformImportPresetDb();
  const existingBuiltin = db
    .prepare(
      `SELECT id FROM terraform_import_presets WHERE id = ? AND builtin = 1`,
    )
    .get(preset.id);
  if (existingBuiltin) {
    throw new Error("Preset id is reserved by a built-in preset.");
  }
  upsertPreset(db, { ...preset, builtin: false });
  return getTerraformImportPresetFromDb(preset.id);
}

export function updateTerraformImportPresetInDb(presetId, preset) {
  const db = getTerraformImportPresetDb();
  const row = db
    .prepare(`SELECT builtin FROM terraform_import_presets WHERE id = ?`)
    .get(presetId);
  if (!row) {
    throw new Error("Preset does not exist.");
  }
  if (row.builtin) {
    throw new Error("Built-in presets cannot be updated.");
  }
  upsertPreset(db, { ...preset, id: presetId, builtin: false });
  return getTerraformImportPresetFromDb(presetId);
}

export function deleteTerraformImportPresetFromDb(presetId) {
  const db = getTerraformImportPresetDb();
  const row = db
    .prepare(`SELECT builtin FROM terraform_import_presets WHERE id = ?`)
    .get(presetId);
  if (!row) {
    return false;
  }
  if (row.builtin) {
    throw new Error("Built-in presets cannot be deleted.");
  }
  db.prepare(`DELETE FROM terraform_import_presets WHERE id = ?`).run(presetId);
  return true;
}

export function resolveTerraformImportFilePath(relativePath) {
  const normalized = String(relativePath)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0") || normalized.includes("..")) {
    return null;
  }
  const ext = path.extname(normalized);
  const allowed = new Set([".json", ".dot", ".tfd", ".tfstate"]);
  if (!allowed.has(ext)) {
    return null;
  }
  const absolutePath = path.resolve(REPO_ROOT, normalized);
  const terraformRoot = path.resolve(REPO_ROOT, "packages/backend/terraform");
  if (
    !absolutePath.startsWith(terraformRoot + path.sep) &&
    absolutePath !== terraformRoot
  ) {
    return null;
  }
  return absolutePath;
}
