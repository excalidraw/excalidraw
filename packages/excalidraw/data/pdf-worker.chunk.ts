/**
 * Entry point of the pdf.js worker. Uses the same trick as
 * `subset-worker.chunk.ts` — being dynamically imported from the main thread,
 * it ends up as a separate chunk which we can then spawn as a module worker,
 * without the need for special bundler plugins.
 *
 * DON'T import anything from the main chunk here, as it would get bundled
 * into the worker.
 */

// When loaded inside a worker, pdf.js sets itself up to listen on `self`.
// When loaded on the main thread, it registers `globalThis.pdfjsWorker`,
// which pdf.js uses as a fallback in case the worker can't be spawned.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";

/**
 * `import.meta.url` is undefined in nodejs
 */
export const WorkerUrl: URL | undefined = import.meta.url
  ? new URL(import.meta.url)
  : undefined;
