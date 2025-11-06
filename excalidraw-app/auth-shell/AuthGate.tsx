import {
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  useClerk,
  useUser,
} from "@clerk/clerk-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

import type { AuthShellConfig } from "./config";
import {
  fetchPremiumSession,
  hasActiveSubscription,
  hasPremiumCookie,
  setPremiumCookie,
} from "./premiumSession";
import { AuthShellProvider } from "./AuthShellContext";
import { SettingsPage } from "./settings/SettingsPage";
import { trackEvent } from "../../packages/excalidraw/analytics";

type SessionStatus =
  | { type: "loading" }
  | { type: "ready"; premium: boolean; hasActiveSubscription: boolean }
  | { type: "error"; message: string };

interface AuthGateProps {
  config: AuthShellConfig;
  children: ReactElement;
}

const loaderStyles: CSSProperties = {
  alignItems: "center",
  display: "flex",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "1rem",
  height: "100vh",
  justifyContent: "center",
  padding: "2rem",
};

function Loader({ label }: { label: string }) {
  return <div style={loaderStyles}>{label}</div>;
}

const ClerkLoadedComponent =
  ClerkLoaded as unknown as ComponentType<{ children?: ReactNode }>;
const ClerkLoadingComponent =
  ClerkLoading as unknown as ComponentType<{ children?: ReactNode }>;
const SignedInComponent =
  SignedIn as unknown as ComponentType<{ children?: ReactNode }>;
const SignedOutComponent =
  SignedOut as unknown as ComponentType<{ children?: ReactNode }>;

const PADDLE_SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";
const PADDLE_DROPIN_TARGET = "paddle-dropin";
let paddleScriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    Paddle?: PaddleNamespace;
  }
}

interface PaddleNamespace {
  Initialize(options: { token: string }): void;
  Checkout: {
    open(options: PaddleCheckoutOptions): void;
    close?: () => void;
  };
  Environment?: {
    set?: (environment: "sandbox" | "production") => void;
  };
}

interface PaddleCheckoutOptions {
  clientToken?: string;
  items?: Array<{ priceId: string; quantity: number }>;
  customer?: { email: string };
  customData?: Record<string, unknown>;
  settings?: {
    displayMode?: "inline" | "overlay";
    frameTarget?: string;
    frameStyle?: string;
    locale?: string;
    theme?: "light" | "dark";
    successUrl?: string;
  };
  eventCallback?: (event: PaddleEvent) => void;
}

interface PaddleEvent {
  name: string;
  data?: Record<string, unknown>;
}

function AuthScreen({ config }: { config: AuthShellConfig }) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: "100vh",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <SignIn
        routing="virtual"
        redirectUrl={config.redirectUrl}
        afterSignInUrl={config.redirectUrl}
        appearance={{
          elements: {
            rootBox: {
              boxShadow: "0 1rem 3rem rgba(16, 24, 40, 0.12)",
            },
          },
        }}
      />
    </div>
  );
}

type BillingInterval = "month" | "year";

interface CheckoutResponse {
  priceId: string;
  billingInterval: BillingInterval;
  environment: "sandbox" | "production";
  customerEmail: string;
  customData: {
    userId: string;
    clerkUserId: string;
  };
  successUrl: string;
  cancelUrl: string;
}

type ProcessingStatus = "polling" | "success" | "timeout";

const loadPaddleScript = async () => {
  if (typeof window === "undefined") {
    return;
  }

  if (window.Paddle) {
    return;
  }

  if (!paddleScriptPromise) {
    paddleScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PADDLE_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (event) =>
        reject(
          event instanceof ErrorEvent
            ? event.error
            : new Error("Failed to load Paddle script"),
        );
      document.body.appendChild(script);
    });
  }

  await paddleScriptPromise;
};

const getInitialPlanFromSearch = (): BillingInterval => {
  if (typeof window === "undefined") {
    return "month";
  }
  const params = new URLSearchParams(window.location.search);
  return params.get("plan") === "year" ? "year" : "month";
};

const resolveSuccessUrl = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  return (
    import.meta.env.VITE_CHECKOUT_SUCCESS_URL ||
    `${window.location.origin}?subscribed=true`
  );
};

function SubscriptionProcessing({
  config,
  onRetry,
  onSignOut,
}: {
  config: AuthShellConfig;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<ProcessingStatus>("polling");
  const [pollCount, setPollCount] = useState(0);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  useEffect(() => {
    if (status !== "polling") {
      return;
    }

    const maxPolls = 60; // 60 polls × 3 seconds = 3 minutes max
    const pollInterval = 3000; // 3 seconds

    const checkSubscription = async () => {
      try {
        console.log(`🔄 Polling subscription status (attempt ${pollCount + 1})...`);
        const session = await fetchPremiumSession(config, {
          getToken: () => getToken({ skipCache: true }),
        });

        console.log("📊 Session response:", session);
        console.log("📋 Subscription details:", JSON.stringify(session?.subscription, null, 2));
        console.log("💳 Has active subscription:", hasActiveSubscription(session));

        if (hasActiveSubscription(session)) {
          console.log("✅ Subscription found! Stopping polling.");
          setSubscriptionActive(true);
          setStatus("success");

          // Track subscription activated
          trackEvent("subscription", "activated");

          // Wait 2 seconds to show success message, then reload to activate
          setTimeout(() => {
            window.location.href = window.location.pathname;
          }, 2000);
          return true;
        }
        return false;
      } catch (error) {
        console.error("❌ Error checking subscription:", error);
        return false;
      }
    };

    const poll = async () => {
      const isActive = await checkSubscription();

      if (!isActive) {
        setPollCount((prev) => {
          const newCount = prev + 1;
          if (newCount >= maxPolls) {
            setStatus("timeout");
            return newCount;
          }
          return newCount;
        });
      }
    };

    // Initial check
    poll();

    // Set up polling interval
    const intervalId = setInterval(() => {
      if (pollCount < maxPolls && status === "polling") {
        poll();
      }
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [config, getToken, pollCount, status]);

  if (status === "success" || subscriptionActive) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#f0fdf4",
          display: "flex",
          fontFamily: "Inter, system-ui, sans-serif",
          height: "100vh",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            boxShadow: "0 1.5rem 4rem rgba(15, 23, 42, 0.15)",
            maxWidth: "28rem",
            padding: "2.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "#10b981",
              borderRadius: "50%",
              color: "#ffffff",
              fontSize: "2.5rem",
              height: "4rem",
              lineHeight: "4rem",
              margin: "0 auto 1.5rem",
              width: "4rem",
            }}
          >
            ✓
          </div>
          <h1
            style={{
              color: "#111827",
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: "1rem",
            }}
          >
            Payment Complete!
          </h1>
          <p style={{ color: "#6b7280", fontSize: "1rem", lineHeight: "1.6" }}>
            Your subscription is now active. Redirecting you to EmbraceBoard...
          </p>
        </div>
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#f9fafb",
          display: "flex",
          fontFamily: "Inter, system-ui, sans-serif",
          height: "100vh",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            boxShadow: "0 1.5rem 4rem rgba(15, 23, 42, 0.15)",
            maxWidth: "28rem",
            padding: "2.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "#f59e0b",
              borderRadius: "50%",
              color: "#ffffff",
              fontSize: "2rem",
              height: "4rem",
              lineHeight: "4rem",
              margin: "0 auto 1.5rem",
              width: "4rem",
            }}
          >
            ⏱
          </div>
          <h1
            style={{
              color: "#111827",
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: "1rem",
            }}
          >
            Payment Processing
          </h1>
          <p
            style={{
              color: "#6b7280",
              fontSize: "1rem",
              lineHeight: "1.6",
              marginBottom: "1.5rem",
            }}
          >
            Your payment is taking longer than expected to process. This can
            happen if the webhook is delayed.
          </p>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "0.875rem",
              lineHeight: "1.6",
              marginBottom: "2rem",
            }}
          >
            Your subscription should activate within a few minutes. You can try
            refreshing the page or contact support if the issue persists.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={onRetry}
              style={{
                backgroundColor: "#111827",
                border: "none",
                borderRadius: "0.75rem",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
                padding: "0.875rem 1.5rem",
              }}
            >
              Refresh and Check Again
            </button>
            <button
              type="button"
              onClick={onSignOut}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #d0d5dd",
                borderRadius: "0.75rem",
                color: "#111827",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
                padding: "0.875rem 1.5rem",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Polling state
  const elapsedSeconds = pollCount * 3;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#f9fafb",
        display: "flex",
        fontFamily: "Inter, system-ui, sans-serif",
        height: "100vh",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          boxShadow: "0 1.5rem 4rem rgba(15, 23, 42, 0.15)",
          maxWidth: "28rem",
          padding: "2.5rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            animation: "spin 1s linear infinite",
            border: "4px solid #e5e7eb",
            borderRadius: "50%",
            borderTopColor: "#3b82f6",
            height: "4rem",
            margin: "0 auto 1.5rem",
            width: "4rem",
          }}
        />
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
        <h1
          style={{
            color: "#111827",
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: "1rem",
          }}
        >
          Processing Payment...
        </h1>
        <p
          style={{
            color: "#6b7280",
            fontSize: "1rem",
            lineHeight: "1.6",
            marginBottom: "1rem",
          }}
        >
          We're confirming your subscription. This usually takes a few seconds.
        </p>
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          Checking... ({minutes > 0 ? `${minutes}m ` : ""}
          {seconds}s elapsed)
        </p>
      </div>
    </div>
  );
}

function SubscriptionManagement({
  config,
  onSignOut,
}: {
  config: AuthShellConfig;
  onSignOut: () => void;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showInvoices, setShowInvoices] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        const apiUrl =
          config.apiBaseUrl ||
          (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
        const response = await fetch(`${apiUrl}/api/subscription`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch subscription");
        }

        const data = await response.json();
        setSubscription(data.subscription);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load subscription");
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [config.apiBaseUrl, getToken]);

  const handleUpdateBillingInterval = async (newInterval: BillingInterval) => {
    if (subscription.billingInterval === newInterval) {
      return;
    }

    try {
      setUpdating(true);
      setError(null);
      setSuccessMessage(null);

      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const apiUrl =
        config.apiBaseUrl ||
        (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
      const response = await fetch(`${apiUrl}/api/subscription/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ billingInterval: newInterval }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update subscription");
      }

      const data = await response.json();
      setSuccessMessage(data.message || "Subscription updated successfully");
      
      // Refresh subscription data
      const subResponse = await fetch(`${apiUrl}/api/subscription`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
      }

      trackEvent("subscription", "billing_interval_updated", newInterval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.")) {
      return;
    }

    try {
      setCanceling(true);
      setError(null);
      setSuccessMessage(null);

      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const apiUrl =
        config.apiBaseUrl ||
        (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
      const response = await fetch(`${apiUrl}/api/subscription/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel subscription");
      }

      const data = await response.json();
      setSuccessMessage(data.message || "Subscription will be canceled at the end of the billing period");
      
      // Refresh subscription data
      const subResponse = await fetch(`${apiUrl}/api/subscription`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
      }

      trackEvent("subscription", "canceled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCanceling(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const apiUrl =
        config.apiBaseUrl ||
        (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
      const response = await fetch(`${apiUrl}/api/subscription/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.portalUrl) {
        // Portal available - open it
        window.open(data.portalUrl, "_blank");
        trackEvent("subscription", "portal_opened");
      } else if (data.canViewInvoices) {
        // Portal not available but invoices can be viewed
        setError(data.message || "Portal not available. Use 'View Invoices' to see your payment history.");
      } else {
        throw new Error(data.message || "Failed to get portal URL");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open customer portal");
    }
  };

  const handleViewInvoices = async () => {
    if (showInvoices) {
      // Just hide the invoices
      setShowInvoices(false);
      return;
    }

    try {
      setError(null);
      setLoadingInvoices(true);
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const apiUrl =
        config.apiBaseUrl ||
        (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
      const response = await fetch(`${apiUrl}/api/subscription/invoices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch invoices" }));
        throw new Error(errorData.message || "Failed to fetch invoices");
      }

      const data = await response.json();
      setInvoices(data.transactions || []);
      setShowInvoices(true);
      trackEvent("subscription", "invoices_viewed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoadingInvoices(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#f9fafb",
          display: "flex",
          fontFamily: "Inter, system-ui, sans-serif",
          height: "100vh",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#6b7280", fontSize: "1rem" }}>Loading subscription...</p>
        </div>
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#f9fafb",
          display: "flex",
          fontFamily: "Inter, system-ui, sans-serif",
          height: "100vh",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.75rem",
              color: "#991b1b",
              marginBottom: "1rem",
              padding: "1rem",
            }}
          >
            {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "#111827",
              border: "none",
              borderRadius: "0.5rem",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.75rem 1.5rem",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentPeriodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  const isCanceled = subscription?.cancelAtPeriodEnd === true;

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#f9fafb",
        display: "flex",
        fontFamily: "Inter, system-ui, sans-serif",
        minHeight: "100vh",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{ maxWidth: "48rem", width: "100%" }}>
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <h1
            style={{
              color: "#111827",
              fontSize: "1.75rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}
          >
            Subscription Management
          </h1>
          {user?.primaryEmailAddress && (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              {user.primaryEmailAddress.emailAddress}
            </p>
          )}
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.75rem",
              color: "#991b1b",
              marginBottom: "1rem",
              padding: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: "0.75rem",
              color: "#166534",
              marginBottom: "1rem",
              padding: "1rem",
            }}
          >
            {successMessage}
          </div>
        )}

        {subscription && (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "0.75rem",
              marginBottom: "1rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h2 style={{ color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
                  Current Plan
                </h2>
                {isCanceled && (
                  <span
                    style={{
                      backgroundColor: "#fef2f2",
                      borderRadius: "0.375rem",
                      color: "#991b1b",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.75rem",
                    }}
                  >
                    Canceling
                  </span>
                )}
              </div>
              <div style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: "#111827", fontSize: "1.5rem", fontWeight: 700 }}>
                  {subscription.pricePerPeriod}
                </span>
                <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                  /{subscription.billingInterval === "month" ? "month" : "year"}
                </span>
              </div>
              {currentPeriodEnd && (
                <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  {isCanceled ? "Access until" : "Next billing"} {currentPeriodEnd.toLocaleDateString()}
                </p>
              )}
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem" }}>
              <h3 style={{ color: "#111827", fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                Change Billing Interval
              </h3>
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                <button
                  onClick={() => handleUpdateBillingInterval("month")}
                  disabled={updating || subscription.billingInterval === "month"}
                  style={{
                    backgroundColor: subscription.billingInterval === "month" ? "#e5e7eb" : "#ffffff",
                    border: `2px solid ${subscription.billingInterval === "month" ? "#111827" : "#e5e7eb"}`,
                    borderRadius: "0.5rem",
                    color: "#111827",
                    cursor: updating || subscription.billingInterval === "month" ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    opacity: updating ? 0.6 : 1,
                    padding: "0.75rem 1.25rem",
                    transition: "all 0.2s",
                  }}
                >
                  Monthly ($19/month)
                </button>
                <button
                  onClick={() => handleUpdateBillingInterval("year")}
                  disabled={updating || subscription.billingInterval === "year"}
                  style={{
                    backgroundColor: subscription.billingInterval === "year" ? "#e5e7eb" : "#ffffff",
                    border: `2px solid ${subscription.billingInterval === "year" ? "#111827" : "#e5e7eb"}`,
                    borderRadius: "0.5rem",
                    color: "#111827",
                    cursor: updating || subscription.billingInterval === "year" ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    opacity: updating ? 0.6 : 1,
                    padding: "0.75rem 1.25rem",
                    transition: "all 0.2s",
                  }}
                >
                  Yearly ($190/year)
                </button>
              </div>
              {updating && (
                <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  Updating subscription...
                </p>
              )}
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
              <h3 style={{ color: "#111827", fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                Payment & Billing
              </h3>
              <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}>
                {isCanceled 
                  ? "Customer portal is not available for canceled subscriptions. You can view your invoices and payment history below."
                  : "Update payment method, view invoices, and update billing address"}
              </p>
              <button
                onClick={handleOpenPortal}
                disabled={isCanceled}
                style={{
                  backgroundColor: isCanceled ? "#f3f4f6" : "#ffffff",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  color: isCanceled ? "#9ca3af" : "#111827",
                  cursor: isCanceled ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                  padding: "0.75rem 1.25rem",
                  width: "100%",
                  opacity: isCanceled ? 0.6 : 1,
                }}
              >
                {isCanceled ? "Not Available (Canceled)" : "Update Payment Method"}
              </button>
              <button
                onClick={handleViewInvoices}
                disabled={loadingInvoices}
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  color: "#111827",
                  cursor: loadingInvoices ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                  padding: "0.75rem 1.25rem",
                  width: "100%",
                  opacity: loadingInvoices ? 0.6 : 1,
                }}
              >
                {loadingInvoices ? "Loading..." : showInvoices ? "Hide Invoices" : "View Invoices"}
              </button>
              {showInvoices && invoices.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <h4 style={{ color: "#111827", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                    Payment History
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {invoices.map((invoice: any) => (
                      <div
                        key={invoice.id}
                        style={{
                          backgroundColor: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "0.5rem",
                          padding: "0.75rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ color: "#111827", fontSize: "0.875rem", fontWeight: 600 }}>
                            {invoice.invoiceNumber || invoice.id}
                          </div>
                          <div style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                            {invoice.billedAt 
                              ? new Date(invoice.billedAt).toLocaleDateString()
                              : invoice.createdAt 
                              ? new Date(invoice.createdAt).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "#111827", fontSize: "0.875rem", fontWeight: 600 }}>
                            {invoice.total ? `${invoice.currencyCode || "USD"} $${(invoice.total / 100).toFixed(2)}` : "N/A"}
                          </div>
                          <div style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                            {invoice.status || "unknown"}
                          </div>
                        </div>
                        {(invoice.invoiceUrl || invoice.receiptUrl) && (
                          <button
                            onClick={() => window.open(invoice.invoiceUrl || invoice.receiptUrl, "_blank")}
                            style={{
                              backgroundColor: "#ffffff",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              color: "#111827",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              padding: "0.375rem 0.75rem",
                              marginLeft: "0.75rem",
                            }}
                          >
                            {invoice.invoiceUrl ? "Invoice" : "Receipt"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {showInvoices && invoices.length === 0 && (
                <div style={{ marginTop: "1rem", color: "#6b7280", fontSize: "0.875rem", textAlign: "center" }}>
                  No invoices found.
                </div>
              )}
              <button
                onClick={handleCancel}
                disabled={canceling || isCanceled}
                style={{
                  backgroundColor: isCanceled ? "#f3f4f6" : "#ffffff",
                  border: "1px solid #fecaca",
                  borderRadius: "0.5rem",
                  color: isCanceled ? "#9ca3af" : "#991b1b",
                  cursor: canceling || isCanceled ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  opacity: canceling ? 0.6 : 1,
                  padding: "0.75rem 1.25rem",
                  width: "100%",
                  marginTop: "0.75rem",
                }}
              >
                {canceling ? "Canceling..." : isCanceled ? "Already Canceled" : "Cancel Subscription"}
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <button
            onClick={onSignOut}
            style={{
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
              textDecoration: "underline",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function SubscribeScreen({
  onSignOut,
  config,
}: {
  onSignOut: () => void;
  config: AuthShellConfig;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const dropInRef = useRef<HTMLDivElement>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingInterval>(
    () => getInitialPlanFromSearch(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropInReady, setDropInReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadCheckout = useCallback(async (billingInterval: BillingInterval) => {
    try {
      setError(null);
      setLoading(true);
      setStatusMessage("Loading checkout…");
      setDropInReady(false);

      trackEvent("subscription", "checkout_started", billingInterval);

      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const customerEmail =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress ??
        undefined;

      const apiUrl =
        config.apiBaseUrl ||
        (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
      const response = await fetch(`${apiUrl}/api/subscription/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          billingInterval,
          customerEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create checkout");
      }

      const data: CheckoutResponse = await response.json();
      setCheckoutData(data);

      if (!window.Paddle) {
        throw new Error("Paddle checkout is unavailable");
      }

      // Ensure the target element exists before opening checkout
      const targetElement = document.querySelector<HTMLElement>(
        `.${PADDLE_DROPIN_TARGET}`,
      );
      if (!targetElement) {
        throw new Error("Paddle checkout container not found in DOM");
      }

      window.Paddle.Checkout.close?.();
      // Open checkout with items directly (no backend client token needed)
      window.Paddle.Checkout.open({
        items: [
          {
            priceId: data.priceId,
            quantity: 1,
          },
        ],
        customer: {
          email: data.customerEmail,
        },
        customData: data.customData,
        settings: {
          displayMode: "inline",
          frameTarget: PADDLE_DROPIN_TARGET,
          frameStyle: "width:100%;min-height:320px;border:0;",
          successUrl: data.successUrl,
          theme: "light",
        },
        eventCallback: (event: PaddleEvent) => {
          console.log("🔔 Paddle event:", event.name, event.data);
          switch (event.name) {
            case "checkout.loaded":
              setDropInReady(true);
              setLoading(false);
              setStatusMessage(null);
              break;
            case "checkout.customer.created":
              trackEvent("subscription", "checkout_confirm_clicked", billingInterval);
              break;
            case "checkout.payment.initiated":
              // Check if 3DS challenge is required
              if (event.data?.requires_authentication) {
                trackEvent("subscription", "checkout_3ds_challenge", billingInterval);
              }
              break;
            case "checkout.completed":
              console.log("✅ Checkout completed! Transaction:", event.data);
              setStatusMessage("Payment confirmed. Finalizing your workspace…");
              window.Paddle?.Checkout?.close?.();
              // Redirect to success URL which will trigger polling
              window.location.assign(data.successUrl || resolveSuccessUrl());
              break;
            case "checkout.closed":
              setStatusMessage(null);
              break;
            case "checkout.payment_failed":
            case "checkout.error":
              console.error("❌ Checkout error:", event.data);
              trackEvent("subscription", "checkout_inline_error", billingInterval);
              setError("Payment failed. Please try again.");
              setLoading(false);
              break;
            default:
              console.log("⚠️ Unhandled Paddle event:", event.name);
              break;
          }
        },
      });

      trackEvent("subscription", "checkout_opened", billingInterval);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setLoading(false);
      setStatusMessage(null);
      console.error("Checkout error:", err);
    }
  }, [config.apiBaseUrl, getToken, user]);

  // Load Paddle script and initialize on mount
  useEffect(() => {
    trackEvent("subscription", "paywall_shown");

    const initPaddle = async () => {
      try {
        await loadPaddleScript();

        if (!window.Paddle) {
          throw new Error("Paddle script loaded but Paddle object not available");
        }

        // Get Paddle environment from config
        const envConfig = import.meta.env.VITE_PADDLE_ENVIRONMENT;
        const paddleEnv: "sandbox" | "production" =
          envConfig === "production" ? "production" : "sandbox";

        // Set sandbox/production environment (required for inline checkout)
        window.Paddle.Environment?.set?.(paddleEnv);
        console.log(`✓ Paddle.js loaded (${paddleEnv})`);
      } catch (err) {
        console.error("Failed to initialize Paddle:", err);
        setError("Unable to load payment form. Please try again later.");
      }
    };

    initPaddle();
  }, []);

  // Initialize checkout when component mounts and Paddle script loads
  useEffect(() => {
    if (!isInitialized) {
      const initialPlan = getInitialPlanFromSearch();

      // Wait for both Paddle script and DOM to be ready
      const initCheckout = async () => {
        await loadPaddleScript();

        // Poll for the element to exist (max 10 attempts)
        let attempts = 0;
        const checkElement = () => {
          const element = document.querySelector(`.${PADDLE_DROPIN_TARGET}`);
          if (element) {
            setIsInitialized(true);
            loadCheckout(initialPlan);
          } else if (attempts < 10) {
            attempts++;
            setTimeout(checkElement, 100);
          } else {
            setError("Unable to initialize checkout form. Please refresh the page.");
          }
        };

        checkElement();
      };

      initCheckout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlanChange = (plan: BillingInterval) => {
    if (plan !== selectedPlan) {
      setSelectedPlan(plan);
      loadCheckout(plan);
    }
  };

  return (
    <div
      style={{
        alignItems: "center",
        backgroundColor: "#f9fafb",
        display: "flex",
        fontFamily: "Inter, system-ui, sans-serif",
        height: "100vh",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{ maxWidth: "64rem", width: "100%" }}>
        <div style={{ marginBottom: "1rem", textAlign: "center" }}>
          <h1
            style={{
              color: "#111827",
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.375rem",
            }}
          >
            Choose Your Plan
          </h1>
          <p
            style={{
              color: "#6b7280",
              fontSize: "0.875rem",
              marginBottom: "0.5rem",
            }}
          >
            Select a plan to start using EmbraceBoard
          </p>
          {user?.primaryEmailAddress && (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              Subscribing as{" "}
              <strong style={{ color: "#6b7280" }}>
                {user.primaryEmailAddress.emailAddress}
              </strong>
            </p>
          )}
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.75rem",
              color: "#991b1b",
              marginBottom: "1.5rem",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
        >
          {/* Monthly Plan */}
          <div
            onClick={() => handlePlanChange("month")}
            style={{
              backgroundColor: "#ffffff",
              border: `2px solid ${selectedPlan === "month" ? "#111827" : "#e5e7eb"}`,
              borderRadius: "0.75rem",
              padding: "0.75rem 1.25rem",
              transition: "all 0.2s",
              cursor: "pointer",
              opacity: loading && selectedPlan === "month" ? 0.7 : 1,
              flex: "0 1 auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#111827", marginBottom: "0.25rem" }}>
                  1 Month
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                  <span style={{ color: "#111827", fontSize: "1.5rem", fontWeight: 700 }}>
                    $19
                  </span>
                  <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                    /month
                  </span>
                </div>
              </div>
              {selectedPlan === "month" && (
                <div
                  style={{
                    backgroundColor: "#10b981",
                    borderRadius: "0.375rem",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.375rem 0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  ✓ Selected
                </div>
              )}
            </div>
          </div>

          {/* Yearly Plan */}
          <div
            onClick={() => handlePlanChange("year")}
            style={{
              backgroundColor: "#ffffff",
              border: `2px solid ${selectedPlan === "year" ? "#3b82f6" : "#e5e7eb"}`,
              borderRadius: "0.75rem",
              padding: "0.75rem 1.25rem",
              position: "relative",
              transition: "all 0.2s",
              cursor: "pointer",
              opacity: loading && selectedPlan === "year" ? 0.7 : 1,
              flex: "0 1 auto",
            }}
          >
            <div
              style={{
                backgroundColor: "#3b82f6",
                borderRadius: "0.25rem",
                color: "#ffffff",
                fontSize: "0.625rem",
                fontWeight: 600,
                padding: "0.125rem 0.5rem",
                position: "absolute",
                right: "0.75rem",
                top: "0.5rem",
              }}
            >
              SAVE 17%
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ paddingTop: "0.75rem" }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#111827", marginBottom: "0.25rem" }}>
                  1 Year
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                  <span style={{ color: "#111827", fontSize: "1.5rem", fontWeight: 700 }}>
                    $190
                  </span>
                  <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                    /year
                  </span>
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                  $15.83/month
                </div>
              </div>
              {selectedPlan === "year" && (
                <div
                  style={{
                    backgroundColor: "#3b82f6",
                    borderRadius: "0.375rem",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.375rem 0.75rem",
                    whiteSpace: "nowrap",
                    marginTop: "0.75rem",
                  }}
                >
                  ✓ Selected
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Form - Always Visible */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            marginBottom: "0.5rem",
            padding: "0.75rem",
          }}
        >
          <div
            ref={dropInRef}
            id={PADDLE_DROPIN_TARGET}
            className={PADDLE_DROPIN_TARGET}
            style={{
              minHeight: "320px",
            }}
          />
          {!dropInReady && (
            <p style={{ color: "#6b7280", marginTop: "0.5rem", fontSize: "0.75rem" }}>
              Loading secure payment form…
            </p>
          )}
        </div>

      {statusMessage && (
        <p
          style={{
            color: "#2563eb",
            fontSize: "0.95rem",
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          {statusMessage}
        </p>
      )}

      <div style={{ textAlign: "center" }}>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            marginBottom: "1rem",
            }}
          >
            Secure checkout processed by Paddle
          </p>
          <button
            type="button"
            onClick={() => {
              trackEvent("subscription", "signout_from_subscribe");
              onSignOut();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
              textDecoration: "underline",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionGuard({
  config,
  children,
}: {
  config: AuthShellConfig;
  children: ReactElement;
}) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();

  const shouldFetchSession = Boolean(config.apiBaseUrl);

  // Check if user is returning from checkout
  const urlParams = new URLSearchParams(window.location.search);
  const isReturningFromCheckout = urlParams.get("subscribed") === "true";

  const [status, setStatus] = useState<SessionStatus>(() =>
    shouldFetchSession
      ? { type: "loading" }
      : { type: "ready", premium: true, hasActiveSubscription: true },
  );
  const [retryIndex, setRetryIndex] = useState(0);
  const [showProcessing, setShowProcessing] = useState(isReturningFromCheckout);
  const [sessionData, setSessionData] = useState<any>(null);

  const ensurePremiumCookie = useCallback(
    (premium: boolean) => {
      setPremiumCookie(config, premium);
    },
    [config],
  );

  useEffect(() => {
    if (!shouldFetchSession) {
      if (!hasPremiumCookie(config)) {
        ensurePremiumCookie(true);
      }
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    async function hydrate() {
      setStatus({ type: "loading" });

      try {
        const session = await fetchPremiumSession(config, {
          getToken: () => getToken({ skipCache: true }),
          signal: controller.signal,
        });

        if (isCancelled) {
          return;
        }

        const premium = session?.premium ?? false;
        const hasSubscription = hasActiveSubscription(session);
        ensurePremiumCookie(premium);
        setSessionData(session);
        setStatus({ type: "ready", premium, hasActiveSubscription: hasSubscription });
        if (hasSubscription) {
          setShowProcessing(false);
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unknown session error occurred.";

        setStatus({ type: "error", message });
      }
    }

    hydrate();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [config, ensurePremiumCookie, getToken, retryIndex, shouldFetchSession]);

  const handleRetry = useCallback(() => {
    setRetryIndex((value) => value + 1);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      ensurePremiumCookie(false);
      await signOut();
    } catch (error) {
      console.error("[AuthShell] Failed to sign out", error);
    }
  }, [ensurePremiumCookie, signOut]);

  const handleDeleteAccount = useCallback(async () => {
    if (!user) {
      throw new Error("User is not loaded");
    }

    const token = await getToken({ skipCache: true });
    if (!token) {
      throw new Error("Not authenticated");
    }

    const apiBaseUrl =
      config.apiBaseUrl ||
      (typeof window !== "undefined" ? window.location.origin : undefined);

    if (!apiBaseUrl) {
      throw new Error("API base URL is not configured");
    }

    const response = await fetch(`${apiBaseUrl}/api/account`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      let message = "Failed to delete account";
      try {
        const errorData = await response.json();
        message = errorData?.message || message;
      } catch {
        // Ignore JSON parse errors for non-JSON responses
      }
      throw new Error(message);
    }

    ensurePremiumCookie(false);

    try {
      await user.delete();
    } catch (error) {
      console.error("[AuthShell] Failed to delete Clerk user", error);
    }

    await signOut();
    if (typeof window !== "undefined") {
      window.location.href = config.redirectUrl;
    }
  }, [config.apiBaseUrl, config.redirectUrl, ensurePremiumCookie, getToken, signOut, user]);

  if (status.type === "loading") {
    return <Loader label="Verifying subscription…" />;
  }

  if (status.type === "error") {
    return (
      <div
        style={{
          alignItems: "center",
          display: "flex",
          height: "100vh",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            boxShadow: "0 1.5rem 4rem rgba(15, 23, 42, 0.15)",
            maxWidth: "26rem",
            padding: "2rem",
            textAlign: "center",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Unable to load your workspace
          </h1>
          <p style={{ color: "#475467", marginBottom: "1.5rem" }}>
            {status.message}
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handleRetry}
              style={{
                backgroundColor: "#111827",
                border: "none",
                borderRadius: "0.75rem",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 600,
                padding: "0.65rem 1.5rem",
              }}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #d0d5dd",
                borderRadius: "0.75rem",
                color: "#111827",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 600,
                padding: "0.65rem 1.5rem",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if user is returning from checkout and waiting for webhook
  if (status.type === "ready" && !status.hasActiveSubscription && showProcessing) {
    return (
      <SubscriptionProcessing
        config={config}
        onRetry={() => setRetryIndex((value) => value + 1)}
        onSignOut={handleSignOut}
      />
    );
  }

  // Check if user is accessing settings page
  const pathname = window.location.pathname;
  // Precise check: match /settings or /settings/* but not unrelated routes like /integrations/settings-guide
  const isSettingsPage = pathname === "/settings" || pathname.endsWith("/settings") || /\/settings\//.test(pathname);

  if (status.type === "ready" && status.hasActiveSubscription && isSettingsPage) {
    return (
      <SettingsPage
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
        apiBaseUrl={config.apiBaseUrl}
        getToken={getToken}
        user={user}
      />
    );
  }

  // Check if subscription is required but not active
  if (status.type === "ready" && !status.hasActiveSubscription) {
    return <SubscribeScreen config={config} onSignOut={handleSignOut} />;
  }

  return (
    <AuthShellProvider
      value={{
        signOut: handleSignOut,
        getToken,
        hasActiveSubscription: status.type === "ready" ? status.hasActiveSubscription : false,
        subscriptionStatus: sessionData?.subscription?.status,
        subscriptionTier: sessionData?.subscription?.planId ? "pro" : undefined,
      }}
    >
      {children}
    </AuthShellProvider>
  );
}

export function AuthGate({ config, children }: AuthGateProps) {
  if (!config.publishableKey) {
    throw new Error("[AuthShell] Missing Clerk publishable key in config.");
  }

  return (
    <ClerkProvider publishableKey={config.publishableKey}>
      <ClerkLoadingComponent>
        <Loader label="Preparing authentication…" />
      </ClerkLoadingComponent>
      <ClerkLoadedComponent>
        <SignedInComponent>
          <SessionGuard config={config}>{children}</SessionGuard>
        </SignedInComponent>
        <SignedOutComponent>
          <AuthScreen config={config} />
        </SignedOutComponent>
      </ClerkLoadedComponent>
    </ClerkProvider>
  );
}
