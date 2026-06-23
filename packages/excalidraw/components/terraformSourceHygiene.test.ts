/**
 * Source-encoding hygiene guard (RFC §30 — "Source-encoding discipline").
 *
 * The terraform layout code joins composite keys with control-character
 * delimiters written as ESCAPES: NUL as the two-character escape backslash-zero
 * (e.g. [a, b].join(...) / template literals), and the secondary delimiter as
 * the unicode escape for 0x01. A handful of RCLL files had once embedded the
 * RAW control byte (0x00 / 0x01) into the string literal instead. That is valid
 * JS and the runtime string is identical, but the file then reads as **binary**
 * to grep / git diff / file(1): tooling skips it and agents cannot search it
 * (the exact failure that motivated this guard).
 *
 * This test fails if any terraform source carries a raw C0 control byte (other
 * than the legitimate whitespace TAB / LF / CR), so the regression cannot recur.
 * Fix any failure by replacing the raw byte with its escape (NUL and 0x01 both
 * have escape forms) — byte-identical runtime string, plain-text file.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sourceDir = dirname(fileURLToPath(import.meta.url));

// C0 control bytes that must never appear LITERALLY in a TS source — every byte
// in 0x00–0x1f except the legitimate whitespace TAB (0x09), LF (0x0a), CR (0x0d).
const FORBIDDEN = new Set<number>();
for (let b = 0x00; b <= 0x1f; b++) {
  if (b !== 0x09 && b !== 0x0a && b !== 0x0d) {
    FORBIDDEN.add(b);
  }
}

describe("terraform source-encoding hygiene (RFC §30)", () => {
  it("no terraform*.{ts,tsx} embeds a raw control byte (use the escape, never a literal NUL)", () => {
    const files = readdirSync(sourceDir).filter(
      (f) =>
        f.startsWith("terraform") && (f.endsWith(".ts") || f.endsWith(".tsx")),
    );
    // Sanity: the glob must actually match this subsystem, else the guard is vacuous.
    expect(files.length).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const file of files) {
      const bytes = readFileSync(join(sourceDir, file));
      let count = 0;
      let firstOffset = -1;
      for (let i = 0; i < bytes.length; i++) {
        if (FORBIDDEN.has(bytes[i]!)) {
          count += 1;
          if (firstOffset < 0) {
            firstOffset = i;
          }
        }
      }
      if (count > 0) {
        offenders.push(
          `${file}: ${count} raw control byte(s), first at offset ${firstOffset}`,
        );
      }
    }

    expect(
      offenders,
      `${
        "Raw control bytes make a source file read as binary to grep/diff/file. " +
        "Replace each with its escape sequence (a NUL/0x01 escape is byte-clean):\n  "
      }${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
