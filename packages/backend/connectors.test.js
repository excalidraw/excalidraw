const { buildDiagramIR } = require("./diagram-ir");
const {
  REGISTRY,
  getRenderer,
  listRenderers,
} = require("./connectors");
const {
  UnknownRendererError,
} = require("./connectors/errors");

function makeNodes() {
  return {
    "aws_lambda_function.worker": {
      resources: {
        "aws_lambda_function.worker": {
          address: "aws_lambda_function.worker",
          type: "aws_lambda_function",
          name: "worker",
          change: { actions: ["create"] },
        },
      },
      edges_new: ["aws_iam_role.worker"],
      edges_existing: [],
      edges_data_flow: [],
    },
    "aws_iam_role.worker": {
      resources: {
        "aws_iam_role.worker": {
          address: "aws_iam_role.worker",
          type: "aws_iam_role",
          name: "worker",
          change: { actions: ["no-op"] },
        },
      },
      edges_new: [],
      edges_existing: [],
      edges_data_flow: [],
    },
  };
}

describe("DiagramIR", () => {
  it("builds a renderer-neutral IR from a nodes map", () => {
    const ir = buildDiagramIR(makeNodes());

    expect(ir.version).toBe(1);
    expect(ir.metadata.nodeCount).toBe(2);
    expect(ir.nodes.map((n) => n.id).sort()).toEqual([
      "aws_iam_role.worker",
      "aws_lambda_function.worker",
    ]);

    const lambda = ir.nodes.find(
      (n) => n.id === "aws_lambda_function.worker",
    );
    expect(lambda).toMatchObject({
      kind: "resource",
      provider: "aws",
      resourceType: "aws_lambda_function",
      action: "create",
    });

    expect(ir.edges.length).toBeGreaterThanOrEqual(1);
    const dep = ir.edges.find((e) => e.kind === "dependency");
    expect(dep).toMatchObject({
      source: "aws_lambda_function.worker",
      target: "aws_iam_role.worker",
      directed: true,
    });
  });

  it("ignores keys starting with __ (pipeline metadata)", () => {
    const nodes = makeNodes();
    nodes.__networkingFacetStore = { foo: "bar" };
    const ir = buildDiagramIR(nodes);
    expect(ir.nodes.find((n) => n.id.startsWith("__"))).toBeUndefined();
  });
});

describe("Connector registry", () => {
  it("exposes excalidraw, tldraw and reactflow with the connector contract", () => {
    const list = listRenderers();
    const ids = list.map((r) => r.id);
    expect(ids).toContain("excalidraw");
    expect(ids).toContain("tldraw");
    expect(ids).toContain("reactflow");

    for (const id of Object.keys(REGISTRY)) {
      const renderer = REGISTRY[id];
      expect(typeof renderer.id).toBe("string");
      expect(typeof renderer.label).toBe("string");
      expect(typeof renderer.contentType).toBe("string");
      expect(typeof renderer.fileExtension).toBe("string");
      expect(typeof renderer.render).toBe("function");
    }
  });

  it("getRenderer throws UnknownRendererError for unknown ids", () => {
    expect(() => getRenderer("nope")).toThrow(UnknownRendererError);
  });

  it("excalidraw connector renders a scene through the registry", async () => {
    const nodes = makeNodes();
    const ir = buildDiagramIR(nodes);
    const renderer = getRenderer("excalidraw");
    const result = await renderer.render({ nodes, ir, options: {} });
    expect(result.contentType).toBe("application/json");
    expect(result.fileExtension).toBe("excalidraw");
    expect(result.body.type).toBe("excalidraw");
    expect(Array.isArray(result.body.elements)).toBe(true);
  });

  it("tldraw connector renders a tldraw shape document", async () => {
    const nodes = makeNodes();
    const ir = buildDiagramIR(nodes);
    const renderer = getRenderer("tldraw");
    const result = await renderer.render({ nodes, ir, options: {} });
    expect(result.contentType).toBe("application/json");
    expect(result.fileExtension).toBe("tldr.json");
    expect(result.body.type).toBe("tldraw");
    expect(Array.isArray(result.body.shapes)).toBe(true);
    expect(result.body.shapes.length).toBeGreaterThan(0);

    const resource = result.body.shapes.find(
      (shape) =>
        shape.type === "geo" &&
        shape.meta &&
        shape.meta.terraformVisibilityRole === "resource" &&
        shape.meta.terraformVisibilityKey,
    );
    expect(resource).toBeTruthy();
  });

  it("reactflow connector renders grouped subflow JSON", async () => {
    const nodes = makeNodes();
    const ir = buildDiagramIR(nodes);
    const renderer = getRenderer("reactflow");
    const result = await renderer.render({ nodes, ir, options: {} });
    expect(result.contentType).toBe("application/json");
    expect(result.fileExtension).toBe("reactflow.json");
    expect(result.body.type).toBe("reactflow");
    expect(Array.isArray(result.body.nodes)).toBe(true);
    expect(Array.isArray(result.body.edges)).toBe(true);
    expect(result.body.meta.edgePolicy).toBe("intra-module-only");
  });

  it("reactflow connector avoids duplicate ids from module group nodes", async () => {
    const renderer = getRenderer("reactflow");
    const ir = {
      version: 1,
      source: "test",
      metadata: { nodeCount: 2, edgeCount: 1, generatedAt: new Date().toISOString() },
      nodes: [
        {
          id: "module.foo",
          kind: "module",
          label: "module.foo",
          resourceType: "terraform_module",
          provider: null,
          action: null,
          modulePath: ["module.foo"],
        },
        {
          id: "module.foo.aws_s3_bucket.bar",
          kind: "resource",
          label: "bucket",
          resourceType: "aws_s3_bucket",
          provider: "aws",
          action: "create",
          modulePath: ["module.foo"],
        },
      ],
      edges: [
        {
          id: "dep_0",
          source: "module.foo.aws_s3_bucket.bar",
          target: "module.foo",
          kind: "dependency",
          directed: true,
        },
      ],
      groups: [
        {
          id: "module.foo",
          type: "module",
          label: "module.foo",
          parentId: null,
          childIds: ["module.foo.aws_s3_bucket.bar"],
        },
      ],
    };

    const result = await renderer.render({ nodes: {}, ir, options: {} });
    const ids = result.body.nodes.map((node) => node.id);
    const duplicateIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    expect(duplicateIds).toEqual([]);
    expect(
      result.body.nodes.some(
        (node) => node.id === "module.foo" && node.type === "group",
      ),
    ).toBe(true);
    expect(
      result.body.nodes.some(
        (node) => node.id === "module.foo" && node.type !== "group",
      ),
    ).toBe(false);
  });

  it("tldraw connector preserves soft-hidden terraform arrows for explode flows", async () => {
    const hiddenTerraformArrow = {
      id: "hidden-arrow",
      type: "arrow",
      x: 0,
      y: 0,
      points: [
        [0, 0],
        [80, 0],
      ],
      strokeColor: "#1e1e1e",
      strokeWidth: 2,
      isDeleted: true,
      customData: {
        terraform: true,
        terraformEdgeLayer: "dependency",
        relationship: {
          source: "aws_lambda_function.worker",
          target: "aws_iam_role.worker",
          type: "dependency",
          label: "depends on",
        },
      },
    };

    const {
      excalidrawSceneToTldrawShapes,
    } = require("./connectors/excalidraw-to-tldraw");
    const converted = excalidrawSceneToTldrawShapes({
      type: "excalidraw",
      elements: [hiddenTerraformArrow],
    });

    expect(converted.shapes.length).toBe(1);
    expect(converted.shapes[0].type).toBe("arrow");
    expect(converted.shapes[0].meta?.terraformEdgeLayer).toBe("dependency");
  });
});
