/**
 * Moving a ticket between columns.
 *
 * The **folder is the status**, so a move is a file move and nothing else — no
 * field to update, no second source of truth. `git mv` is used when the tickets
 * root is a git working tree (which is the case in a checkout, and preserves the
 * history); a plain rename is used on a deployment, where the ledger is a copy.
 * The log says which happened.
 *
 * `tickets/open/feature-0014-uw-render-and-edit-tickets-in-the-board.md`.
 */

import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

import {
  COLUMNS,
  columnOf,
  parseTicketFilename,
  safeResolve,
} from "./tickets.mjs";

export const isColumn = (value) => COLUMNS.includes(value);

/**
 * Whether the ledger is a git working tree — the same check the move makes, so a
 * caller can say what will happen rather than discover it.
 */
export const isGitWorkingTree = (root) => {
  try {
    return (
      execFileSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim() === "true"
    );
  } catch {
    return false;
  }
};

/**
 * The decision, separated from the doing: given a move, what would happen?
 * Returns `{ok:true, from, to, useGit}` or `{ok:false, error}`.
 */
export const planMove = (
  root,
  { column, filename, to },
  { git = null } = {},
) => {
  if (!isColumn(column)) {
    return { ok: false, error: `'${column}' is not a ticket column` };
  }
  if (!isColumn(to)) {
    return { ok: false, error: `'${to}' is not a ticket column` };
  }
  if (!columnOf(`${column}/${filename}`)) {
    return { ok: false, error: `'${filename}' is not a ticket filename` };
  }

  // THE GUARD'S RULE, stated here too: a ticket that does not match the naming
  // contract is refused, with the reason, rather than moved while malformed.
  if (!parseTicketFilename(filename)) {
    return {
      ok: false,
      error: `'${filename}' does not match <type>-<NNNN>-<devid>-<slug>.md — fix the name first`,
    };
  }

  const from = safeResolve(join(root, "tickets"), `${column}/${filename}`);
  const dest = safeResolve(join(root, "tickets"), `${to}/${filename}`);
  if (!from || !dest) {
    return { ok: false, error: "that path escapes the tickets root" };
  }
  if (column === to) {
    return { ok: false, error: `already in '${to}'` };
  }

  return {
    ok: true,
    from,
    to: dest,
    relative: {
      from: `tickets/${column}/${filename}`,
      to: `tickets/${to}/${filename}`,
    },
    useGit: git === null ? isGitWorkingTree(root) : git,
  };
};

/**
 * Applies a move. Returns `{ok, detail}`.
 *
 * `who` is recorded — the log answers "who moved what, when" — and the log never
 * carries ticket **content**, by the same rule as the room server's.
 */
export const applyMove = (
  root,
  request,
  { logPath = "", who = "unknown" } = {},
) => {
  const plan = planMove(root, request);
  if (!plan.ok) {
    return plan;
  }

  let moved = false;
  if (plan.useGit) {
    try {
      execFileSync(
        "git",
        ["-C", root, "mv", plan.relative.from, plan.relative.to],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      moved = true;
    } catch (error) {
      // A git failure is worth reporting rather than silently falling back to a
      // rename — the caller asked for history to be preserved and it was not.
      return {
        ok: false,
        error: `git mv failed: ${error?.message ?? String(error)}`,
      };
    }
  } else {
    try {
      renameSync(plan.from, plan.to);
      moved = true;
    } catch (error) {
      return {
        ok: false,
        error: `rename failed: ${error?.message ?? String(error)}`,
      };
    }
  }

  if (!moved) {
    return { ok: false, error: "nothing moved" };
  }

  if (logPath) {
    try {
      appendFileSync(
        logPath,
        `${JSON.stringify({
          at: new Date().toISOString(),
          event: "ticket-move",
          who,
          from: plan.relative.from,
          to: plan.relative.to,
          via: plan.useGit ? "git mv" : "rename",
        })}\n`,
      );
    } catch {
      // A logging failure must not undo a move that happened.
    }
  }

  return {
    ok: true,
    detail: `moved ${plan.relative.from} -> ${plan.relative.to}`,
  };
};
