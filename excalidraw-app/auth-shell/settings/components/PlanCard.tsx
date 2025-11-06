import { useState } from "react";

interface PlanCardProps {
  billingInterval: "month" | "year";
  isCurrent: boolean;
  onChangePlan: () => Promise<void>;
  pricePerPeriodCents: number;
  currency: string;
}

export function PlanCard({ billingInterval, isCurrent, onChangePlan, pricePerPeriodCents, currency }: PlanCardProps) {
  const [isChanging, setIsChanging] = useState(false);

  const isMonthly = billingInterval === "month";
  const price = pricePerPeriodCents / 100;
  const pricePerMonth = isMonthly ? price : price / 12;

  // Get currency symbol (basic implementation, can be enhanced)
  const getCurrencySymbol = (curr: string): string => {
    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CAD: "$",
      AUD: "$",
    };
    return symbols[curr] || curr;
  };

  const currencySymbol = getCurrencySymbol(currency);

  const handleChangePlan = async () => {
    if (isCurrent) return;

    if (!window.confirm(`Switch to ${isMonthly ? "monthly" : "yearly"} billing?`)) {
      return;
    }

    setIsChanging(true);
    try {
      await onChangePlan();
    } catch (error) {
      console.error("Failed to change plan:", error);
      alert("Failed to change plan. Please try again.");
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#2c2c2c",
        border: isCurrent ? "2px solid #8b5cf6" : "1px solid #3c3c3c",
        borderRadius: "0.5rem",
        padding: "1.5rem",
        flex: 1,
        minWidth: "280px",
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: "inline-block",
          backgroundColor: "#8b5cf6",
          color: "#ffffff",
          fontSize: "0.75rem",
          fontWeight: 600,
          padding: "0.25rem 0.75rem",
          borderRadius: "0.25rem",
          marginBottom: "1rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {isMonthly ? "Monthly" : "Yearly"}
      </div>

      {/* Plan Name */}
      <h4
        style={{
          color: "#ffffff",
          fontSize: "1.125rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}
      >
        EmbraceBoard Pro
      </h4>

      {/* Price */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            color: "#ffffff",
            fontSize: "2rem",
            fontWeight: 700,
            marginBottom: "0.25rem",
          }}
        >
          {currencySymbol}{price.toFixed(2)}
        </div>
        <div
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
          }}
        >
          {currencySymbol}{pricePerMonth.toFixed(2)} / month {!isMonthly && "(billed yearly)"}
        </div>
      </div>

      {/* Billing Details */}
      <div
        style={{
          backgroundColor: "#1e1e1e",
          borderRadius: "0.375rem",
          padding: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#d1d5db",
            fontSize: "0.875rem",
            marginBottom: "0.5rem",
          }}
        >
          <span>Total price</span>
          <span style={{ fontWeight: 600 }}>{currencySymbol}{price.toFixed(2)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#9ca3af",
            fontSize: "0.8125rem",
          }}
        >
          <span>Billed {isMonthly ? "monthly" : "yearly"}</span>
        </div>
      </div>

      {/* Button */}
      {isCurrent ? (
        <div
          style={{
            backgroundColor: "#3c3c3c",
            color: "#9ca3af",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            textAlign: "center",
            cursor: "not-allowed",
          }}
        >
          Current plan
        </div>
      ) : (
        <button
          onClick={handleChangePlan}
          disabled={isChanging}
          style={{
            width: "100%",
            backgroundColor: "#8b5cf6",
            color: "#ffffff",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: isChanging ? "not-allowed" : "pointer",
            opacity: isChanging ? 0.6 : 1,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isChanging) {
              e.currentTarget.style.backgroundColor = "#7c3aed";
            }
          }}
          onMouseLeave={(e) => {
            if (!isChanging) {
              e.currentTarget.style.backgroundColor = "#8b5cf6";
            }
          }}
        >
          {isChanging ? "Changing plan..." : "Change plan →"}
        </button>
      )}
    </div>
  );
}
