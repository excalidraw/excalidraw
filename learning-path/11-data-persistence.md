# Module 11 — Data Persistence

**Time:** 4-6 hours
**Goal:** Understand how scenes are saved, loaded, exported, and migrated.
**Key files:** `packages/excalidraw/data/`

---

## Formats

| Format | Extension | Used for |
|--------|-----------|----------|
| JSON | `.excalidraw` | Human-readable scene files |
| Compressed binary | `.excalidraw` (blob) | Cloud storage, smaller size |
| PNG with metadata | `.png` | Export with embedded scene data |
| SVG | `.svg` | Vector export |

---

## JSON Format

**File:** `packages/excalidraw/data/json.ts`

A `.excalidraw` file is JSON:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [
    {
      "id": "abc123",
      "type": "rectangle",
      "x": 100,
      "y": 200,
      "width": 300,
      "height": 150,
      "strokeColor": "#000000",
      "version": 5,
      "versionNonce": 847362,
      ...
    }
  ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": null,
    ...
  },
  "files": {
    "file-id-1": {
      "mimeType": "image/png",
      "id": "file-id-1",
      "dataURL": "data:image/png;base64,..."
    }
  }
}
```

### Serialization

```typescript
// json.ts
function serializeAsJSON(
  elements: ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  type: "local" | "database",
): string {
  // Filter out deleted elements
  // Strip internal-only appState fields
  // Include only referenced files
  return JSON.stringify({ type: "excalidraw", version: 2, ... });
}
```

### Deserialization

```typescript
function loadFromJSON(
  localAppState: AppState,
  localElements: ExcalidrawElement[],
): Promise<ImportedDataState> {
  // Open file picker
  // Read file
  // Parse JSON
  // Run restore() for migrations
  // Return { elements, appState, files }
}
```

---

## Binary Format (Compression)

**File:** `packages/excalidraw/data/blob.ts`

For cloud storage, scenes are gzip-compressed:

```typescript
// Save:
const json = serializeAsJSON(elements, appState, files);
const blob = await compressData(json);  // pako gzip

// Load:
const json = await decompressData(blob);
const data = JSON.parse(json);
```

Compression ratio is typically 4-5x (100KB JSON → ~20KB blob).

---

## PNG Metadata Export

Excalidraw can embed the full scene inside a PNG file's metadata chunks:

```typescript
// Export flow:
1. Render scene to canvas
2. Export canvas as PNG ArrayBuffer
3. Encode scene JSON as PNG tEXt chunk
4. Insert tEXt chunk into PNG
5. Return combined PNG

// Import flow:
1. Read PNG file
2. Extract tEXt chunks
3. Find "excalidraw" chunk
4. Decompress and parse JSON
5. Load scene from parsed data
```

This means a `.png` file exported from Excalidraw can be dragged back in and the full editable scene is restored.

**Libraries used:**
- `png-chunks-extract` — parse PNG into chunks
- `png-chunks-encode` — rebuild PNG from chunks
- `png-chunk-text` — create/read tEXt chunks

---

## Schema Migrations

**File:** `packages/excalidraw/data/restore.ts`

When the file format changes (new fields, renamed fields, changed defaults), old files must be upgraded:

```typescript
function restoreElements(
  elements: ImportedExcalidrawElement[],
  localElements: ExcalidrawElement[] | null,
): ExcalidrawElement[] {
  return elements.map(element => {
    // Apply migrations:

    // Old files might not have roundness:
    if (element.roundness === undefined) {
      element.roundness = null;
    }

    // Old arrow format → new arrow format:
    if (element.type === "arrow" && !element.elbowed) {
      element.elbowed = false;
    }

    // Old font names → new font family constants:
    if (element.fontFamily === "Virgil") {
      element.fontFamily = FONT_FAMILY.Virgil;
    }

    // ... many more migrations
    return element;
  });
}
```

**Key function:** `restoreElement()` handles individual element migration. `restoreElements()` handles the array. `restoreAppState()` handles AppState migration.

**Why this is important:** Excalidraw scenes can be months or years old. Every new feature that adds/changes element fields needs a migration so old files still load correctly.

---

## Library System

**File:** `packages/excalidraw/data/library.ts`

Users can save elements to a personal library for reuse:

```typescript
type LibraryItem = {
  id: string;
  status: "unpublished" | "published";
  elements: ExcalidrawElement[];
  created: number;
};
```

Library items are stored in IndexedDB (browser local storage) and can be exported/imported as `.excalidrawlib` JSON files.

---

## LocalStorage Persistence

**File:** `packages/excalidraw/data/EditorLocalStorage.ts`

The app autosaves to localStorage:

```typescript
class EditorLocalStorage {
  static get<T>(name: string): T | null;
  static set(name: string, value: any): void;
  static delete(name: string): void;
}
```

Autosave stores:
- Current elements
- Current appState (subset)
- Library items

On page load, `restoreFromLocalStorage()` restores the previous session.

---

## File System Access

**File:** `packages/excalidraw/data/filesystem.ts`

Uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) (via `browser-fs-access` library) for native save/open dialogs:

```typescript
// Save:
const handle = await fileSave(blob, {
  fileName: "drawing.excalidraw",
  extensions: [".excalidraw"],
});

// Open:
const file = await fileOpen({
  extensions: [".excalidraw", ".excalidrawlib", ".json"],
  mimeTypes: ["application/json"],
});
```

On browsers that support it (Chrome), this gives native file dialogs with "Save" (not just "Download").

---

## Exercises

1. Draw a few shapes. Export as `.excalidraw` (File → Save to disk). Open the file in a text editor — read the JSON structure.
2. Export as PNG. Open the PNG in a hex editor or online PNG chunk viewer. Find the `tEXt` chunk containing the scene data.
3. Read `restore.ts` — find `restoreElement()`. Count how many migrations are applied per element.
4. Read `json.ts` — `serializeAsJSON()`. What appState fields are included? What's excluded?
5. Check localStorage in DevTools (Application tab → Local Storage). Find the autosaved scene data.

---

**Next:** [Module 12 — Testing](12-testing.md)
