/**
 * Web Worker entry for Terraform layout jobs (module stack / semantic AWS / semantic provider).
 * Loaded as a separate chunk via `import.meta.url` (see subset-worker.chunk.ts).
 */
import { runModuleStackLayoutJob } from "./terraformLayoutModuleParallel";
import {
  runSemanticAwsLayoutJob,
  runSemanticProviderLayoutJob,
} from "./terraformLayoutSemanticParallel";

import type {
  TerraformLayoutWorkerRequest,
  TerraformLayoutWorkerResponse,
} from "./terraformLayoutWorkerTypes";

export const WorkerUrl: URL | undefined = import.meta.url
  ? new URL(import.meta.url)
  : undefined;

if (typeof window === "undefined" && typeof self !== "undefined") {
  self.onmessage = async (
    event: MessageEvent<TerraformLayoutWorkerRequest>,
  ) => {
    const { id, job } = event.data;
    try {
      let result;
      switch (job.type) {
        case "moduleStack":
          result = await runModuleStackLayoutJob(
            job.stackId,
            job.plan,
            job.dotText,
            job.moduleLayoutOptions,
          );
          break;
        case "semanticAws":
          result = await runSemanticAwsLayoutJob(job.prep);
          break;
        case "semanticProvider":
          result = await runSemanticProviderLayoutJob(
            job.family,
            job.label,
            job.changes,
            job.nodes,
            job.plan,
          );
          break;
        default:
          throw new Error(`Unknown layout worker job type`);
      }
      const response: TerraformLayoutWorkerResponse = {
        id,
        ok: true,
        result,
      };
      self.postMessage(response);
    } catch (err) {
      const response: TerraformLayoutWorkerResponse = {
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(response);
    }
  };
}
