/**
 * Singleton screen-reader announcer.
 *
 * Maintains one polite and one assertive ARIA live region appended to
 * `document.body`. The regions must exist in the DOM *before* the first
 * message is written into them (dynamically-inserted live regions are not
 * reliably picked up by screen readers), so the editor calls
 * `ensureLiveRegions()` on mount and `announce()` afterwards.
 *
 * Messages are written in a single DOM mutation and cleared shortly after,
 * so an identical message can be re-announced later. Rapid-fire events
 * (arrow-key nudges, marquee selection, zooming) should pass a
 * `coalesceKey` so only the last message of a burst is announced.
 */

export type A11yPoliteness = "polite" | "assertive";

export type A11yAnnounceOptions = {
  politeness?: A11yPoliteness;
  /** messages sharing a key within `coalesceDelay` replace one another and
   * only the last one is announced once the burst settles */
  coalesceKey?: string;
  /** ms to wait for a coalesced burst to settle (default 250) */
  coalesceDelay?: number;
};

const CONTAINER_ID = "excalidraw-a11y-announcer";
/** cleared this long after writing so identical messages re-announce */
const MESSAGE_CLEAR_DELAY = 1000;
const DEFAULT_COALESCE_DELAY = 250;

let liveRegions: Record<A11yPoliteness, HTMLDivElement> | null = null;
let mountCount = 0;

const clearTimers = new Map<A11yPoliteness, number>();
const coalesceTimers = new Map<string, number>();

const createRegion = (politeness: A11yPoliteness) => {
  const region = document.createElement("div");
  region.setAttribute("aria-live", politeness);
  region.setAttribute("role", politeness === "polite" ? "status" : "alert");
  return region;
};

export const ensureLiveRegions = () => {
  mountCount++;
  if (liveRegions || typeof document === "undefined") {
    return;
  }
  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  // visually hidden without collapsing to display:none (which would mute it);
  // inline styles because the container lives outside the .excalidraw scope
  Object.assign(container.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    border: "0",
    padding: "0",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  });
  const polite = createRegion("polite");
  const assertive = createRegion("assertive");
  container.append(polite, assertive);
  document.body.appendChild(container);
  liveRegions = { polite, assertive };
};

export const destroyLiveRegions = () => {
  mountCount = Math.max(0, mountCount - 1);
  if (mountCount > 0 || !liveRegions) {
    return;
  }
  for (const timer of coalesceTimers.values()) {
    window.clearTimeout(timer);
  }
  coalesceTimers.clear();
  for (const timer of clearTimers.values()) {
    window.clearTimeout(timer);
  }
  clearTimers.clear();
  document.getElementById(CONTAINER_ID)?.remove();
  liveRegions = null;
};

const write = (message: string, politeness: A11yPoliteness) => {
  if (!liveRegions) {
    return;
  }
  const region = liveRegions[politeness];
  // assertive interrupts: drop a pending polite message so it doesn't
  // announce stale info after the alert
  if (politeness === "assertive") {
    liveRegions.polite.textContent = "";
  }
  region.textContent = message;

  const pendingClear = clearTimers.get(politeness);
  if (pendingClear) {
    window.clearTimeout(pendingClear);
  }
  clearTimers.set(
    politeness,
    window.setTimeout(() => {
      region.textContent = "";
      clearTimers.delete(politeness);
    }, MESSAGE_CLEAR_DELAY),
  );
};

export const announce = (
  message: string,
  {
    politeness = "polite",
    coalesceKey,
    coalesceDelay = DEFAULT_COALESCE_DELAY,
  }: A11yAnnounceOptions = {},
) => {
  if (!message || !liveRegions) {
    return;
  }

  if (!coalesceKey) {
    write(message, politeness);
    return;
  }

  const pending = coalesceTimers.get(coalesceKey);
  if (pending) {
    window.clearTimeout(pending);
  }
  coalesceTimers.set(
    coalesceKey,
    window.setTimeout(() => {
      coalesceTimers.delete(coalesceKey);
      write(message, politeness);
    }, coalesceDelay),
  );
};
