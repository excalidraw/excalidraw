// place here categories that you want to track. We want to track just a
// small subset of categories at a given time.
const ALLOWED_CATEGORIES_TO_TRACK = ["ai", "command_palette"] as string[];

export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  try {
    // prettier-ignore
    if (
      typeof window === "undefined"
      || import.meta.env.VITE_WORKER_ID
      // comment out to debug locally
      || import.meta.env.PROD
    ) {
      return;
    }

    if (!ALLOWED_CATEGORIES_TO_TRACK.includes(category)) {
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
