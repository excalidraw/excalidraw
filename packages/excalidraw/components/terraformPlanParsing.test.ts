import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { terraformPlanParsing } from "./terraformPlanParsing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE_DIR = path.resolve(__dirname, "../../backend/terraform");
const PLAN_FIXTURE = path.join(FIXTURE_DIR, "allplanmodules.json");
const DOT_FIXTURE = path.join(FIXTURE_DIR, "allplanmodules.dot");

/** Minimal `File` stand-in: Vitest’s jsdom `File` / `Blob` may omit `.text()`. */
function textFileLike(contents: string): File {
  return {
    text: async () => contents,
  } as File;
}

describe("terraformPlanParsing", () => {
  beforeAll(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it(
    "runs full local pipeline on allplanmodules fixtures without throwing",
    async () => {
      const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
      const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

      const res = await terraformPlanParsing(
        textFileLike(planText),
        textFileLike(dotText),
        null,
      );

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");

      const body = await res.json();
      expect(body.type).toBe("excalidraw");
      expect(body.version).toBe(2);
      expect(body.source).toBe("terraform-local-parse");
      expect(Array.isArray(body.elements)).toBe(true);
      expect(body.appState).toMatchObject({
        viewBackgroundColor: "#ffffff",
        gridSize: null,
      });
    },
    60_000,
  );
});
