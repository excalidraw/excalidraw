export const trackEvent =
  typeof process !== "undefined" &&
  process.env?.REACT_APP_GOOGLE_ANALYTICS_ID &&
  typeof window !== "undefined" &&
  window.gtag
    ? (category: string, action: string, label?: string, value?: number) => {
        try {
          window.gtag("event", action, {
            event_category: category,
            event_label: label,
            value,
          });
        } catch (error) {
          console.error("error logging to ga", error);
        }
      }
    : typeof process !== "undefined" && process.env?.JEST_WORKER_ID
    ? (category: string, action: string, label?: string, value?: number) => {}
    : (category: string, action: string, label?: string, value?: number) => {
        // Uncomment the next line to track locally
        // console.log("Track Event", { category, action, label, value });
      };
