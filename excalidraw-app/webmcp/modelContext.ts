export type WebMcpExecutionOptions = {
  signal: AbortSignal;
};

export type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    consequentialHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    options?: WebMcpExecutionOptions,
  ) => unknown | Promise<unknown>;
};

export type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
};

export type WebMcpDocument = Document & {
  modelContext?: WebMcpModelContext;
};
