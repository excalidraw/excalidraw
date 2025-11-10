interface Transaction {
  id: string;
  status: string;
  total: string;
  subtotal: string;
  tax: string;
  currencyCode: string;
  createdAt: string;
  billedAt: string;
  invoiceUrl?: string;
  receiptUrl?: string;
}

interface InvoiceTableProps {
  transactions: Transaction[];
  showViewLink?: boolean;
}

export function InvoiceTable({ transactions, showViewLink = false }: InvoiceTableProps) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      paid: { bg: "#10b981", color: "#ffffff" },
      completed: { bg: "#10b981", color: "#ffffff" },
      draft: { bg: "#6b7280", color: "#ffffff" },
      pending: { bg: "#f59e0b", color: "#ffffff" },
      failed: { bg: "#ef4444", color: "#ffffff" },
      refunded: { bg: "#9ca3af", color: "#ffffff" },
      canceled: { bg: "#6b7280", color: "#ffffff" },
    };

    const style = styles[status.toLowerCase()] || { bg: "#6b7280", color: "#ffffff" };

    return (
      <span
        style={{
          backgroundColor: style.bg,
          borderRadius: "0.25rem",
          color: style.color,
          fontSize: "0.75rem",
          fontWeight: 600,
          padding: "0.25rem 0.5rem",
          textTransform: "capitalize",
        }}
      >
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAmount = (amount: string, currency: string) => {
    // Amount comes as cents/minor unit string, convert to decimal
    const numAmount = parseFloat(amount || '0') / 100;

    // Handle NaN case
    if (isNaN(numAmount)) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(0);
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(numAmount);
  };

  if (transactions.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontSize: "0.875rem", padding: "1rem 0" }}>
        No invoices found.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          color: "#ffffff",
          fontSize: "0.875rem",
          width: "100%",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid #3c3c3c",
            }}
          >
            <th
              style={{
                color: "#9ca3af",
                fontWeight: 600,
                padding: "0.75rem 1rem",
                textAlign: "left",
              }}
            >
              Date
            </th>
            <th
              style={{
                color: "#9ca3af",
                fontWeight: 600,
                padding: "0.75rem 1rem",
                textAlign: "left",
              }}
            >
              Status
            </th>
            <th
              style={{
                color: "#9ca3af",
                fontWeight: 600,
                padding: "0.75rem 1rem",
                textAlign: "right",
              }}
            >
              Total
            </th>
            {showViewLink && (
              <th
                style={{
                  color: "#9ca3af",
                  fontWeight: 600,
                  padding: "0.75rem 1rem",
                  textAlign: "right",
                }}
              >
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              style={{
                borderBottom: "1px solid #2c2c2c",
              }}
            >
              <td style={{ padding: "0.75rem 1rem" }}>
                {formatDate(transaction.billedAt || transaction.createdAt)}
              </td>
              <td style={{ padding: "0.75rem 1rem" }}>
                {getStatusBadge(transaction.status)}
              </td>
              <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 600 }}>
                {formatAmount(transaction.total, transaction.currencyCode)}
              </td>
              {showViewLink && (
                <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                  {transaction.invoiceUrl || transaction.receiptUrl ? (
                    <a
                      href={transaction.invoiceUrl || transaction.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#8b5cf6",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = "underline";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = "none";
                      }}
                    >
                      View →
                    </a>
                  ) : (
                    <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>-</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
