import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const SCHEMA_VERSIONS = {
  initial: 1,
  frameBackgrounds: 2,
  latest: 2,
} as const;

export const SCHEMA_MIGRATION_SCOPES = [
  "scene",
  "library",
  "clipboard",
  "api",
] as const;

export type SchemaMigrationScope = (typeof SCHEMA_MIGRATION_SCOPES)[number];

export const ALL_SCOPES: readonly SchemaMigrationScope[] =
  SCHEMA_MIGRATION_SCOPES;

export type SchemaMigration = {
  version: number;
  title: string;
  description: string;
  scope: readonly SchemaMigrationScope[];
  apply: (
    elements: readonly ExcalidrawElement[],
  ) => readonly ExcalidrawElement[];
};

export const SCHEMA_MIGRATIONS: readonly SchemaMigration[] = [
  {
    version: SCHEMA_VERSIONS.frameBackgrounds,
    title: "Normalize legacy frame backgrounds",
    description:
      "Frames saved before schema v2 must render without visible fill, so normalize their backgroundColor to transparent on restore.",
    scope: ALL_SCOPES,
    apply: (elements) =>
      elements.map((element) => {
        if (element.type !== "frame") {
          return element;
        }
        return {
          ...element,
          backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
        };
      }),
  },
];

export const resolveSchemaVersion = (
  schemaVersion: number | undefined,
  fallbackVersion: number,
) => {
  if (
    Number.isInteger(schemaVersion) &&
    (schemaVersion as number) >= SCHEMA_VERSIONS.initial
  ) {
    return schemaVersion as number;
  }
  return fallbackVersion;
};

export const validateSchemaMigrations = (
  migrations: readonly SchemaMigration[],
) => {
  const errors: string[] = [];
  const seenVersions = new Set<number>();
  let previousVersion: number = SCHEMA_VERSIONS.initial;

  for (const migration of migrations) {
    if (!Number.isInteger(migration.version)) {
      errors.push(
        `Migration "${migration.title}" must use an integer version.`,
      );
    }
    if (migration.version <= SCHEMA_VERSIONS.initial) {
      errors.push(
        `Migration "${migration.title}" version must be greater than schema initial version.`,
      );
    }
    if (seenVersions.has(migration.version)) {
      errors.push(
        `Duplicate schema migration version found: ${migration.version}.`,
      );
    }
    seenVersions.add(migration.version);

    if (migration.version <= previousVersion) {
      errors.push(
        `Migration "${migration.title}" must be ordered by increasing version.`,
      );
    }
    previousVersion = migration.version;

    if (!migration.description.trim()) {
      errors.push(
        `Migration "${migration.title}" must include a non-empty description.`,
      );
    }
    if (!migration.scope.length) {
      errors.push(`Migration "${migration.title}" must declare at least one scope.`);
    }
    for (const scope of migration.scope) {
      if (!SCHEMA_MIGRATION_SCOPES.includes(scope)) {
        errors.push(
          `Migration "${migration.title}" contains unsupported scope "${scope}".`,
        );
      }
    }
  }

  if (migrations.length > 0 && previousVersion !== SCHEMA_VERSIONS.latest) {
    errors.push(
      `SCHEMA_VERSIONS.latest (${SCHEMA_VERSIONS.latest}) must match last migration version (${previousVersion}).`,
    );
  }

  return errors;
};

const schemaMigrationValidationErrors = validateSchemaMigrations(
  SCHEMA_MIGRATIONS,
);
if (schemaMigrationValidationErrors.length) {
  throw new Error(
    `Invalid schema migration configuration:\n${schemaMigrationValidationErrors.join("\n")}`,
  );
}

export const migrateElementsBySchema = (
  elements: readonly ExcalidrawElement[] | null | undefined,
  opts: {
    schemaVersion: number;
    scope: SchemaMigrationScope;
  },
) => {
  if (!elements) {
    return elements;
  }

  return SCHEMA_MIGRATIONS.reduce<readonly ExcalidrawElement[]>(
    (acc, migration) => {
      if (migration.version <= opts.schemaVersion) {
        return acc;
      }
      if (!migration.scope.includes(opts.scope)) {
        return acc;
      }
      return migration.apply(acc);
    },
    elements,
  );
};
