/** Vitest globs excluded from `yarn test:fast` (run via full suite / `yarn test:slow`). */
export const SLOW_TEST_PATTERNS = [
  "**/terraformImportPerf.test.ts",
  "**/terraformLayoutSnapshot.test.ts",
  "**/terraformMultiImport.integration.test.ts",
  "**/tests/terraformMultiImportApp.test.tsx",
  "**/terraformTopologySubnetContainment.test.ts",
  "**/terraformTopologySubnetPlacement.test.ts",
  "**/terraformStackDebug.test.ts",
  "**/terraformPipelineTfdBind.test.ts",
] as const;
