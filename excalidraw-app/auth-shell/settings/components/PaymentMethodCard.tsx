import { useState } from "react";

interface CardDetails {
  type: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
}

interface PayPalDetails {
  email: string;
}

export interface PaymentMethod {
  id: string;
  customerId: string;
  type: "card" | "paypal";
  card: CardDetails | null;
  paypal: PayPalDetails | null;
  savedAt: string;
  updatedAt: string;
}

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
  onRemove?: (id: string) => void;
}

export function PaymentMethodCard({ paymentMethod, onRemove }: PaymentMethodCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    if (!onRemove) return;

    if (window.confirm("Are you sure you want to remove this payment method?")) {
      setIsRemoving(true);
      try {
        await onRemove(paymentMethod.id);
      } catch (error) {
        console.error("Failed to remove payment method:", error);
        alert("Failed to remove payment method. Please try again.");
      } finally {
        setIsRemoving(false);
      }
    }
  };

  // Get card brand display name
  const getCardBrand = (type: string): string => {
    const brands: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "American Express",
      discover: "Discover",
      diners_club: "Diners Club",
      jcb: "JCB",
      unionpay: "UnionPay",
    };
    return brands[type.toLowerCase()] || type;
  };

  // Check if card is expired
  const isExpired = (): boolean => {
    if (!paymentMethod.card) return false;
    const now = new Date();
    const expiry = new Date(paymentMethod.card.expiryYear, paymentMethod.card.expiryMonth - 1);
    return expiry < now;
  };

  // Format expiry date
  const formatExpiry = (month: number, year: number): string => {
    return `${String(month).padStart(2, "0")}/${year}`;
  };

  const expired = isExpired();

  return (
    <div
      style={{
        backgroundColor: "#2c2c2c",
        border: "1px solid #3c3c3c",
        borderRadius: "0.5rem",
        padding: "1.25rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ flex: 1 }}>
        {paymentMethod.type === "card" && paymentMethod.card && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Card Icon */}
            <div
              style={{
                width: "48px",
                height: "32px",
                backgroundColor: "#3c3c3c",
                borderRadius: "0.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#9ca3af",
              }}
            >
              CARD
            </div>

            <div style={{ flex: 1 }}>
              {/* Card Brand and Last 4 */}
              <div
                style={{
                  color: "#ffffff",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                {getCardBrand(paymentMethod.card.type)} •••• {paymentMethod.card.last4}
              </div>

              {/* Cardholder Name and Expiry */}
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                {paymentMethod.card.cardholderName && (
                  <span>{paymentMethod.card.cardholderName}</span>
                )}
                <span>
                  Expires {formatExpiry(paymentMethod.card.expiryMonth, paymentMethod.card.expiryYear)}
                </span>
              </div>

              {/* Status Badge */}
              {expired && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "inline-block",
                  }}
                >
                  <span
                    style={{
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    EXPIRED
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {paymentMethod.type === "paypal" && paymentMethod.paypal && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* PayPal Icon */}
            <div
              style={{
                width: "48px",
                height: "32px",
                backgroundColor: "#3c3c3c",
                borderRadius: "0.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#9ca3af",
              }}
            >
              PP
            </div>

            <div style={{ flex: 1 }}>
              {/* PayPal Label */}
              <div
                style={{
                  color: "#ffffff",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                PayPal
              </div>

              {/* PayPal Email */}
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "0.875rem",
                }}
              >
                {paymentMethod.paypal.email}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {onRemove && (
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          style={{
            backgroundColor: "transparent",
            border: "1px solid #ef4444",
            color: "#ef4444",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: isRemoving ? "not-allowed" : "pointer",
            opacity: isRemoving ? 0.6 : 1,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isRemoving) {
              e.currentTarget.style.backgroundColor = "#ef4444";
              e.currentTarget.style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            if (!isRemoving) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#ef4444";
            }
          }}
        >
          {isRemoving ? "Removing..." : "Remove"}
        </button>
      )}
    </div>
  );
}
