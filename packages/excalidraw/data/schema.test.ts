import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import { API } from "../tests/helpers/api";
import {
  ALL_SCOPES,
  hasElementSchemaVersion,
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
        title: "",
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
        scope: ["scene"],
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
        scope: ["scene"],
        apply: (elements) => elements,
      },
    ]);

    expect(errors.join("\n")).toContain(
      "SCHEMA_VERSIONS.latest (2) must match last migration version",
    );
  });

  it("should not depend on temporary fields during migration", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#a5d8ff",
    });
    const withTempField = {
      ...frame,
      backgroundEnabled: false,
    } as typeof frame & { backgroundEnabled: boolean };

    const migratedBase = migrateSceneElements(
      [frame],
      SCHEMA_VERSIONS.initial,
    )!;
    const migratedWithTempField = migrateSceneElements(
      [withTempField],
      SCHEMA_VERSIONS.initial,
    )!;

    expect(migratedBase[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect(migratedWithTempField[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
  });

  it("should use per-element schema when payload schema is missing", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ff0000",
    });
    const frameFromModernSource = {
      ...frame,
      schemaVersion: SCHEMA_VERSIONS.latest,
    } as typeof frame & { schemaVersion: number };

    const migrated = migrateClipboardElements([frameFromModernSource], {
      payloadSchemaVersion: undefined,
      fallbackVersion: SCHEMA_VERSIONS.initial,
    })!;

    expect(migrated[0].backgroundColor).toBe("#ff0000");
  });

  it("should migrate mixed-hint elements individually when payload schema is missing", () => {
    const legacyFrame = API.createElement({
      type: "frame",
      backgroundColor: "#ff0000",
    });
    const modernFrame = API.createElement({
      type: "frame",
      backgroundColor: "#00ff00",
    });
    const modernFrameWithHint = {
      ...modernFrame,
      schemaVersion: SCHEMA_VERSIONS.latest,
    } as typeof modernFrame & { schemaVersion: number };

    const migrated = migrateSceneElements(
      [legacyFrame, modernFrameWithHint],
      {
        payloadSchemaVersion: undefined,
        fallbackVersion: SCHEMA_VERSIONS.initial,
      },
    )!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect(migrated[1].backgroundColor).toBe("#00ff00");
  });

  it("should prefer payload schema over per-element schema", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ff0000",
    });
    const frameFromModernSource = {
      ...frame,
      schemaVersion: SCHEMA_VERSIONS.latest,
    } as typeof frame & { schemaVersion: number };

    const migrated = migrateClipboardElements([frameFromModernSource], {
      payloadSchemaVersion: SCHEMA_VERSIONS.initial,
      fallbackVersion: SCHEMA_VERSIONS.latest,
    })!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
  });

  it("should detect schema hints on elements", () => {
    const frame = API.createElement({ type: "frame" });
    const withHint = {
      ...frame,
      schemaVersion: SCHEMA_VERSIONS.latest,
    } as typeof frame & { schemaVersion: number };

    expect(hasElementSchemaVersion([frame])).toBe(false);
    expect(hasElementSchemaVersion([withHint])).toBe(true);
  });
});
