import {
  CORE_FRAME_SCHEMA_TRACK,
  SCHEMA_CORE_NAMESPACE,
  SCHEMA_INITIAL_TRACK_VERSION,
  CORE_SUPPORTED_TRACKS,
} from "@excalidraw/element/schema";

import type { SchemaNamespace, SchemaTrack } from "@excalidraw/element/schema";
import type { ExcalidrawElement } from "@excalidraw/element/types";

export {
  CORE_FRAME_SCHEMA_TRACK,
  CORE_SUPPORTED_TRACKS,
  SCHEMA_CORE_NAMESPACE,
  SCHEMA_INITIAL_TRACK_VERSION,
};
export type { SchemaNamespace, SchemaTrack };

/**
 * Schema migration flow:
 * 0) Compile schema config from core migrations + optional host plugins.
 *    - validate plugin metadata
 *    - validate migration ordering/metadata
 *    - derive per-track supported versions for this registry
 * 1) Normalize element.schemaState.tracks (invalid/missing -> initial track version).
 * 2) Iterate compiled migrations in declaration order.
 * 3) For matching element types, apply only forward migrations that are
 *    supported by the current registry config (never re-run, never downgrade).
 * 4) Stamp migrated track versions back onto each element.
 */
/** One migration step for a single track version bump. */
export type SchemaMigration = {
  /** Stable unique id for validation and debugging. */
  id: string;
  /** Owner of the migration: core or a host namespace. */
  namespace: SchemaNamespace;
  /** Version line this migration belongs to. */
  track: SchemaTrack;
  /** Target version reached after applying this migration. */
  toVersion: number;
  /** Human-readable metadata for maintainers/reviewers. */
  title: string;
  description: string;
  /** Which element types this migration may transform ("*" = all). */
  targetTypes: readonly ExcalidrawElement["type"][] | "*";
  /** Pure transform for a single element. */
  apply: (element: ExcalidrawElement) => ExcalidrawElement;
};

/**
 * Optional host-provided migration bundle.
 * Plugins are additive and may only declare host namespace migrations.
 */
export type SchemaPlugin = {
  /** Stable plugin id for diagnostics. */
  id: string;
  /** Host migration steps merged with core migrations into one registry. */
  migrations: readonly SchemaMigration[];
};

/** Default plugin registry (intentionally empty in core). */
export const SCHEMA_PLUGINS: readonly SchemaPlugin[] = [];

export type SchemaMigrationRegistry = Readonly<{
  /** Fully validated core + host migrations used for this run. */
  migrations: readonly SchemaMigration[];
  /** Latest supported version for each known track in this run. */
  supportedTrackVersions: Readonly<Record<string, number>>;
}>;

export const SCHEMA_MIGRATIONS: readonly SchemaMigration[] = [
  {
    id: "core.frame.background.normalize.v2",
    namespace: SCHEMA_CORE_NAMESPACE,
    track: CORE_FRAME_SCHEMA_TRACK,
    toVersion: CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK],
    title: "Normalize legacy frame backgrounds",
    description:
      "Frames saved before frame track v2 must render without visible fill, so normalize backgroundColor to transparent on restore.",
    targetTypes: ["frame"],
    apply: (element) => {
      if (element.type !== "frame") {
        return element;
      }
      return {
        ...element,
        backgroundColor: "transparent",
      };
    },
  },
];

export const resolveTrackVersion = (trackVersion: unknown) => {
  if (
    Number.isInteger(trackVersion) &&
    (trackVersion as number) >= SCHEMA_INITIAL_TRACK_VERSION
  ) {
    return trackVersion as number;
  }
  return SCHEMA_INITIAL_TRACK_VERSION;
};

const normalizeSchemaTracks = (tracks: unknown) => {
  if (!tracks || typeof tracks !== "object") {
    return {} as Record<string, number>;
  }

  return Object.entries(tracks as Record<string, unknown>).reduce<
    Record<string, number>
  >((acc, [track, version]) => {
    const normalizedVersion = resolveTrackVersion(version);
    if (normalizedVersion >= SCHEMA_INITIAL_TRACK_VERSION) {
      acc[track] = normalizedVersion;
    }
    return acc;
  }, {});
};

const normalizeElementSchemaState = (
  element: ExcalidrawElement,
): ExcalidrawElement["schemaState"] => {
  const tracks = normalizeSchemaTracks(
    (
      element as ExcalidrawElement & {
        schemaState?: ExcalidrawElement["schemaState"];
      }
    ).schemaState?.tracks,
  );

  return {
    tracks,
  };
};

const ensureElementSchemaState = (element: ExcalidrawElement) => {
  const normalizedSchemaState = normalizeElementSchemaState(element);

  // Fast path: avoid reallocating when element already has normalized state.
  if (element.schemaState === normalizedSchemaState) {
    return element;
  }

  if (
    element.schemaState &&
    Object.keys(element.schemaState?.tracks || {}).length ===
      Object.keys(normalizedSchemaState.tracks).length &&
    Object.entries(normalizedSchemaState.tracks).every(
      ([track, version]) => element.schemaState?.tracks?.[track] === version,
    )
  ) {
    return element;
  }

  return {
    ...element,
    schemaState: normalizedSchemaState,
  };
};

const getTrackVersion = (element: ExcalidrawElement, track: SchemaTrack) => {
  return resolveTrackVersion(element.schemaState.tracks[track]);
};

const withTrackVersion = (
  element: ExcalidrawElement,
  track: SchemaTrack,
  version: number,
) => {
  if (element.schemaState.tracks[track] === version) {
    return element;
  }

  return {
    ...element,
    schemaState: {
      ...element.schemaState,
      tracks: {
        ...element.schemaState.tracks,
        [track]: version,
      },
    },
  };
};

const migrationMatchesElementType = (
  migration: SchemaMigration,
  element: ExcalidrawElement,
) => {
  return (
    migration.targetTypes === "*" ||
    migration.targetTypes.includes(element.type)
  );
};

export const validateSchemaMigrations = (
  migrations: readonly SchemaMigration[],
) => {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const previousVersionByTrack = new Map<string, number>();

  for (const migration of migrations) {
    if (!migration.id.trim()) {
      errors.push("Migration id must be non-empty.");
    }
    if (seenIds.has(migration.id)) {
      errors.push(`Duplicate schema migration id found: ${migration.id}.`);
    }
    seenIds.add(migration.id);

    if (!migration.title.trim()) {
      errors.push(`Migration "${migration.id}" title must be non-empty.`);
    }
    if (!migration.description.trim()) {
      errors.push(
        `Migration "${migration.id}" must include a non-empty description.`,
      );
    }

    if (!Number.isInteger(migration.toVersion)) {
      errors.push(`Migration "${migration.id}" must use an integer version.`);
    }
    if (migration.toVersion <= SCHEMA_INITIAL_TRACK_VERSION) {
      errors.push(
        `Migration "${migration.id}" version must be greater than ${SCHEMA_INITIAL_TRACK_VERSION}.`,
      );
    }

    if (
      migration.targetTypes !== "*" &&
      (!migration.targetTypes.length ||
        migration.targetTypes.some((type) => !type))
    ) {
      errors.push(
        `Migration "${migration.id}" must declare at least one target type.`,
      );
    }

    const trackKey = `${migration.namespace}|${migration.track}`;
    const previousVersion =
      previousVersionByTrack.get(trackKey) ?? SCHEMA_INITIAL_TRACK_VERSION;
    if (migration.toVersion <= previousVersion) {
      errors.push(
        `Migration "${migration.id}" must be ordered by increasing version within ${trackKey}.`,
      );
    }
    previousVersionByTrack.set(trackKey, migration.toVersion);

    if (
      migration.namespace === SCHEMA_CORE_NAMESPACE &&
      !migration.track.startsWith("excalidraw.")
    ) {
      errors.push(
        `Core migration "${migration.id}" must use an excalidraw.* track.`,
      );
    }

    if (
      migration.namespace === SCHEMA_CORE_NAMESPACE &&
      !(migration.track in CORE_SUPPORTED_TRACKS)
    ) {
      errors.push(
        `Core migration "${migration.id}" track "${migration.track}" must be declared in CORE_SUPPORTED_TRACKS.`,
      );
    }

    if (
      migration.namespace !== SCHEMA_CORE_NAMESPACE &&
      !migration.track.startsWith(`${migration.namespace}.`)
    ) {
      errors.push(
        `Host migration "${migration.id}" track must use namespace prefix ${migration.namespace}.`,
      );
    }
  }

  for (const [track, supportedVersion] of Object.entries(
    CORE_SUPPORTED_TRACKS,
  )) {
    const migrationTrackKey = `${SCHEMA_CORE_NAMESPACE}|${track}`;
    const lastDeclaredVersion =
      previousVersionByTrack.get(migrationTrackKey) ??
      SCHEMA_INITIAL_TRACK_VERSION;

    if (lastDeclaredVersion !== supportedVersion) {
      errors.push(
        `Core supported track "${track}" (${supportedVersion}) must match last migration version (${lastDeclaredVersion}).`,
      );
    }
  }

  return errors;
};

export const validateSchemaPlugins = (plugins: readonly SchemaPlugin[]) => {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const plugin of plugins) {
    if (!plugin.id.trim()) {
      errors.push("Schema plugin id must be non-empty.");
    }
    if (seenIds.has(plugin.id)) {
      errors.push(`Duplicate schema plugin id found: ${plugin.id}.`);
    }
    seenIds.add(plugin.id);

    for (const migration of plugin.migrations) {
      if (migration.namespace === SCHEMA_CORE_NAMESPACE) {
        errors.push(
          `Schema plugin "${plugin.id}" cannot declare core migrations ("${migration.id}").`,
        );
      }
    }
  }

  return errors;
};

const collectPluginMigrations = (plugins: readonly SchemaPlugin[]) =>
  plugins.flatMap((plugin) => plugin.migrations);

/**
 * Builds the registry "latest version" map:
 * - core tracks come from CORE_SUPPORTED_TRACKS
 * - host tracks are inferred from provided plugin migrations
 */
const getSupportedTrackVersions = (
  migrations: readonly SchemaMigration[],
): Readonly<Record<string, number>> => {
  const supportedTrackVersions: Record<string, number> = {
    ...CORE_SUPPORTED_TRACKS,
  };

  for (const migration of migrations) {
    if (migration.namespace === SCHEMA_CORE_NAMESPACE) {
      continue;
    }

    const currentSupportedVersion =
      supportedTrackVersions[migration.track] ?? SCHEMA_INITIAL_TRACK_VERSION;
    if (migration.toVersion > currentSupportedVersion) {
      supportedTrackVersions[migration.track] = migration.toVersion;
    }
  }

  return supportedTrackVersions;
};

export const createSchemaMigrationRegistry = (
  plugins: readonly SchemaPlugin[] = SCHEMA_PLUGINS,
): SchemaMigrationRegistry => {
  const pluginErrors = validateSchemaPlugins(plugins);
  if (pluginErrors.length) {
    throw new Error(
      `Invalid schema plugin configuration:\n${pluginErrors.join("\n")}`,
    );
  }

  const migrations = [
    ...SCHEMA_MIGRATIONS,
    ...collectPluginMigrations(plugins),
  ] as const;

  const migrationErrors = validateSchemaMigrations(migrations);
  if (migrationErrors.length) {
    throw new Error(
      `Invalid schema migration configuration:\n${migrationErrors.join("\n")}`,
    );
  }

  return {
    migrations,
    supportedTrackVersions: getSupportedTrackVersions(migrations),
  };
};

const CORE_SCHEMA_MIGRATION_REGISTRY = createSchemaMigrationRegistry();

/** Uses cached core config by default, recompiles when plugins are provided. */
const resolveSchemaMigrationRegistry = (
  schemaMigrationRegistry: SchemaMigrationRegistry | undefined,
) => schemaMigrationRegistry || CORE_SCHEMA_MIGRATION_REGISTRY;

const migrateElement = (
  element: ExcalidrawElement,
  schemaMigrationRegistry: SchemaMigrationRegistry,
) => {
  // Always migrate from a normalized per-element schema state.
  let migratedElement = ensureElementSchemaState(element);

  for (const migration of schemaMigrationRegistry.migrations) {
    if (!migrationMatchesElementType(migration, migratedElement)) {
      continue;
    }

    const currentTrackVersion = getTrackVersion(
      migratedElement,
      migration.track,
    );
    const supportedTrackVersion =
      schemaMigrationRegistry.supportedTrackVersions[migration.track] ??
      currentTrackVersion;

    // Never re-run or downgrade.
    if (currentTrackVersion >= migration.toVersion) {
      continue;
    }

    // Preserve future data: ignore migrations newer than what this app supports.
    if (migration.toVersion > supportedTrackVersion) {
      continue;
    }

    // Apply transform, then stamp the element's track version.
    migratedElement = withTrackVersion(
      migration.apply(migratedElement),
      migration.track,
      migration.toVersion,
    );
  }

  return migratedElement;
};

export const migrateElements = (
  elements: readonly ExcalidrawElement[] | null | undefined,
  opts?: {
    schemaMigrationRegistry?: SchemaMigrationRegistry;
  },
) => {
  if (!elements) {
    return elements;
  }

  const schemaMigrationRegistry = resolveSchemaMigrationRegistry(
    opts?.schemaMigrationRegistry,
  );

  return elements.map((element) =>
    migrateElement(element, schemaMigrationRegistry),
  );
};
