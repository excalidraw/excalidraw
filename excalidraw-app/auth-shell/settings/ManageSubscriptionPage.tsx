import { PlanSelectionCards } from "./components/PlanSelectionCards";
import { CancelSubscription } from "./components/CancelSubscription";

interface ManageSubscriptionPageProps {
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
}

export function ManageSubscriptionPage({ apiBaseUrl, getToken }: ManageSubscriptionPageProps) {
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
        Manage Subscription
      </h2>

      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          marginBottom: "2rem",
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
          Change subscription plan
        </h3>

        <PlanSelectionCards apiBaseUrl={apiBaseUrl} getToken={getToken} />
      </div>

      <CancelSubscription apiBaseUrl={apiBaseUrl} getToken={getToken} />
    </div>
  );
}
