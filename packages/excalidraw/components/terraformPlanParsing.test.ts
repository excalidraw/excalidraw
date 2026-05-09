import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildTerraformModuleTree, terraformPlanParsing } from "./terraformPlanParsing";

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

describe("buildTerraformModuleTree", () => {
  it("places root resources under path root and nests module resources", () => {
    const nodes = {
      "aws_s3_bucket.root": {
        resources: {
          "aws_s3_bucket.root": { address: "aws_s3_bucket.root" },
        },
      },
      "module.network.aws_vpc.main": {
        resources: {
          "module.network.aws_vpc.main": { address: "module.network.aws_vpc.main" },
        },
      },
      "module.network.module.sub.aws_subnet.a": {
        resources: {
          "module.network.module.sub.aws_subnet.a": {
            address: "module.network.module.sub.aws_subnet.a",
          },
        },
      },
    };

    const tree = buildTerraformModuleTree(nodes);

    expect(tree.path).toBe("root");
    expect(tree.resourceAddresses).toEqual(["aws_s3_bucket.root"]);
    expect(Object.keys(tree.modules)).toEqual(["module.network"]);

    const net = tree.modules["module.network"];
    expect(net.resourceAddresses).toEqual(["module.network.aws_vpc.main"]);
    expect(Object.keys(net.modules)).toEqual(["module.network.module.sub"]);

    const sub = net.modules["module.network.module.sub"];
    expect(sub.resourceAddresses).toEqual(["module.network.module.sub.aws_subnet.a"]);
    expect(sub.modules).toEqual({});
  });

  it("ignores reserved __ keys on the nodes map", () => {
    const nodes = {
      "aws_instance.a": {
        resources: { "aws_instance.a": { address: "aws_instance.a" } },
      },
    };
    const map = { ...nodes } as Record<string, (typeof nodes)["aws_instance.a"]> & {
      __other__?: unknown;
    };
    map.__other__ = { misc: true };

    const tree = buildTerraformModuleTree(map as Parameters<typeof buildTerraformModuleTree>[0]);
    expect(tree.resourceAddresses).toEqual(["aws_instance.a"]);
  });
});

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
