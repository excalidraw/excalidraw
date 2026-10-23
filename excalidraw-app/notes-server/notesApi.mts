/**
 * Local notes storage backed by SQLite (Node's built-in `node:sqlite`).
 *
 * Exposes a connect-style middleware handling `/api/notes/*` and
 * `/api/library` (the editor's shape library, shared by all notes), used by
 * the Vite dev server (see `vite.config.mts`), the standalone production
 * server (`server.mts`) and the macOS app (`desktop/`).
 *
 * Images (binary files) are stored in a separate table so that autosaves only
 * need to send files the server doesn't have yet.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BODY_SIZE = 200 * 1024 * 1024; // 200MB (scenes with images)

type NoteRow = {
  id: string;
  title: string;
  elements: string;
  app_state: string;
  created_at: number;
  updated_at: number;
  has_thumbnail: number;
};

type FileRow = { id: string; data: string };

type NoteUpdate = {
  title?: string;
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, { id: string }>;
  thumbnail?: string | null;
};

// no TS parameter properties: this file runs in Node via type stripping
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const openDatabase = (dbFile: string) => {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new DatabaseSync(dbFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      elements   TEXT NOT NULL DEFAULT '[]',
      app_state  TEXT NOT NULL DEFAULT '{}',
      thumbnail  BLOB,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_files (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      id      TEXT NOT NULL,
      data    TEXT NOT NULL,
      PRIMARY KEY (note_id, id)
    );

    -- single row holding the persisted shape library (\`LibraryPersistedData\`)
    CREATE TABLE IF NOT EXISTS library (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
};

const toNoteSummary = (row: NoteRow) => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  hasThumbnail: !!row.has_thumbnail,
});

const decodeDataURL = (dataURL: string) => {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataURL);
  if (!match) {
    throw new HttpError(400, "invalid thumbnail");
  }
  return Buffer.from(match[3], match[2] ? "base64" : "utf8");
};

const readJSONBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      throw new HttpError(413, "payload too large");
    }
    chunks.push(chunk);
  }
  if (!size) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
};

const sendJSON = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

export const createNotesApi = (dbFile: string) => {
  const db = openDatabase(dbFile);

  const SUMMARY_COLUMNS = `id, title, created_at, updated_at,
    thumbnail IS NOT NULL AS has_thumbnail`;

  const listNotes = db.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM notes ORDER BY updated_at DESC`,
  );
  const getNote = db.prepare(
    `SELECT ${SUMMARY_COLUMNS}, elements, app_state FROM notes WHERE id = ?`,
  );
  const getThumbnail = db.prepare(`SELECT thumbnail FROM notes WHERE id = ?`);
  const getFiles = db.prepare(
    `SELECT id, data FROM note_files WHERE note_id = ?`,
  );
  const getFileIds = db.prepare(`SELECT id FROM note_files WHERE note_id = ?`);
  const insertNote = db.prepare(
    `INSERT INTO notes (id, title, elements, app_state, thumbnail, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const upsertFile = db.prepare(
    `INSERT OR IGNORE INTO note_files (note_id, id, data) VALUES (?, ?, ?)`,
  );
  const deleteFile = db.prepare(
    `DELETE FROM note_files WHERE note_id = ? AND id = ?`,
  );
  const deleteNote = db.prepare(`DELETE FROM notes WHERE id = ?`);
  const getLibrary = db.prepare(`SELECT data FROM library WHERE id = 1`);
  const saveLibrary = db.prepare(
    `INSERT INTO library (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data,
       updated_at = excluded.updated_at`,
  );

  const findNote = (id: string) => {
    const row = getNote.get(id) as NoteRow | undefined;
    if (!row) {
      throw new HttpError(404, "note not found");
    }
    return row;
  };

  const transaction = (fn: () => void) => {
    db.exec("BEGIN");
    try {
      fn();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  const loadNote = (id: string) => {
    const row = findNote(id);
    const files: Record<string, unknown> = {};
    for (const file of getFiles.all(id) as FileRow[]) {
      files[file.id] = JSON.parse(file.data);
    }
    return {
      ...toNoteSummary(row),
      elements: JSON.parse(row.elements),
      appState: JSON.parse(row.app_state),
      files,
    };
  };

  const createNote = (title: string) => {
    const id = randomUUID();
    const now = Date.now();
    insertNote.run(id, title, "[]", "{}", null, now, now);
    return toNoteSummary(findNote(id));
  };

  const duplicateNote = (sourceId: string) => {
    const source = findNote(sourceId);
    const id = randomUUID();
    const now = Date.now();
    transaction(() => {
      const thumbnail = getThumbnail.get(sourceId) as {
        thumbnail: Uint8Array | null;
      };
      insertNote.run(
        id,
        `${source.title || "Sem título"} (cópia)`,
        source.elements,
        source.app_state,
        thumbnail.thumbnail,
        now,
        now,
      );
      for (const file of getFiles.all(sourceId) as FileRow[]) {
        upsertFile.run(id, file.id, file.data);
      }
    });
    return toNoteSummary(findNote(id));
  };

  const updateNote = (id: string, update: NoteUpdate) => {
    findNote(id);

    const assignments: string[] = [];
    const values: (string | number | Uint8Array | null)[] = [];
    const assign = (column: string, value: string | Uint8Array | null) => {
      assignments.push(`${column} = ?`);
      values.push(value);
    };

    if (typeof update.title === "string") {
      assign("title", update.title.trim());
    }
    if (Array.isArray(update.elements)) {
      assign("elements", JSON.stringify(update.elements));
    }
    if (update.appState && typeof update.appState === "object") {
      assign("app_state", JSON.stringify(update.appState));
    }
    if (update.thumbnail !== undefined) {
      assign(
        "thumbnail",
        update.thumbnail ? decodeDataURL(update.thumbnail) : null,
      );
    }

    transaction(() => {
      if (assignments.length) {
        db.prepare(
          `UPDATE notes SET ${assignments.join(", ")}, updated_at = ?
           WHERE id = ?`,
        ).run(...values, Date.now(), id);
      }

      for (const file of Object.values(update.files ?? {})) {
        upsertFile.run(id, file.id, JSON.stringify(file));
      }

      // drop images no longer referenced by any element (deleted elements
      // are kept in the scene for undo, so their images are kept too)
      if (Array.isArray(update.elements)) {
        const referenced = new Set(
          update.elements
            .map((element) => (element as { fileId?: string }).fileId)
            .filter(Boolean),
        );
        for (const { id: fileId } of getFileIds.all(id) as { id: string }[]) {
          if (!referenced.has(fileId)) {
            deleteFile.run(id, fileId);
          }
        }
      }
    });

    return toNoteSummary(findNote(id));
  };

  const routeLibrary = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET") {
      const row = getLibrary.get() as { data: string } | undefined;
      return sendJSON(res, 200, row ? JSON.parse(row.data) : null);
    }
    if (req.method === "PUT") {
      const body = await readJSONBody(req);
      if (!Array.isArray(body.libraryItems)) {
        throw new HttpError(400, "libraryItems must be an array");
      }
      saveLibrary.run(JSON.stringify(body), Date.now());
      res.statusCode = 204;
      return res.end();
    }
    throw new HttpError(405, "method not allowed");
  };

  const route = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const [, , resource, id, action] = url.pathname.split("/");
    const method = req.method ?? "GET";

    if (resource === "library" && !id) {
      return routeLibrary(req, res);
    }
    if (resource !== "notes") {
      throw new HttpError(404, "not found");
    }

    if (!id) {
      if (method === "GET") {
        return sendJSON(
          res,
          200,
          (listNotes.all() as NoteRow[]).map(toNoteSummary),
        );
      }
      if (method === "POST") {
        const body = await readJSONBody(req);
        return sendJSON(res, 201, createNote(String(body.title ?? "")));
      }
    } else if (!action) {
      if (method === "GET") {
        return sendJSON(res, 200, loadNote(id));
      }
      if (method === "PUT") {
        return sendJSON(res, 200, updateNote(id, await readJSONBody(req)));
      }
      if (method === "DELETE") {
        findNote(id);
        deleteNote.run(id);
        res.statusCode = 204;
        return res.end();
      }
    } else if (action === "duplicate" && method === "POST") {
      return sendJSON(res, 201, duplicateNote(id));
    } else if (action === "thumbnail" && method === "GET") {
      const row = getThumbnail.get(id) as
        | { thumbnail: Uint8Array | null }
        | undefined;
      if (!row?.thumbnail) {
        throw new HttpError(404, "thumbnail not found");
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-cache");
      return res.end(row.thumbnail);
    }

    throw new HttpError(405, "method not allowed");
  };

  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!/^\/api\/(notes|library)(\/|\?|$)/.test(req.url ?? "")) {
      return next();
    }
    route(req, res).catch((error) => {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) {
        console.error("[notes-api]", error);
      }
      sendJSON(res, status, { error: error.message });
    });
  };
};
