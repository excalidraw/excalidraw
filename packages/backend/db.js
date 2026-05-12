/**
 * Drizzle + better-sqlite3 handle for `graph.db` (`uploads` table). Export `db`, `uploads`, `eq`.
 */
const path = require("path");

const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { sqliteTable, integer, text } = require("drizzle-orm/sqlite-core");
const { eq, sql } = require("drizzle-orm");

// Schema
const uploads = sqliteTable("uploads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  data: text("data").notNull(),
  planFilename: text("plan_filename"),
  dotFilename: text("dot_filename"),
  stateFilename: text("state_filename"),
  nodeCount: integer("node_count"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Connection
const DB_PATH = path.join(__dirname, "graph.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

const db = drizzle(sqlite, { schema: { uploads } });

// Create table if it doesn't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    plan_filename TEXT,
    dot_filename TEXT,
    state_filename TEXT,
    node_count INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const columns = sqlite.prepare("PRAGMA table_info(uploads)").all();
if (!columns.some((column) => column.name === "state_filename")) {
  sqlite.exec("ALTER TABLE uploads ADD COLUMN state_filename TEXT");
}

module.exports = { db, uploads, eq };
