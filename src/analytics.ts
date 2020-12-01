declare let gtag: Function;

export const EVENT_ACTION = "action";
export const EVENT_EXIT = "exit";

export const trackEvent = (
  name: string,
  category: string,
  label?: string,
  value?: number,
) => {
  if (gtag) {
    gtag("event", name, {
      event_category: category,
      event_label: label,
      value,
    });
  }
};
