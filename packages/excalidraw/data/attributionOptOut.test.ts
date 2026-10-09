import {
  clearAttributionOptOutState,
  getAttributionOptOutState,
  setAttributionOptOutCompleted,
} from "./attributionOptOut";

const STORAGE_KEY = "excalidraw-attribution-opt-out";

describe("attributionOptOut", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing was ever completed", () => {
    expect(getAttributionOptOutState()).toBeNull();
  });

  it("returns the state right after completion", () => {
    setAttributionOptOutCompleted();
    expect(getAttributionOptOutState()).not.toBeNull();
  });

  it("expires after 30 days", () => {
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completedAt: Date.now() - THIRTY_ONE_DAYS_MS }),
    );

    expect(getAttributionOptOutState()).toBeNull();
    // expired entry should be cleaned up, not just ignored
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("still holds just under 30 days", () => {
    const TWENTY_NINE_DAYS_MS = 29 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completedAt: Date.now() - TWENTY_NINE_DAYS_MS }),
    );

    expect(getAttributionOptOutState()).not.toBeNull();
  });

  it("treats malformed storage as not opted out", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(getAttributionOptOutState()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(getAttributionOptOutState()).toBeNull();
  });

  it("clears the stored state", () => {
    setAttributionOptOutCompleted();
    expect(getAttributionOptOutState()).not.toBeNull();

    clearAttributionOptOutState();
    expect(getAttributionOptOutState()).toBeNull();
  });
});
