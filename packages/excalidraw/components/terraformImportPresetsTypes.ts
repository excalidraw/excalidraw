import importPresetsCatalog from "../../backend/terraform/import-presets.catalog.json";

import type { TerraformPlanDotBundle } from "./terraformPlanParsing";

export type TerraformImportPresetView = "semantic" | "module" | "pipeline";

export type TerraformImportPresetWarning = {
  code:
    | "missing_state_file"
    | "missing_optional_tfd"
    | "composition_error";
  message: string;
};

export type TerraformImportArtifactKind = "plan" | "dot" | "state";

export type TerraformImportArtifactRef = {
  repoName: string;
  relativePath: string;
};

export type TerraformImportArtifact = {
  repoName: string;
  relativePath: string;
  kind: TerraformImportArtifactKind;
  stackId?: string;
  label?: string;
  contentHash?: string;
  hasContent?: boolean;
};

export type TerraformImportStackCatalogEntry = {
  stackId: string;
  label: string;
  planPath: string;
  dotPath: string;
  statePath?: string;
  planText?: string;
  dotText?: string;
  stateText?: string;
};

export type TerraformImportComposition = {
  id: string;
  name: string;
  description?: string;
  defaultView: TerraformImportPresetView;
  tfdContent: string;
};

export type TerraformImportPresetSources = {
  planDotBundles: TerraformPlanDotBundle[];
  states: unknown[];
  stateLabels: string[];
  tfdTexts: string[];
  tfdLabels: string[];
  warnings: TerraformImportPresetWarning[];
  repoName?: string;
  stackCatalog?: TerraformImportStackCatalogEntry[];
  compositionErrors?: string[];
};

export type TerraformImportPresetStack = {
  id: string;
  label: string;
  planPath: string;
  dotPath: string;
  statePath?: string;
  /** Embedded file content (stored in SQLite; omitted from list API). */
  planText?: string;
  dotText?: string;
  stateText?: string;
};

export type TerraformImportPresetTfdFile = {
  path: string;
  text: string;
};

export type TerraformImportPreset = {
  id: string;
  name: string;
  description?: string;
  builtin?: boolean;
  view: TerraformImportPresetView;
  rootPath: string;
  stacks: TerraformImportPresetStack[];
  tfdPaths: string[];
  /** True when plan/dot content is stored in the preset database. */
  hasContent?: boolean;
  /** Embedded .tfd contents (save payload / includeContent GET only). */
  tfdFiles?: TerraformImportPresetTfdFile[];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function normalizeStack(value: unknown): TerraformImportPresetStack | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const planPath =
    typeof value.planPath === "string" ? value.planPath.trim() : "";
  const dotPath = typeof value.dotPath === "string" ? value.dotPath.trim() : "";
  const statePath =
    typeof value.statePath === "string" ? value.statePath.trim() : undefined;
  const planText =
    typeof value.planText === "string" ? value.planText : undefined;
  const dotText = typeof value.dotText === "string" ? value.dotText : undefined;
  const stateText =
    typeof value.stateText === "string" ? value.stateText : undefined;
  if (!id || !label || !planPath || !dotPath) {
    return null;
  }
  return {
    id,
    label,
    planPath,
    dotPath,
    ...(statePath ? { statePath } : {}),
    ...(planText ? { planText } : {}),
    ...(dotText ? { dotText } : {}),
    ...(stateText ? { stateText } : {}),
  };
}

function normalizeTfdFile(value: unknown): TerraformImportPresetTfdFile | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const pathValue = typeof value.path === "string" ? value.path.trim() : "";
  const text = typeof value.text === "string" ? value.text : "";
  if (!pathValue || !text) {
    return null;
  }
  return { path: pathValue, text };
}

export function normalizeTerraformImportPreset(
  value: unknown,
): TerraformImportPreset | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const view =
    value.view === "module"
      ? "module"
      : value.view === "pipeline"
      ? "pipeline"
      : "semantic";
  const rootPath =
    typeof value.rootPath === "string" ? value.rootPath.trim() : "";
  const stacksRaw = Array.isArray(value.stacks) ? value.stacks : [];
  const stacks = stacksRaw
    .map(normalizeStack)
    .filter((stack): stack is TerraformImportPresetStack => Boolean(stack));
  const tfdPathsRaw = Array.isArray(value.tfdPaths) ? value.tfdPaths : [];
  const tfdPaths = tfdPathsRaw.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0,
  );
  const tfdFilesRaw = Array.isArray(value.tfdFiles) ? value.tfdFiles : [];
  const tfdFiles = tfdFilesRaw
    .map(normalizeTfdFile)
    .filter((entry): entry is TerraformImportPresetTfdFile => Boolean(entry));
  const hasContent = value.hasContent === true;
  if (!id || !name || !rootPath || stacks.length === 0) {
    return null;
  }
  const description =
    typeof value.description === "string" && value.description.trim().length > 0
      ? value.description.trim()
      : undefined;
  return {
    id,
    name,
    view,
    rootPath,
    stacks,
    tfdPaths:
      tfdPaths.length > 0 ? tfdPaths : tfdFiles.map((file) => file.path),
    ...(description ? { description } : {}),
    ...(hasContent ? { hasContent: true } : {}),
    ...(tfdFiles.length > 0 ? { tfdFiles } : {}),
  };
}

const catalogPresets = (importPresetsCatalog.presets ?? [])
  .map(normalizeTerraformImportPreset)
  .filter((preset): preset is TerraformImportPreset => Boolean(preset));

export const BUILTIN_TERRAFORM_IMPORT_PRESETS: TerraformImportPreset[] =
  catalogPresets;
