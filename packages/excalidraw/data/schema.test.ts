import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import { API } from "../tests/helpers/api";

import {
  type SchemaMigration,
  migrateElements,
  resolveSchemaVersion,
  SCHEMA_MIGRATIONS,
  SCHEMA_VERSIONS,
  validateSchemaMigrations,
} from "./schema";

describe("schema migration", () => {
  it("should migrate legacy frame backgrounds to transparent", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#ffc9c9",
      }),
      schemaVersion: undefined,
    };

    const migrated = migrateElements([frame])!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect(migrated[0].schemaVersion).toBe(SCHEMA_VERSIONS.latest);
  });

  it("should keep latest-schema frame backgrounds unchanged", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ffc9c9",
    });
    const latestFrame = {
      ...frame,
      schemaVersion: SCHEMA_VERSIONS.latest,
    } as typeof frame & { schemaVersion: number };

    const migrated = migrateElements([latestFrame])!;

    expect(migrated[0].backgroundColor).toBe("#ffc9c9");
    expect(migrated[0].schemaVersion).toBe(SCHEMA_VERSIONS.latest);
  });

  it("should normalize legacy frame backgrounds", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#a5d8ff",
      }),
      schemaVersion: undefined,
    };

    const migrated = migrateElements([frame])!;
    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
  });

  it("should resolve invalid schema versions to initial", () => {
    expect(resolveSchemaVersion(undefined)).toBe(SCHEMA_VERSIONS.initial);
    expect(resolveSchemaVersion(0)).toBe(SCHEMA_VERSIONS.initial);
    expect(resolveSchemaVersion(2)).toBe(2);
  });

  it("should have a valid migration registry configuration", () => {
    expect(validateSchemaMigrations(SCHEMA_MIGRATIONS)).toEqual([]);
  });

  it("should reject invalid migration metadata", () => {
    const invalidMigrations: SchemaMigration[] = [
      {
        version: 2.1,
        title: "",
        description: " ",
        apply: (elements) => elements,
      },
      {
        version: 2.1,
        title: "duplicate",
        description: "duplicate version",
        apply: (elements) => elements,
      },
    ];

    const errors = validateSchemaMigrations(invalidMigrations);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain("integer version");
    expect(errors.join("\n")).toContain("title must be non-empty");
    expect(errors.join("\n")).toContain("non-empty description");
    expect(errors.join("\n")).toContain("Duplicate schema migration version");
  });

  it("should reject versions at or below initial", () => {
    const errors = validateSchemaMigrations([
      {
        version: SCHEMA_VERSIONS.initial,
        title: "invalid start",
        description: "bad version",
        apply: (elements) => elements,
      },
    ]);

    expect(errors.join("\n")).toContain("greater than schema initial version");
  });

  it("should reject latest-version mismatch", () => {
    const errors = validateSchemaMigrations([
      {
        version: SCHEMA_VERSIONS.latest + 1,
        title: "future migration",
        description: "future migration for test",
        apply: (elements) => elements,
      },
    ]);

    expect(errors.join("\n")).toContain(
      "SCHEMA_VERSIONS.latest (2) must match last migration version",
    );
  });

  it("should not depend on temporary fields during migration", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#a5d8ff",
      }),
      schemaVersion: undefined,
    };
    const withTempField = {
      ...frame,
      backgroundEnabled: false,
    } as typeof frame & { backgroundEnabled: boolean };

    const migratedBase = migrateElements([frame])!;
    const migratedWithTempField = migrateElements([withTempField])!;

    expect(migratedBase[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect(migratedWithTempField[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
  });

  it("should use per-element schema hints", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ff0000",
    });
    const frameFromModernSource = {
      ...frame,
      schemaVersion: SCHEMA_VERSIONS.latest,
    } as typeof frame & { schemaVersion: number };

    const migrated = migrateElements([frameFromModernSource])!;

    expect(migrated[0].backgroundColor).toBe("#ff0000");
  });

  it("should migrate mixed-hint elements individually", () => {
    const legacyFrame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#ff0000",
      }),
      schemaVersion: undefined,
    };
    const modernFrame = API.createElement({
      type: "frame",
      backgroundColor: "#00ff00",
    });
    const modernFrameWithHint = {
      ...modernFrame,
      schemaVersion: SCHEMA_VERSIONS.latest,
    } as typeof modernFrame & { schemaVersion: number };

    const migrated = migrateElements([legacyFrame, modernFrameWithHint])!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect(migrated[1].backgroundColor).toBe("#00ff00");
  });

  it("should stamp schemaVersion to latest after migration", () => {
    const rect = API.createElement({ type: "rectangle" });
    const migrated = migrateElements([rect])!;
    expect(migrated[0].schemaVersion).toBe(SCHEMA_VERSIONS.latest);
  });

  it("should preserve higher-than-latest schema versions", () => {
    const rect = API.createElement({ type: "rectangle" });
    const futureRect = {
      ...rect,
      schemaVersion: SCHEMA_VERSIONS.latest + 1,
    } as typeof rect & { schemaVersion: number };

    const migrated = migrateElements([futureRect])!;
    expect(migrated[0].schemaVersion).toBe(SCHEMA_VERSIONS.latest + 1);
  });
});
