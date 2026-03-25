import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import { API } from "../tests/helpers/api";

import {
  CORE_FRAME_SCHEMA_TRACK,
  type SchemaMigration,
  CORE_SUPPORTED_TRACKS,
  migrateElements,
  resolveTrackVersion,
  SCHEMA_INITIAL_TRACK_VERSION,
  SCHEMA_MIGRATIONS,
  validateSchemaMigrations,
} from "./schema";

describe("schema migration", () => {
  it("should migrate legacy frame backgrounds to transparent", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#ffc9c9",
      }),
      schemaState: { tracks: {} },
    };

    const migrated = migrateElements([frame])!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect(migrated[0].schemaState.tracks[CORE_FRAME_SCHEMA_TRACK]).toBe(
      CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK],
    );
  });

  it("should keep latest-track frame backgrounds unchanged", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#ffc9c9",
      }),
      schemaState: {
        tracks: {
          [CORE_FRAME_SCHEMA_TRACK]:
            CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK],
        },
      },
    };

    const migrated = migrateElements([frame])!;

    expect(migrated[0].backgroundColor).toBe("#ffc9c9");
    expect(migrated[0].schemaState.tracks[CORE_FRAME_SCHEMA_TRACK]).toBe(
      CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK],
    );
  });

  it("should normalize legacy frame backgrounds", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#a5d8ff",
      }),
      schemaState: {
        tracks: {
          [CORE_FRAME_SCHEMA_TRACK]: SCHEMA_INITIAL_TRACK_VERSION,
        },
      },
    };

    const migrated = migrateElements([frame])!;
    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
  });

  it("should resolve invalid track versions to initial", () => {
    expect(resolveTrackVersion(undefined)).toBe(SCHEMA_INITIAL_TRACK_VERSION);
    expect(resolveTrackVersion(0)).toBe(SCHEMA_INITIAL_TRACK_VERSION);
    expect(resolveTrackVersion(2)).toBe(2);
  });

  it("should have a valid migration registry configuration", () => {
    expect(validateSchemaMigrations(SCHEMA_MIGRATIONS)).toEqual([]);
  });

  it("should reject invalid migration metadata", () => {
    const invalidMigrations: SchemaMigration[] = [
      {
        id: "",
        namespace: "core",
        track: CORE_FRAME_SCHEMA_TRACK,
        toVersion: 2.1,
        title: "",
        description: " ",
        targetTypes: [],
        apply: (element) => element,
      },
      {
        id: "dup",
        namespace: "core",
        track: CORE_FRAME_SCHEMA_TRACK,
        toVersion: 2.1,
        title: "duplicate",
        description: "duplicate version",
        targetTypes: ["frame"],
        apply: (element) => element,
      },
      {
        id: "dup",
        namespace: "core",
        track: CORE_FRAME_SCHEMA_TRACK,
        toVersion: 3,
        title: "duplicate id",
        description: "duplicate id",
        targetTypes: ["frame"],
        apply: (element) => element,
      },
    ];

    const errors = validateSchemaMigrations(invalidMigrations);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain("integer version");
    expect(errors.join("\n")).toContain("title must be non-empty");
    expect(errors.join("\n")).toContain("non-empty description");
    expect(errors.join("\n")).toContain("Duplicate schema migration id");
    expect(errors.join("\n")).toContain("at least one target type");
  });

  it("should reject versions at or below initial", () => {
    const errors = validateSchemaMigrations([
      {
        id: "invalid-start",
        namespace: "core",
        track: CORE_FRAME_SCHEMA_TRACK,
        toVersion: SCHEMA_INITIAL_TRACK_VERSION,
        title: "invalid start",
        description: "bad version",
        targetTypes: ["frame"],
        apply: (element) => element,
      },
    ]);

    expect(errors.join("\n")).toContain("must be greater than 1");
  });

  it("should reject core track/version mismatch", () => {
    const errors = validateSchemaMigrations([
      {
        id: "frame-v3",
        namespace: "core",
        track: CORE_FRAME_SCHEMA_TRACK,
        toVersion: CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK] + 1,
        title: "future migration",
        description: "future migration for test",
        targetTypes: ["frame"],
        apply: (element) => element,
      },
    ]);

    expect(errors.join("\n")).toContain(
      `Core supported track "${CORE_FRAME_SCHEMA_TRACK}" (${CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK]}) must match last migration version`,
    );
  });

  it("should reject undeclared core tracks", () => {
    const errors = validateSchemaMigrations([
      {
        id: "unknown-core-track",
        namespace: "core",
        track: "excalidraw.shape.unknown",
        toVersion: 2,
        title: "unknown core track",
        description: "should require supported-track declaration",
        targetTypes: ["rectangle"],
        apply: (element) => element,
      },
    ]);

    expect(errors.join("\n")).toContain(
      "must be declared in CORE_SUPPORTED_TRACKS",
    );
  });

  it("should not depend on temporary fields during migration", () => {
    const frame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#a5d8ff",
      }),
      schemaState: { tracks: {} },
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

  it("should use per-element track hints", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ff0000",
    });
    const frameFromModernSource = {
      ...frame,
      schemaState: {
        tracks: {
          [CORE_FRAME_SCHEMA_TRACK]:
            CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK],
        },
      },
    };

    const migrated = migrateElements([frameFromModernSource])!;

    expect(migrated[0].backgroundColor).toBe("#ff0000");
  });

  it("should migrate mixed-hint elements individually", () => {
    const legacyFrame = {
      ...API.createElement({
        type: "frame",
        backgroundColor: "#ff0000",
      }),
      schemaState: { tracks: {} },
    };
    const modernFrame = API.createElement({
      type: "frame",
      backgroundColor: "#00ff00",
    });
    const modernFrameWithTrack = {
      ...modernFrame,
      schemaState: {
        tracks: {
          [CORE_FRAME_SCHEMA_TRACK]:
            CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK],
        },
      },
    };

    const migrated = migrateElements([legacyFrame, modernFrameWithTrack])!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect(migrated[1].backgroundColor).toBe("#00ff00");
  });

  it("should preserve higher-than-supported track versions", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ff0000",
    });
    const futureFrame = {
      ...frame,
      schemaState: {
        tracks: {
          [CORE_FRAME_SCHEMA_TRACK]:
            CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK] + 1,
        },
      },
    };

    const migrated = migrateElements([futureFrame])!;
    expect(migrated[0].schemaState.tracks[CORE_FRAME_SCHEMA_TRACK]).toBe(
      CORE_SUPPORTED_TRACKS[CORE_FRAME_SCHEMA_TRACK] + 1,
    );
    expect(migrated[0].backgroundColor).toBe("#ff0000");
  });

  it("should normalize invalid schema state and preserve unknown tracks", () => {
    const rect = {
      ...API.createElement({ type: "rectangle" }),
      schemaState: {
        tracks: {
          "host.myapp.card": 4,
          [CORE_FRAME_SCHEMA_TRACK]: 0,
        },
      },
    };

    const migrated = migrateElements([rect])!;
    expect(migrated[0].schemaState.tracks[CORE_FRAME_SCHEMA_TRACK]).toBe(
      SCHEMA_INITIAL_TRACK_VERSION,
    );
    expect(migrated[0].schemaState.tracks["host.myapp.card"]).toBe(4);
  });
});
