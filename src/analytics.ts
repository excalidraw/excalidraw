export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  try {
    // place here categories that you want to track as events
    // KEEP IN MIND THE PRICING
    const ALLOWED_CATEGORIES_TO_TRACK = [] as string[];
    // Uncomment the next line to track locally
    // console.log("Track Event", { category, action, label, value });

    if (typeof window === "undefined" || import.meta.env.VITE_WORKER_ID) {
      return;
    }

    if (!ALLOWED_CATEGORIES_TO_TRACK.includes(category)) {
      return;
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
