import { useState } from "react";
import { trackEvent } from "../../../../packages/excalidraw/analytics";

interface CancelSubscriptionProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
  onCanceled?: () => void;
}

export function CancelSubscription({ apiBaseUrl, getToken, onCanceled }: CancelSubscriptionProps) {
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancel = async () => {
    trackEvent("settings", "cancel_subscription_clicked");

    const confirmed = window.confirm(
      "Are you sure you want to cancel your subscription?\n\n" +
        "Your subscription will remain active until the end of the current billing period. " +
        "After that, you will lose access to all premium features.\n\n" +
        "This action cannot be undone."
    );

    if (!confirmed) {
      trackEvent("settings", "cancel_subscription_aborted");
      return;
    }

    setIsCanceling(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const baseUrl = apiBaseUrl || window.location.origin;
      const response = await fetch(`${baseUrl}/api/subscription/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        trackEvent("settings", "cancel_subscription_failed");
        throw new Error(errorData?.message || "Failed to cancel subscription");
      }

      const data = await response.json();

      trackEvent("settings", "subscription_canceled");

      if (onCanceled) {
        onCanceled();
      }

      alert(
        `Your subscription has been scheduled for cancellation.\n\n` +
          `You will retain access until ${new Date(data.currentPeriodEnd).toLocaleDateString()}.`
      );
    } catch (error: any) {
      console.error("Failed to cancel subscription:", error);
      alert(`Failed to cancel subscription: ${error.message || "Unknown error"}`);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#2c2c2c",
        border: "1px solid #3c3c3c",
        borderRadius: "0.5rem",
        padding: "1.5rem",
      }}
    >
      <h3
        style={{
          color: "#ffffff",
          fontSize: "1rem",
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        Cancel your subscription
      </h3>

      <p
        style={{
          color: "#9ca3af",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          marginBottom: "1.5rem",
        }}
      >
        Your subscription will remain active until the end of the current billing period.
      </p>

      <button
        onClick={handleCancel}
        disabled={isCanceling}
        style={{
          backgroundColor: "#ef4444",
          color: "#ffffff",
          border: "none",
          padding: "0.75rem 1.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: isCanceling ? "not-allowed" : "pointer",
          opacity: isCanceling ? 0.6 : 1,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!isCanceling) {
            e.currentTarget.style.backgroundColor = "#dc2626";
          }
        }}
        onMouseLeave={(e) => {
          if (!isCanceling) {
            e.currentTarget.style.backgroundColor = "#ef4444";
          }
        }}
      >
        {isCanceling ? "Canceling..." : "Cancel subscription"}
      </button>
    </div>
  );
}
