/**
 * Encapsulates a set of application-level `Delta`s.
 */
export interface DeltaContainer<T> {
  /**
   * Inverses the `Delta`s while creating a new `DeltaContainer` instance.
   */
  inverse(): DeltaContainer<T>;

  /**
   * Applies the `Delta`s to the previous object.
   *
   * @returns a tuple of the next object `T` with applied `Delta`s, and `boolean`, indicating whether the applied deltas resulted in a visible change.
   */
  applyTo(previous: T, ...options: unknown[]): [T, boolean];

  /**
   * Checks whether all `Delta`s are empty.
   */
  isEmpty(): boolean;
}
