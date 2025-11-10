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
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
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
import {
  CenteredContainer,
  Card,
  StatusIcon,
  Button,
  ActionButton,
  Heading,
  Text,
  Badge,
  Alert,
  ButtonGroup,
} from "./AuthShell.components";
import {
  resolveAPIBaseUrl,
  resolveSuccessUrl,
  createCheckout,
  createCheckoutSession,
  PaymentProviderUnavailableError,
} from "./api-utils";
import {
  loadDodoPaymentsScript,
  initializeDodoPayments,
  openCheckout,
  closeCheckout,
  isRedirectEvent,
  getRedirectUrl,
  isErrorEvent,
  getErrorMessage,
  type DodoPaymentsEvent,
} from "./dodopayments-utils";

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

const ClerkLoadedComponent = ClerkLoaded as unknown as ComponentType<{
  children?: ReactNode;
}>;
const ClerkLoadingComponent = ClerkLoading as unknown as ComponentType<{
  children?: ReactNode;
}>;
const SignedInComponent = SignedIn as unknown as ComponentType<{
  children?: ReactNode;
}>;
const SignedOutComponent = SignedOut as unknown as ComponentType<{
  children?: ReactNode;
}>;

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

type BillingInterval = "month";

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
  pricePerPeriodCents: number;
  pricePerPeriod: string;
  currency: string;
}

type ProcessingStatus = "polling" | "success" | "timeout";

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
        console.log(
          `🔄 Polling subscription status (attempt ${pollCount + 1})...`,
        );
        const session = await fetchPremiumSession(config, {
          getToken: () => getToken({ skipCache: true }),
        });

        console.log("📊 Session response:", session);
        console.log(
          "📋 Subscription details:",
          JSON.stringify(session?.subscription, null, 2),
        );
        console.log(
          "💳 Has active subscription:",
          hasActiveSubscription(session),
        );

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
      <CenteredContainer backgroundColor="#f0fdf4">
        <Card>
          <StatusIcon type="success" />
          <Heading>Payment Complete!</Heading>
          <Text>
            Your subscription is now active. Redirecting you to EmbraceBoard...
          </Text>
        </Card>
      </CenteredContainer>
    );
  }

  if (status === "timeout") {
    return (
      <CenteredContainer>
        <Card>
          <StatusIcon type="warning" />
          <Heading>Payment Processing</Heading>
          <Text marginBottom="1.5rem">
            Your payment is taking longer than expected to process. This can
            happen if the webhook is delayed.
          </Text>
          <Text fontSize="0.875rem" color="#9ca3af" marginBottom="2rem">
            Your subscription should activate within a few minutes. You can try
            refreshing the page or contact support if the issue persists.
          </Text>
          <ButtonGroup>
            <Button onClick={onRetry}>Refresh and Check Again</Button>
            <Button onClick={onSignOut} variant="secondary">
              Sign Out
            </Button>
          </ButtonGroup>
        </Card>
      </CenteredContainer>
    );
  }

  // Polling state
  const elapsedSeconds = pollCount * 3;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <CenteredContainer>
      <Card>
        <StatusIcon type="loading" />
        <Heading>Processing Payment...</Heading>
        <Text marginBottom="1rem">
          We're confirming your subscription. This usually takes a few seconds.
        </Text>
        <Text fontSize="0.875rem" color="#9ca3af">
          Checking... ({minutes > 0 ? `${minutes}m ` : ""}
          {seconds}s elapsed)
        </Text>
      </Card>
    </CenteredContainer>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(
    null,
  );
  const [paymentProviderUnavailable, setPaymentProviderUnavailable] =
    useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const planFeatures = [
    "$10 in AI credits included monthly",
  ];

  const handlePlanActivate = () => {
    if (loading) {
      return;
    }
    loadCheckout("month");
  };

  const handlePlanKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePlanActivate();
    }
  };

  const loadCheckout = useCallback(
    async (billingInterval: BillingInterval) => {
      try {
        setError(null);
        setLoading(true);
        setStatusMessage("Loading checkout…");

        trackEvent("subscription", "checkout_started", billingInterval);

        const token = await getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        const customerEmail =
          user?.primaryEmailAddress?.emailAddress ??
          user?.emailAddresses?.[0]?.emailAddress ??
          undefined;

        // Create checkout
        const data: CheckoutResponse = await createCheckout(config, token, {
          billingInterval,
          customerEmail,
        });
        setCheckoutData(data);
        // Set price from API response
        setPrice(data.pricePerPeriod);

        // Create checkout session
        const { checkoutUrl } = await createCheckoutSession(config, token, {
          productId: data.priceId,
          billingInterval,
          customerEmail: data.customerEmail,
          customData: data.customData,
        });

        // Open checkout overlay
        openCheckout(checkoutUrl);

        trackEvent("subscription", "checkout_opened", billingInterval);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setLoading(false);
        setStatusMessage(null);
        console.error("Checkout error:", err);

        // Check if payment provider is unavailable
        if (err instanceof PaymentProviderUnavailableError) {
          setPaymentProviderUnavailable(true);
        }
      }
    },
    [config, getToken, user],
  );

  // Load DodoPayments script and initialize on mount
  useEffect(() => {
    trackEvent("subscription", "paywall_shown");

    const init = async () => {
      try {
        await loadDodoPaymentsScript();

        initializeDodoPayments((event: DodoPaymentsEvent) => {
          console.log("🔔 DodoPayments event:", event.event_type, event.data);

          switch (event.event_type) {
            case "checkout.opened":
              setLoading(false);
              setStatusMessage(null);
              break;

            case "checkout.customer_details_submitted":
              trackEvent("subscription", "checkout_confirm_clicked", "month");
              break;

            case "checkout.payment_page_opened":
              trackEvent(
                "subscription",
                "checkout_payment_page_opened",
                "month",
              );
              break;

            case "checkout.redirect":
              console.log("✅ Checkout redirecting:", event.data);
              setStatusMessage("Payment confirmed. Finalizing your workspace…");
              closeCheckout();

              // Redirect to success URL which will trigger polling
              const redirectUrl =
                getRedirectUrl(event) ||
                checkoutData?.successUrl ||
                resolveSuccessUrl();

              if (redirectUrl) {
                window.location.assign(redirectUrl);
              } else {
                console.error("Invalid redirect URL:", redirectUrl);
                setError("Invalid redirect URL. Please refresh the page.");
              }
              break;

            case "checkout.closed":
              setStatusMessage(null);
              break;

            case "checkout.error":
              console.error("❌ Checkout error:", event.data);
              trackEvent("subscription", "checkout_inline_error", "month");
              setError(getErrorMessage(event));
              setLoading(false);
              break;

            default:
              console.log("⚠️ Unhandled DodoPayments event:", event.event_type);
              break;
          }
        });
      } catch (err) {
        console.error("Failed to initialize DodoPayments:", err);
        setError("Unable to load payment form. Please try again later.");
      }
    };

    init();
  }, [checkoutData]);

  // Fetch price on mount
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.warn("No token available for price fetch");
          return;
        }

        const customerEmail =
          user?.primaryEmailAddress?.emailAddress ??
          user?.emailAddresses?.[0]?.emailAddress ??
          undefined;

        const data: CheckoutResponse = await createCheckout(config, token, {
          billingInterval: "month",
          customerEmail,
        });
        
        console.log("Price fetched:", data.pricePerPeriod);
        
        if (data.pricePerPeriod) {
          setPrice(data.pricePerPeriod);
        } else {
          console.error("Price is missing from API response:", data);
        }
      } catch (err) {
        console.error("Failed to fetch price:", err);
        // Don't set price if fetch fails - let it remain null so price section is hidden
      }
    };

    if (user) {
      fetchPrice();
    }
  }, [config, getToken, user]);

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
        {user?.primaryEmailAddress && (
          <div style={{ marginBottom: "1rem", textAlign: "center" }}>
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              Subscribing as{" "}
              <strong style={{ color: "#6b7280" }}>
                {user.primaryEmailAddress.emailAddress}
              </strong>
            </p>
          </div>
        )}

        {paymentProviderUnavailable && (
          <Alert variant="warning">
            <strong>Payments Temporarily Offline</strong>
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
              Our payment system is currently unavailable. Your payment may have
              succeeded, but provisioning failed. Please contact support with
              your checkout session ID if you completed a payment.
            </p>
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
              <a
                href="mailto:support@embraceboard.com"
                style={{ color: "#92400e", textDecoration: "underline" }}
              >
                Contact Support
              </a>
            </p>
          </Alert>
        )}

        {error && !paymentProviderUnavailable && (
          <Alert variant="error">{error}</Alert>
        )}

        {/* Subscription Card CTA */}
        <div
          role="button"
          tabIndex={paymentProviderUnavailable ? -1 : 0}
          onClick={paymentProviderUnavailable ? undefined : handlePlanActivate}
          onKeyDown={paymentProviderUnavailable ? undefined : handlePlanKeyDown}
          style={{
            backgroundColor: paymentProviderUnavailable ? "#9ca3af" : "#111827",
            border: "1px solid #1f2937",
            borderRadius: "0.75rem",
            color: "#f9fafb",
            margin: "0 auto 1.5rem",
            cursor: paymentProviderUnavailable
              ? "not-allowed"
              : loading
              ? "progress"
              : "pointer",
            opacity: paymentProviderUnavailable ? 0.6 : loading ? 0.85 : 1,
            maxWidth: "28rem",
            padding: "1.75rem",
            transition: "transform 0.2s",
            boxShadow: "0 25px 50px -12px rgba(30, 64, 175, 0.35)",
          }}
        >
          <div
            style={{
              marginBottom: "1rem",
            }}
          >
            <span
              style={{
                backgroundColor: "#22c55e",
                borderRadius: "9999px",
                color: "#052e16",
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.25rem 0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              AI
            </span>
          </div>

          <p
            style={{
              fontSize: "0.9375rem",
              color: "#d1d5db",
              lineHeight: "1.6",
              marginBottom: "1.25rem",
              fontWeight: 400,
            }}
          >
            A chat with a canvas that understands your ideas.
          </p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: "0.65rem",
              marginBottom: "1.5rem",
            }}
          >
            {planFeatures.map((feature) => (
              <li
                key={feature}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  fontSize: "0.875rem",
                  color: "#e5e7eb",
                  lineHeight: "1.5",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    backgroundColor: "#22c55e",
                    color: "#052e16",
                    borderRadius: "9999px",
                    width: "1.25rem",
                    height: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {price && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <span style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                {price}
              </span>
              <span style={{ fontSize: "0.875rem", color: "#9ca3af", fontWeight: 400 }}>
                /month
              </span>
              <span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: "0.25rem" }}>
                (tax included)
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handlePlanActivate();
            }}
            disabled={loading}
            style={{
              backgroundColor: "#6366f1",
              border: "none",
              borderRadius: "0.5rem",
              color: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: 600,
              padding: "0.85rem 1.75rem",
              width: "100%",
              opacity: loading ? 0.7 : 1,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(event) => {
              if (!loading) {
                event.currentTarget.style.backgroundColor = "#4f46e5";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "#6366f1";
            }}
          >
            {loading ? "Connecting to DodoPayments…" : "Upgrade now"}
          </button>

          <p
            style={{
              color: "#9ca3af",
              fontSize: "0.8rem",
              marginTop: "0.75rem",
            }}
          >
            No charge is made until you confirm the secure checkout overlay.
          </p>
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
            Secure checkout processed by DodoPayments
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
        setStatus({
          type: "ready",
          premium,
          hasActiveSubscription: hasSubscription,
        });
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
  }, [
    config.apiBaseUrl,
    config.redirectUrl,
    ensurePremiumCookie,
    getToken,
    signOut,
    user,
  ]);

  if (status.type === "loading") {
    return <Loader label="Loading EmbraceBoard…" />;
  }

  if (status.type === "error") {
    return (
      <CenteredContainer>
        <Card maxWidth="26rem" padding="2rem">
          <Heading level={1}>Unable to load your workspace</Heading>
          <Text color="#475467" marginBottom="1.5rem">
            {status.message}
          </Text>
          <ButtonGroup direction="row">
            <Button onClick={handleRetry}>Retry</Button>
            <Button onClick={handleSignOut} variant="secondary">
              Sign out
            </Button>
          </ButtonGroup>
        </Card>
      </CenteredContainer>
    );
  }

  // Check if user is returning from checkout and waiting for webhook
  if (
    status.type === "ready" &&
    !status.hasActiveSubscription &&
    showProcessing
  ) {
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
  const isSettingsPage =
    pathname === "/settings" ||
    pathname.endsWith("/settings") ||
    /\/settings\//.test(pathname);

  if (
    status.type === "ready" &&
    status.hasActiveSubscription &&
    isSettingsPage
  ) {
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
        hasActiveSubscription:
          status.type === "ready" ? status.hasActiveSubscription : false,
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
