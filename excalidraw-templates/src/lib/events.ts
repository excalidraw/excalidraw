// Analytics adapter. track() is the only call sites should use; sinks are
// swappable behind the Sink interface so a real destination can replace
// ConsoleSink/LocalStorageSink later without touching call sites.

export type EventName =
  | "template_strip_shown"
  | "template_selected"
  | "prompt_submitted"
  | "generation_succeeded"
  | "generation_failed"
  | "repair_attempted"
  | "type_mismatch_corrected"
  | "fallback_inserted"
  | "diagram_inserted"
  | "regenerate_clicked"
  | "durability_shown"
  | "file_downloaded";

export interface AnalyticsEvent {
  name: EventName;
  /** null when the event isn't tied to a specific template (rare). */
  templateId: string | null;
  /** ms since the current TemplateStrip appearance, or null if it hasn't shown yet. */
  msSinceStripShown: number | null;
  timestamp: number;
  props: Record<string, unknown>;
}

export interface Sink {
  emit(event: AnalyticsEvent): void;
}

export class ConsoleSink implements Sink {
  emit(event: AnalyticsEvent): void {
    // eslint-disable-next-line no-console
    console.log(`[track] ${event.name}`, event);
  }
}

const STORAGE_KEY = "excalidraw-templates:events";
const MAX_EVENTS = 200;

/** Capped ring buffer in localStorage — oldest events drop off past MAX_EVENTS. */
export class LocalStorageSink implements Sink {
  emit(event: AnalyticsEvent): void {
    try {
      const existing = LocalStorageSink.readAll();
      existing.push(event);
      const trimmed = existing.slice(-MAX_EVENTS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // localStorage unavailable (private mode, quota, disabled) — drop silently.
    }
  }

  static readAll(): AnalyticsEvent[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
    } catch {
      return [];
    }
  }

  static clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

const isDev = Boolean(import.meta.env?.DEV);

let sinks: Sink[] = isDev ? [new ConsoleSink(), new LocalStorageSink()] : [];

/** Lets a real production sink replace the defaults later without call-site changes. */
export function setSinks(next: Sink[]): void {
  sinks = next;
}

let stripShownAt: number | null = null;

export interface TrackProps {
  templateId: string | null;
  [key: string]: unknown;
}

/**
 * Marks the moment the TemplateStrip becomes visible. Every subsequent
 * track() call reports elapsed time from this baseline until the strip
 * appears again (e.g. after a cancel).
 */
export function markStripShown(): void {
  stripShownAt = Date.now();
  track("template_strip_shown", { templateId: null });
}

/**
 * track(name, props). props.templateId and elapsed-since-strip-shown are
 * required on every event — every call site passes at least templateId
 * (null on the rare event that isn't tied to one).
 */
export function track(name: EventName, props: TrackProps): void {
  const { templateId, ...rest } = props;
  const event: AnalyticsEvent = {
    name,
    templateId,
    msSinceStripShown:
      stripShownAt !== null ? Date.now() - stripShownAt : null,
    timestamp: Date.now(),
    props: rest,
  };
  for (const sink of sinks) {
    sink.emit(event);
  }
}
