import { Commands, getLassoSelectedElementIds } from "./lasso-shared.chunk";

import type { LassoWorkerInput } from "./lasso-main";

/**
 * Due to this export (and related dynamic import), this worker code will be included in the bundle automatically (as a separate chunk),
 * without the need for esbuild / vite /rollup plugins and special browser / server treatment.
 *
 * `import.meta.url` is undefined in nodejs
 */
export const WorkerUrl: URL | undefined = import.meta.url
  ? new URL(import.meta.url)
  : undefined;

// variables to track processing state and latest input data
// for "backpressure" purposes
let isProcessing: boolean = false;
let latestInputData: LassoWorkerInput | null = null;

// run only in the worker context
if (typeof window === "undefined" && typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent<LassoWorkerInput>) => {
    if (!event.data) {
      self.postMessage({
        error: "No data received",
        selectedElementIds: [],
      });
      return;
    }

    latestInputData = event.data;

    if (!isProcessing) {
      processInputData();
    }
  };
}

// function to process the latest data
const processInputData = () => {
  // If no data to process, return
  if (!latestInputData) {
    return;
  }

  // capture the current data to process and reset latestData
  const dataToProcess = latestInputData;
  latestInputData = null; // reset to avoid re-processing the same data
  isProcessing = true;

  try {
    switch (dataToProcess.command) {
      case Commands.GET_LASSO_SELECTED_ELEMENT_IDS:
        const result = getLassoSelectedElementIds(dataToProcess);
        self.postMessage(result);
        break;
    }
  } finally {
    isProcessing = false;
    // if new data arrived during processing, process it
    // as we're done with processing the previous data
    if (latestInputData) {
      processInputData();
    }
  }
};
