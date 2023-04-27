export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  try {
    // Uncomment the next line to track locally
    // console.log("Track Event", { category, action, label, value });

    if (typeof window === "undefined" || process.env.JEST_WORKER_ID) {
      return;
    }

    if (process.env.REACT_APP_GOOGLE_ANALYTICS_ID && window.gtag) {
      window.gtag("event", action, {
        event_category: category,
        event_label: label,
        value,
      });
    }

    if (window.sa_event) {
      window.sa_event(action, {
        category,
        label,
        value,
      });
    }

    if (window.fathom) {
      window.fathom.trackEvent(action, {
        category,
        label,
        value,
      });
    }
  } catch (error) {
    console.error("error during analytics", error);
  }
};
