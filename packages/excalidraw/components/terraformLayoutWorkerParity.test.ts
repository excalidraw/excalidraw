import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { layoutTerraformFromSources } from "./terraformLayoutCore";
import {
  layoutTerraformViaWorkers,
  setTerraformLayoutWorkersEnabledForTests,
} from "./terraformLayoutWorkerClient";
import {
  buildTerraformLayoutSnapshot,
  type TerraformLayoutSnapshot,
} from "./terraformLayoutSnapshot";
import {
  stagingMultiStateLayoutSources,
  stagingMultiStatePipelineLayoutSources,
} from "./terraformLayoutSnapshotFixtures";

import type { TerraformPlanParsingSources } from "./terraformPlanParsing";

function snapshotFromLayoutResult(
  result: Awaited<ReturnType<typeof layoutTerraformFromSources>>,
): TerraformLayoutSnapshot {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("layout failed");
  }
  return buildTerraformLayoutSnapshot(
    result.scene as Parameters<typeof buildTerraformLayoutSnapshot>[0],
  );
}

async function snapshotViaWorkers(
  sources: TerraformPlanParsingSources,
  options: Parameters<typeof layoutTerraformViaWorkers>[1],
): Promise<TerraformLayoutSnapshot> {
  const scene = await layoutTerraformViaWorkers(sources, options);
  return buildTerraformLayoutSnapshot(
    scene as Parameters<typeof buildTerraformLayoutSnapshot>[0],
  );
}

describe("terraform layout worker parity", () => {
  beforeAll(() => {
    if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
      vi.spyOn(console, "log").mockImplementation(() => {});
    }
  });

  afterEach(() => {
    setTerraformLayoutWorkersEnabledForTests(null);
  });

  const views = [
    {
      name: "semantic",
      sources: () => stagingMultiStateLayoutSources(),
      coreOptions: { semanticLayout: true as const },
      workerOptions: { semanticLayout: true as const },
    },
    {
      name: "pipeline",
      sources: () => stagingMultiStatePipelineLayoutSources(),
      coreOptions: {
        semanticLayout: false as const,
        layoutMode: "pipeline" as const,
      },
      workerOptions: {
        semanticLayout: false as const,
        layoutMode: "pipeline" as const,
      },
    },
    {
      name: "module",
      sources: () => stagingMultiStateLayoutSources(),
      coreOptions: { semanticLayout: false as const },
      workerOptions: { semanticLayout: false as const },
    },
  ] as const;

  for (const view of views) {
    it(
      `${view.name}: layoutTerraformFromSources matches layoutTerraformViaWorkers (workers off)`,
      async () => {
        setTerraformLayoutWorkersEnabledForTests(false);
        const sources = view.sources();
        const coreSnap = snapshotFromLayoutResult(
          await layoutTerraformFromSources(sources, view.coreOptions),
        );
        const workerSnap = await snapshotViaWorkers(
          sources,
          view.workerOptions,
        );
        expect(workerSnap).toEqual(coreSnap);
      },
      STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
    );

    it(
      `${view.name}: layoutTerraformViaWorkers workers on matches workers off`,
      async () => {
        const sources = view.sources();
        setTerraformLayoutWorkersEnabledForTests(false);
        const offSnap = await snapshotViaWorkers(sources, view.workerOptions);
        setTerraformLayoutWorkersEnabledForTests(true);
        const onSnap = await snapshotViaWorkers(sources, view.workerOptions);
        expect(onSnap).toEqual(offSnap);
      },
      STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
    );
  }
});
