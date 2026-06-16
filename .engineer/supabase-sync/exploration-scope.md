# Excalidraw Supabase Sync Feature - Exploration Scope

## A. App.tsx Exact Edit Sites

### 1. onChange Handler (Lines 677-727)
**Location:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:677-727`

**Current Code:**
```typescript
const onChange = (
  elements: readonly OrderedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  if (collabAPI?.isCollaborating()) {
    collabAPI.syncElements(elements);
  }

  if (!LocalData.isSavePaused()) {
    LocalData.save(elements, appState, files, () => {
      // ... file status updates
    });
  }
  // ... debug renderer
};
```

**Edit Point:** After line 689 (`LocalData.save(...)` call), inject Supabase sync call:
- Check if user is signed into Supabase
- Call Supabase sync to store scene + images
- Disable the `collabAPI.syncElements()` branch for live collab

---

### 2. initializeScene Definition & Invocation (Lines 215-371)
**Location:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:215-371`

**Key Invocations:**
- Line 527: `initializeScene({ collabAPI, excalidrawAPI })` — initial load
- Line 544: `initializeScene({ collabAPI, excalidrawAPI })` — on hash change

**Edit Points:**
1. **Hash Parsing (Lines 226-229):** 
   - Line 226-228: Parses `#json=...` (shareable link)
   - Line 229: Parses `#url=...` (external URL)
   - Line 248: Calls `getCollaborationLinkData(window.location.href)` to parse `#room=...` (collab link)
   - **Action:** Neutralize collaboration link handling by preventing `roomLinkData` from being used
   
2. **Collaboration Scene Load (Lines 327-359):**
   - Calls `opts.collabAPI.startCollaboration(roomLinkData)`
   - **Action:** Skip this branch if collaboration is disabled

3. **After initializeScene, load images (Line 528):**
   - Calls `loadImages(data, true)`
   - Will need to adapt for Supabase image loading

---

### 3. renderTopRightUI JSX (Lines 955-978)
**Location:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:955-978`

**Current JSX:**
```typescript
renderTopRightUI={(isMobile) => {
  if (isMobile || !collabAPI || isCollabDisabled) {
    return null;
  }

  return (
    <div className="excalidraw-ui-top-right">
      {excalidrawAPI?.getEditorInterface().formFactor === "desktop" && (
        <ExcalidrawPlusPromoBanner isSignedIn={isExcalidrawPlusSignedUser} />
      )}
      {collabError.message && <CollabError collabError={collabError} />}
      <LiveCollaborationTrigger
        isCollaborating={isCollaborating}
        onSelect={() =>
          setShareDialogState({ isOpen: true, type: "share" })
        }
        editorInterface={editorInterface}
      />
    </div>
  );
}}
```

**Edit Point:** Replace `<LiveCollaborationTrigger ... />` with Supabase sync status component

---

### 4. Collab Component Render (Lines 1038-1040)
**Location:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:1038-1040`

**Current Code:**
```typescript
{excalidrawAPI && !isCollabDisabled && (
  <Collab excalidrawAPI={excalidrawAPI} />
)}
```

**Edit Point:** Wrap with feature flag or skip rendering if collab is disabled

---

### 5. ShareDialog Rendering & State Management (Lines 1042-1057 + multiple setShareDialogState calls)
**Location:** Multiple sites:
- Line 406: `const [, setShareDialogState] = useAtom(shareDialogStateAtom);`
- Line 791-793: `onCollabDialogOpen = useCallback(() => setShareDialogState({ isOpen: true, type: "collaborationOnly" }), ...)`
- Line 972: `setShareDialogState({ isOpen: true, type: "share" })` (LiveCollaborationTrigger click)
- Line 1042-1057: ShareDialog component rendering
- Line 1082-1086: Command palette "Live Collaboration" command
- Line 1127: Command palette "Share" command

**Edit Points:**
1. Line 791-793: Disable "collaborationOnly" type entirely
2. Line 972: Neutralize LiveCollaborationTrigger click
3. Lines 1082-1086: Remove/hide "Live Collaboration" command palette item
4. Line 1042-1057: ShareDialog still needs to render (for shareable link export), but disable collaboration tab
5. Lines 1127: Keep "Share" command but hide collaboration features

---

### 6. onExportToBackend Definition (Lines 733-771)
**Location:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:733-771`

**Current Code:**
```typescript
const onExportToBackend = async (
  exportedElements: readonly NonDeletedExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
) => {
  const { url, errorMessage } = await exportToBackend(
    exportedElements,
    { ...appState, viewBackgroundColor: ... },
    files,
  );
  // ... handle url and error
};
```

**Edit Point:** Already passed to `<Excalidraw>` at line 920, no changes needed (it's for shareable links, which remain)

---

### 7. ExcalidrawAPI Access & Scene State Reading
**Location:** Multiple throughout App.tsx

**API Calls to Access Scene State:**
- `excalidrawAPI.getSceneElements()` (line 1006)
- `excalidrawAPI.getSceneElementsIncludingDeleted()` (line 458, 587, 694, etc.)
- `excalidrawAPI.getAppState()` (line 344, 353, etc.)
- `excalidrawAPI.getFiles()` (line 588, 1008)
- `excalidrawAPI.getName()` (line 928, 1008, 1226)
- `excalidrawAPI.updateScene({ elements, appState, ... })` (line 547, 572, 709, etc.)
- `excalidrawAPI.addFiles(loadedFiles)` (line 454, 502, 605)

**Edit Point:** Use these exact APIs to read current scene state for pushing to Supabase

---

### 8. MainMenu & Command Palette (Lines 986-1246)
**Location:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:986-1246`

**Current Menu Structure:**
- Line 986-992: `<AppMainMenu onCollabDialogOpen={onCollabDialogOpen} ... />`
- Line 1067-1246: `<CommandPalette customCommandPaletteItems={[...]}>`

**Command Palette Items:**
- Line 1070-1087: "Live Collaboration" command (label: `t("labels.liveCollaboration")`)
- Line 1088-1109: "Stop Session" command
- Line 1110-1129: "Share" command
- Lines 1131-1245: GitHub, Twitter, Discord, YouTube, Excalidraw+, PWA commands

**Edit Points:**
1. Line 1070-1087: Hide "Live Collaboration" command (set `predicate: false`)
2. Line 1088-1109: Hide "Stop Session" command (set `predicate: false`)
3. Optionally add new "Sync Status" or "Sign In" command for Supabase

---

## B. Data Layer - LocalData, FileManager, & localStorage

### LocalData.ts
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/data/LocalData.ts`

**Key Exports:**
1. **LocalData.save** (Line 137-147)
   ```typescript
   static save = (
     elements: readonly ExcalidrawElement[],
     appState: AppState,
     files: BinaryFiles,
     onFilesSaved: () => void,
   ) => {
     if (!this.isSavePaused()) {
       this._save(elements, appState, files, onFilesSaved);
     }
   };
   ```

2. **LocalData.flushSave** (Line 149-151)
   ```typescript
   static flushSave = () => {
     this._save.flush();
   };
   ```

3. **LocalData.pauseSave / resumeSave** (Lines 155-161)
   ```typescript
   static pauseSave = (lockType: SavingLockTypes) => {
     this.locker.lock(lockType);
   };
   static resumeSave = (lockType: SavingLockTypes) => {
     this.locker.unlock(lockType);
   };
   ```

4. **LocalData.fileStorage** (Lines 169-227)
   - Instance of `LocalFileManager` with `getFiles()`, `saveFiles()`, `clearObsoleteFiles()`
   - Constructor signature shows the expected interface for a file manager

### FileManager.ts
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/data/FileManager.ts`

**Constructor Signature (Lines 45-65):**
```typescript
constructor({
  getFiles,
  saveFiles,
  onFileStatusChange,
}: {
  getFiles: (fileIds: FileId[]) => Promise<{
    loadedFiles: BinaryFileData[];
    erroredFiles: Map<FileId, true>;
  }>;
  saveFiles: (data: { addedFiles: Map<FileId, BinaryFileData> }) => Promise<{
    savedFiles: Map<FileId, BinaryFileData>;
    erroredFiles: Map<FileId, BinaryFileData>;
  }>;
  onFileStatusChange?: (
    updates: Array<[FileId, "loading" | "loaded" | "error"]>,
  ) => void;
})
```

**How Collab Constructs FileManager:**
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/collab/Collab.tsx:150-220+`
- Uses Firebase for file storage: `saveFilesToFirebase`, `loadFilesFromFirebase`
- Passes `FileManager` constructor with Firebase-backed `getFiles` and `saveFiles`

### localStorage.ts
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/data/localStorage.ts`

**Storage Keys (from app_constants.ts):**
- `STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS`
- `STORAGE_KEYS.LOCAL_STORAGE_APP_STATE`
- `STORAGE_KEYS.LOCAL_STORAGE_COLLAB` (username)
- `STORAGE_KEYS.IDB_LIBRARY` (IndexedDB)

**Key Functions:**
- `importFromLocalStorage()` (Line 37-74) — reads elements + appState from localStorage
- `importUsernameFromLocalStorage()` (Line 23-35) — reads collab username
- `saveUsernameToLocalStorage()` (Line 11-21)

---

## C. URL Handling - Collaboration & Share Links

### Collaboration Link Parsing
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/data/index.ts`

1. **isCollaborationLink** (Line 133-136)
   ```typescript
   export const isCollaborationLink = (link: string) => {
     const hash = new URL(link).hash;
     return RE_COLLAB_LINK.test(hash);
   };
   ```
   - Regex: `RE_COLLAB_LINK = /^#room=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/` (Line 131)

2. **getCollaborationLinkData** (Line 138-146)
   ```typescript
   export const getCollaborationLinkData = (link: string) => {
     const hash = new URL(link).hash;
     const match = hash.match(RE_COLLAB_LINK);
     if (match && match[2].length !== 22) {
       window.alert(t("alerts.invalidEncryptionKey"));
       return null;
     }
     return match ? { roomId: match[1], roomKey: match[2] } : null;
   };
   ```

### Shareable Link Parsing
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:226-229`
- `#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)` — encrypted backend data
- Line 260-279: Imports via `importFromBackend()` 

**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:229`
- `#url=(.*)` — external URL data
- Line 305-325: Fetches and loads via `loadFromBlob()`

### ImportFromBackend
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/data/index.ts:202-242`
```typescript
export const importFromBackend = async (
  id: string,
  decryptionKey: string,
): Promise<ImportedDataState> => {
  // Fetches from BACKEND_V2_GET_URL with encryption
};
```

### ExportToBackend
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/data/index.ts:248-307`
```typescript
export const exportToBackend = async (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<ExportToBackendResult> => {
  // Encrypts and posts to BACKEND_V2_POST_URL
};
```

### Hash Change Handler
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/App.tsx:532-556`
- Line 534: Listens to `EVENT.HASHCHANGE`
- Line 536-538: Checks for library URL tokens
- Line 537-541: If collaborating and hash no longer matches collab link, stops collaboration
- Line 544: Calls `initializeScene()` again to re-initialize

**Neutralization Points:**
1. Line 248 in App.tsx: `getCollaborationLinkData()` should return null
2. Line 537-541: Hash change handler should skip collaboration stop/start
3. Line 537-541 in isCollaborationLink check: Skip when parsing

---

## D. Environment Variables & Configuration

### vite.config.mts
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/vite.config.mts`

**Env Loading (Lines 12-13):**
```typescript
const envVars = loadEnv(mode, `../`);
return {
  server: { port: Number(envVars.VITE_APP_PORT || 3000), ... },
  envDir: "../",
  // ...
};
```

**Note:** No `define` block, so all `VITE_APP_*` vars are automatically available via `import.meta.env`

---

### vite-env.d.ts
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/vite-env.d.ts`

**ImportMetaEnv Interface (Lines 4-49):**
```typescript
interface ImportMetaEnv {
  VITE_APP_PORT: string;
  VITE_APP_BACKEND_V2_GET_URL: string;
  VITE_APP_BACKEND_V2_POST_URL: string;
  VITE_APP_WS_SERVER_URL: string;
  VITE_APP_PORTAL_URL: string;
  VITE_APP_AI_BACKEND: string;
  VITE_APP_FIREBASE_CONFIG: string;
  VITE_APP_DEV_DISABLE_LIVE_RELOAD: string;
  VITE_APP_DISABLE_SENTRY: string;
  VITE_APP_COLLAPSE_OVERLAY: string;
  VITE_APP_ENABLE_ESLINT: string;
  VITE_APP_ENABLE_PWA: string;
  VITE_APP_PLUS_LP: string;
  VITE_APP_PLUS_APP: string;
  VITE_APP_GIT_SHA: string;
  MODE: string;
  DEV: string;
  PROD: string;
}
```

**Add Supabase Typings:**
```typescript
VITE_APP_SUPABASE_URL: string;
VITE_APP_SUPABASE_ANON_KEY: string;
VITE_APP_FEATURE_SUPABASE_SYNC: string; // "true" or "false"
```

---

### Existing VITE_APP_* Variables (from grep)
Located in: `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/*`

Referenced in code:
- `VITE_APP_BACKEND_V2_GET_URL` (data/index.ts:65)
- `VITE_APP_BACKEND_V2_POST_URL` (data/index.ts:66)
- `VITE_APP_WS_SERVER_URL` (collab/Portal.tsx)
- `VITE_APP_PORTAL_URL` (collab/Portal.tsx)
- `VITE_APP_AI_BACKEND` (App.tsx & AI components)
- `VITE_APP_FIREBASE_CONFIG` (data/firebase.ts)
- `VITE_APP_DISABLE_PREVENT_UNLOAD` (App.tsx:662)
- `VITE_APP_PLUS_LP` (App.tsx:873)
- `VITE_APP_PLUS_APP` (App.tsx:896)
- `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` (components/ExportToExcalidrawPlus)
- `VITE_APP_COLLAPSE_OVERLAY` (vite.config.mts)
- `VITE_APP_ENABLE_ESLINT` (vite.config.mts)
- `VITE_APP_ENABLE_PWA` (vite.config.mts)
- `VITE_APP_GIT_SHA` (scripts)

---

### .env Files
**Location:** `/Users/araj7/Documents/personal/excalidraw/`

Available files:
- `.env.production`
- `.env.development`
- `.env.development.local` (user-specific, not in git)

**Example from .env.development:**
```env
VITE_APP_BACKEND_V2_GET_URL=https://json-dev.excalidraw.com/api/v2/
VITE_APP_BACKEND_V2_POST_URL=https://json-dev.excalidraw.com/api/v2/post/
VITE_APP_WS_SERVER_URL=http://localhost:3002
VITE_APP_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"..."}'
```

---

### Supabase Dependency Status
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/package.json`

**Current dependencies (Lines 28-40):**
```json
"@excalidraw/random-username": "1.0.0",
"@sentry/browser": "9.0.1",
"callsites": "4.2.0",
"firebase": "11.3.1",
"i18next-browser-languagedetector": "6.1.4",
"idb-keyval": "6.0.3",
"jotai": "2.11.0",
"react": "19.0.0",
"react-dom": "19.0.0",
"socket.io-client": "4.7.2",
"uqr": "0.1.2",
"vite-plugin-html": "3.2.2"
```

**Status:** NO Supabase dependency exists yet. Will need to add `@supabase/supabase-js`.

---

## E. Test Patterns

### Test Directory Structure
**Location:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/tests/`

**Test Files:**
- `collab.test.tsx` (2025-01-13)
- `LanguageList.test.tsx`
- `MobileMenu.test.tsx`
- `__snapshots__/` — snapshot files

---

### Test Setup - Firebase Mocking Pattern
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/tests/collab.test.tsx`

**Firebase Mock (Lines 30-50):**
```typescript
vi.mock("../../excalidraw-app/data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = () => {};
  const isSavedToFirebase = () => true;
  const loadFilesFromFirebase = async () => ({
    loadedFiles: [],
    erroredFiles: [],
  });
  const saveFilesToFirebase = async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  });

  return {
    loadFromFirebase,
    saveToFirebase,
    isSavedToFirebase,
    loadFilesFromFirebase,
    saveFilesToFirebase,
  };
});
```

**Socket.IO Mock (Lines 52-64):**
```typescript
vi.mock("socket.io-client", () => {
  return {
    default: () => {
      return {
        close: () => {},
        on: () => {},
        once: () => {},
        off: () => {},
        emit: () => {},
      };
    },
  };
});
```

---

### Test Utilities
**From:** `@excalidraw/excalidraw/tests/test-utils` and `@excalidraw/excalidraw/tests/helpers/api`
- `render()` component test helper
- `waitFor()` async wait helper
- `act()` react batching helper
- `API.createElement()` factory for creating test elements

**Crypto Mock (Lines 19-28):**
```typescript
Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
    },
  },
});
```

---

### Vite Test Configuration
**File:** `/Users/araj7/Documents/personal/excalidraw/excalidraw-app/vite.config.mts`

**No test config found in main vite.config.mts.** 

Tests likely configured via `vitest` config file or in `package.json`. Likely setup files in:
- Root `vitest.config.ts` or `vitest.config.mts`
- Test utilities in `@excalidraw/excalidraw/tests/` directory

**Pattern for mocking:** Use `vi.mock()` at module level before component render.

---

### import.meta.env in Tests
Tests use `vi.mock()` to override module exports before calling `render()`. 
For testing Supabase, will need to:
1. Mock `@supabase/supabase-js` module
2. Mock `import.meta.env.VITE_APP_SUPABASE_*` vars (likely injected automatically by Vite test runner)

---

## Summary: Edit Sites for Supabase Sync Feature

| Requirement | File | Line(s) | Action |
|---|---|---|---|
| **onChange sync to Supabase** | App.tsx | 689 (after LocalData.save) | Add Supabase sync call if user signed in |
| **Disable live collab in onChange** | App.tsx | 682-684 | Wrap `collabAPI.syncElements()` with feature flag or remove |
| **Disable collab scene init** | App.tsx | 327-359 | Skip `collabAPI.startCollaboration()` branch |
| **Hide LiveCollaborationTrigger** | App.tsx | 969-976 | Replace with Supabase status component |
| **Disable Collab component render** | App.tsx | 1038-1040 | Add feature flag condition |
| **Hide "collaborationOnly" dialog** | App.tsx | 791-793 + 1082-1086 | Set predicate to false or remove |
| **Remove collab link parsing** | App.tsx + data/index.ts | 248, 537 | Make `getCollaborationLinkData()` return null |
| **Hash change handler** | App.tsx | 532-556 | Skip collab link detection |
| **API for reading scene state** | App.tsx | See section A.7 | Use `excalidrawAPI.getSceneElements/Elements()`, `getAppState()`, `getFiles()` |
| **Add Supabase env vars** | vite-env.d.ts | Lines 4-49 | Add `VITE_APP_SUPABASE_URL`, `VITE_APP_SUPABASE_ANON_KEY`, `VITE_APP_FEATURE_SUPABASE_SYNC` |
| **FileManager signature** | FileManager.ts | Lines 45-65 | Use as template for Supabase file manager |
| **LocalData exports** | LocalData.ts | 137, 149, 155-161 | Integrate with Supabase save lifecycle |
| **Test mocking pattern** | collab.test.tsx | Lines 30-64 | Use `vi.mock()` pattern for Supabase module |

