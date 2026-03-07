export class ToolError extends Error {
  code: string;
  hint?: string;

  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.hint = hint;
  }
}

export const asToolError = (error: unknown): ToolError => {
  if (error instanceof ToolError) {
    return error;
  }

  if (error instanceof Error) {
    return new ToolError("INTERNAL_ERROR", error.message);
  }

  return new ToolError("INTERNAL_ERROR", "Unknown error");
};
