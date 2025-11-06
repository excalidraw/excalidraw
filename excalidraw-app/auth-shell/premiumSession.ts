import type { AuthShellConfig } from "./config";

export interface PremiumSession {
  userId: string;
  premium: boolean;
  accessToken?: string;
  expiresAt?: string;
  subscription?: {
    status: string;
    planId?: string;
    variantId?: string;
    renewsAt?: string;
    endsAt?: string;
  };
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

export function hasActiveSubscription(session: PremiumSession | null): boolean {
  return session?.subscription?.status === "active";
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

  const response = await fetch(`${config.apiBaseUrl}${config.sessionEndpoint}`, {
    method: "GET",
    headers,
    credentials: "include",
    signal: options.signal,
  });

  // 401 Unauthorized or 404 Not Found = no active subscription
  if (response.status === 401 || response.status === 404) {
    return null;
  }

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Session request failed (${response.status}): ${body || response.statusText}`,
    );
  }

  try {
    const payload = JSON.parse(body) as PremiumSession;
    return payload;
  } catch {
    throw new Error(
      "Session response was not valid JSON. Check your API base URL configuration.",
    );
  }
}
