import { loadPresetBlobText } from "./_terraformPresetBlobStorage";

export type TerraformImportPresetView = "semantic" | "module" | "pipeline";

export type TerraformImportPresetWarning = {
  code: "missing_state_file" | "missing_optional_tfd";
  message: string;
};

export type TerraformImportPresetStack = {
  id: string;
  label: string;
  planPath: string;
  dotPath: string;
  statePath?: string;
  planText?: string;
  dotText?: string;
  stateText?: string;
};

export type TerraformImportPreset = {
  id: string;
  name: string;
  description?: string;
  builtin: boolean;
  view: TerraformImportPresetView;
  rootPath: string;
  stacks: TerraformImportPresetStack[];
  tfdPaths: string[];
  hasContent: boolean;
};

export type TerraformImportPresetSources = {
  planDotBundles: Array<{
    plan: unknown;
    dotText: string;
    label: string;
  }>;
  states: unknown[];
  stateLabels: string[];
  tfdTexts: string[];
  tfdLabels: string[];
  warnings: TerraformImportPresetWarning[];
  repoName?: string;
  stackCatalog?: Array<{
    stackId: string;
    label: string;
    planPath: string;
    dotPath: string;
    statePath?: string;
    planText?: string;
    dotText?: string;
    stateText?: string;
  }>;
};

type PresetRow = {
  id: string;
  name: string;
  description: string | null;
  builtin: number;
  view: TerraformImportPresetView;
  root_path: string;
};

type StackRow = {
  stack_id: string;
  label: string;
  plan_path: string;
  dot_path: string;
  state_path: string | null;
  plan_text: string | null;
  dot_text: string | null;
  state_text: string | null;
};

type TfdRow = {
  path: string;
  content: string | null;
};

async function presetHasStoredContent(
  db: D1Database,
  presetId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?
         AND plan_text IS NOT NULL
         AND dot_text IS NOT NULL`,
    )
    .bind(presetId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0) > 0;
}

async function rowToPreset(
  db: D1Database,
  row: PresetRow,
): Promise<TerraformImportPreset> {
  const stacks = await db
    .prepare(
      `SELECT stack_id, label, plan_path, dot_path, state_path,
              plan_text, dot_text, state_text
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .bind(row.id)
    .all<StackRow>();

  const tfdRows = await db
    .prepare(
      `SELECT path, content FROM terraform_import_preset_tfd
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .bind(row.id)
    .all<TfdRow>();

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    builtin: Boolean(row.builtin),
    view: row.view,
    rootPath: row.root_path,
    stacks: (stacks.results ?? []).map((stack) => ({
      id: stack.stack_id,
      label: stack.label,
      planPath: stack.plan_path,
      dotPath: stack.dot_path,
      ...(stack.state_path ? { statePath: stack.state_path } : {}),
    })),
    tfdPaths: (tfdRows.results ?? []).map((entry) => entry.path),
    hasContent: await presetHasStoredContent(db, row.id),
  };
}

export async function listTerraformImportPresetsFromD1(
  db: D1Database,
): Promise<TerraformImportPreset[]> {
  const result = await db
    .prepare(
      `SELECT id, name, description, builtin, view, root_path
       FROM terraform_import_presets
       ORDER BY builtin DESC, name ASC`,
    )
    .all<PresetRow>();

  const rows = result.results ?? [];
  return Promise.all(rows.map((row) => rowToPreset(db, row)));
}

export async function getTerraformImportPresetFromD1(
  db: D1Database,
  presetId: string,
): Promise<TerraformImportPreset | null> {
  const row = await db
    .prepare(
      `SELECT id, name, description, builtin, view, root_path
       FROM terraform_import_presets
       WHERE id = ?`,
    )
    .bind(presetId)
    .first<PresetRow>();

  if (!row) {
    return null;
  }
  return rowToPreset(db, row);
}

export async function getTerraformImportPresetSourcesFromD1(
  db: D1Database,
  presetId: string,
): Promise<TerraformImportPresetSources | null> {
  const preset = await getTerraformImportPresetFromD1(db, presetId);
  if (!preset) {
    return null;
  }

  if (!preset.hasContent) {
    throw new Error(`Preset "${presetId}" has no stored file content.`);
  }

  const stackRows = await db
    .prepare(
      `SELECT stack_id, label, plan_path, dot_path, state_path,
              plan_text, dot_text, state_text
       FROM terraform_import_preset_stacks
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .bind(presetId)
    .all<StackRow>();

  const repoName =
    preset.rootPath
      .replace(/\\/g, "/")
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean)
      .pop() ?? "terraform";
  const stackCatalog = (stackRows.results ?? []).map((stack) => ({
    stackId: stack.stack_id,
    label: stack.label,
    planPath: stack.plan_path,
    dotPath: stack.dot_path,
    ...(stack.state_path ? { statePath: stack.state_path } : {}),
    ...(stack.plan_text ? { planText: stack.plan_text } : {}),
    ...(stack.dot_text ? { dotText: stack.dot_text } : {}),
    ...(stack.state_text ? { stateText: stack.state_text } : {}),
  }));

  const warnings: TerraformImportPresetWarning[] = [];
  const planDotBundles: TerraformImportPresetSources["planDotBundles"] = [];

  for (const stack of stackRows.results ?? []) {
    const planText = await loadPresetBlobText(
      db,
      presetId,
      "plan",
      stack.stack_id,
      stack.plan_text,
    );
    const dotText = await loadPresetBlobText(
      db,
      presetId,
      "dot",
      stack.stack_id,
      stack.dot_text,
    );
    if (!planText || !dotText) {
      throw new Error(
        `Preset "${presetId}" is missing stored plan or graph for stack "${stack.stack_id}".`,
      );
    }
    let parsedPlan: unknown;
    try {
      parsedPlan = JSON.parse(planText);
    } catch {
      throw new Error(
        `Stored plan JSON is invalid for stack "${stack.stack_id}".`,
      );
    }
    planDotBundles.push({
      plan: parsedPlan,
      dotText,
      label: stack.label,
    });
  }

  const states: unknown[] = [];
  const stateLabels: string[] = [];
  for (const stack of stackRows.results ?? []) {
    const stateText = await loadPresetBlobText(
      db,
      presetId,
      "state",
      stack.stack_id,
      stack.state_text,
    );
    if (!stateText) {
      warnings.push({
        code: "missing_state_file",
        message: `Optional state file missing for stack "${stack.stack_id}".`,
      });
      continue;
    }
    let parsedState: unknown;
    try {
      parsedState = JSON.parse(stateText);
    } catch {
      throw new Error(
        `Stored state JSON is invalid for stack "${stack.stack_id}".`,
      );
    }
    states.push(parsedState);
    stateLabels.push(stack.label);
  }

  const tfdRows = await db
    .prepare(
      `SELECT path, content FROM terraform_import_preset_tfd
       WHERE preset_id = ?
       ORDER BY sort_order ASC`,
    )
    .bind(presetId)
    .all<TfdRow>();

  const tfdTexts: string[] = [];
  const tfdLabels: string[] = [];
  for (const tfdRow of tfdRows.results ?? []) {
    const tfdContent = await loadPresetBlobText(
      db,
      presetId,
      "tfd",
      tfdRow.path,
      tfdRow.content,
    );
    if (!tfdContent) {
      warnings.push({
        code: "missing_optional_tfd",
        message: `Optional dataflow file missing: ${tfdRow.path}`,
      });
      continue;
    }
    tfdTexts.push(tfdContent);
    tfdLabels.push(tfdRow.path);
  }

  return {
    planDotBundles,
    states,
    stateLabels,
    tfdTexts,
    tfdLabels,
    warnings,
    repoName,
    stackCatalog,
  };
}

export const PRESET_CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "public, max-age=300",
};
