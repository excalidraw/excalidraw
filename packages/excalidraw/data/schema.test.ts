import { DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";

import { API } from "../tests/helpers/api";
import {
  migrateElementsBySchema,
  resolveSchemaVersion,
  SCHEMA_VERSIONS,
} from "./schema";

describe("schema migration", () => {
  it("should migrate legacy frame backgrounds to transparent", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ffc9c9",
    });
    (frame as any).backgroundEnabled = true;

    const migrated = migrateElementsBySchema([frame], SCHEMA_VERSIONS.initial)!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect((migrated[0] as any).backgroundEnabled).toBeUndefined();
  });

  it("should keep latest-schema frame backgrounds unchanged", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#ffc9c9",
    });
    (frame as any).backgroundEnabled = true;

    const migrated = migrateElementsBySchema(
      [frame],
      SCHEMA_VERSIONS.latest,
    )!;

    expect(migrated[0].backgroundColor).toBe("#ffc9c9");
    expect((migrated[0] as any).backgroundEnabled).toBeUndefined();
  });

  it("should normalize legacy false-flag frame backgrounds", () => {
    const frame = API.createElement({
      type: "frame",
      backgroundColor: "#a5d8ff",
    });
    (frame as any).backgroundEnabled = false;

    const migrated = migrateElementsBySchema([frame], SCHEMA_VERSIONS.initial)!;

    expect(migrated[0].backgroundColor).toBe(
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    );
    expect((migrated[0] as any).backgroundEnabled).toBeUndefined();
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
});
