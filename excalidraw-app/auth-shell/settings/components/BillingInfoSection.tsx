import { useState, useEffect } from "react";
import { EditableField } from "./EditableField";
import { trackEvent } from "../../../../packages/excalidraw/analytics";

interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface BillingInfo {
  billingEmail: string;
  billingAddress: BillingAddress | null;
  companyName?: string;
  vatId?: string;
}

interface BillingInfoSectionProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
}

export function BillingInfoSection({ apiBaseUrl, getToken }: BillingInfoSectionProps) {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const baseUrl = apiBaseUrl || window.location.origin;
      const response = await fetch(`${baseUrl}/api/subscription/billing-info`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to fetch billing info: ${response.statusText}`);
      }

      const data = await response.json();
      setBillingInfo(data);
    } catch (err: any) {
      console.error("Error fetching billing info:", err);
      setError(err.message || "Failed to load billing information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingInfo();
  }, [apiBaseUrl]);

  const updateField = async (field: string, value: any) => {
    trackEvent("settings", "billing_info_update_initiated", field);

    const token = await getToken();
    if (!token) {
      throw new Error("No authentication token available");
    }

    const baseUrl = apiBaseUrl || window.location.origin;
    const response = await fetch(`${baseUrl}/api/subscription/billing-info`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [field]: value }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      trackEvent("settings", "billing_info_update_failed", field);
      throw new Error(errorData?.message || "Failed to update billing information");
    }

    trackEvent("settings", "billing_info_updated", field);

    // Refresh billing info
    await fetchBillingInfo();
  };

  const formatAddress = (address: BillingAddress | null): string => {
    if (!address) return "";

    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);

    return parts.join(", ");
  };

  const handleAddressSave = async (addressString: string) => {
    // Parse address string (simple parsing - in production, use a proper address form)
    const parts = addressString.split(",").map((s) => s.trim());
    const address: BillingAddress = {
      line1: parts[0] || "",
      line2: parts[1] || "",
      city: parts[2] || "",
      state: parts[3] || "",
      postalCode: parts[4] || "",
      country: parts[5] || "US",
    };

    await updateField("billingAddress", address);
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
      <h3
        style={{
          color: "#ffffff",
          fontSize: "1rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        Billing Information
      </h3>

      {loading && (
        <div style={{ color: "#9ca3af", fontSize: "0.875rem", padding: "2rem", textAlign: "center" }}>
          Loading billing information...
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
            marginBottom: "1rem",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && billingInfo && (
        <div>
          <EditableField
            label="Billing email"
            value={billingInfo.billingEmail}
            subtitle="Invoices are being sent to"
            placeholder="email@example.com"
            onSave={(value) => updateField("billingEmail", value)}
          />

          <EditableField
            label="Billing address"
            value={formatAddress(billingInfo.billingAddress)}
            subtitle="Address will be added to all future invoices"
            placeholder="Street, City, State, ZIP, Country"
            onSave={handleAddressSave}
            multiline
          />

          <EditableField
            label="Company Name"
            value={billingInfo.companyName}
            subtitle="Company name will be added to all future invoices"
            placeholder="No company name set"
            onSave={(value) => updateField("companyName", value)}
          />

          <EditableField
            label="VAT ID"
            value={billingInfo.vatId}
            subtitle="VAT ID will be added to all future invoices"
            placeholder="No VAT ID set"
            onSave={(value) => updateField("vatId", value)}
          />
        </div>
      )}
    </div>
  );
}
