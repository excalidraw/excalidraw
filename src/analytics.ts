export const EVENT_ACTION = "action";
export const EVENT_EXIT = "exit";
export const EVENT_CHANGE = "change";
export const EVENT_SHAPE = "shape";
export const EVENT_LAYER = "layer";
export const EVENT_ALIGN = "align";

export const trackEvent = window.gtag
  ? (category: string, name: string, label?: string, value?: number) => {
      window.gtag("event", name, {
        event_category: category,
        event_label: label,
        value,
      });
    }
  : (category: string, name: string, label?: string, value?: number) => {
      console.info("Track Event", category, name, label, value);
    };
