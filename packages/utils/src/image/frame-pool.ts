/**
 * Global budget for decoded animation frames kept in memory, shared across
 * every animated image in the session.
 *
 * The budget is divided max-min fairly between the active (currently
 * playing) animations: every active animation gets an equal slot, an
 * animation that needs less than its slot (small enough to cache fully)
 * only takes what it needs, and the surplus is redistributed to the rest.
 * When a new animation starts, incumbents holding more than their new fair
 * share shed frames to make room. Animations that stop being played
 * (e.g. scrolled out of the viewport) become inactive and their cached
 * frames are evicted entirely.
 */
export const ANIMATION_FRAME_POOL_PIXELS = 25_000_000;

// An animation is considered paused once it hasn't been played for this
// long. Its cached frames are then evicted.
export const ANIMATION_INACTIVITY_MS = 2_000;

export type FramePoolOwner = {
  // Drop cached frames (highest indexes first) until the owner's reserved
  // pixels are at or below `maxPixels`, releasing them from the pool
  shedCache(maxPixels: number): void;
};

type FramePoolMember = {
  // Pixels needed to cache the entire animation
  readonly demandPixels: number;
  usedPixels: number;
  lastActive: number;
  // Weak so the pool never keeps a player (and its bitmaps) alive
  readonly owner: WeakRef<FramePoolOwner>;
};

export type { FramePoolMember };

export class FramePool {
  private members = new Set<FramePoolMember>();

  // Drops a garbage-collected owner's bookkeeping (its bitmaps died with
  // it, so its reservation simply disappears from the pool)
  private finalizationRegistry =
    typeof FinalizationRegistry !== "undefined"
      ? new FinalizationRegistry<FramePoolMember>((member) => {
          this.members.delete(member);
        })
      : null;

  constructor(private readonly poolPixels: number) {}

  register(owner: FramePoolOwner, demandPixels: number): FramePoolMember {
    const member: FramePoolMember = {
      demandPixels,
      usedPixels: 0,
      lastActive: 0,
      owner: new WeakRef(owner),
    };
    this.members.add(member);
    this.finalizationRegistry?.register(owner, member);
    return member;
  }

  // Marks the animation as actively playing — call on every seek
  touch(member: FramePoolMember, now = Date.now()) {
    member.lastActive = now;
  }

  release(member: FramePoolMember, pixels: number) {
    member.usedPixels = Math.max(0, member.usedPixels - pixels);
  }

  /**
   * Reserves `framePixels` for one cached frame if that fits the member's
   * current fair share, evicting inactive members' caches and clawing back
   * over-share reservations from other active members when needed. Returns
   * false when the member is already at its share.
   */
  tryReserve(
    member: FramePoolMember,
    framePixels: number,
    now = Date.now(),
  ): boolean {
    this.evictInactive(now, member);

    if (member.usedPixels + framePixels > this.allocationFor(member, now)) {
      return false;
    }

    if (this.totalUsed() + framePixels > this.poolPixels) {
      // over-share incumbents give room back to the requester
      for (const other of this.members) {
        if (other === member) {
          continue;
        }
        const allocation = this.allocationFor(other, now);
        if (other.usedPixels > allocation) {
          other.owner.deref()?.shedCache(allocation);
        }
      }
      if (this.totalUsed() + framePixels > this.poolPixels) {
        return false;
      }
    }

    member.usedPixels += framePixels;
    return true;
  }

  /** max-min fair share of the pool among currently active members: equal
   * slots, but a member never claims more than its demand — the surplus is
   * redistributed to members that need more */
  private allocationFor(member: FramePoolMember, now: number): number {
    const active = [...this.members]
      .filter((other) => other === member || this.isActive(other, now))
      .sort((a, b) => a.demandPixels - b.demandPixels);

    let remaining = this.poolPixels;
    let membersLeft = active.length;
    for (const other of active) {
      const share = Math.floor(remaining / membersLeft);
      const allocation = Math.min(other.demandPixels, share);
      if (other === member) {
        return allocation;
      }
      remaining -= allocation;
      membersLeft--;
    }
    return 0;
  }

  private isActive(member: FramePoolMember, now: number): boolean {
    return now - member.lastActive <= ANIMATION_INACTIVITY_MS;
  }

  private totalUsed(): number {
    let total = 0;
    for (const member of this.members) {
      total += member.usedPixels;
    }
    return total;
  }

  private evictInactive(now: number, requester: FramePoolMember) {
    for (const member of [...this.members]) {
      const owner = member.owner.deref();
      if (!owner) {
        this.members.delete(member);
        continue;
      }
      if (
        member !== requester &&
        member.usedPixels > 0 &&
        !this.isActive(member, now)
      ) {
        owner.shedCache(0);
      }
    }
  }
}

/** the session-wide pool used by animated image players */
export const animationFramePool = new FramePool(ANIMATION_FRAME_POOL_PIXELS);
