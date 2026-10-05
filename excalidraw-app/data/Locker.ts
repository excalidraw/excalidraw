export class Locker<T extends string> {
  private locks = new Map<T, true>();

  lock = (lockType: T) => {
    this.locks.set(lockType, true);
  };

  /** @returns whether no locks remaining */
  unlock = (lockType: T) => {
    this.locks.delete(lockType);
    return !this.isLocked();
  };

  /** @returns whether some (or specific) locks are present */
  isLocked(lockType?: T) {
    return lockType ? this.locks.has(lockType) : !!this.locks.size;
  }
}
