export type BillingInterval = "month" | "year";

export const useCheckout = () => {
  const openCheckout = (billingInterval: BillingInterval = "month") => {
    const url = new URL(window.location.href);
    url.pathname = "/subscribe";
    url.searchParams.set("plan", billingInterval);
    window.location.assign(url.toString());
  };

  return {
    openCheckout,
    loading: false,
    error: null as string | null,
  };
};
