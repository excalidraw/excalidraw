import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { terraformPlanParsing } from "./terraformPlanParsing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TERRAFORM_ROOT = path.resolve(__dirname, "../../backend/terraform");
const MANIFEST_PATH = path.join(TERRAFORM_ROOT, "fixtures/manifest.json");
const CORPUS_DIR = path.join(TERRAFORM_ROOT, ".corpus");

const CORPUS_FULL = process.env.CORPUS_FULL === "1";

function textFileLike(content: string, name = "fixture"): File {
  return {
    name,
    async text() {
      return content;
    },
  } as unknown as File;
}

function loadManifestCases() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return [];
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as {
    cases: Array<{ id: string; title: string }>;
  };
  return manifest.cases.filter((c) =>
    fs.existsSync(path.join(CORPUS_DIR, c.id, "plan.json")),
  );
}

const corpusCases = loadManifestCases();

describe.skipIf(!CORPUS_FULL || corpusCases.length === 0)(
  "terraform corpus fixtures (CORPUS_FULL=1)",
  () => {
    it.each(corpusCases.map((c) => [c.id, c.title, c] as const))(
      "%s: %s imports without throwing",
      async (_id, _title, testCase) => {
        const caseDir = path.join(CORPUS_DIR, testCase.id);
        const planText = fs.readFileSync(
          path.join(caseDir, "plan.json"),
          "utf8",
        );
        const dotText = fs.readFileSync(
          path.join(caseDir, "graph.dot"),
          "utf8",
        );

        const res = await terraformPlanParsing(
          textFileLike(planText, `${testCase.id}.json`),
          textFileLike(dotText, `${testCase.id}.dot`),
          null,
          {},
        );

        expect(res.ok).toBe(true);
        const body = await res.json();
        expect(body.type).toBe("excalidraw");
        expect(body.elements.length).toBeGreaterThan(0);
      },
      120_000,
    );
  },
);

describe("terraform corpus manifest", () => {
  it("has 100 recipes defined", () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    expect(manifest.cases).toHaveLength(100);
  });
});
