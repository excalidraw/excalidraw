import {
  type TerraformImportPreset,
  type TerraformImportPresetStack,
} from "./terraformImportPresets";
import { fetchTerraformImportPresetSourcesFromApi } from "./terraformImportPresetsApi";

import { parseRawStateJson } from "./terraformImportMerge";
import {
  buildStackCatalogFromPresetStacks,
  repoNameFromRootPath,
} from "./terraformImportCompositionResolve";

import type { TerraformPlanDotBundle } from "./terraformPlanParsing";
import type {
  TerraformImportPresetSources,
  TerraformImportPresetWarning,
} from "./terraformImportPresetsTypes";

export type {
  TerraformImportPresetSources,
  TerraformImportPresetWarning,
} from "./terraformImportPresetsTypes";

type LoadedFileText = {
  path: string;
  text: string;
};

export type TerraformImportPresetLoadOptions = {
  /** Load embedded content from the preset SQLite API (default: dev). */
  allowApiFetch?: boolean;
  allowDevFetch?: boolean;
  allowDirectoryHandleFallback?: boolean;
};

const PRESET_HANDLE_DB = "excalidraw-terraform-import-presets";
const PRESET_HANDLE_STORE = "handles";
const PRESET_HANDLE_KEY = "rootDirectoryHandle";

const joinRootRelative = (rootPath: string, relativePath: string) =>
  `${rootPath.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;

const safeRelativePath = (path: string) => {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.includes("..") ||
    normalized.includes("\0") ||
    normalized.length === 0
  ) {
    throw new Error(`Unsafe preset path: ${path}`);
  }
  return normalized;
};

const devFetchUrlForPath = (relativePath: string) =>
  `/__dev/terraform-import/${encodeURIComponent(
    safeRelativePath(relativePath),
  )}`;

async function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PRESET_HANDLE_DB, 1);
    request.onerror = () => {
      reject(request.error || new Error("Unable to open IndexedDB."));
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRESET_HANDLE_STORE)) {
        db.createObjectStore(PRESET_HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function getStoredRootDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  try {
    const db = await openHandleDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(PRESET_HANDLE_STORE, "readonly");
      const store = tx.objectStore(PRESET_HANDLE_STORE);
      const request = store.get(PRESET_HANDLE_KEY);
      request.onerror = () => resolve(null);
      request.onsuccess = () =>
        resolve(
          (request.result as FileSystemDirectoryHandle | undefined) ?? null,
        );
    });
  } catch {
    return null;
  }
}

async function setStoredRootDirectoryHandle(handle: FileSystemDirectoryHandle) {
  if (typeof indexedDB === "undefined") {
    return;
  }
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PRESET_HANDLE_STORE, "readwrite");
      tx.onerror = () =>
        reject(tx.error || new Error("Unable to persist directory handle."));
      tx.oncomplete = () => resolve();
      tx.objectStore(PRESET_HANDLE_STORE).put(handle, PRESET_HANDLE_KEY);
    });
  } catch {
    // Best-effort cache; no-op when blocked.
  }
}

export async function chooseTerraformImportPresetRootDirectory() {
  if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
    throw new Error("Directory picker is not supported in this browser.");
  }
  const showDirectoryPicker = (
    window as Window & {
      showDirectoryPicker?: (options?: {
        mode?: "read" | "readwrite";
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!showDirectoryPicker) {
    throw new Error("Directory picker is not supported in this browser.");
  }
  const handle = await showDirectoryPicker({
    mode: "read",
  });
  await setStoredRootDirectoryHandle(handle);
  return handle;
}

async function fetchDevFile(relativePath: string): Promise<LoadedFileText> {
  const response = await fetch(devFetchUrlForPath(relativePath));
  if (!response.ok) {
    throw new Error(`Missing required preset file: ${relativePath}`);
  }
  return {
    path: relativePath,
    text: await response.text(),
  };
}

async function readFileFromDirectoryHandle(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<LoadedFileText> {
  const normalized = safeRelativePath(relativePath);
  const segments = normalized.split("/");
  let directory: FileSystemDirectoryHandle = rootHandle;
  for (let index = 0; index < segments.length - 1; index++) {
    directory = await directory.getDirectoryHandle(segments[index]!, {
      create: false,
    });
  }
  const fileHandle = await directory.getFileHandle(
    segments[segments.length - 1]!,
    {
      create: false,
    },
  );
  const file = await fileHandle.getFile();
  return { path: relativePath, text: await file.text() };
}

async function loadRequiredText(
  fullRelativePath: string,
  options: TerraformImportPresetLoadOptions,
  directoryHandle: FileSystemDirectoryHandle | null,
): Promise<LoadedFileText> {
  const allowDevFetch = options.allowDevFetch ?? import.meta.env.DEV;
  if (allowDevFetch) {
    return fetchDevFile(fullRelativePath);
  }
  if (directoryHandle) {
    return readFileFromDirectoryHandle(directoryHandle, fullRelativePath);
  }
  throw new Error(
    `Preset requires directory access for "${fullRelativePath}". Choose a preset folder first.`,
  );
}

async function loadOptionalText(
  fullRelativePath: string,
  options: TerraformImportPresetLoadOptions,
  directoryHandle: FileSystemDirectoryHandle | null,
): Promise<LoadedFileText | null> {
  try {
    return await loadRequiredText(fullRelativePath, options, directoryHandle);
  } catch {
    return null;
  }
}

function fullPathForPresetFile(
  preset: TerraformImportPreset,
  stack: TerraformImportPresetStack,
  relativePath: string,
) {
  const stackBase = stack.id ? stack.id : "";
  return joinRootRelative(
    preset.rootPath,
    stackBase && !relativePath.startsWith(`${stackBase}/`)
      ? `${stackBase}/${relativePath}`
      : relativePath,
  );
}

const isTerraformPresetsApiEnabled = () =>
  import.meta.env.DEV || import.meta.env.VITE_TERRAFORM_PRESETS_API === "true";

export async function loadTerraformImportPresetSources(
  preset: TerraformImportPreset,
  options: TerraformImportPresetLoadOptions = {},
): Promise<TerraformImportPresetSources> {
  const allowApiFetch = options.allowApiFetch ?? isTerraformPresetsApiEnabled();
  if (allowApiFetch && (preset.hasContent ?? true)) {
    try {
      return await fetchTerraformImportPresetSourcesFromApi(preset.id);
    } catch (apiError) {
      if (preset.hasContent === true) {
        const message =
          apiError instanceof Error ? apiError.message : "Preset API failed.";
        if (!import.meta.env.DEV) {
          throw new Error(
            `${message} Presets may be unavailable until D1 is imported (see docs/cloudflare-deploy.md).`,
          );
        }
        throw apiError;
      }
    }
  }

  const warnings: TerraformImportPresetWarning[] = [];
  const allowDirectoryFallback = options.allowDirectoryHandleFallback ?? true;
  const directoryHandle = allowDirectoryFallback
    ? await getStoredRootDirectoryHandle()
    : null;

  const planDotBundles: TerraformPlanDotBundle[] = [];
  for (const stack of preset.stacks) {
    const planPath = fullPathForPresetFile(preset, stack, stack.planPath);
    const dotPath = fullPathForPresetFile(preset, stack, stack.dotPath);
    const [planRaw, dotRaw] = await Promise.all([
      loadRequiredText(planPath, options, directoryHandle),
      loadRequiredText(dotPath, options, directoryHandle),
    ]);
    let parsedPlan: unknown;
    try {
      parsedPlan = JSON.parse(planRaw.text);
    } catch {
      throw new Error(`Preset plan file must be valid JSON: ${planRaw.path}`);
    }
    planDotBundles.push({
      plan: parsedPlan,
      dotText: dotRaw.text,
      label: stack.label,
    });
  }

  const states: unknown[] = [];
  const stateLabels: string[] = [];
  for (const stack of preset.stacks) {
    if (!stack.statePath) {
      continue;
    }
    const statePath = fullPathForPresetFile(preset, stack, stack.statePath);
    const stateRaw = await loadOptionalText(
      statePath,
      options,
      directoryHandle,
    );
    if (!stateRaw) {
      warnings.push({
        code: "missing_state_file",
        message: `Optional state file missing: ${statePath}`,
      });
      continue;
    }
    const parsed = parseRawStateJson(stateRaw.text);
    if (!parsed.ok) {
      throw new Error(`${statePath}: ${parsed.error}`);
    }
    states.push(parsed.state);
    stateLabels.push(stack.label);
  }

  const tfdTexts: string[] = [];
  const tfdLabels: string[] = [];
  for (const tfdPath of preset.tfdPaths) {
    const fullTfdPath = joinRootRelative(preset.rootPath, tfdPath);
    const tfdRaw = await loadOptionalText(
      fullTfdPath,
      options,
      directoryHandle,
    );
    if (!tfdRaw) {
      warnings.push({
        code: "missing_optional_tfd",
        message: `Optional dataflow file missing: ${fullTfdPath}`,
      });
      continue;
    }
    tfdTexts.push(tfdRaw.text);
    tfdLabels.push(tfdPath);
  }

  const repoName = repoNameFromRootPath(preset.rootPath);
  const stackCatalog = buildStackCatalogFromPresetStacks(
    repoName,
    preset.stacks.map((stack) => ({
      id: stack.id,
      label: stack.label,
      planPath: stack.planPath,
      dotPath: stack.dotPath,
      statePath: stack.statePath,
      planText: stack.planText,
      dotText: stack.dotText,
      stateText: stack.stateText,
    })),
  );

  return {
    planDotBundles,
    states,
    stateLabels,
    tfdTexts,
    tfdLabels,
    warnings,
    repoName,
    stackCatalog,
  };
}
