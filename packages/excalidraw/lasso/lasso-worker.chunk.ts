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

// run only in the worker context
if (typeof window === "undefined" && typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent<LassoWorkerInput>) => {
    switch (event.data.command) {
      case Commands.GET_LASSO_SELECTED_ELEMENT_IDS:
        const result = getLassoSelectedElementIds(event.data);
        self.postMessage(result);
        break;
    }
  };
}
