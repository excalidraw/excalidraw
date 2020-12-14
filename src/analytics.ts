export const EVENT_ACTION = "action";
export const EVENT_ALIGN = "align";
export const EVENT_CHANGE = "change";
export const EVENT_DIALOG = "dialog";
export const EVENT_EXIT = "exit";
export const EVENT_IO = "io";
export const EVENT_LAYER = "layer";
export const EVENT_LIBRARY = "library";
export const EVENT_LOAD = "load";
export const EVENT_SHAPE = "shape";
export const EVENT_SHARE = "share";
export const EVENT_MAGIC = "magic";

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
