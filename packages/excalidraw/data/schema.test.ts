import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import { API } from "../tests/helpers/api";
import {
  ALL_SCOPES,
  type SchemaMigration,
  migrateAPIElements,
  migrateClipboardElements,
  migrateLibraryElements,
  migrateSceneElements,
  resolveSchemaVersion,
  SCHEMA_MIGRATIONS,
  SCHEMA_VERSIONS,
  validateSchemaMigrations,
} from "./schema";

describe("schema migration", () => {
  it("should migrate legacy frame backgrounds to transparent", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ffc9c9",
    });

    const migrated = migrateSceneElements([frame], SCHEMA_VERSIONS.initial)!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
  });

  it("should keep latest-schema frame backgrounds unchanged", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ffc9c9",
    });

    const migrated = migrateSceneElements([frame], SCHEMA_VERSIONS.latest)!;

    expect(migrated[0].backgroundColor).toBe("#ffc9c9");
  });

  it("should normalize legacy frame backgrounds across all scopes", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#a5d8ff",
    });

    const migrationsByScope = {
      scene: migrateSceneElements,
      library: migrateLibraryElements,
      clipboard: migrateClipboardElements,
      api: migrateAPIElements,
    } as const;

    for (const scope of ALL_SCOPES) {
      const migrated = migrationsByScope[scope](
        [frame],
        SCHEMA_VERSIONS.initial,
      )!;
      expect(migrated[0].backgroundColor).toBe(
        DEFAULT_ELEMENT_PROPS.backgroundColor,
      );
    }
  });

  it("should resolve invalid schema versions using fallback", () => {
    expect(resolveSchemaVersion(undefined, SCHEMA_VERSIONS.initial)).toBe(
      SCHEMA_VERSIONS.initial,
    );
    expect(resolveSchemaVersion(0, SCHEMA_VERSIONS.latest)).toBe(
      SCHEMA_VERSIONS.latest,
    );
    expect(resolveSchemaVersion(2, SCHEMA_VERSIONS.initial)).toBe(2);
  });

  it("should have a valid migration registry configuration", () => {
    expect(validateSchemaMigrations(SCHEMA_MIGRATIONS)).toEqual([]);
  });

  it("should reject invalid migration metadata", () => {
    const invalidMigrations: SchemaMigration[] = [
      {
        version: 2.1,
        title: "bad migration",
        description: " ",
        scope: [],
        apply: (elements) => elements,
      },
      {
        version: 2.1,
        title: "duplicate",
        description: "duplicate version",
        scope: ["scene"],
        apply: (elements) => elements,
      },
    ];

    const errors = validateSchemaMigrations(invalidMigrations);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain("integer version");
    expect(errors.join("\n")).toContain("non-empty description");
    expect(errors.join("\n")).toContain("Duplicate schema migration version");
  });
});
