import { Scene } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Renderer } from "../scene/Renderer";
import { API } from "../tests/helpers/api";

import { resolveTerraformEffectiveFocusKey } from "./useTerraformRelationshipFocusEffect";
import {
  TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
  TERRAFORM_RUNTIME_PERFORMANCE_STORAGE_KEY,
  filterTerraformRuntimeVisibleElements,
  getTerraformRuntimePerformanceSnapshot,
  parseTerraformRuntimePerformanceSettings,
  patchTerraformRuntimePerformanceSettings,
  resetTerraformRuntimePerformanceSettings,
  shouldSuppressTerraformFrameClip,
} from "./terraformRuntimePerformance";

const terraformRect = (id: string, customData: Record<string, unknown>) =>
  ({
    ...API.createElement({
      type: "rectangle",
      id,
      x: 10,
      y: 10,
      width: 100,
      height: 60,
    }),
    customData,
  } as ExcalidrawElement);

describe("terraform runtime performance settings", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTerraformRuntimePerformanceSettings();
  });

  it("defaults off, patches with version changes, persists, and resets", () => {
    const initial = getTerraformRuntimePerformanceSnapshot();
    expect(initial.value).toEqual(TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS);

    expect(
      patchTerraformRuntimePerformanceSettings({
        hideAwsIconGlyphsBelowZoom: true,
        lowZoomThreshold: 0.4,
      }),
    ).toBe(true);
    const patched = getTerraformRuntimePerformanceSnapshot();
    expect(patched.version).toBeGreaterThan(initial.version);
    expect(patched.value.hideAwsIconGlyphsBelowZoom).toBe(true);
    expect(patched.value.lowZoomThreshold).toBe(0.4);
    expect(
      JSON.parse(
        localStorage.getItem(TERRAFORM_RUNTIME_PERFORMANCE_STORAGE_KEY)!,
      ),
    ).toEqual(patched.value);

    resetTerraformRuntimePerformanceSettings();
    expect(getTerraformRuntimePerformanceSnapshot().value).toEqual(
      TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
    );
  });

  it("rejects malformed fields and restores defaults for unknown values", () => {
    expect(parseTerraformRuntimePerformanceSettings(null)).toEqual(
      TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
    );
    expect(
      parseTerraformRuntimePerformanceSettings({
        hideAwsIconGlyphsBelowZoom: "yes",
        suppressHoverFocusBelowZoom: true,
        lowZoomThreshold: 0.25,
        unknown: true,
      }),
    ).toEqual({
      ...TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
      suppressHoverFocusBelowZoom: true,
    });
  });

  it("continues in memory when localStorage writes fail", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });

    expect(
      patchTerraformRuntimePerformanceSettings({
        debounceHoverFocus: true,
      }),
    ).toBe(true);
    expect(
      getTerraformRuntimePerformanceSnapshot().value.debounceHoverFocus,
    ).toBe(true);
    setItem.mockRestore();
  });
});

describe("terraform runtime render predicates", () => {
  beforeEach(() => {
    resetTerraformRuntimePerformanceSettings();
  });

  it("hides only AWS icon glyphs below, but not at or above, the threshold", () => {
    const card = terraformRect("card", {
      terraform: true,
      terraformVisibilityRole: "resource",
      nodePath: "aws_s3_bucket.example",
    });
    const icon = terraformRect("icon", {
      terraform: true,
      terraformAwsIconGlyph: true,
      nodePath: "aws_s3_bucket.example",
    });
    const generic = terraformRect("generic", {});
    const settings = {
      ...TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
      hideAwsIconGlyphsBelowZoom: true,
    };

    expect(
      filterTerraformRuntimeVisibleElements(
        [card, icon, generic] as never,
        0.29,
        settings,
      ).map((element) => element.id),
    ).toEqual(["card", "generic"]);
    expect(
      filterTerraformRuntimeVisibleElements(
        [card, icon, generic] as never,
        0.3,
        settings,
      ).map((element) => element.id),
    ).toEqual(["card", "icon", "generic"]);
  });

  it("invalidates Renderer visibility cache when runtime revision changes", () => {
    const card = terraformRect("card", {
      terraform: true,
      terraformVisibilityRole: "resource",
      nodePath: "aws_s3_bucket.example",
    });
    const icon = terraformRect("icon", {
      terraform: true,
      terraformAwsIconGlyph: true,
      nodePath: "aws_s3_bucket.example",
    });
    const scene = new Scene([card, icon], { skipValidation: true });
    const renderer = new Renderer(scene);
    const snapshot = getTerraformRuntimePerformanceSnapshot();
    const args = {
      sceneNonce: scene.getSceneNonce(),
      zoom: { value: 0.1 },
      offsetLeft: 0,
      offsetTop: 0,
      scrollX: 0,
      scrollY: 0,
      height: 1000,
      width: 1000,
      editingTextElement: null,
      newElementId: undefined,
      terraformLodEnabled: false,
      terraformLodPreset: "balanced",
      selectedElementIds: {},
      terraformEdgeHoverPeekKey: null,
      terraformRuntimePerformanceRevision: snapshot.version,
    } as const;

    expect(
      renderer.getRenderableElements(args as never).visibleElements,
    ).toHaveLength(2);
    patchTerraformRuntimePerformanceSettings({
      hideAwsIconGlyphsBelowZoom: true,
    });
    expect(
      renderer.getRenderableElements(args as never).visibleElements,
    ).toHaveLength(2);
    expect(
      renderer.getRenderableElements({
        ...args,
        terraformRuntimePerformanceRevision:
          getTerraformRuntimePerformanceSnapshot().version,
      } as never).visibleElements,
    ).toHaveLength(1);
  });

  it("suppresses clipping only for low-zoom Terraform non-export rendering", () => {
    const terraform = terraformRect("tf", { terraform: true });
    const generic = terraformRect("generic", {});
    const settings = {
      ...TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
      suppressFrameClippingBelowZoom: true,
    };
    const appState = { zoom: { value: 0.1 } } as never;
    const normalRender = { isExporting: false } as never;

    expect(
      shouldSuppressTerraformFrameClip(
        terraform,
        appState,
        normalRender,
        settings,
      ),
    ).toBe(true);
    expect(
      shouldSuppressTerraformFrameClip(
        generic,
        appState,
        normalRender,
        settings,
      ),
    ).toBe(false);
    expect(
      shouldSuppressTerraformFrameClip(
        terraform,
        appState,
        { isExporting: true } as never,
        settings,
      ),
    ).toBe(false);
    expect(
      shouldSuppressTerraformFrameClip(
        terraform,
        { zoom: { value: 0.3 } } as never,
        normalRender,
        settings,
      ),
    ).toBe(false);
  });

  it("suppresses hover below threshold while keeping selection focus", () => {
    const settings = {
      ...TERRAFORM_RUNTIME_PERFORMANCE_DEFAULTS,
      suppressHoverFocusBelowZoom: true,
    };
    expect(
      resolveTerraformEffectiveFocusKey({
        hoveredGraphKey: "hovered",
        selectedGraphKey: "selected",
        zoom: 0.1,
        settings,
      }),
    ).toBe("selected");
    expect(
      resolveTerraformEffectiveFocusKey({
        hoveredGraphKey: "hovered",
        selectedGraphKey: "selected",
        zoom: 0.3,
        settings,
      }),
    ).toBe("hovered");
  });
});
