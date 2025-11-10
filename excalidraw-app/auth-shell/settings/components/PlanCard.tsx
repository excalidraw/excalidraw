interface PlanCardProps {
  pricePerPeriodCents: number;
  currency: string;
}

export function PlanCard({ pricePerPeriodCents, currency }: PlanCardProps) {
  const price = pricePerPeriodCents / 100;

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

  return (
    <div
      style={{
        backgroundColor: "#2c2c2c",
        border: "2px solid #8b5cf6",
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
        Monthly
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
        AI
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
          {currencySymbol}
          {price.toFixed(2)}
        </div>
        <div
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
          }}
        >
          per month
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
          <span style={{ fontWeight: 600 }}>
            {currencySymbol}
            {price.toFixed(2)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#9ca3af",
            fontSize: "0.8125rem",
          }}
        >
          <span>Billed monthly</span>
        </div>
      </div>

    </div>
  );
}
