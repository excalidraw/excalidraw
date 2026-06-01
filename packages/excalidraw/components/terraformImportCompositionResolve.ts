import {
  applyTfdCompositionToSources,
  repoNameFromRootPath,
  type TerraformArtifactKind,
  type TerraformArtifactRecord,
  type TerraformArtifactRef,
} from "./terraformTfdComposition";

import type {
  TerraformImportPresetSources,
  TerraformImportStackCatalogEntry,
} from "./terraformImportPresetsTypes";

export type ArtifactLoader = (
  ref: TerraformArtifactRef,
  kind: TerraformArtifactKind,
) =>
  | Pick<TerraformArtifactRecord, "content">
  | TerraformArtifactRecord
  | null
  | undefined;

export function resolveSourcesWithTfdComposition(
  sources: TerraformImportPresetSources,
  artifactLoader?: ArtifactLoader,
): TerraformImportPresetSources {
  const hasTfd = sources.tfdTexts.some((text) => text?.trim());
  if (!hasTfd) {
    return sources;
  }

  const result = applyTfdCompositionToSources(sources, sources.tfdTexts, {
    repoName: sources.repoName,
    stackCatalog: sources.stackCatalog,
    artifactLoader,
  });

  return {
    ...result.sources,
    repoName: sources.repoName,
    stackCatalog: sources.stackCatalog,
    warnings: result.warnings,
    compositionErrors: result.errors,
  };
}

export function buildStackCatalogFromPresetStacks(
  repoName: string,
  stacks: ReadonlyArray<{
    id: string;
    label: string;
    planPath: string;
    dotPath: string;
    statePath?: string;
    planText?: string;
    dotText?: string;
    stateText?: string;
  }>,
): TerraformImportStackCatalogEntry[] {
  return stacks.map((stack) => ({
    stackId: stack.id,
    label: stack.label,
    planPath: stack.planPath,
    dotPath: stack.dotPath,
    ...(stack.statePath ? { statePath: stack.statePath } : {}),
    ...(stack.planText ? { planText: stack.planText } : {}),
    ...(stack.dotText ? { dotText: stack.dotText } : {}),
    ...(stack.stateText ? { stateText: stack.stateText } : {}),
  }));
}

export { repoNameFromRootPath };
