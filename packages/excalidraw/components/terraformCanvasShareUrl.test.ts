import { describe, expect, it } from "vitest";

import {
  buildTerraformCanvasShareUrl,
  deriveViewFromSession,
  type TerraformCanvasViewSettings,
} from "./terraformCanvasShareUrl";
import { parseTerraformDemoUrlParams } from "./terraformDemoUrlParams";
import { DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS } from "./terraformModuleLayoutOptions";
import { TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS } from "./terraformRuntimePerformance";

import type { TerraformImportSession } from "./terraformImportSession";

const makeSession = (
  overrides: Partial<TerraformImportSession> = {},
): TerraformImportSession =>
  ({
    sources: {} as TerraformImportSession["sources"],
    semanticLayout: false,
    moduleLayoutOptions: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
    preset: {
      id: "staging-extended-localstack-v2",
    } as TerraformImportSession["preset"],
    importedTfdTexts: [],
    snapshot: {
      elements: [],
      terraformEdgeLayerPins: null,
      enableDeclaredDataFlow: false,
    },
    ...overrides,
  } as TerraformImportSession);

const defaultView: TerraformCanvasViewSettings = {
  terraformLodEnabled: true,
  terraformLodPreset: "balanced",
  terraformMinimapEnabled: false,
  terraformEdgeLayerPins: null,
  runtimePerformance: { ...TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS },
};

const queryOf = (url: string): string => url.slice(url.indexOf("?"));

describe("terraformCanvasShareUrl", () => {
  describe("deriveViewFromSession", () => {
    it("recovers pipeline-family views from layoutMode", () => {
      expect(deriveViewFromSession(makeSession({ layoutMode: "rcll" }))).toBe(
        "rcll",
      );
      expect(
        deriveViewFromSession(makeSession({ layoutMode: "pipeline" })),
      ).toBe("pipeline");
    });

    it("falls back to semantic vs module via semanticLayout", () => {
      expect(deriveViewFromSession(makeSession({ semanticLayout: true }))).toBe(
        "semantic",
      );
      expect(
        deriveViewFromSession(makeSession({ semanticLayout: false })),
      ).toBe("module");
    });
  });

  it("returns null without a preset-backed session", () => {
    expect(buildTerraformCanvasShareUrl(null, defaultView)).toBeNull();
    expect(
      buildTerraformCanvasShareUrl(makeSession({ preset: null }), defaultView),
    ).toBeNull();
  });

  it("encodes preset + layout + runtime settings into a /demo URL", () => {
    const session = makeSession({
      layoutMode: "rcll",
      pipelineCompact: false,
      pipelineIncludeAncillary: true,
      pipelineLayoutProfile: "compact",
    });
    const view: TerraformCanvasViewSettings = {
      terraformLodEnabled: false,
      terraformLodPreset: "detailed",
      terraformMinimapEnabled: true,
      terraformEdgeLayerPins: {
        dependency: true,
        dataFlow: false,
        declaredDataFlow: false,
        networking: true,
        topologyFrameFlow: false,
      },
      runtimePerformance: {
        ...TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
        hideAwsIconGlyphsBelowZoom: true,
        lowZoomThreshold: 0.4,
      },
    };
    const url = buildTerraformCanvasShareUrl(session, view, {
      origin: "https://tfdraw.dev",
    });
    expect(url?.startsWith("https://tfdraw.dev/demo?")).toBe(true);
    const parsed = parseTerraformDemoUrlParams(queryOf(url!));
    expect(parsed).toMatchObject({
      presetId: "staging-extended-localstack-v2",
      view: "rcll",
      compact: false,
      ancillary: true,
      profile: "compact",
      lodEnabled: false,
      lodPreset: "detailed",
      minimap: true,
      edgeLayerPins: {
        dependency: true,
        networking: true,
        dataFlow: false,
        declaredDataFlow: false,
        topologyFrameFlow: false,
      },
      runtimePerformance: {
        hideAwsIconGlyphsBelowZoom: true,
        lowZoomThreshold: 0.4,
      },
    });
  });

  it("omits dev perf params when settings are at defaults", () => {
    const url = buildTerraformCanvasShareUrl(
      makeSession({ layoutMode: "rcll" }),
      defaultView,
    );
    expect(url).not.toContain("canvasPerf");
    // LOD + minimap are always emitted so the URL is self-describing.
    expect(url).toContain("lodEnabled=1");
    expect(url).toContain("minimap=0");
  });
});
