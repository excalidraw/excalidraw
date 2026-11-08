/**
 * Palm rejection for passive (capacitive) styluses.
 *
 * A passive stylus is indistinguishable from a finger for the browser
 * (`pointerType` is `"touch"`, no pressure/tilt/identifier), so we cannot
 * recognise it directly. We combine three weak signals instead:
 *
 *  1. ORDER: the stylus tip is nearly always the first thing to land.
 *     The first accepted touch is the OWNER of the stroke.
 *  2. SIZE (optional, `useContactSize`): a contact that is clearly large —
 *     either above an absolute size, or much larger than the contacts the
 *     user has been drawing with — is a palm and can never become owner,
 *     even if it landed first. Many screens report no contact size at all
 *     (`width`/`height` of 0 or 1); then this signal is simply skipped.
 *  3. MOTION (`allowPinch`): a pinch and "stylus + resting palm" look the
 *     same when the second contact lands (often at the very same moment),
 *     so we do not decide then. The second contact is only a CANDIDATE:
 *     its events are swallowed. If, shortly after, both contacts have moved
 *     in OPPOSITE directions and the distance between them changed
 *     noticeably, it was a pinch and the candidate is promoted to PARTNER
 *     (the app is told, so it can drop the stroke the first finger started).
 *     A palm moves WITH the stylus hand (same direction) or stays put, so it
 *     is never promoted.
 *
 * Contact roles:
 *   owner     draws / interacts normally
 *   candidate second contact being watched; swallowed until promoted
 *   partner   second finger of a pinch, interacts normally
 *   ghost     leftover contact after a pinch ended: its moves are swallowed
 *             (so it cannot leave a stray mark) but its pointerup passes so
 *             the app can clean up its own bookkeeping
 *   rejected  ignored completely until it lifts
 *
 * Mouse and real pen pointers are never affected. The module is free of DOM
 * and React so it is cheap to run on every pointer event and easy to test.
 *
 * NOTE: all thresholds are educated defaults; touchscreens differ a lot in
 * what they report. They are centralised below for tuning.
 */

/** contacts at least this large (CSS px, max(width, height)) are palms */
export const LARGE_CONTACT_PX = 56;
/**
 * a contact this many times larger than the typical drawing contact is a
 * palm (adapts to a fat stylus disc or to finger drawing)
 */
export const LARGE_CONTACT_RATIO = 2;
/** relative rule never fires below this size, to avoid noise on tiny tips */
export const LARGE_CONTACT_MIN_RELATIVE_PX = 24;
/** how fast the "typical drawing contact" estimate follows new strokes */
export const BASELINE_SMOOTHING = 0.3;
/** how long after landing a second contact may still prove to be a pinch */
export const PINCH_CONFIRM_WINDOW_MS = 700;
/** each of the two contacts must have moved at least this far... */
export const PINCH_MIN_TRAVEL_PX = 15;
/** ...and the distance between them must have changed by at least this */
export const PINCH_MIN_SPREAD_PX = 40;

export type PalmRejectionEventType =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel";

export type PalmRejectionEvent = {
  /** `event.type`; anything but the four known types is accepted as-is */
  type: string;
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  clientX?: number;
  clientY?: number;
  /** `event.timeStamp` (ms) */
  timeStamp?: number;
  /** contact size as reported by the browser; 0/1 means "not available" */
  width?: number;
  height?: number;
};

export type PalmRejectionOptions = {
  /** let a quickly-added second finger pinch/pan the canvas */
  allowPinch: boolean;
  /** use reported contact size to recognise palms */
  useContactSize: boolean;
};

/**
 * accept   let the event through
 * reject   swallow the event
 * promote  let the event through, but first call `takePromotedContact()` and
 *          register that contact with the app as the second finger of a pinch
 */
export type PalmRejectionVerdict = "accept" | "reject" | "promote";

export type PalmRejectionPromotedContact = {
  pointerId: number;
  x: number;
  y: number;
};

type Role = "owner" | "candidate" | "partner" | "ghost" | "rejected";

type Contact = {
  role: Role;
  downTime: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** candidate only: where the owner was, and how far apart, on landing */
  watch?: { ownerX: number; ownerY: number; distance: number };
};

const DEFAULT_OPTIONS: PalmRejectionOptions = {
  allowPinch: false,
  useContactSize: false,
};

/** contact diameter in CSS px, or `null` if the browser doesn't report it */
export const getContactSize = (event: {
  width?: number;
  height?: number;
}): number | null => {
  const size = Math.max(event.width ?? 0, event.height ?? 0);
  // Chrome reports 1x1 when it has no geometry, Firefox 0
  return Number.isFinite(size) && size > 1 ? size : null;
};

export class PalmRejectionGate {
  private readonly contacts = new Map<number, Contact>();
  private ownerId: number | null = null;
  private partnerId: number | null = null;
  private candidateId: number | null = null;
  private pinched = false;
  private promoted: PalmRejectionPromotedContact | null = null;
  /** running estimate of the contact size the user draws with */
  private baselineSize: number | null = null;

  /** pointerId of the touch currently allowed to draw, if any */
  get ownerPointerId(): number | null {
    return this.ownerId;
  }

  /** current estimate of the user's drawing-contact size (for diagnostics) */
  get drawingContactSize(): number | null {
    return this.baselineSize;
  }

  /** an owner and a partner are both active: a pinch/pan is in progress */
  isPinchActive(): boolean {
    return this.ownerId !== null && this.partnerId !== null;
  }

  /** a pinch happened and not all of its contacts have lifted yet */
  hadPinch(): boolean {
    return this.pinched;
  }

  /** whether at least one touch is currently being ignored */
  hasRejectedContacts(): boolean {
    for (const contact of this.contacts.values()) {
      if (contact.role === "rejected" || contact.role === "candidate") {
        return true;
      }
    }
    return false;
  }

  /** whether the gate knows this pointer in any role */
  isTracked(pointerId: number): boolean {
    return this.contacts.has(pointerId);
  }

  /** forget all contacts (all touches lifted, window blurred, feature off) */
  reset(): void {
    this.contacts.clear();
    this.ownerId = null;
    this.partnerId = null;
    this.candidateId = null;
    this.pinched = false;
    this.promoted = null;
  }

  /** the contact a `"promote"` verdict refers to (read once) */
  takePromotedContact(): PalmRejectionPromotedContact | null {
    const promoted = this.promoted;
    this.promoted = null;
    return promoted;
  }

  /** whether a contact of this size is clearly a palm */
  isLargeContact(size: number): boolean {
    if (size >= LARGE_CONTACT_PX) {
      return true;
    }
    return (
      this.baselineSize !== null &&
      size >= LARGE_CONTACT_MIN_RELATIVE_PX &&
      size >= this.baselineSize * LARGE_CONTACT_RATIO
    );
  }

  /**
   * Decide what to do with a pointer event. Callers must only feed
   * `pointerdown` events that landed on the drawing surface; other event
   * types can be fed freely (untracked pointers are accepted).
   */
  evaluate(
    event: PalmRejectionEvent,
    options: PalmRejectionOptions = DEFAULT_OPTIONS,
  ): PalmRejectionVerdict {
    if (event.pointerType !== "touch") {
      return "accept";
    }
    switch (event.type) {
      case "pointerdown":
        return this.onDown(event, options);
      case "pointermove":
        return this.onMove(event);
      case "pointerup":
      case "pointercancel":
        return this.onUp(event);
      default:
        return "accept";
    }
  }

  private onDown(
    event: PalmRejectionEvent,
    options: PalmRejectionOptions,
  ): PalmRejectionVerdict {
    if (event.isPrimary) {
      // no other touch can be active: any state we hold is stale
      this.reset();
    }
    const { pointerId } = event;
    if (this.contacts.has(pointerId)) {
      return this.contacts.get(pointerId)!.role === "rejected"
        ? "reject"
        : "accept";
    }

    const x = event.clientX ?? 0;
    const y = event.clientY ?? 0;
    const time = event.timeStamp ?? 0;
    const add = (role: Role) =>
      this.contacts.set(pointerId, {
        role,
        downTime: time,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
      });

    const size = getContactSize(event);

    // a clearly large contact is a palm, whether or not it landed first
    if (options.useContactSize && size !== null && this.isLargeContact(size)) {
      add("rejected");
      return "reject";
    }

    if (this.ownerId === null) {
      add("owner");
      this.ownerId = pointerId;
      if (size !== null) {
        this.baselineSize =
          this.baselineSize === null
            ? size
            : this.baselineSize +
              (size - this.baselineSize) * BASELINE_SMOOTHING;
      }
      return "accept";
    }

    if (
      options.allowPinch &&
      this.candidateId === null &&
      this.partnerId === null
    ) {
      // don't decide yet: swallow it and watch how it moves
      add("candidate");
      const owner = this.contacts.get(this.ownerId)!;
      this.contacts.get(pointerId)!.watch = {
        ownerX: owner.lastX,
        ownerY: owner.lastY,
        distance: Math.hypot(owner.lastX - x, owner.lastY - y),
      };
      this.candidateId = pointerId;
      return "reject";
    }

    add("rejected");
    return "reject";
  }

  private onMove(event: PalmRejectionEvent): PalmRejectionVerdict {
    const contact = this.contacts.get(event.pointerId);
    if (!contact) {
      return "accept";
    }
    if (contact.role === "rejected" || contact.role === "ghost") {
      return "reject";
    }
    contact.lastX = event.clientX ?? contact.lastX;
    contact.lastY = event.clientY ?? contact.lastY;

    if (
      (contact.role === "owner" || contact.role === "candidate") &&
      this.candidateId !== null &&
      this.confirmPinch(event.timeStamp ?? 0)
    ) {
      return "promote";
    }
    return contact.role === "candidate" ? "reject" : "accept";
  }

  /**
   * Promote the candidate to a pinch partner if both contacts moved in
   * opposite directions and the gap between them changed. Gives up (the
   * candidate becomes a plain resting contact) once the window has passed.
   */
  private confirmPinch(time: number): boolean {
    const candidate =
      this.candidateId === null
        ? undefined
        : this.contacts.get(this.candidateId);
    const owner =
      this.ownerId === null ? undefined : this.contacts.get(this.ownerId);
    const watch = candidate?.watch;
    if (!candidate || !owner || !watch) {
      return false;
    }
    if (time - candidate.downTime > PINCH_CONFIRM_WINDOW_MS) {
      candidate.role = "rejected";
      this.candidateId = null;
      return false;
    }

    const ownerDX = owner.lastX - watch.ownerX;
    const ownerDY = owner.lastY - watch.ownerY;
    const candDX = candidate.lastX - candidate.startX;
    const candDY = candidate.lastY - candidate.startY;
    if (
      Math.hypot(ownerDX, ownerDY) < PINCH_MIN_TRAVEL_PX ||
      Math.hypot(candDX, candDY) < PINCH_MIN_TRAVEL_PX ||
      // moving the same way = a hand dragging along, not a pinch
      ownerDX * candDX + ownerDY * candDY >= 0
    ) {
      return false;
    }
    const distance = Math.hypot(
      owner.lastX - candidate.lastX,
      owner.lastY - candidate.lastY,
    );
    if (Math.abs(distance - watch.distance) < PINCH_MIN_SPREAD_PX) {
      return false;
    }

    candidate.role = "partner";
    candidate.watch = undefined;
    this.partnerId = this.candidateId;
    this.candidateId = null;
    this.pinched = true;
    this.promoted = {
      pointerId: this.partnerId!,
      x: candidate.lastX,
      y: candidate.lastY,
    };
    return true;
  }

  private onUp(event: PalmRejectionEvent): PalmRejectionVerdict {
    const { pointerId } = event;
    const contact = this.contacts.get(pointerId);
    if (!contact) {
      return "accept";
    }
    this.contacts.delete(pointerId);

    let verdict: PalmRejectionVerdict = "accept";
    switch (contact.role) {
      case "rejected":
        verdict = "reject";
        break;
      case "candidate":
        this.candidateId = null;
        verdict = "reject";
        break;
      case "owner":
        this.ownerId = null;
        this.demoteRemainingPinchContact(this.partnerId);
        this.releaseCandidate();
        break;
      case "partner":
        this.partnerId = null;
        this.demoteRemainingPinchContact(this.ownerId);
        break;
      case "ghost":
        break;
    }

    if (this.contacts.size === 0) {
      this.pinched = false;
    }
    return verdict;
  }

  /** the owner lifted: a watched contact is just a resting hand now */
  private releaseCandidate(): void {
    if (this.candidateId === null) {
      return;
    }
    const candidate = this.contacts.get(this.candidateId);
    if (candidate) {
      candidate.role = "rejected";
      candidate.watch = undefined;
    }
    this.candidateId = null;
  }

  /**
   * One finger of a pinch lifted. The other must not turn into a stroke:
   * it keeps its pointerup (so the app can clean up) but loses its moves.
   */
  private demoteRemainingPinchContact(remainingId: number | null): void {
    if (remainingId === null) {
      return;
    }
    const remaining = this.contacts.get(remainingId);
    if (remaining) {
      remaining.role = "ghost";
    }
    this.ownerId = null;
    this.partnerId = null;
  }
}
