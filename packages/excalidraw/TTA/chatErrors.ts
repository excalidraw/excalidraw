import type { AI_ERROR_CODE } from "./types";

export type AIChatRuntimeError = Error & {
  code?: AI_ERROR_CODE | number;
  handled?: boolean;
  cause?: unknown;
};

export const withAIChatErrorMeta = (
  error: Error,
  options?: {
    code?: AI_ERROR_CODE | number;
    handled?: boolean;
    cause?: unknown;
  },
): AIChatRuntimeError => {
  const runtimeError = error as AIChatRuntimeError;
  if (options && "code" in options && typeof options.code === "number") {
    runtimeError.code = options.code;
  }
  if (options && "handled" in options && typeof options.handled === "boolean") {
    runtimeError.handled = options.handled;
  }
  if (options && "cause" in options) {
    runtimeError.cause = options.cause;
  }
  return runtimeError;
};

export const getAIChatErrorCode = (
  error: unknown,
): AI_ERROR_CODE | number | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "number" ? maybeCode : undefined;
};

export const isAIChatErrorHandled = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { handled?: unknown }).handled === true;
};
