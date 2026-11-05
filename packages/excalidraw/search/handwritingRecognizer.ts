import type { AppClassProperties } from "../types";

/** One worker and one in-flight inference per search panel. */
export class HandwritingRecognizer {
  private worker?: Worker;
  private pending?: (error: Error) => void;
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(private app: AppClassProperties) {}

  recognize(image: ImageData, isCancelled = () => false): Promise<string> {
    const result = this.queue.then(async () => {
      if (this.disposed || isCancelled()) {
        throw new Error("Handwriting recognition stopped");
      }
      if (!this.worker) {
        const WorkerConstructor = this.app.ownerWindow?.Worker || Worker;
        this.worker = new WorkerConstructor(
          new URL("./handwriting-worker.chunk.ts", import.meta.url),
          { type: "module" },
        );
      }
      const worker = this.worker;
      return new Promise<string>((resolve, reject) => {
        const win = this.app.ownerWindow || window;
        const timeout = win.setTimeout(() => {
          this.dispose();
        }, 180_000);
        const cleanup = () => {
          win.clearTimeout(timeout);
          this.pending = undefined;
          worker.onmessage = null;
          worker.onerror = null;
        };
        this.pending = (error) => {
          cleanup();
          reject(error);
        };
        worker.onmessage = (
          event: MessageEvent<{ text?: string; error?: string }>,
        ) => {
          cleanup();
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.text ?? "");
          }
        };
        worker.onerror = () =>
          this.pending?.(new Error("Handwriting worker failed"));
        worker.postMessage(image);
      });
    });
    this.queue = result.catch(() => {});
    return result;
  }

  dispose() {
    this.disposed = true;
    this.pending?.(new Error("Handwriting recognition stopped"));
    this.worker?.terminate();
    this.worker = undefined;
  }
}
