import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeKey } from "./keys";

import type { StorageProvider } from "./index";

export class LocalStorage implements StorageProvider {
  private root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Resolves a key and refuses anything that escapes the storage root. */
  private resolve(key: string) {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) {
      throw new Error("invalid storage key");
    }
    return full;
  }

  async put(key: string, data: Buffer, contentType: string) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    await writeFile(`${file}.meta`, contentType);
  }

  async get(key: string) {
    const file = this.resolve(key);
    try {
      const [data, contentType] = await Promise.all([
        readFile(file),
        readFile(`${file}.meta`, "utf8"),
      ]);
      return { data, contentType };
    } catch (e: any) {
      if (e.code === "ENOENT") {
        return null;
      }
      throw e;
    }
  }

  async delete(key: string) {
    const file = this.resolve(key);
    await rm(file, { force: true });
    await rm(`${file}.meta`, { force: true });
  }

  async deletePrefix(prefix: string) {
    await rm(this.resolve(prefix.replace(/\/$/, "")), {
      recursive: true,
      force: true,
    });
  }
}
