/**
 * The schema version that the current in-memory element shape corresponds to.
 */
export const CURRENT_ELEMENT_SCHEMA_VERSION = 1;

/**
 * A migration that upgrades an element from one schema version to the next.
 */
type ElementSchemaMigration = (element: any) => any;

/**
 * `migrations[n]` upgrades an element from schema version `n` to `n + 1`.
 *
 * Index `0` migrates legacy (unversioned) elements to version 1.
 */
const migrations: Record<number, ElementSchemaMigration> = {
  0: (element) => element,
};

/**
 * Returns an element's schema version, treating a missing `schemaVersion` (i.e.
 * a legacy element persisted before schema versioning) as version 0.
 */
export const getElementSchemaVersion = (element: {
  schemaVersion?: number;
}): number =>
  typeof element.schemaVersion === "number" ? element.schemaVersion : 0;

/**
 * Lifts an element up to {@link CURRENT_ELEMENT_SCHEMA_VERSION} by running each
 * migration in sequence, then stamps the current schema version onto it.
 *
 * Safe to call on an already-current element (the migration chain is empty and
 * it is simply re-stamped). If a migration step is missing (which shouldn't
 * happen), it stops early rather than throwing, so a partially-known element is
 * still returned rather than lost.
 */
export const upgradeElementSchema = <T>(
  element: T,
): T & { schemaVersion: number } => {
  let version = getElementSchemaVersion(element as { schemaVersion?: number });
  let upgraded: any = element;

  while (version < CURRENT_ELEMENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      break;
    }
    upgraded = migrate(upgraded);
    version += 1;
  }

  return {
    ...upgraded,
    schemaVersion: CURRENT_ELEMENT_SCHEMA_VERSION,
  };
};
