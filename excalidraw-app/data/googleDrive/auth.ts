/**
 * Client-side Google OAuth using Google Identity Services (GIS).
 *
 * This uses the OAuth 2.0 *token model* for public (browser) clients: there is
 * no client secret, and access tokens live in memory only (~1h). A fresh
 * consent/silent refresh is requested whenever the token is missing/expired.
 */
import { loadScript } from "./utils";

const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 * Least-privilege scope: the app can only see files it created, or files the
 * user explicitly picked via the Google Picker.
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

type TokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
};

export const getGoogleClientId = () =>
  (import.meta.env.VITE_APP_GOOGLE_CLIENT_ID || "").trim();

export const getGoogleApiKey = () =>
  (import.meta.env.VITE_APP_GOOGLE_API_KEY || "").trim();

export const getGoogleAppId = () =>
  (import.meta.env.VITE_APP_GOOGLE_APP_ID || "").trim();

export const isGoogleDriveConfigured = () =>
  !!getGoogleClientId() && !!getGoogleApiKey() && !!getGoogleAppId();

export class GoogleDriveAuth {
  private ownerDocument: Document;

  private ownerWindow: Window & typeof globalThis;

  private tokenClient: TokenClient | null = null;

  private accessToken: string | null = null;

  private expiresAt = 0;

  private pending: {
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(
    ownerDocument: Document,
    ownerWindow: Window & typeof globalThis,
  ) {
    this.ownerDocument = ownerDocument;
    this.ownerWindow = ownerWindow;
  }

  private isTokenValid() {
    return !!this.accessToken && Date.now() < this.expiresAt;
  }

  private async ensureTokenClient() {
    if (this.tokenClient) {
      return;
    }

    const clientId = getGoogleClientId();
    if (!clientId) {
      throw new Error("Google Drive is not configured");
    }

    await loadScript(this.ownerDocument, GIS_SRC);

    const google = (this.ownerWindow as any).google;
    if (!google?.accounts?.oauth2) {
      throw new Error("Google Identity Services failed to load");
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response: TokenResponse) => {
        const pending = this.pending;
        this.pending = null;
        if (!pending) {
          return;
        }
        if (response.error || !response.access_token) {
          pending.reject(new Error(response.error || "Authorization failed"));
          return;
        }
        this.accessToken = response.access_token;
        this.expiresAt =
          Date.now() +
          (response.expires_in ?? 3600) * 1000 -
          TOKEN_EXPIRY_BUFFER_MS;
        pending.resolve(response.access_token);
      },
      error_callback: (error: { message?: string }) => {
        const pending = this.pending;
        this.pending = null;
        pending?.reject(new Error(error?.message || "Authorization failed"));
      },
    });
  }

  /**
   * Requests an access token. Silent when the user already granted access
   * (`prompt: ""`), showing the consent flow when they haven't.
   */
  requestAccessToken = async (
    prompt: "" | "consent" | "select_account" = "",
  ): Promise<string> => {
    await this.ensureTokenClient();
    if (this.isTokenValid()) {
      return this.accessToken!;
    }

    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.tokenClient!.requestAccessToken({ prompt });
    });
  };

  /**
   * Pre-loads the Google Identity Services script and initializes the token
   * client. OAuth token requests must run while a user gesture is active, so
   * warming this up ahead of time avoids losing the gesture to a script-load
   * delay (which makes the auth popup open without activation and close).
   */
  prepare = () => this.ensureTokenClient();

  getToken = async (): Promise<string> => {
    if (this.isTokenValid()) {
      return this.accessToken!;
    }
    return this.requestAccessToken("");
  };

  revoke = () => {
    const token = this.accessToken;
    this.accessToken = null;
    this.expiresAt = 0;
    if (token) {
      const google = (this.ownerWindow as any).google;
      google?.accounts?.oauth2?.revoke(token);
    }
  };
}

let auth: GoogleDriveAuth | null = null;

/**
 * Returns a process-wide auth instance. Access tokens are memory-only, so a
 * single instance keeps the token alive for the session without persisting it.
 */
export const getGoogleDriveAuth = (
  ownerDocument: Document,
  ownerWindow: Window & typeof globalThis,
) => {
  if (!auth) {
    auth = new GoogleDriveAuth(ownerDocument, ownerWindow);
  }
  return auth;
};
