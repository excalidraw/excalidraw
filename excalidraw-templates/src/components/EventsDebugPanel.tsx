import { useState } from "react";
import { LocalStorageSink, type AnalyticsEvent } from "../lib/events";
import "./EventsDebugPanel.css";

/** Dev-only. Dumps the LocalStorageSink ring buffer as JSON for inspection. */
export function EventsDebugPanel() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  const refresh = () => setEvents(LocalStorageSink.readAll());

  const toggle = () => {
    if (!open) refresh();
    setOpen((o) => !o);
  };

  return (
    <div className="events-debug-panel">
      <button
        type="button"
        className="events-debug-panel__toggle"
        onClick={toggle}
      >
        {open ? "Close events" : `Events (${LocalStorageSink.readAll().length})`}
      </button>
      {open && (
        <div className="events-debug-panel__body">
          <div className="events-debug-panel__actions">
            <button type="button" onClick={refresh}>
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                LocalStorageSink.clear();
                refresh();
              }}
            >
              Clear
            </button>
          </div>
          <pre className="events-debug-panel__json">
            {JSON.stringify(events, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
