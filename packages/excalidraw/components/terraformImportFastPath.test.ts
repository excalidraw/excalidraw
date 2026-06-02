import { describe, expect, it, vi } from "vitest";

import {
  isStagingMultiStateExpandedSources,
  shouldUseStagingExpandedFastPath,
} from "./terraformImportFastPath";

describe("terraformImportFastPath", () => {
  it("detects staging-multi-state-expanded by 25 plan/dot bundles", () => {
    const bundles = Array.from({ length: 25 }, (_, i) => ({
      plan: {},
      dotText: "",
      label: `stack-${i}`,
    }));
    const base = {
      planDotBundles: bundles,
      states: [] as unknown[],
      stateLabels: [] as string[],
      tfdTexts: ["x -> y"],
      tfdLabels: [] as string[],
    };
    expect(isStagingMultiStateExpandedSources(base)).toBe(true);
    expect(
      isStagingMultiStateExpandedSources({
        ...base,
        planDotBundles: bundles.slice(0, 24),
        tfdTexts: [],
      }),
    ).toBe(false);
  });

  it("requires flag for shouldUseStagingExpandedFastPath", () => {
    vi.stubEnv("VITE_TERRAFORM_STAGING_FASTPATH", "0");
    const bundles = Array.from({ length: 25 }, () => ({
      plan: {},
      dotText: "",
      label: "s",
    }));
    const sources = {
      planDotBundles: bundles,
      states: [] as unknown[],
      stateLabels: [] as string[],
      tfdTexts: [],
      tfdLabels: [] as string[],
    };
    expect(shouldUseStagingExpandedFastPath(undefined, sources)).toBe(false);

    vi.stubEnv("VITE_TERRAFORM_STAGING_FASTPATH", "1");
    expect(shouldUseStagingExpandedFastPath(undefined, sources)).toBe(true);
    vi.unstubAllEnvs();
  });
});
