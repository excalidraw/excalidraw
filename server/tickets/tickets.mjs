/**
 * Tickets board — the read-only projection of the repo's `tickets/` directory.
 *
 * The **files remain the source of truth**. This module only reads them and
 * shapes them for the UI, so the board can never become a second, divergent
 * backlog.
 *
 * See `tickets/open/feature-0006-uw-ticket-board-in-the-tool.md`.
 */

import path from "node:path";

/** The four columns, in workflow order. */
export const COLUMNS = ["open", "in-progress", "review", "done"];

export const COLUMN_LABELS = {
  open: "Open",
  "in-progress": "In progress",
  review: "Review",
  done: "Done",
};

const NAME_RE = /^(bug|feature|chore|spike)-(\d{4})-([a-z]{2,4})-(.+)\.md$/;

/** `feature-0001-uw-sever-a-thing.md` → its parts, or `null` if malformed. */
export const parseTicketFilename = (filename) => {
  const match = NAME_RE.exec(filename);
  if (!match) {
    return null;
  }
  return {
    type: match[1],
    number: match[2],
    devId: match[3],
    slug: match[4],
    filename,
  };
};

/**
 * Reads the header line, e.g.
 *   **Type** feature · **Status** open · **Risk** high · **Opened** 2026-10-10 · **Owner** @zerwiz
 */
export const parseHeader = (markdown) => {
  const line = String(markdown)
    .split("\n")
    .find((l) => l.startsWith("**Type**"));
  if (!line) {
    return {};
  }
  const field = (name) => {
    const match = new RegExp(`\\*\\*${name}\\*\\*\\s*([^·|\\n]+)`).exec(line);
    return match ? match[1].trim() : undefined;
  };
  return {
    type: field("Type"),
    status: field("Status"),
    risk: field("Risk"),
    opened: field("Opened"),
    owner: field("Owner"),
  };
};

/** The ticket's first heading, which is the title. */
export const parseTitle = (markdown, fallback) => {
  const line = String(markdown)
    .split("\n")
    .find((l) => l.startsWith("# "));
  return line ? line.slice(2).trim() : fallback;
};

/**
 * A board entry. `problems` records what the naming guard would also flag, so
 * the UI can show the same mismatch the guard does rather than silently
 * trusting a bad file.
 */
export const buildCard = (column, filename, markdown) => {
  const parsed = parseTicketFilename(filename);
  const header = parseHeader(markdown);
  const problems = [];

  if (!parsed) {
    problems.push("filename does not match <type>-<NNNN>-<devid>-<slug>.md");
  }
  if (!header.owner) {
    problems.push("no Owner in the header");
  }
  if (parsed && header.owner) {
    const owner = header.owner.replace(/^@/, "");
    // The dev id is the same fact as the Owner, stated in the filename.
    const expected = DEV_ID_OWNERS[parsed.devId];
    if (expected && owner !== expected) {
      problems.push(`filename id '${parsed.devId}' but owner @${owner}`);
    }
  }

  return {
    column,
    filename,
    title: parseTitle(markdown, parsed?.slug ?? filename),
    type: header.type ?? parsed?.type ?? null,
    risk: header.risk ?? null,
    owner: header.owner ?? null,
    opened: header.opened ?? null,
    number: parsed?.number ?? null,
    devId: parsed?.devId ?? null,
    problems,
  };
};

/**
 * Dev id → GitHub handle. Kept here so the board can flag a mismatch; the
 * authoritative list is `tickets/DEVIDS`, which `bin/guards/ticket-ids.sh`
 * enforces at push time.
 */
export const DEV_ID_OWNERS = { uw: "zerwiz" };

export const parseDevIds = (contents) =>
  contents
    .split("\n")
    .filter((line) => !line.trim().startsWith("#") && line.trim() !== "")
    .reduce((acc, line) => {
      const [id, handle] = line.trim().split(/\s+/);
      if (id && handle) {
        acc[id] = handle.replace(/^@/, "");
      }
      return acc;
    }, {});

export const buildBoard = (entries) => ({
  columns: COLUMNS.map((column) => ({
    id: column,
    label: COLUMN_LABELS[column],
    tickets: entries
      .filter((entry) => entry.column === column)
      .sort((a, b) => String(a.filename).localeCompare(String(b.filename))),
  })),
  total: entries.length,
});

/**
 * Resolves a request path inside the tickets root, refusing anything that
 * escapes it. Returns `null` rather than throwing, so the caller answers 400/404.
 */
export const safeResolve = (root, relative) => {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relative);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return target;
};

/**
 * Which column a path belongs to, or `null`. Only the four status directories
 * are servable — not `_templates/` or the README.
 */
export const columnOf = (relativePath) => {
  const parts = String(relativePath).split("/").filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }
  const [column, filename] = parts;
  if (!COLUMNS.includes(column)) {
    return null;
  }
  if (!filename.endsWith(".md")) {
    return null;
  }
  return { column, filename };
};

export const readConfig = (env = process.env) => ({
  port: Number(env.TICKETS_PORT ?? 7314),
  /** the append-only write log; empty means a move is not logged */
  writeLog: env.TICKETS_WRITE_LOG ?? "",
  host: env.TICKETS_HOST ?? "127.0.0.1",
  root: path.resolve(env.TICKETS_REPO_ROOT ?? process.cwd()),
  allowedOrigins: (
    env.TICKETS_ORIGINS ?? "http://localhost:7311,http://127.0.0.1:7311"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});
