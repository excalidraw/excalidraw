export interface RawAuthShellConfig {
  enabled?: string | boolean;
  publishableKey?: string;
  redirectUrl?: string;
  apiBaseUrl?: string;
  sessionEndpoint?: string;
  premiumCookieName?: string;
}

export interface AuthShellConfig {
  enabled: boolean;
  publishableKey?: string;
  redirectUrl: string;
  apiBaseUrl: string;
  sessionEndpoint: string;
  premiumCookieName: string;
}

declare global {
  interface Window {
    __CANVAS_CONFIG__?: {
      authShell?: RawAuthShellConfig;
    };
  }
}

const DEFAULTS: AuthShellConfig = {
  enabled: false,
  publishableKey: undefined,
  redirectUrl: typeof window !== "undefined" ? window.location.origin : "/",
  apiBaseUrl: "",
  sessionEndpoint: "/session",
  premiumCookieName: "embplus-auth",
};

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }

  return false;
}

function ensureLeadingSlash(endpoint: string): string {
  if (!endpoint) {
    return "/session";
  }

  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

function stripTrailingSlash(value: string): string {
  if (!value) {
    return value;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function sanitizeRedirectUrl(value: string | undefined): string {
  if (value && value.trim()) {
    return value.trim();
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "/";
}

function readEnvConfig(): RawAuthShellConfig {
  if (typeof import.meta !== "object" || !import.meta?.env) {
    return {};
  }

  const env = import.meta.env;

  return {
    enabled: env.VITE_CANVAS_AUTH_ENABLED,
    publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
    redirectUrl: env.VITE_CANVAS_APP_URL,
    apiBaseUrl: env.VITE_APP_API_URL,
    sessionEndpoint: env.VITE_SESSION_ENDPOINT,
    premiumCookieName: env.VITE_PREMIUM_COOKIE_NAME,
  };
}

export function getAuthShellConfig(): AuthShellConfig {
  const rawConfig: RawAuthShellConfig = {
    ...readEnvConfig(),
    ...(window.__CANVAS_CONFIG__?.authShell ?? {}),
  };

  const enabled = parseBoolean(rawConfig.enabled);
  const publishableKey = rawConfig.publishableKey?.trim();

  if (enabled && !publishableKey) {
    console.warn(
      "[AuthShell] Enabled but missing Clerk publishable key. Disabling gate.",
    );
  }

  const apiBaseUrl = stripTrailingSlash(rawConfig.apiBaseUrl?.trim() ?? "");
  const sessionEndpoint = ensureLeadingSlash(
    rawConfig.sessionEndpoint?.trim() ?? DEFAULTS.sessionEndpoint,
  );
  const premiumCookieName =
    rawConfig.premiumCookieName?.trim() ?? DEFAULTS.premiumCookieName;

  return {
    enabled: enabled && Boolean(publishableKey),
    publishableKey,
    redirectUrl: sanitizeRedirectUrl(rawConfig.redirectUrl),
    apiBaseUrl,
    sessionEndpoint,
    premiumCookieName,
  };
}
