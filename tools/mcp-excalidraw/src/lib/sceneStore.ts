import fs from "node:fs/promises";
import path from "node:path";

import { ToolError } from "./errors";
import { exportSceneAsJson, exportSceneAsSvg } from "./exporters";
import type { ExcalidrawScene, SceneListItem, SceneStats } from "./types";
import {
  assertPlainObject,
  assertValidScene,
  countSceneFiles,
  createEmptyScene,
  mergeScenePatch,
  validateScenePath,
} from "./validators";

const isInsideRoot = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const ensureBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== "boolean") {
    throw new ToolError("INVALID_PARAMS", `${field} must be a boolean`);
  }
  return value;
};

interface SafePathResult {
  absolutePath: string;
  relativePath: string;
}

export class SceneStore {
  private readonly rootDir: string;
  private rootRealPath: string | null = null;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private async getRootRealPath(): Promise<string> {
    if (this.rootRealPath) {
      return this.rootRealPath;
    }

    let stats;
    try {
      stats = await fs.stat(this.rootDir);
    } catch {
      throw new ToolError(
        "ROOT_NOT_FOUND",
        `Configured root does not exist: ${this.rootDir}`,
        "Set EXCALIDRAW_MCP_ROOT to an existing directory",
      );
    }

    if (!stats.isDirectory()) {
      throw new ToolError(
        "INVALID_ROOT",
        `Configured root is not a directory: ${this.rootDir}`,
      );
    }

    this.rootRealPath = await fs.realpath(this.rootDir);
    return this.rootRealPath;
  }

  private async resolveSafeDirectory(baseDir?: unknown): Promise<SafePathResult> {
    const rootRealPath = await this.getRootRealPath();
    const requestedDirectory =
      typeof baseDir === "string" && baseDir.trim()
        ? baseDir
        : ".";

    const absolutePath = path.isAbsolute(requestedDirectory)
      ? path.resolve(requestedDirectory)
      : path.resolve(rootRealPath, requestedDirectory);

    let realPath: string;
    try {
      realPath = await fs.realpath(absolutePath);
    } catch {
      throw new ToolError("NOT_FOUND", `Directory not found: ${requestedDirectory}`);
    }

    if (!isInsideRoot(rootRealPath, realPath)) {
      throw new ToolError(
        "PATH_NOT_ALLOWED",
        "Requested directory is outside configured root",
      );
    }

    const stats = await fs.stat(realPath);
    if (!stats.isDirectory()) {
      throw new ToolError("INVALID_PATH", "baseDir must point to a directory");
    }

    return {
      absolutePath: realPath,
      relativePath: path.relative(rootRealPath, realPath) || ".",
    };
  }

  private async resolveSafeScenePath(
    scenePath: unknown,
    mustExist: boolean,
  ): Promise<SafePathResult> {
    const requestedPath = validateScenePath(scenePath);
    const rootRealPath = await this.getRootRealPath();

    const absolutePath = path.isAbsolute(requestedPath)
      ? path.resolve(requestedPath)
      : path.resolve(rootRealPath, requestedPath);

    if (!isInsideRoot(rootRealPath, absolutePath)) {
      throw new ToolError(
        "PATH_NOT_ALLOWED",
        "Requested path is outside configured root",
      );
    }

    if (mustExist) {
      let realPath: string;
      try {
        realPath = await fs.realpath(absolutePath);
      } catch {
        throw new ToolError("NOT_FOUND", `Scene not found: ${requestedPath}`);
      }

      if (!isInsideRoot(rootRealPath, realPath)) {
        throw new ToolError(
          "PATH_NOT_ALLOWED",
          "Resolved file path is outside configured root",
        );
      }

      const stats = await fs.stat(realPath);
      if (!stats.isFile()) {
        throw new ToolError("INVALID_PATH", "path must point to a file");
      }

      return {
        absolutePath: realPath,
        relativePath: path.relative(rootRealPath, realPath),
      };
    }

    let parent = path.dirname(absolutePath);
    while (true) {
      try {
        const realParent = await fs.realpath(parent);
        if (!isInsideRoot(rootRealPath, realParent)) {
          throw new ToolError(
            "PATH_NOT_ALLOWED",
            "Scene directory resolves outside configured root",
          );
        }
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
      const next = path.dirname(parent);
      if (next === parent) {
        throw new ToolError(
          "PATH_NOT_ALLOWED",
          "Unable to resolve a safe parent directory for path",
        );
      }
      parent = next;
    }

    return {
      absolutePath,
      relativePath: path.relative(rootRealPath, absolutePath),
    };
  }

  private async writeAtomic(filePath: string, content: string): Promise<void> {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });

    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmpPath, content, "utf8");
    await fs.rename(tmpPath, filePath);
  }

  private async readScene(scenePath: string): Promise<ExcalidrawScene> {
    const raw = await fs.readFile(scenePath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ToolError(
        "INVALID_SCENE_JSON",
        "Scene file contains invalid JSON",
      );
    }

    assertValidScene(parsed);
    return parsed;
  }

  async list(input: unknown): Promise<{ items: SceneListItem[] }> {
    const args: Record<string, unknown> = {};
    if (input !== undefined) {
      assertPlainObject(input, "arguments");
      Object.assign(args, input);
    }
    const recursive =
      "recursive" in args
        ? ensureBoolean(args.recursive, "recursive")
        : false;
    const baseDir = args.baseDir;

    const { absolutePath } = await this.resolveSafeDirectory(baseDir);
    const rootRealPath = await this.getRootRealPath();
    const items: SceneListItem[] = [];

    const walk = async (directoryPath: string): Promise<void> => {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          if (recursive) {
            await walk(entryPath);
          }
          continue;
        }

        if (!entry.isFile() || !entry.name.endsWith(".excalidraw")) {
          continue;
        }

        const stats = await fs.stat(entryPath);
        items.push({
          name: entry.name,
          path: path.relative(rootRealPath, entryPath),
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        });
      }
    };

    await walk(absolutePath);
    items.sort((a, b) => a.path.localeCompare(b.path));
    return { items };
  }

  async get(input: unknown): Promise<{ scene: ExcalidrawScene; stats: SceneStats }> {
    assertPlainObject(input, "arguments");
    const args = input;
    const { absolutePath } = await this.resolveSafeScenePath(args.path, true);
    const scene = await this.readScene(absolutePath);
    const fileStats = await fs.stat(absolutePath);

    return {
      scene,
      stats: {
        elements: scene.elements.length,
        files: countSceneFiles(scene),
        updatedAt: fileStats.mtime.toISOString(),
      },
    };
  }

  async create(
    input: unknown,
  ): Promise<{ path: string; created: true }> {
    assertPlainObject(input, "arguments");
    const args = input;
    const overwrite =
      "overwrite" in args ? ensureBoolean(args.overwrite, "overwrite") : false;
    const { absolutePath, relativePath } = await this.resolveSafeScenePath(
      args.path,
      false,
    );

    const scene = args.scene ?? createEmptyScene();
    assertValidScene(scene);

    let exists = false;
    try {
      const stats = await fs.stat(absolutePath);
      exists = stats.isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    if (exists && !overwrite) {
      throw new ToolError(
        "ALREADY_EXISTS",
        `Scene already exists: ${relativePath}`,
        "Use overwrite=true to replace it",
      );
    }

    await this.writeAtomic(absolutePath, `${JSON.stringify(scene, null, 2)}\n`);
    return { path: relativePath, created: true };
  }

  async update(
    input: unknown,
  ): Promise<{ path: string; updated: true }> {
    assertPlainObject(input, "arguments");
    const args = input;
    const { absolutePath, relativePath } = await this.resolveSafeScenePath(
      args.path,
      true,
    );
    const currentScene = await this.readScene(absolutePath);
    const nextScene = mergeScenePatch(currentScene, args.patch);
    await this.writeAtomic(absolutePath, `${JSON.stringify(nextScene, null, 2)}\n`);
    return { path: relativePath, updated: true };
  }

  async delete(
    input: unknown,
  ): Promise<{ path: string; deleted: true }> {
    assertPlainObject(input, "arguments");
    const args = input;
    const confirm =
      "confirm" in args ? ensureBoolean(args.confirm, "confirm") : false;
    if (!confirm) {
      throw new ToolError(
        "CONFIRM_REQUIRED",
        "delete requires confirm=true",
        "Set confirm to true to delete the file",
      );
    }
    const { absolutePath, relativePath } = await this.resolveSafeScenePath(
      args.path,
      true,
    );
    await fs.unlink(absolutePath);
    return { path: relativePath, deleted: true };
  }

  async export(input: unknown): Promise<{
    format: "json" | "svg";
    content?: string;
    outputPath?: string;
  }> {
    assertPlainObject(input, "arguments");
    const args = input;
    const format = args.format;
    if (format !== "json" && format !== "svg") {
      throw new ToolError(
        "INVALID_PARAMS",
        'format must be either "json" or "svg"',
      );
    }

    const { absolutePath } = await this.resolveSafeScenePath(args.path, true);
    const scene = await this.readScene(absolutePath);

    const serialized =
      format === "json"
        ? exportSceneAsJson(scene)
        : await exportSceneAsSvg(scene);

    if (args.outputPath !== undefined) {
      if (typeof args.outputPath !== "string" || !args.outputPath.trim()) {
        throw new ToolError(
          "INVALID_PARAMS",
          "outputPath must be a non-empty string",
        );
      }

      const rootRealPath = await this.getRootRealPath();
      const outputAbsolutePath = path.isAbsolute(args.outputPath)
        ? path.resolve(args.outputPath)
        : path.resolve(rootRealPath, args.outputPath);

      if (!isInsideRoot(rootRealPath, outputAbsolutePath)) {
        throw new ToolError(
          "PATH_NOT_ALLOWED",
          "outputPath must stay inside configured root",
        );
      }

      await this.writeAtomic(outputAbsolutePath, serialized);
      return {
        format,
        outputPath: path.relative(rootRealPath, outputAbsolutePath),
      };
    }

    return {
      format,
      content: serialized,
    };
  }
}
