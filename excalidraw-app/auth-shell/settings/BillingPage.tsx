import { InvoicesSection } from "./components/InvoicesSection";
import { PaymentMethodsSection } from "./components/PaymentMethodsSection";
import { BillingInfoSection } from "./components/BillingInfoSection";

interface BillingPageProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
}

export function BillingPage({ apiBaseUrl, getToken }: BillingPageProps) {
  return (
    <div style={{ padding: "2rem" }}>
      <h2
        style={{
          color: "#ffffff",
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        Billing
      </h2>

      <BillingInfoSection apiBaseUrl={apiBaseUrl} getToken={getToken} />

      <PaymentMethodsSection apiBaseUrl={apiBaseUrl} getToken={getToken} />

      <InvoicesSection apiBaseUrl={apiBaseUrl} getToken={getToken} />
    </div>
  );
}
