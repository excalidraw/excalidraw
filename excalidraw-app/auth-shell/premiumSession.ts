import type { AuthShellConfig } from "./config";

export interface PremiumSession {
  userId: string;
  premium: boolean;
  accessToken?: string;
  expiresAt?: string;
}

export interface SessionFetchOptions {
  getToken?: () => Promise<string | null>;
  signal?: AbortSignal;
}

function getCookieEntries(): string[] {
  return document.cookie.split(";").map((entry) => entry.trim());
}

export function hasPremiumCookie(config: AuthShellConfig): boolean {
  if (!config.premiumCookieName) {
    return false;
  }

  return getCookieEntries().some((entry) =>
    entry.startsWith(`${config.premiumCookieName}=`),
  );
}

export function setPremiumCookie(
  config: AuthShellConfig,
  enabled: boolean,
): void {
  if (!config.premiumCookieName) {
    return;
  }

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  const cookieName = config.premiumCookieName;

  if (enabled) {
    const maxAgeSeconds = 60 * 60 * 24;
    document.cookie = `${cookieName}=1; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
  } else {
    document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`;
  }
}

export async function fetchPremiumSession(
  config: AuthShellConfig,
  options: SessionFetchOptions = {},
): Promise<PremiumSession | null> {
  if (!config.apiBaseUrl) {
    return null;
  }

  const headers: HeadersInit = {};

  if (options.getToken) {
    const token = await options.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(
    `${config.apiBaseUrl}${config.sessionEndpoint}`,
    {
      method: "GET",
      headers,
      credentials: "include",
      signal: options.signal,
    },
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Session request failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const payload = (await response.json()) as PremiumSession;
  return payload;
}
