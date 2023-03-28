export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  if (
    (typeof process !== "undefined" && process.env?.JEST_WORKER_ID) ||
    !window
  ) {
    return;
  }

  // Uncomment the next line to track locally
  // console.log("Track Event", { category, action, label, value });

  if (process.env?.REACT_APP_GOOGLE_ANALYTICS_ID && window.gtag) {
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

  // MATOMO event tracking _paq must be same as the one in index.html
  if (window._paq) {
    window._paq.push(["trackEvent", category, action, label, value]);
  }
};
