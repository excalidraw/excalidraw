/**
 * Standalone server for the notes app: serves the production build
 * (`excalidraw-app/build`) and the SQLite-backed notes API.
 *
 * Usage: `yarn start:notes` (from the repo root), then open
 * http://localhost:5001. Configure with `PORT`, `HOST` and `NOTES_DB_PATH`.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { createNotesServer } from "./createServer.mts";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 5001);
// only reachable from this machine unless explicitly exposed
const host = process.env.HOST || "127.0.0.1";
const dbFile = path.resolve(
  process.env.NOTES_DB_PATH || path.join(appDir, "..", "data", "notes.db"),
);

createNotesServer({ buildDir: path.join(appDir, "build"), dbFile }).listen(
  port,
  host,
  () => {
    console.info(`Excalidraw notes running at http://localhost:${port}`);
    console.info(`SQLite database: ${dbFile}`);
  },
);
