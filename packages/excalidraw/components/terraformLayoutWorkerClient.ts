import { promiseTry } from "@excalidraw/common";

import { WorkerInTheMainChunkError, WorkerUrlNotDefinedError } from "../errors";
import { WorkerPool } from "../workers";

import {
  layoutTerraformFromSources,
  type LayoutTerraformResult,
  type TerraformLayoutOptions,
  type TerraformPlanParsingSources,
} from "./terraformLayoutCore";
import { layoutModuleViewParallel } from "./terraformLayoutModuleParallel";
import { layoutSemanticViewParallel } from "./terraformLayoutSemanticParallel";

import type { TerraformExcalidrawScenePayload } from "./terraformSceneApply";
import type {
  LayoutViaWorkersOptions,
  TerraformLayoutWorkerJob,
  TerraformLayoutWorkerJobResult,
  TerraformLayoutWorkerRequest,
  TerraformLayoutWorkerResponse,
} from "./terraformLayoutWorkerTypes";

let shouldUseTerraformLayoutWorkers =
  typeof Worker !== "undefined" &&
  import.meta.env.VITE_TERRAFORM_LAYOUT_WORKERS !== "false";

let layoutWorkerPool: Promise<
  WorkerPool<TerraformLayoutWorkerRequest, TerraformLayoutWorkerResponse>
> | null = null;

let nextJobId = 1;

async function getLayoutWorkerPool() {
  if (!layoutWorkerPool) {
    layoutWorkerPool = promiseTry(async () => {
      const { WorkerUrl } = await import("./terraform-layout-worker.chunk");
      return WorkerPool.create<
        TerraformLayoutWorkerRequest,
        TerraformLayoutWorkerResponse
      >(WorkerUrl, { ttl: 60_000 });
    });
  }
  return layoutWorkerPool;
}

async function runPoolJob(
  job: TerraformLayoutWorkerJob,
  signal?: AbortSignal,
): Promise<TerraformLayoutWorkerJobResult> {
  if (signal?.aborted) {
    throw new DOMException("Layout aborted", "AbortError");
  }
  const pool = await getLayoutWorkerPool();
  const id = nextJobId++;
  const response = await pool.postMessage({ id, job }, {});
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.result;
}

async function runJobOnMainThread(
  job: TerraformLayoutWorkerJob,
): Promise<TerraformLayoutWorkerJobResult> {
  const { runModuleStackLayoutJob } = await import(
    "./terraformLayoutModuleParallel"
  );
  const { runSemanticAwsLayoutJob, runSemanticProviderLayoutJob } =
    await import("./terraformLayoutSemanticParallel");

  switch (job.type) {
    case "moduleStack":
      return runModuleStackLayoutJob(
        job.stackId,
        job.plan,
        job.dotText,
        job.moduleLayoutOptions,
      );
    case "semanticAws":
      return runSemanticAwsLayoutJob(job.prep);
    case "semanticProvider":
      return runSemanticProviderLayoutJob(
        job.family,
        job.label,
        job.changes,
        job.nodes,
        job.plan,
      );
    default:
      throw new Error("Unknown layout job");
  }
}

async function runJobWithFallback(
  job: TerraformLayoutWorkerJob,
  signal?: AbortSignal,
): Promise<TerraformLayoutWorkerJobResult> {
  if (!shouldUseTerraformLayoutWorkers) {
    return runJobOnMainThread(job);
  }
  try {
    return await runPoolJob(job, signal);
  } catch {
    return runJobOnMainThread(job);
  }
}

function toScenePayload(
  result: LayoutTerraformResult,
): TerraformExcalidrawScenePayload {
  if (!result.ok) {
    const err = new Error(result.error);
    (err as Error & { status?: number }).status = result.status ?? 400;
    throw err;
  }
  return result.scene as TerraformExcalidrawScenePayload;
}

export function isTerraformLayoutWorkersEnabled(): boolean {
  return shouldUseTerraformLayoutWorkers;
}

export async function layoutTerraformViaWorkers(
  sources: TerraformPlanParsingSources,
  options: TerraformLayoutOptions,
  workerOptions: LayoutViaWorkersOptions = {},
): Promise<TerraformExcalidrawScenePayload> {
  const { onProgress, signal } = workerOptions;
  const layoutMode =
    options.layoutMode ??
    (options.semanticLayout === true ? "semantic" : "module");
  const semanticLayout = layoutMode === "semantic";
  const pipelineLayout = layoutMode === "pipeline";
  const multiStackModule =
    !semanticLayout && !pipelineLayout && sources.planDotBundles.length > 1;

  const runSequential = async () => {
    const result = await layoutTerraformFromSources(sources, options);
    return toScenePayload(result);
  };

  if (!shouldUseTerraformLayoutWorkers || typeof Worker === "undefined") {
    return runSequential();
  }

  const runJob = (job: TerraformLayoutWorkerJob) =>
    runJobWithFallback(job, signal);

  try {
    if (semanticLayout) {
      const result = await layoutSemanticViewParallel(
        sources,
        options,
        runJob,
        onProgress,
      );
      return toScenePayload(result);
    }

    if (pipelineLayout) {
      return runSequential();
    }

    if (multiStackModule) {
      const result = await layoutModuleViewParallel(
        sources,
        options.moduleLayoutOptions,
        async (stackId, plan, dotText) => {
          const job: TerraformLayoutWorkerJob = {
            type: "moduleStack",
            stackId,
            plan,
            dotText,
            moduleLayoutOptions: options.moduleLayoutOptions,
          };
          return runJob(job) as Promise<
            Extract<TerraformLayoutWorkerJobResult, { type: "moduleStack" }>
          >;
        },
        onProgress,
      );
      return toScenePayload(result);
    }

    return runSequential();
  } catch (err) {
    if (
      err instanceof WorkerUrlNotDefinedError ||
      err instanceof WorkerInTheMainChunkError
    ) {
      shouldUseTerraformLayoutWorkers = false;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    return runSequential();
  }
}
