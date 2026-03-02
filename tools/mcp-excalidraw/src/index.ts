import process from "node:process";

import { asToolError } from "./lib/errors";
import { SceneStore } from "./lib/sceneStore";
import { createToolRegistry } from "./tools/sceneTools";

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const SERVER_NAME = "excalidraw-local-mcp";
const SERVER_VERSION = "0.1.0";
const FALLBACK_PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_ROOT = "/home/diplov/excalidraw/excalidraw-app";

const selectedRoot = process.env.EXCALIDRAW_MCP_ROOT || DEFAULT_ROOT;
const store = new SceneStore(selectedRoot);
const registry = createToolRegistry(store);

const writeResponse = (payload: JsonRpcResponse): void => {
  const serialized = JSON.stringify(payload);
  const headers = `Content-Length: ${Buffer.byteLength(
    serialized,
    "utf8",
  )}\r\n\r\n`;
  process.stdout.write(headers);
  process.stdout.write(serialized);
};

const writeError = (
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): void => {
  writeResponse({
    jsonrpc: "2.0",
    id,
    error: { code, message, data },
  });
};

const asTextToolResult = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});

const asTextToolError = (error: unknown) => {
  const parsed = asToolError(error);
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: parsed.hint
          ? `${parsed.message}\nHint: ${parsed.hint}`
          : parsed.message,
      },
    ],
    structuredContent: {
      error: {
        code: parsed.code,
        message: parsed.message,
        hint: parsed.hint ?? null,
      },
    },
  };
};

const handleRequest = async (request: JsonRpcRequest): Promise<void> => {
  if (request.jsonrpc !== "2.0") {
    writeError(request.id ?? null, -32600, "Invalid Request");
    return;
  }

  if (!request.method) {
    writeError(request.id ?? null, -32600, "Missing method");
    return;
  }

  // Notifications do not have an id and should not get a response.
  const isNotification = request.id === undefined;

  try {
    if (request.method === "initialize") {
      if (isNotification) {
        return;
      }
      const params =
        typeof request.params === "object" && request.params !== null
          ? (request.params as Record<string, unknown>)
          : {};
      const protocolVersion =
        typeof params.protocolVersion === "string"
          ? params.protocolVersion
          : FALLBACK_PROTOCOL_VERSION;
      writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          protocolVersion,
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
          instructions:
            "Use scene.* tools to manage .excalidraw files under EXCALIDRAW_MCP_ROOT.",
        },
      });
      return;
    }

    if (request.method === "notifications/initialized") {
      return;
    }

    if (request.method === "ping") {
      if (isNotification) {
        return;
      }
      writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {},
      });
      return;
    }

    if (request.method === "tools/list") {
      if (isNotification) {
        return;
      }
      writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          tools: registry.list(),
        },
      });
      return;
    }

    if (request.method === "tools/call") {
      if (isNotification) {
        return;
      }
      const params =
        typeof request.params === "object" && request.params !== null
          ? (request.params as Record<string, unknown>)
          : null;

      if (!params || typeof params.name !== "string") {
        writeError(request.id ?? null, -32602, "Invalid params: missing tool name");
        return;
      }

      try {
        const result = await registry.call(params.name, params.arguments);
        writeResponse({
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: asTextToolResult(result),
        });
      } catch (error) {
        writeResponse({
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: asTextToolError(error),
        });
      }
      return;
    }

    if (!isNotification) {
      writeError(request.id ?? null, -32601, `Method not found: ${request.method}`);
    }
  } catch (error) {
    if (!isNotification) {
      const parsed = asToolError(error);
      writeError(request.id ?? null, -32000, parsed.message, {
        code: parsed.code,
        hint: parsed.hint ?? null,
      });
    }
  }
};

let frameBuffer = Buffer.alloc(0);

const parseFrames = (input: Buffer): string[] => {
  frameBuffer = Buffer.concat([frameBuffer, input]);
  const messages: string[] = [];

  while (true) {
    const headerEnd = frameBuffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      break;
    }

    const headerText = frameBuffer.slice(0, headerEnd).toString("utf8");
    const contentLengthHeader = headerText
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-length:"));

    if (!contentLengthHeader) {
      throw new Error("Missing Content-Length header");
    }

    const rawLength = contentLengthHeader.split(":")[1]?.trim();
    const contentLength = rawLength ? Number.parseInt(rawLength, 10) : NaN;
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw new Error("Invalid Content-Length value");
    }

    const totalLength = headerEnd + 4 + contentLength;
    if (frameBuffer.length < totalLength) {
      break;
    }

    const body = frameBuffer.slice(headerEnd + 4, totalLength).toString("utf8");
    frameBuffer = frameBuffer.slice(totalLength);
    messages.push(body);
  }

  return messages;
};

process.stdin.on("data", async (chunk: Buffer) => {
  try {
    const bodies = parseFrames(chunk);
    for (const body of bodies) {
      const request = JSON.parse(body) as JsonRpcRequest;
      await handleRequest(request);
    }
  } catch (error) {
    const parsed = asToolError(error);
    process.stderr.write(
      `[${SERVER_NAME}] Protocol error: ${parsed.message}\n`,
    );
  }
});

process.stdin.on("error", (error) => {
  process.stderr.write(`[${SERVER_NAME}] stdin error: ${error.message}\n`);
});

process.stdout.on("error", (error) => {
  process.stderr.write(`[${SERVER_NAME}] stdout error: ${error.message}\n`);
});

process.stderr.write(
  `[${SERVER_NAME}] Ready. root=${selectedRoot}\n`,
);
