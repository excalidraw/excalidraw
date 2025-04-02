import { promiseTry } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { GlobalPoint } from "@excalidraw/math";

import { WorkerPool } from "../workers";

import type { Commands, ElementsSegmentsMap } from "./lasso-shared.chunk";

let shouldUseWorkers = typeof Worker !== "undefined";

/**
 * Tries to get the selected element with a worker, if it fails, it fallbacks to the main thread.
 *
 * @param input - The input data for the lasso selection.
 * @returns The selected element ids.
 */
export const getLassoSelectedElementIds = async (
  input: Omit<LassoWorkerInput, "command">,
): Promise<
  LassoWorkerOutput<typeof Commands.GET_LASSO_SELECTED_ELEMENT_IDS>
> => {
  const { Commands, getLassoSelectedElementIds } =
    await lazyLoadLassoSharedChunk();

  const inputWithCommand: LassoWorkerInput = {
    ...input,
    command: Commands.GET_LASSO_SELECTED_ELEMENT_IDS,
  };

  if (!shouldUseWorkers) {
    return getLassoSelectedElementIds(inputWithCommand);
  }

  return promiseTry(async () => {
    try {
      const workerPool = await getOrCreateWorkerPool();

      const result = await workerPool.postMessage(inputWithCommand, {});

      return result;
    } catch (e) {
      // don't use workers if they are failing
      shouldUseWorkers = false;

      // eslint-disable-next-line no-console
      console.error(
        "Failed to use workers for lasso selection, falling back to the main thread.",
        e,
      );

      // fallback to the main thread
      return getLassoSelectedElementIds(inputWithCommand);
    }
  });
};

// lazy-loaded and cached chunks
let lassoWorker: Promise<typeof import("./lasso-worker.chunk")> | null = null;
let lassoShared: Promise<typeof import("./lasso-shared.chunk")> | null = null;

export const lazyLoadLassoWorkerChunk = async () => {
  if (!lassoWorker) {
    lassoWorker = import("./lasso-worker.chunk");
  }

  return lassoWorker;
};

export const lazyLoadLassoSharedChunk = async () => {
  if (!lassoShared) {
    lassoShared = import("./lasso-shared.chunk");
  }

  return lassoShared;
};

export type LassoWorkerInput = {
  command: typeof Commands.GET_LASSO_SELECTED_ELEMENT_IDS;
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
};

export type LassoWorkerOutput<T extends LassoWorkerInput["command"]> =
  T extends typeof Commands.GET_LASSO_SELECTED_ELEMENT_IDS
    ? {
        selectedElementIds: string[];
      }
    : never;

let workerPool: Promise<
  WorkerPool<LassoWorkerInput, LassoWorkerOutput<LassoWorkerInput["command"]>>
> | null = null;

/**
 * Lazy initialize or get the worker pool singleton.
 *
 * @throws implicitly if anything goes wrong
 */
const getOrCreateWorkerPool = () => {
  if (!workerPool) {
    // immediate concurrent-friendly return, to ensure we have only one pool instance
    workerPool = promiseTry(async () => {
      const { WorkerUrl } = await lazyLoadLassoWorkerChunk();

      const pool = WorkerPool.create<
        LassoWorkerInput,
        LassoWorkerOutput<LassoWorkerInput["command"]>
      >(WorkerUrl, {
        // limit the pool size to a single active worker
        maxPoolSize: 1,
      });

      return pool;
    });
  }

  return workerPool;
};
