import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";

import { applyMove, isColumn, planMove } from "./move.mjs";

const HEADER =
  "**Type** feature · **Status** open · **Risk** low · **Opened** 2026-01-01 · **Owner** @zerwiz";
const GOOD = "feature-0001-uw-a-thing.md";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tickets-move-"));
  for (const column of ["open", "in-progress", "review", "done"]) {
    mkdirSync(join(root, "tickets", column), { recursive: true });
  }
  writeFileSync(join(root, "tickets", "open", GOOD), `# t\n\n${HEADER}\n`);
});

describe("isColumn", () => {
  it("knows the four", () => {
    assert.ok(isColumn("open"));
    assert.equal(isColumn("archived"), false);
  });
});

describe("planMove", () => {
  it("plans a move between columns", () => {
    const plan = planMove(
      root,
      { column: "open", filename: GOOD, to: "review" },
      { git: false },
    );
    assert.equal(plan.ok, true);
    assert.equal(plan.relative.from, `tickets/open/${GOOD}`);
    assert.equal(plan.relative.to, `tickets/review/${GOOD}`);
  });

  it("refuses a filename that breaks the naming contract, and says why", () => {
    const plan = planMove(
      root,
      { column: "open", filename: "feature-1-thing.md", to: "review" },
      { git: false },
    );
    assert.equal(plan.ok, false);
    assert.match(plan.error, /does not match/);
  });

  it("refuses an unknown column, either end", () => {
    assert.equal(
      planMove(
        root,
        { column: "nope", filename: GOOD, to: "review" },
        { git: false },
      ).ok,
      false,
    );
    assert.equal(
      planMove(
        root,
        { column: "open", filename: GOOD, to: "nope" },
        { git: false },
      ).ok,
      false,
    );
  });

  it("refuses a move that would escape the tickets root", () => {
    const plan = planMove(
      root,
      { column: "open", filename: "../../etc/passwd", to: "review" },
      { git: false },
    );
    assert.equal(plan.ok, false);
  });

  it("says 'already there' rather than moving to the same column", () => {
    const plan = planMove(
      root,
      { column: "open", filename: GOOD, to: "open" },
      { git: false },
    );
    assert.equal(plan.ok, false);
    assert.match(plan.error, /already in/);
  });
});

describe("applyMove", () => {
  it("moves the file and logs who and why, never the content", () => {
    const logPath = join(root, "writes.log");
    const result = applyMove(
      root,
      { column: "open", filename: GOOD, to: "review" },
      {
        logPath,
        who: "anna",
      },
    );
    assert.equal(result.ok, true);
    assert.equal(existsSync(join(root, "tickets", "open", GOOD)), false);
    assert.equal(existsSync(join(root, "tickets", "review", GOOD)), true);

    const entry = JSON.parse(readFileSync(logPath, "utf8").trim());
    assert.equal(entry.event, "ticket-move");
    assert.equal(entry.who, "anna");
    assert.equal(entry.via, "rename");
    assert.ok(
      !readFileSync(logPath, "utf8").includes("Risk"),
      "the log holds no content",
    );
  });

  it("uses git mv inside a working tree, so history is preserved", () => {
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", root, "config", "user.name", "t"]);
    execFileSync("git", ["-C", root, "add", "-A"]);
    execFileSync("git", ["-C", root, "commit", "-qm", "tickets"]);

    const result = applyMove(
      root,
      { column: "open", filename: GOOD, to: "done" },
      {},
    );
    assert.equal(result.ok, true);
    const status = execFileSync("git", [
      "-C",
      root,
      "status",
      "--porcelain",
    ]).toString();
    assert.match(
      status,
      /^R/m,
      "git recorded a RENAME, not a delete and an add",
    );
  });

  it("refuses a bad name without touching the file", () => {
    const result = applyMove(
      root,
      { column: "open", filename: "bad-name.md", to: "review" },
      {},
    );
    assert.equal(result.ok, false);
    assert.equal(existsSync(join(root, "tickets", "open", GOOD)), true);
  });
});

// ── the HTTP route, exercised for real ──────────────────────────────────────
//
// A module test cannot catch a route that reads `url` before declaring it — that
// bug took the whole server down on the FIRST request while every unit test
// passed. So the route is driven over HTTP.
describe("the move route over HTTP", () => {
  it("moves, refuses a malformed name, and answers /healthz", async () => {
    const { execFileSync: exec } = await import("node:child_process");

    exec("git", ["-C", root, "init", "-q"]);
    exec("git", ["-C", root, "config", "user.email", "t@example.com"]);
    exec("git", ["-C", root, "config", "user.name", "t"]);
    exec("git", ["-C", root, "add", "-A"]);
    exec("git", ["-C", root, "commit", "-qm", "tickets"]);

    const logPath = join(root, "writes.log");
    process.env.TICKETS_REPO_ROOT = root;
    process.env.TICKETS_WRITE_LOG = logPath;
    process.env.TICKETS_PORT = "0";

    // The route is exercised through the REAL server process, because a module
    // test cannot see a handler that never runs.
    const { spawn } = await import("node:child_process");
    const child = spawn(
      process.execPath,
      [join(process.cwd(), "server", "tickets", "index.mjs")],
      {
        env: {
          ...process.env,
          TICKETS_REPO_ROOT: root,
          TICKETS_PORT: "7394",
          TICKETS_WRITE_LOG: logPath,
        },
        stdio: "ignore",
      },
    );
    try {
      // Wait for it to answer.
      let up = false;
      for (let i = 0; i < 40 && !up; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        try {
          const r = await fetch("http://127.0.0.1:7394/healthz");
          up = r.ok;
        } catch {
          /* not yet */
        }
      }
      assert.equal(up, true, "the board did not come up");

      const ok = await fetch("http://127.0.0.1:7394/api/tickets/move", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-excalidraw-who": "test",
        },
        body: JSON.stringify({ column: "open", filename: GOOD, to: "review" }),
      });
      assert.equal(ok.status, 200);
      const okBody = await ok.json();
      assert.match(okBody.detail, /moved/);
      assert.equal(existsSync(join(root, "tickets", "review", GOOD)), true);

      const bad = await fetch("http://127.0.0.1:7394/api/tickets/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          column: "review",
          filename: "nope.md",
          to: "done",
        }),
      });
      assert.equal(bad.status, 400);
      assert.match((await bad.json()).error, /does not match/);

      // The board still answers after a refused write — the crash this test exists for.
      const after = await fetch("http://127.0.0.1:7394/api/tickets");
      assert.equal(after.status, 200);
      assert.equal(typeof (await after.json()).total, "number");

      const log = readFileSync(logPath, "utf8");
      assert.match(log, /ticket-move/);
      assert.match(log, /"who":"test"/);
    } finally {
      child.kill();
    }
  });
});
