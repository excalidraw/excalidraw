export const EVENT_CHANGE = "change";
export const EVENT_MAGIC = "magic";

export const trackEvent =
  process.env.REACT_APP_INCLUDE_GTAG &&
  typeof window !== "undefined" &&
  window.gtag
    ? (category: string, name: string, label?: string, value?: number) => {
        window.gtag("event", name, {
          event_category: category,
          event_label: label,
          value,
        });
      }
    : typeof process !== "undefined" && process?.env?.JEST_WORKER_ID
    ? (category: string, name: string, label?: string, value?: number) => {}
    : (category: string, name: string, label?: string, value?: number) => {
        // Uncomment the next line to track locally
        // console.info("Track Event", category, name, label, value);
      };
