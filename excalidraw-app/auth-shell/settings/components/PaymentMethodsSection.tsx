import { useState, useEffect } from "react";
import { PaymentMethodCard, PaymentMethod } from "./PaymentMethodCard";
import { AddPaymentMethodModal } from "./AddPaymentMethodModal";
import { trackEvent } from "../../../../packages/excalidraw/analytics";

interface PaymentMethodsSectionProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
}

export function PaymentMethodsSection({ apiBaseUrl, getToken }: PaymentMethodsSectionProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const baseUrl = apiBaseUrl || window.location.origin;
      const response = await fetch(`${baseUrl}/api/subscription/payment-methods`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to fetch payment methods: ${response.statusText}`);
      }

      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
    } catch (err: any) {
      console.error("Error fetching payment methods:", err);
      setError(err.message || "Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, [apiBaseUrl]);

  const openCustomerPortal = async () => {
    trackEvent("settings", "customer_portal_requested");

    try {
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
        // Portal available - open it in new tab
        trackEvent("settings", "customer_portal_opened");
        window.open(data.portalUrl, "_blank");
      } else if (data.canViewInvoices) {
        // Portal not available but invoices can be viewed
        trackEvent("settings", "customer_portal_unavailable");
        alert(data.message || "Customer portal is not available. You can view your invoices in the Billing section.");
      } else {
        trackEvent("settings", "customer_portal_failed");
        throw new Error(data.message || "Failed to access customer portal");
      }
    } catch (err: any) {
      console.error("Failed to open customer portal:", err);
      trackEvent("settings", "customer_portal_error");
      alert(`Failed to open customer portal: ${err.message || "Unknown error"}`);
    }
  };

  const handleRemove = async (paymentMethodId: string) => {
    // Payment method removal is handled via Paddle's customer portal
    // The portal provides a secure interface for managing payment methods
    await openCustomerPortal();
  };

  const handleAddCard = () => {
    trackEvent("settings", "add_card_clicked");
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
  };

  const handlePaymentMethodAdded = async () => {
    trackEvent("settings", "payment_method_added");
    setShowAddModal(false);
    // Refresh payment methods list
    await fetchPaymentMethods();
  };

  return (
    <div
      style={{
        backgroundColor: "#2c2c2c",
        border: "1px solid #3c3c3c",
        borderRadius: "0.5rem",
        padding: "1.5rem",
        marginBottom: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3
          style={{
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Payment Methods
        </h3>

        <button
          onClick={handleAddCard}
          style={{
            backgroundColor: "#8b5cf6",
            color: "#ffffff",
            border: "none",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#7c3aed";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#8b5cf6";
          }}
        >
          + Add Card
        </button>
      </div>

      {loading && (
        <div style={{ color: "#9ca3af", fontSize: "0.875rem", padding: "2rem", textAlign: "center" }}>
          Loading payment methods...
        </div>
      )}

      {error && (
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
      )}

      {!loading && !error && paymentMethods.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "#9ca3af",
            fontSize: "0.875rem",
          }}
        >
          <p style={{ marginBottom: "0.5rem" }}>No payment methods saved</p>
          <p style={{ fontSize: "0.8125rem" }}>
            Add a card to make future payments easier
          </p>
        </div>
      )}

      {!loading && !error && paymentMethods.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {paymentMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              paymentMethod={method}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={showAddModal}
        onClose={handleModalClose}
        onSuccess={handlePaymentMethodAdded}
        apiBaseUrl={apiBaseUrl}
        getToken={getToken}
      />
    </div>
  );
}
