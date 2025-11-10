/**
 * DodoPayments integration utilities
 * Handles script loading, initialization, and checkout
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface DodoPaymentsNamespace {
  DodoPayments: {
    Initialize(options: DodoPaymentsInitOptions): void;
    Checkout: {
      open(options: DodoPaymentsCheckoutOptions): void;
      close?: () => void;
    };
  };
}

export interface DodoPaymentsInitOptions {
  mode: "test" | "live";
  onEvent?: (event: DodoPaymentsEvent) => void;
}

export interface DodoPaymentsCheckoutOptions {
  checkoutUrl: string;
}

export interface DodoPaymentsEvent {
  event_type: string;
  data?: Record<string, unknown>;
}

declare global {
  interface Window {
    DodoPaymentsCheckout?: DodoPaymentsNamespace;
  }
}

// ============================================================================
// Constants
// ============================================================================

const DODOPAYMENTS_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/npm/dodopayments-checkout@latest/dist/index.js";

let dodopaymentsScriptPromise: Promise<void> | null = null;

// ============================================================================
// Script Loading
// ============================================================================

/**
 * Loads the DodoPayments script if not already loaded
 * Uses a promise cache to prevent multiple simultaneous loads
 */
export async function loadDodoPaymentsScript(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (window.DodoPaymentsCheckout) {
    return;
  }

  if (!dodopaymentsScriptPromise) {
    dodopaymentsScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = DODOPAYMENTS_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (event) =>
        reject(
          event instanceof ErrorEvent
            ? event.error
            : new Error("Failed to load DodoPayments script"),
        );
      document.body.appendChild(script);
    });
  }

  await dodopaymentsScriptPromise;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Gets the DodoPayments mode from environment config
 */
export function getDodoPaymentsMode(): "test" | "live" {
  const envConfig = import.meta.env.VITE_DODOPAYMENTS_ENVIRONMENT;
  return envConfig === "live_mode" || envConfig === "production"
    ? "live"
    : "test";
}

/**
 * Initializes DodoPayments with the given event handler
 */
export function initializeDodoPayments(
  onEvent?: (event: DodoPaymentsEvent) => void,
): void {
  if (!window.DodoPaymentsCheckout) {
    throw new Error(
      "DodoPayments script loaded but DodoPayments object not available",
    );
  }

  const mode = getDodoPaymentsMode();

  window.DodoPaymentsCheckout.DodoPayments.Initialize({
    mode,
    onEvent,
  });

  console.log(`✓ DodoPayments.js loaded (${mode})`);
}

// ============================================================================
// Checkout Operations
// ============================================================================

/**
 * Opens the DodoPayments checkout overlay
 */
export function openCheckout(checkoutUrl: string): void {
  if (!window.DodoPaymentsCheckout) {
    throw new Error("DodoPayments checkout is unavailable");
  }

  // Close any existing checkout first
  window.DodoPaymentsCheckout.DodoPayments.Checkout.close?.();

  // Open new checkout
  window.DodoPaymentsCheckout.DodoPayments.Checkout.open({
    checkoutUrl,
  });
}

/**
 * Closes the DodoPayments checkout overlay
 */
export function closeCheckout(): void {
  window.DodoPaymentsCheckout?.DodoPayments?.Checkout?.close?.();
}

// ============================================================================
// Event Utilities
// ============================================================================

/**
 * Type guard for checkout redirect events
 */
export function isRedirectEvent(event: DodoPaymentsEvent): boolean {
  return event.event_type === "checkout.redirect";
}

/**
 * Extracts redirect URL from event data
 */
export function getRedirectUrl(event: DodoPaymentsEvent): string | null {
  if (!event.data || typeof event.data.url !== "string") {
    return null;
  }
  return event.data.url;
}

/**
 * Type guard for checkout error events
 */
export function isErrorEvent(event: DodoPaymentsEvent): boolean {
  return event.event_type === "checkout.error";
}

/**
 * Extracts error message from event data
 */
export function getErrorMessage(event: DodoPaymentsEvent): string {
  if (
    event.data &&
    typeof event.data.message === "string" &&
    event.data.message
  ) {
    return event.data.message;
  }
  return "Payment failed. Please try again.";
}
