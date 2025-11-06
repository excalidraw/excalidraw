import { useState, useEffect } from "react";
import { PlanCard } from "./PlanCard";
import { trackEvent } from "../../../../packages/excalidraw/analytics";

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
    yearly: PlanPricing;
  };
}

interface PlanSelectionCardsProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
  onPlanChanged?: () => void;
}

export function PlanSelectionCards({ apiBaseUrl, getToken, onPlanChanged }: PlanSelectionCardsProps) {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error(errorData?.message || `Failed to fetch subscription: ${response.statusText}`);
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

  useEffect(() => {
    fetchSubscription();
  }, [apiBaseUrl]);

  const handleChangePlan = async (newBillingInterval: "month" | "year") => {
    trackEvent("settings", "plan_change_initiated", newBillingInterval);

    const token = await getToken();
    if (!token) {
      throw new Error("No authentication token available");
    }

    const baseUrl = apiBaseUrl || window.location.origin;
    const response = await fetch(`${baseUrl}/api/subscription/update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ billingInterval: newBillingInterval }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      trackEvent("settings", "plan_change_failed", newBillingInterval);
      throw new Error(errorData?.message || "Failed to change plan");
    }

    trackEvent("settings", "plan_changed", newBillingInterval);

    // Refresh subscription data
    await fetchSubscription();

    if (onPlanChanged) {
      onPlanChanged();
    }

    alert(`Plan successfully changed to ${newBillingInterval}ly billing!`);
  };

  if (loading) {
    return (
      <div style={{ color: "#9ca3af", fontSize: "0.875rem", padding: "2rem", textAlign: "center" }}>
        Loading subscription details...
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!subscriptionData) {
    return null;
  }

  const { subscription, pricing } = subscriptionData;

  return (
    <div>
      <p
        style={{
          color: "#9ca3af",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          marginBottom: "1.5rem",
        }}
      >
        The subscription plan will be changed immediately, and you will be billed for the new plan right away.
        However, you will be credited for unused time on your subscription.
      </p>

      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <PlanCard
          billingInterval="month"
          isCurrent={subscription.billingInterval === "month"}
          onChangePlan={() => handleChangePlan("month")}
          pricePerPeriodCents={pricing.monthly.pricePerPeriodCents}
          currency={pricing.monthly.currency}
        />

        <PlanCard
          billingInterval="year"
          isCurrent={subscription.billingInterval === "year"}
          onChangePlan={() => handleChangePlan("year")}
          pricePerPeriodCents={pricing.yearly.pricePerPeriodCents}
          currency={pricing.yearly.currency}
        />
      </div>
    </div>
  );
}
