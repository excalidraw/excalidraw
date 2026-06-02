import { expect } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { terraformPlanParsingFromSources } from "../components/terraformPlanParsing";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
} from "./terraformPresetFixtures";

export type StagingSemanticLayoutBody = {
  elements: ExcalidrawElement[];
  meta?: {
    stackIds?: string[];
    [key: string]: unknown;
  };
};

let cachedBody: StagingSemanticLayoutBody | null = null;
let loadPromise: Promise<StagingSemanticLayoutBody> | null = null;

/** One 25-stack semantic import per worker; reuse across tests in the same file/run. */
export async function importStagingSemanticLayoutBody(): Promise<StagingSemanticLayoutBody> {
  if (cachedBody) {
    return cachedBody;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
      const tfd = readStagingMultiStatePipelineTfdFromDb();
      const res = await terraformPlanParsingFromSources(
        {
          planDotBundles: bundles,
          states: [],
          stateLabels: [],
          tfdTexts: [tfd],
          tfdLabels: ["pipeline.tfd"],
        },
        { semanticLayout: true },
      );
      expect(res.ok).toBe(true);
      cachedBody = (await res.json()) as StagingSemanticLayoutBody;
      return cachedBody;
    })();
  }
  return loadPromise;
}

export async function getStagingSemanticLayoutElements(): Promise<
  ExcalidrawElement[]
> {
  const body = await importStagingSemanticLayoutBody();
  return body.elements;
}
