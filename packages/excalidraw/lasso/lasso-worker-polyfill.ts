import { updateSelection } from "./utils";

import type { LassoWorkerInput, LassoWorkerOutput } from "./types";

export class LassoWorkerPolyfill {
  public onmessage: ((event: MessageEvent<LassoWorkerOutput>) => void) | null =
    null;
  public onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(data: LassoWorkerInput) {
    try {
      // run asynchronously to simulate a real worker
      setTimeout(() => {
        const selectedElementIds = updateSelection(data);
        const messageEvent = {
          data: selectedElementIds,
        } as MessageEvent<LassoWorkerOutput>;
        this.onmessage?.(messageEvent);
      }, 0);
    } catch (error) {
      this.onerror?.(new ErrorEvent("error", { error }));
    }
  }

  terminate() {
    // no-op for polyfill
  }
}
