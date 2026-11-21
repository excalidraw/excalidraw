/**
 * The name of the `<meta>` that points to the JSON list of the mermaid chunks,
 * which `lazyChunksPlugin` (vite.config.mts) emits in production builds.
 */
export const MERMAID_CHUNKS_LIST_NAME = "mermaid-chunks";

// Lets the dialog load the chunks it needs first (mermaid-to-excalidraw, and
// those of the diagram type it converts), so that they aren't fetched twice:
// cached chunks are then served from the cache.
const CACHE_DELAY_MS = 5000;

let caching: Promise<unknown> | null = null;

/**
 * The mermaid chunks (mermaid-to-excalidraw, and Pele's chunk per diagram
 * type) aren't precached, as most users never use Mermaid. Once the TTD dialog
 * is opened, they're all fetched for the service worker to cache (`lazy-chunks`
 * runtime caching), so that offline, every diagram type converts, not just the
 * ones used while online.
 */
export const cacheMermaidChunks = () => {
  const listFileName = document.querySelector<HTMLMetaElement>(
    `meta[name="${MERMAID_CHUNKS_LIST_NAME}"]`,
  )?.content;
  if (caching || !listFileName || !navigator.serviceWorker?.controller) {
    return;
  }
  caching = new Promise((resolve) => setTimeout(resolve, CACHE_DELAY_MS))
    .then(() => fetch(`${import.meta.env.BASE_URL}${listFileName}`))
    .then((response) => response.json())
    .then((fileNames: string[]) =>
      Promise.all(
        fileNames.map((fileName) =>
          fetch(`${import.meta.env.BASE_URL}${fileName}`, { priority: "low" }),
        ),
      ),
    )
    .catch(() => {
      // e.g. offline -> retry once the dialog is opened again
      caching = null;
    });
};
