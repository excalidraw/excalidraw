declare module "../../../excalidraw-app/dev/terraformImportPresetDb.mjs" {
  export function hasTerraformImportRepoFileInDb(
    repoRelativePath: string,
  ): boolean;

  export function readTerraformImportRepoFileText(
    repoRelativePath: string,
  ): string;

  export function loadStagingMultiStatePlanDotBundlesFromDb(): Array<{
    plan: Record<string, unknown>;
    dotText: string;
    label: string;
  }>;

  export function readStagingMultiStatePipelineTfdFromDb(): string;
}
