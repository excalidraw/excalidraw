/**
 * Build a shareable `/demo?…` URL that reconstructs the *current* Terraform canvas: the
 * originating preset + its layout (from the in-memory import session) plus the live runtime
 * view settings (LOD, minimap, edge layers, dev canvas-performance). Opening the URL cold
 * re-imports the preset and then applies the settings — see {@link TerraformDemoAutoImport}.
 *
 * Only preset-backed scenes are shareable: an uploaded-file import has no stable URL source,
 * so {@link buildTerraformCanvasShareUrl} returns `null` when the session has no preset.
 */
import {
  buildTerraformDemoUrl,
  collectTerraformDemoParams,
  type TerraformDemoSettingsSnapshot,
  type TerraformDemoUrlParams,
  type TerraformEdgeLayerPins,
} from "./terraformDemoUrlParams";
import {
  TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
  type TerraformRuntimePerformanceSettings,
} from "./terraformRuntimePerformance";

import type { TerraformImportSession } from "./terraformImportSession";
import type { TerraformLodPreset } from "./terraformLod";
import type { TerraformView } from "./terraformImportDialogUtils";

/** The live runtime view settings the share URL captures alongside the session's layout. */
export type TerraformCanvasViewSettings = {
  terraformLodEnabled: boolean;
  terraformLodPreset: TerraformLodPreset;
  terraformMinimapEnabled: boolean;
  terraformEdgeLayerPins: TerraformEdgeLayerPins | null;
  runtimePerformance: TerraformRuntimePerformanceSettings;
};

/**
 * Recover the view the session was imported with: `layoutMode` is only retained for the
 * pipeline family, so semantic/module are distinguished by the `semanticLayout` flag.
 */
export const deriveViewFromSession = (
  session: TerraformImportSession,
): TerraformView => {
  if (session.layoutMode === "pipeline" || session.layoutMode === "rcll") {
    return session.layoutMode;
  }
  return session.semanticLayout ? "semantic" : "module";
};

/** Map the import session's retained layout fields onto the demo-URL settings snapshot. */
const sessionToDemoSnapshot = (
  session: TerraformImportSession,
  presetId: string,
): TerraformDemoSettingsSnapshot => ({
  presetId,
  view: deriveViewFromSession(session),
  pipelineCompact: session.pipelineCompact ?? true,
  pipelineLayoutVariant: session.pipelineLayoutVariant ?? "classic",
  pipelinePacked: session.pipelinePacked ?? false,
  pipelinePackedPullLeft: session.pipelinePackedPullLeft ?? false,
  pipelineIncludeAncillary: session.pipelineIncludeAncillary ?? false,
  pipelineSemanticPlacement: session.pipelineSemanticPlacement ?? false,
  pipelineSwimlaneLaneRise: session.pipelineSwimlaneLaneRise ?? false,
  pipelineReorder: session.pipelineReorder ?? false,
  pipelineCrossingMin: session.pipelineCrossingMin ?? false,
  pipelineDeBandLevel:
    session.pipelineDeBandLevel ??
    (session.pipelineSubnetDeBand ? "subnet" : "none"),
  pipelineRankSeparate: session.pipelineRankSeparate ?? false,
  pipelineStraighten: session.pipelineStraighten ?? false,
  pipelineColumnPacking:
    session.pipelineColumnPacking ??
    (session.pipelineDeDensify ? "spread" : "none"),
  // No retained profile ⇒ the explicit flags above are authoritative (treated as "custom").
  pipelineLayoutProfile: session.pipelineLayoutProfile ?? "custom",
  pipelineStaircaseBandOverlap: session.pipelineStaircaseBandOverlap ?? true,
  moduleLayoutMode: session.moduleLayoutOptions.mode,
});

const runtimePerformanceIsDefault = (
  settings: TerraformRuntimePerformanceSettings,
): boolean =>
  (
    Object.keys(TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS) as Array<
      keyof TerraformRuntimePerformanceSettings
    >
  ).every(
    (key) => settings[key] === TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS[key],
  );

/**
 * Compose the full canvas-share URL. Returns `null` when there is no preset-backed session
 * to reconstruct the scene from (the only case the URL cannot represent).
 */
export const buildTerraformCanvasShareUrl = (
  session: TerraformImportSession | null,
  view: TerraformCanvasViewSettings,
  options?: { origin?: string; pathname?: string },
): string | null => {
  const presetId = session?.preset?.id;
  if (!session || !presetId) {
    return null;
  }

  const params: TerraformDemoUrlParams = {
    ...collectTerraformDemoParams(sessionToDemoSnapshot(session, presetId)),
    // Live runtime view settings — always emit LOD + minimap so the URL is self-describing;
    // edge pins only when set (null = legacy "infer from elements"); dev perf only when
    // it diverges from defaults (keeps the URL clean for the common case).
    lodEnabled: view.terraformLodEnabled,
    lodPreset: view.terraformLodPreset,
    minimap: view.terraformMinimapEnabled,
    ...(view.terraformEdgeLayerPins
      ? { edgeLayerPins: view.terraformEdgeLayerPins }
      : {}),
    ...(runtimePerformanceIsDefault(view.runtimePerformance)
      ? {}
      : { runtimePerformance: view.runtimePerformance }),
  };

  return buildTerraformDemoUrl(params, options);
};
