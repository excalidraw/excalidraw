// Persists whether the user has completed the attribution-mark opt-out
// survey, so the mark stays hidden across sessions without re-asking every
// time. Deliberately time-boxed (see excalidraw-attribution-vision.md
// Section 9.7): an opt-out lapses after 30 days so inactive/lapsed opt-outs
// eventually recover attribution visibility, rather than persisting forever.
//
// Kept isolated from the app's scene/appState persistence: this is a
// standalone user preference, not scene data, and doesn't need to sync,
// serialize with the drawing, or survive scene switches.

const STORAGE_KEY = "excalidraw-attribution-opt-out";
const OPT_OUT_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type StoredAttributionOptOut = {
  completedAt: number;
};

const isStoredAttributionOptOut = (
  value: unknown,
): value is StoredAttributionOptOut =>
  !!value &&
  typeof value === "object" &&
  typeof (value as StoredAttributionOptOut).completedAt === "number";

/**
 * Returns the stored opt-out state if the survey was completed within the
 * last 30 days, or `null` if it was never completed, has expired, or
 * storage is unavailable (e.g. private browsing).
 */
export const getAttributionOptOutState = (): StoredAttributionOptOut | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!isStoredAttributionOptOut(parsed)) {
      return null;
    }

    if (Date.now() - parsed.completedAt > OPT_OUT_DURATION_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
};

/** Marks the opt-out survey as completed now, starting a fresh 30-day hold. */
export const setAttributionOptOutCompleted = (): void => {
  try {
    const state: StoredAttributionOptOut = { completedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // localStorage may be unavailable; opt-out just won't persist.
  }
};

/** Clears the opt-out state (manual toggle reset, or on expiry). */
export const clearAttributionOptOutState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // ignore
  }
};
