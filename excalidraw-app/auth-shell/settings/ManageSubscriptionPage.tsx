import { useState, useEffect } from "react";
import { PlanCard } from "./components/PlanCard";
import { CancelSubscription } from "./components/CancelSubscription";
import { trackEvent } from "../../../packages/excalidraw/analytics";

interface PlanPricing {
  pricePerPeriodCents: number;
  pricePerPeriod: string;
  currency: string;
}

interface Subscription {
  id: string;
  tier: string;
  status: string;
  billingInterval: "month" | "year";
  pricePerPeriod: string;
  pricePerPeriodCents: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface SubscriptionResponse {
  subscription: Subscription;
  pricing: {
    monthly: PlanPricing;
  };
}

interface ManageSubscriptionPageProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
}

export function ManageSubscriptionPage({
  apiBaseUrl,
  getToken,
}: ManageSubscriptionPageProps) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No authentication token available");
        }

        const baseUrl = apiBaseUrl || window.location.origin;
        const response = await fetch(`${baseUrl}/api/subscription`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.message ||
              `Failed to fetch subscription: ${response.statusText}`,
          );
        }

        const data: SubscriptionResponse = await response.json();
        setSubscriptionData(data);
      } catch (err: any) {
        console.error("Error fetching subscription:", err);
        setError(err.message || "Failed to load subscription");
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [apiBaseUrl, getToken]);

  const openCustomerPortal = async () => {
    trackEvent("settings", "customer_portal_requested_manage");

    try {
      setOpeningPortal(true);
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const baseUrl = apiBaseUrl || window.location.origin;
      const response = await fetch(`${baseUrl}/api/subscription/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.portalUrl) {
        trackEvent("settings", "customer_portal_opened_manage");
        window.open(data.portalUrl, "_blank");
      } else if (data.canViewInvoices) {
        trackEvent("settings", "customer_portal_unavailable_manage");
        alert(
          data.message ||
            "Customer portal is not available right now. Please try again later.",
        );
      } else {
        throw new Error(data.message || "Failed to open customer portal");
      }
    } catch (error: any) {
      console.error("Failed to open customer portal:", error);
      trackEvent("settings", "customer_portal_error_manage");
      alert(
        `Failed to open customer portal: ${error.message || "Unknown error"}`,
      );
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2
        style={{
          color: "#ffffff",
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        Manage Subscription
      </h2>

      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {loading ? (
          <div
            style={{
              color: "#9ca3af",
              fontSize: "0.875rem",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            Loading subscription details...
          </div>
        ) : error ? (
          <div
            style={{
              backgroundColor: "#7f1d1d",
              border: "1px solid #991b1b",
              borderRadius: "0.375rem",
              padding: "1rem",
              color: "#fca5a5",
              fontSize: "0.875rem",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        ) : subscriptionData ? (
          <>
            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <PlanCard
                pricePerPeriodCents={
                  subscriptionData.pricing.monthly.pricePerPeriodCents
                }
                currency={subscriptionData.pricing.monthly.currency}
              />
            </div>

            {subscriptionData.subscription.billingInterval === "year" && (
              <p
                style={{
                  color: "#fbbf24",
                  fontSize: "0.875rem",
                  marginTop: "1rem",
                }}
              >
                You're currently on a legacy annual plan. Switch above to move
                to the new monthly billing.
              </p>
            )}
          </>
        ) : null}
      </div>

      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          marginBottom: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            lineHeight: "1.6",
          }}
        >
          Manage payment methods, view invoices, or download receipts directly
          from the secure DodoPayments customer portal.
        </div>
        <button
          onClick={openCustomerPortal}
          disabled={openingPortal}
          style={{
            alignSelf: "flex-start",
            backgroundColor: "#8b5cf6",
            border: "none",
            borderRadius: "0.375rem",
            color: "#ffffff",
            cursor: openingPortal ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
            padding: "0.75rem 1.5rem",
            opacity: openingPortal ? 0.65 : 1,
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!openingPortal) {
              e.currentTarget.style.backgroundColor = "#7c3aed";
            }
          }}
          onMouseLeave={(e) => {
            if (!openingPortal) {
              e.currentTarget.style.backgroundColor = "#8b5cf6";
            }
          }}
        >
          {openingPortal ? "Opening portal..." : "Open Customer Portal"}
        </button>
      </div>

      <CancelSubscription apiBaseUrl={apiBaseUrl} getToken={getToken} />
    </div>
  );
}
