// place here categories that you want to track. We want to track just a
// small subset of categories at a given time.
const ALLOWED_CATEGORIES_TO_TRACK = new Set(["command_palette", "export"]);

export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  try {
    if (
      typeof window === "undefined" ||
      import.meta.env.VITE_WORKER_ID ||
      import.meta.env.VITE_APP_ENABLE_TRACKING !== "true"
    ) {
      return;
    }

    if (!ALLOWED_CATEGORIES_TO_TRACK.has(category)) {
      return;
    }

    if (import.meta.env.DEV) {
      // comment out to debug in dev
      return;
    }

    if (!import.meta.env.PROD) {
      console.info("trackEvent", { category, action, label, value });
    }

    if (window.sa_event) {
      window.sa_event(action, {
        category,
        label,
        value,
      });
    }
  } catch (error) {
    console.error("error during analytics", error);
  }
};
