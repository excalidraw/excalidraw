import { useState, useEffect } from "react";
import { InvoiceTable } from "./InvoiceTable";

interface Transaction {
  id: string;
  invoiceNumber: string;
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

interface InvoicesSectionProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
}

export function InvoicesSection({ apiBaseUrl, getToken }: InvoicesSectionProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        const baseUrl = apiBaseUrl || window.location.origin;
        const response = await fetch(`${baseUrl}/api/subscription/invoices`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch invoices");
        }

        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (err) {
        console.error("Error fetching invoices:", err);
        setError(err instanceof Error ? err.message : "Failed to load invoices");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [apiBaseUrl, getToken]);

  // Separate upcoming (draft/pending) and past (paid/failed/refunded) invoices
  const upcomingInvoices = transactions
    .filter((t) => ["draft", "pending"].includes(t.status.toLowerCase()))
    .slice(0, 1); // Only show the next upcoming invoice

  const pastInvoices = transactions.filter((t) =>
    ["paid", "completed", "failed", "refunded", "canceled"].includes(t.status.toLowerCase())
  );

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
        }}
      >
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          Loading invoices...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.375rem",
            color: "#991b1b",
            padding: "0.75rem",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

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
          marginBottom: "1.5rem",
        }}
      >
        Invoices
      </h3>

      {/* Upcoming Invoices */}
      {upcomingInvoices.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h4
            style={{
              color: "#9ca3af",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "0.75rem",
            }}
          >
            Upcoming Invoices
          </h4>
          <InvoiceTable transactions={upcomingInvoices} showViewLink={false} />
        </div>
      )}

      {/* Past Invoices */}
      <div>
        <h4
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
          }}
        >
          Past Invoices
        </h4>
        <InvoiceTable transactions={pastInvoices} showViewLink={true} />
      </div>

      {transactions.length === 0 && (
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          No invoices found. Invoices will appear here after your first payment.
        </p>
      )}
    </div>
  );
}
