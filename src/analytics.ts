export const EVENT_ACTION = "action";
export const EVENT_EXIT = "exit";
export const EVENT_CHANGE = "change";
export const EVENT_SHAPE = "shape";

export const trackEvent = window.gtag
  ? (name: string, category: string, label?: string, value?: number) => {
      window.gtag("event", name, {
        event_category: category,
        event_label: label,
        value,
      });
    }
  : (name: string, category: string, label?: string, value?: number) => {
      console.info("Track Event", name, category, label, value);
    };
