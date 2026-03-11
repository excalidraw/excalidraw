/**
 * Luzmo Configuration
 *
 * This file contains the authentication configuration for Luzmo charts.
 * These credentials are used to authenticate with the Luzmo API for
 * rendering charts and fetching dataset metadata.
 *
 * HOW TO CONFIGURE:
 * 1. Get your embed authorization credentials from your Luzmo account
 *    - Go to Luzmo Dashboard > Settings > Embed Authorization
 *    - Create a new authorization or use an existing one
 *
 * 2. For production, generate auth tokens server-side using the Luzmo API:
 *    - Use the Authorization API: https://developer.luzmo.com/api/authorization
 *    - Tokens should be short-lived and generated per user session
 *
 * 3. Set the values below with your credentials
 *
 * SECURITY NOTE:
 * - Never commit real credentials to version control
 * - For production, use environment variables or a secure secrets manager
 * - Auth tokens should be generated server-side with appropriate expiration
 *
 * @see https://developer.luzmo.com/guide/flex--introduction
 * @see https://developer.luzmo.com/api/authorization
 */

export interface LuzmoAuthConfig {
  /**
   * The authentication key from your Luzmo embed authorization
   * This identifies your integration
   */
  authKey: string;

  /**
   * The authentication token for API access
   * Should be generated server-side for production use
   */
  authToken: string;

  /**
   * The Luzmo app server URL
   * @default "https://app.luzmo.com/"
   */
  appServer?: string;

  /**
   * The Luzmo API host URL
   * @default "https://api.luzmo.com/"
   */
  apiHost?: string;

  /**
   * The dataset IDs to use for the chart
   * @default []
   */
  datasetIds: string[];
}

/**
 * Default Luzmo authentication configuration
 *
 * Replace these placeholder values with your actual credentials.
 * For development, you can hardcode values here.
 * For production, load from environment variables.
 */
export const LUZMO_AUTH_CONFIG: LuzmoAuthConfig = {
  // TODO: Replace with your Luzmo embed authorization key
  // Get this from: Luzmo Dashboard > Settings > Embed Authorization
  authKey: import.meta.env.VITE_LUZMO_AUTH_KEY || "",

  // TODO: Replace with your Luzmo auth token
  // For production, generate this server-side using the Authorization API
  authToken: import.meta.env.VITE_LUZMO_AUTH_TOKEN || "",

  // Optional: Custom Luzmo server URLs (only needed for on-premise installations)
  appServer: import.meta.env.VITE_LUZMO_APP_SERVER || "https://app.luzmo.com",
  apiHost: import.meta.env.VITE_LUZMO_API_HOST || "https://api.luzmo.com",
  datasetIds: import.meta.env.VITE_LUZMO_DATASET_IDS || [
    "6272b4a6-afb9-4c9e-887c-5370e3cd6d44", // Tickets
    "2c1795f8-b0d7-4a01-b881-de4568f3d94a", // CRM
    "3a670b00-6c7b-4108-a533-8e104c3831df", // DevOps Observability
    "749bf6e9-5ef4-4c69-9cc9-e82a62de7e33", // Fintech payments
    "86854a4d-62c2-42e3-83b9-118c364949d5", // E-commerce
    "a8ca2c8d-b753-49a6-876d-bd6c0a537d07", // HR (HCM)
    "8a3223bf-ec4a-4fbd-9568-f8b6215101b0", // Project management
    "c7af4ec1-aee0-4c09-89e5-1e537a0fc8c8", // Marketing automation
  ],
};

/**
 * Get the full Luzmo auth config with defaults applied
 */
export const getLuzmoAuthConfig = (): Required<LuzmoAuthConfig> => {
  return {
    authKey: LUZMO_AUTH_CONFIG.authKey,
    authToken: LUZMO_AUTH_CONFIG.authToken,
    appServer: LUZMO_AUTH_CONFIG.appServer || "https://app.luzmo.com",
    apiHost: LUZMO_AUTH_CONFIG.apiHost || "https://api.luzmo.com",
    datasetIds: LUZMO_AUTH_CONFIG.datasetIds || [],
  };
};
