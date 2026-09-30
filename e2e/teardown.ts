import { rm } from "node:fs/promises";
import path from "node:path";

import { MongoClient } from "mongodb";

/** Drops the e2e database and its storage folder after the run. */
export default async function globalTeardown() {
  const client = new MongoClient("mongodb://127.0.0.1:27017", {
    serverSelectionTimeoutMS: 3000,
  });
  try {
    await client.connect();
    await client.db("excalidraw_workspace_e2e").dropDatabase();
  } catch {
    /* nothing to clean if MongoDB was unreachable */
  } finally {
    await client.close().catch(() => {});
  }
  await rm(path.resolve(__dirname, "..", "server", "storage-e2e"), {
    recursive: true,
    force: true,
  });
}
