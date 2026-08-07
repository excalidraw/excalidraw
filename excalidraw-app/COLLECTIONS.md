# Collections and disk save

This fork extends the Excalidraw web app (`excalidraw-app`) with **multiple named collections**, optional **save to disk** via the File System Access API, crash **autosave** files, and backup **export**.

All feature code lives under:

- `excalidraw-app/data/collections/` — storage and I/O
- `excalidraw-app/components/` — Collections dialog, save indicator, unsaved-changes dialog
- `excalidraw-app/collections/` — app integration bridge (`useCollectionsAppIntegration`)

The core library `packages/excalidraw` is unchanged.

## Quick start

1. Start the app: from the repo root, `yarn start` (or `scripts/windows/run-excalidraw.bat` on Windows).
2. Open **Menu → Collections**.
3. Enter a name and click **Create**.
4. Click **Save** on that collection and choose a folder (Chrome or Edge).
5. Edits auto-save to disk for that collection after the first successful Save.

## Save status indicator

A chip at the bottom-left shows:

- **Saving…** / **Saved · time ago**
- **Unsaved changes** when the canvas differs from the last persisted snapshot
- The active save location (folder name + file name when available)

Click the chip to run **Save** for the active collection (same as the row Save action).

## Collections dialog

| Action | Description |
|--------|-------------|
| **Create** | New collection (stored in browser until first Save to folder) |
| **Save** | Write `.excalidraw` to the session folder (requires supported browser) |
| **Save As** | Pick a file path for this collection only |
| **Download** | Download one `.excalidraw` file (all browsers) |
| **Duplicate** | Copy collection as `Name (copy)` |
| **Import file** | Register an existing `.excalidraw` from disk |
| **Rename** / **Delete** | Update metadata; delete removes disk file when possible |
| **Export all** | ZIP of every collection’s JSON |
| **Choose / Change folder** | Session folder for new saves |
| **Open save folder** | Folder name, file list, copy helpers |
| **Search / Sort** | Filter and sort the list |

### Unsaved changes

Switching to another collection while the active one has unsaved edits opens a prompt:

- **Save & continue** — saves then switches  
- **Discard** — switches without saving outgoing IDB/disk flush from switch handler  
- **Cancel**

## Welcome screen

Up to **five recent collections** appear under the main menu for one-click open.

## Autosave and recovery

When saving to a session folder, each write also updates `YourFile.autosave.excalidraw` beside the main file.

On load, if the autosave file is newer than the main file, the app loads autosave and shows:

> Recovered from autosave backup. Save to confirm this version on disk.

Use **Save** to write the recovered scene to the main file.

## Browser support

| Browser | Save to folder | Auto-save to disk | Download / Export ZIP |
|---------|----------------|-------------------|------------------------|
| Chrome, Edge | Yes | After first Save | Yes |
| Firefox, Safari | No (IDB only) | IDB only | Yes |

Firefox and Safari show a banner in the Collections dialog explaining limited folder support.

## Optional Windows folder path

For opening a folder in Explorer outside the browser:

1. In Collections, set **Collections folder path** and click **Save path**.
2. Create `.excalidraw-collections-path.txt` in the repo root with that path (one line), **or** use the path saved in the app.
3. Run `scripts/windows/open-collections-folder.bat`.

Browsers cannot expose the full OS path from the folder picker for security reasons.

## Data storage

| Data | Location |
|------|----------|
| Collection index | `localStorage` key `excalidraw-collections-index` |
| Active collection id | `localStorage` key `excalidraw-active-collection-id` |
| Scene fallback | IndexedDB `excalidraw-collections` store |
| Directory / file handles | IndexedDB (persisted) + session memory |
| Thumbnails | IndexedDB per collection |

Legacy single-scene `localStorage` is migrated when you choose a folder and have no collections yet.

## Development

```bash
cd excalidraw
yarn install
yarn start
```

Checks:

```bash
yarn test:code
yarn test:typecheck
```

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Save does nothing | Use Chrome/Edge; click Save inside the dialog (user gesture); allow folder permission |
| Permission denied | Choose folder again via **Change folder** |
| Collection empty after reload | Use **Import** or check autosave file in your save folder |
| Chip stuck on Unsaved | Click chip to Save, or switch away and use Save & continue |

See [FUTURE_IMPROVEMENTS.md](./FUTURE_IMPROVEMENTS.md) for planned work and upstream contribution notes.
