import { useEffect, useRef, useState } from "react";
import { trackEvent } from "../../../../packages/excalidraw/analytics";

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
}

export function AddPaymentMethodModal({
  isOpen,
  onClose,
  onSuccess,
  apiBaseUrl,
  getToken,
}: AddPaymentMethodModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const checkoutRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    const initPaddleCheckout = async () => {
      try {
        setLoading(true);
        setError(null);

        trackEvent("settings", "add_payment_method_modal_opened");

        // Get customer portal URL which contains transaction to add payment method
        const token = await getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        const baseUrl = apiBaseUrl || window.location.origin;
        const response = await fetch(`${baseUrl}/api/subscription/portal`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!data.portalUrl) {
          throw new Error(data.message || "Failed to get customer portal URL");
        }

        // Open portal URL in iframe
        // Note: Paddle's portal cannot be embedded directly in iframe due to X-Frame-Options
        // We need to use their inline checkout instead
        setError(
          "Paddle requires opening the customer portal in a new window for security. " +
          "Click the button below to manage payment methods securely."
        );
      } catch (err: any) {
        console.error("Failed to initialize payment method form:", err);
        setError(err.message || "Failed to load payment form");
        trackEvent("settings", "add_payment_method_modal_error");
      } finally {
        setLoading(false);
      }
    };

    initPaddleCheckout();

    return () => {
      // Cleanup
      if (checkoutRef.current) {
        checkoutRef.current = null;
      }
    };
  }, [isOpen, apiBaseUrl, getToken]);

  const handleOpenPortal = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
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
        trackEvent("settings", "customer_portal_opened_from_modal");
        window.open(data.portalUrl, "_blank");
        onClose();
      }
    } catch (err: any) {
      console.error("Failed to open portal:", err);
      setError(err.message || "Failed to open customer portal");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#2c2c2c",
          borderRadius: "0.5rem",
          width: "90%",
          maxWidth: "500px",
          padding: "2rem",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            color: "#9ca3af",
            fontSize: "1.5rem",
            cursor: "pointer",
            padding: "0.5rem",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#9ca3af";
          }}
        >
          ×
        </button>

        {/* Header */}
        <h2
          style={{
            color: "#ffffff",
            fontSize: "1.5rem",
            fontWeight: 600,
            marginBottom: "0.5rem",
          }}
        >
          Add payment method
        </h2>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          (will be made as the default payment method)
        </p>

        {/* Content */}
        {loading && (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            Loading payment form...
          </div>
        )}

        {!loading && error && (
          <div>
            <div
              style={{
                backgroundColor: "#1e1e1e",
                border: "1px solid #3c3c3c",
                borderRadius: "0.375rem",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <p
                style={{
                  color: "#9ca3af",
                  fontSize: "0.875rem",
                  lineHeight: "1.6",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </p>
            </div>

            <button
              onClick={handleOpenPortal}
              style={{
                width: "100%",
                backgroundColor: "#8b5cf6",
                color: "#ffffff",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
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
              Open Customer Portal
            </button>
          </div>
        )}

        {/* Iframe container - for future Paddle inline integration */}
        {!loading && !error && (
          <div
            style={{
              backgroundColor: "#1e1e1e",
              border: "1px solid #3c3c3c",
              borderRadius: "0.375rem",
              padding: "1.5rem",
              minHeight: "300px",
            }}
          >
            <div
              style={{
                color: "#9ca3af",
                fontSize: "0.875rem",
                textAlign: "center",
                padding: "2rem",
              }}
            >
              Payment form will be embedded here
            </div>
          </div>
        )}

        {/* Security note */}
        <p
          style={{
            color: "#6b7280",
            fontSize: "0.8125rem",
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          We do not store any credit card information. The whole transaction is
          handled securely by Paddle.
        </p>
      </div>
    </div>
  );
}
