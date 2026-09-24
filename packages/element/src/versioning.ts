/**
 * The schema version the current in-memory element shape corresponds to.
 */
export const CURRENT_SCHEMA_VERSION = 1;

type SchemaMigration = {
  // Upgrades a full element from schema version n to n + 1.
  element: (element: any) => any;
  // Upgrades a partial element (durable undo/redo).
  elementPartial: (partial: any) => any;
};

const identity = <T>(value: T): T => value;

/**
 * migrations[n] upgrades data from schema version to n + 1.
 *
 * NOTE: Index 0 migrates legacy (unversioned) data to version 1.
 *
 * IMPORTANT: data of unknown provenance (API input, clipboard from older
 * builds etc.) is considered 'legacy' v0!
 */
const migrations: Record<number, SchemaMigration> = {
  0: { element: identity, elementPartial: identity },
};

/**
 * Returns the schema version indicated by a container.
 */
export const getSchemaVersion = (source: unknown): number => {
  const schemaVersion = (source as { schemaVersion?: unknown } | null)
    ?.schemaVersion;

  return typeof schemaVersion === "number" && Number.isFinite(schemaVersion)
    ? schemaVersion
    : 0;
};

const runMigrations = <T>(
  kind: keyof SchemaMigration,
  value: T,
  fromVersion: number,
): T => {
  let version = fromVersion;
  let migrated: any = value;

  // NOTE: data from a newer client (fromVersion > current) is returned as-is;
  // unknown properties are preserved down the line for forward-compatibility
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      break;
    }
    migrated = migration[kind](migrated);
    version += 1;
  }

  return migrated;
};

/**
 * Lifts a full element from `fromVersion` up to
 * {@link CURRENT_SCHEMA_VERSION} by running each migration in sequence.
 */
export const migrateElement = <T>(element: T, fromVersion: number): T =>
  runMigrations("element", element, fromVersion);

/**
 * Lifts all elements of a container from `fromVersion` up to
 * {@link CURRENT_SCHEMA_VERSION}.
 */
export const migrateElements = <T>(
  elements: readonly T[],
  fromVersion: number,
): readonly T[] =>
  fromVersion >= CURRENT_SCHEMA_VERSION
    ? elements
    : elements.map((element) => migrateElement(element, fromVersion));

/**
 * Lifts a partial element shape (as contained in deltas) from `fromVersion`
 * up to {@link CURRENT_SCHEMA_VERSION}.
 */
export const migrateElementPartial = <T>(partial: T, fromVersion: number): T =>
  fromVersion >= CURRENT_SCHEMA_VERSION
    ? partial
    : runMigrations("elementPartial", partial, fromVersion);
