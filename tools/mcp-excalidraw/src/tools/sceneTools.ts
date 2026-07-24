import { asToolError, ToolError } from "../lib/errors";
import { SceneStore } from "../lib/sceneStore";

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown) => Promise<unknown>;
}

const asObject = (value: unknown): Record<string, unknown> => {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("INVALID_PARAMS", "Tool arguments must be an object");
  }
  return value as Record<string, unknown>;
};

export const createSceneTools = (store: SceneStore): ToolDefinition[] => {
  const tools: ToolDefinition[] = [
    {
      name: "scene.list",
      description: "List .excalidraw files under the configured root directory",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          baseDir: {
            type: "string",
            description: "Optional subdirectory to list from",
          },
          recursive: {
            type: "boolean",
            description: "Whether to walk directories recursively",
          },
        },
      },
      run: async (args) => store.list(asObject(args)),
    },
    {
      name: "scene.get",
      description: "Read and validate a .excalidraw scene file",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: {
          path: { type: "string" },
        },
      },
      run: async (args) => store.get(asObject(args)),
    },
    {
      name: "scene.create",
      description: "Create a .excalidraw scene file",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: {
          path: { type: "string" },
          scene: {
            type: "object",
            description: "Optional full scene object. Defaults to empty scene.",
          },
          overwrite: { type: "boolean" },
        },
      },
      run: async (args) => store.create(asObject(args)),
    },
    {
      name: "scene.update",
      description: "Apply a top-level patch to a .excalidraw scene",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path", "patch"],
        properties: {
          path: { type: "string" },
          patch: { type: "object" },
        },
      },
      run: async (args) => store.update(asObject(args)),
    },
    {
      name: "scene.delete",
      description:
        "Delete a .excalidraw scene file (requires confirm=true)",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path", "confirm"],
        properties: {
          path: { type: "string" },
          confirm: { type: "boolean" },
        },
      },
      run: async (args) => store.delete(asObject(args)),
    },
    {
      name: "scene.export",
      description:
        "Export scene content as JSON or SVG (SVG may be unavailable in this build)",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["path", "format"],
        properties: {
          path: { type: "string" },
          format: { type: "string", enum: ["json", "svg"] },
          outputPath: { type: "string" },
        },
      },
      run: async (args) => store.export(asObject(args)),
    },
  ];

  return tools;
};

export const createToolRegistry = (store: SceneStore) => {
  const tools = createSceneTools(store);
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  const call = async (name: string, args: unknown) => {
    const tool = byName.get(name);
    if (!tool) {
      throw new ToolError("UNKNOWN_TOOL", `Unknown tool: ${name}`);
    }
    try {
      return await tool.run(args);
    } catch (error) {
      throw asToolError(error);
    }
  };

  const list = () =>
    tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

  return { call, list };
};
