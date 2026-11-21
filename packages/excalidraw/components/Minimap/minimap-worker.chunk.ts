/**
 * DON'T depend on anything from the outside, as this module is part of a
 * separate lazy-loaded chunk (see `subset-worker.chunk.ts` for details).
 */

import { createMinimapEndpoint } from "./minimap-shared.chunk";

import type { MinimapInMessage } from "./minimap-shared.chunk";

/**
 * Due to this export (and related dynamic import), this worker code will be
 * included in the bundle automatically (as a separate chunk), without the
 * need for esbuild / vite / rollup plugins.
 *
 * `import.meta.url` is undefined in nodejs
 */
export const WorkerUrl: URL | undefined = import.meta.url
  ? new URL(import.meta.url)
  : undefined;

// run only in the worker context
if (typeof window === "undefined" && typeof self !== "undefined") {
  const endpoint = createMinimapEndpoint((message) =>
    self.postMessage(message),
  );

  self.onmessage = (event: MessageEvent<MinimapInMessage>) => {
    endpoint.handle(event.data);
  };
}
