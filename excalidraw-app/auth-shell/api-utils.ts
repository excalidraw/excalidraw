/**
 * API utilities for AuthShell
 * Centralized error handling and URL resolution
 */

import type { AuthShellConfig } from "./config";

// ============================================================================
// API Error Handling
// ============================================================================

export interface APIErrorResponse {
  message?: string;
  code?: string;
}

export class PaymentProviderUnavailableError extends Error {
  constructor(message?: string) {
    super(
      message ||
        "Payment provider is currently unavailable. Please try again later or contact support.",
    );
    this.name = "PaymentProviderUnavailableError";
  }
}

/**
 * Handles API response errors with consistent error handling
 * Throws PaymentProviderUnavailableError for payment provider issues
 * Throws Error for other API errors
 */
export async function handleAPIResponse(
  response: Response,
  fallbackErrorMessage = "Request failed",
): Promise<void> {
  if (response.ok) {
    return;
  }

  let errorData: APIErrorResponse = {};

  try {
    errorData = await response.json();
  } catch {
    // If JSON parsing fails, use fallback message
    throw new Error(fallbackErrorMessage);
  }

  // Check for payment provider unavailable
  if (
    errorData.code === "PAYMENT_PROVIDER_UNAVAILABLE" ||
    response.status === 503
  ) {
    throw new PaymentProviderUnavailableError(errorData.message);
  }

  // General error
  throw new Error(errorData.message || fallbackErrorMessage);
}

/**
 * Makes an authenticated API request with consistent error handling
 */
export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit & { token: string },
): Promise<Response> {
  const { token, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  return response;
}

// ============================================================================
// URL Resolution
// ============================================================================

/**
 * Resolves the API base URL from config or defaults to current origin
 */
export function resolveAPIBaseUrl(config: AuthShellConfig): string {
  if (config.apiBaseUrl) {
    return config.apiBaseUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Fallback for SSR or testing environments
  return "http://localhost:8787";
}

/**
 * Resolves the checkout success URL
 */
export function resolveSuccessUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    import.meta.env.VITE_CHECKOUT_SUCCESS_URL ||
    `${window.location.origin}?subscribed=true`
  );
}

// ============================================================================
// API Request Builders
// ============================================================================

export interface CheckoutRequestBody {
  billingInterval: "month";
  customerEmail?: string;
}

export interface CheckoutSessionRequestBody {
  productId: string;
  billingInterval: "month";
  customerEmail: string;
  customData: {
    userId: string;
    clerkUserId: string;
  };
}

/**
 * Creates a checkout session
 */
export async function createCheckout(
  config: AuthShellConfig,
  token: string,
  body: CheckoutRequestBody,
): Promise<any> {
  const apiUrl = resolveAPIBaseUrl(config);
  const response = await makeAuthenticatedRequest(
    `${apiUrl}/api/subscription/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      token,
    },
  );

  await handleAPIResponse(response, "Failed to create checkout");
  return response.json();
}

/**
 * Creates a checkout session with DodoPayments
 */
export async function createCheckoutSession(
  config: AuthShellConfig,
  token: string,
  body: CheckoutSessionRequestBody,
): Promise<{ checkoutUrl: string }> {
  const apiUrl = resolveAPIBaseUrl(config);
  const response = await makeAuthenticatedRequest(
    `${apiUrl}/api/subscription/checkout-session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      token,
    },
  );

  await handleAPIResponse(response, "Failed to create checkout session");
  return response.json();
}
