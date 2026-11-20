# Handwriting scene search

Open **Find on canvas** (Ctrl/Cmd+F) and enable **Search handwriting (experimental)**. Freehand strokes are grouped into nearby lines and recognized locally using the quantized `Xenova/trocr-small-handwritten` model through Transformers.js. Recognized text appears alongside typed text; selecting a match focuses and highlights its entire handwritten line.

## Runtime and data

- Inference runs in a dedicated module worker with single-threaded WASM, so it does not require cross-origin isolation or WebGPU.
- The library, WASM runtime and model are loaded on demand. Initial use requires internet access (Hugging Face model files and jsDelivr WASM runtime). Model assets use Transformers.js's browser cache. Drawings and recognized text are never uploaded.
- Recognition results are memory-only and scoped to the editor scene. They do not alter drawing elements, exports, undo history or collaboration messages.
- Each line is keyed by its stroke IDs and versions. Editing or deleting strokes invalidates affected lines; changing the query or typed text reuses results.
- Closing search or disabling handwriting terminates the worker. Recognition errors leave ordinary text search usable; toggle the option to retry.

## Current limitations

TrOCR's handwritten model is trained on English line images. Recognition is approximate, particularly for other languages, rotated writing, dense diagrams, and unusually spaced or overlapping lines. Geometric line grouping is heuristic; freehand sketches may be interpreted as text. Images and geometric shape tools are not recognized. Highlights cover the recognized line, not individual words.

## Verification

`yarn vitest run packages/excalidraw/tests/search.test.tsx packages/excalidraw/tests/handwriting.test.tsx`

The integration tests mock inference to avoid downloading a model in CI. For a browser smoke test, draw a short English line using the freehand tool, enable handwriting search, wait for recognition, and search for a word in that line. Check movement/erasure, closing search during loading, and an unavailable model host. Network requests should only download model/runtime assets.
