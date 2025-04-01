import { updateSelection } from "./utils";

import type { LassoWorkerInput } from "./types";

export const WorkerUrl: URL | undefined = import.meta.url
  ? new URL(import.meta.url)
  : undefined;

// variables to track processing state and latest input data
// for "backpressure" purposes
let isProcessing: boolean = false;
let latestInputData: LassoWorkerInput | null = null;

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
    const { lassoPath, elements, intersectedElements, enclosedElements } =
      dataToProcess;

    if (!Array.isArray(lassoPath) || !Array.isArray(elements)) {
      throw new Error("Invalid input: lassoPath and elements must be arrays");
    }

    if (
      !(intersectedElements instanceof Set) ||
      !(enclosedElements instanceof Set)
    ) {
      throw new Error(
        "Invalid input: intersectedElements and enclosedElements must be Sets",
      );
    }

    const result = updateSelection(dataToProcess);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      selectedElementIds: [],
    });
  } finally {
    isProcessing = false;
    // if new data arrived during processing, process it
    // as we're done with processing the previous data
    if (latestInputData) {
      processInputData();
    }
  }
};
