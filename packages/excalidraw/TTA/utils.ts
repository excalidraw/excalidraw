import { AI_ERRORS, type AI_ERROR_CODE } from "./types";

export const AI_CLIENT_ERRORS = {
  INVALID_RESULT: 1001,
} as const;

type AIChatError = {
  code?: AI_ERROR_CODE | number;
  message?: string;
};

export const isLikelyConnectionError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnrefused") ||
    normalized.includes("connection refused") ||
    normalized.includes("err_connection_refused")
  );
};

export const isLikelyServerUnavailableError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("econnrefused") ||
    normalized.includes("connection refused") ||
    normalized.includes("err_connection_refused") ||
    normalized.includes("service unavailable") ||
    normalized.includes("bad gateway")
  );
};

export const getAIErrorMessageKey = (
  error: AIChatError,
  opts?: { isOffline?: boolean },
) => {
  const rawMessage = error.message?.trim() || "";

  if (error.code === AI_ERRORS.RATE_LIMIT.code) {
    return "ai.chat.errors.rateLimit";
  }
  if (
    error.code === AI_CLIENT_ERRORS.INVALID_RESULT ||
    error.code === AI_ERRORS.GENERATION_ERROR.code
  ) {
    return "ai.chat.errors.invalidResult";
  }
  if (
    error.code === AI_ERRORS.SERVER_ERROR.code ||
    (typeof error.code === "number" && error.code >= 500) ||
    isLikelyServerUnavailableError(rawMessage)
  ) {
    return "ai.chat.errors.serverUnavailable";
  }
  if (opts?.isOffline) {
    return "ai.chat.errors.offline";
  }
  if (isLikelyConnectionError(rawMessage)) {
    return "ai.chat.errors.connection";
  }
  return "ai.chat.errors.requestFailed";
};
