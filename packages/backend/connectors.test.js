const { buildDiagramIR } = require("./diagram-ir");
const {
  REGISTRY,
  getRenderer,
  listRenderers,
} = require("./connectors");
const {
  RendererNotImplementedError,
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
  it("exposes excalidraw and tldraw with the connector contract", () => {
    const list = listRenderers();
    const ids = list.map((r) => r.id);
    expect(ids).toContain("excalidraw");
    expect(ids).toContain("tldraw");

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

  it("tldraw connector throws RendererNotImplementedError (501 signal)", async () => {
    const ir = buildDiagramIR(makeNodes());
    const renderer = getRenderer("tldraw");
    await expect(renderer.render({ nodes: {}, ir })).rejects.toBeInstanceOf(
      RendererNotImplementedError,
    );
  });
});
