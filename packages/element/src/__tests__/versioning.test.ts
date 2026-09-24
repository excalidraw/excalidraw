import {
  CURRENT_SCHEMA_VERSION,
  getSchemaVersion,
  migrateElement,
  migrateElementPartial,
  migrateElements,
} from "../versioning";

describe("scene schema versioning", () => {
  describe("getSchemaVersion", () => {
    it("treats a container without schemaVersion as legacy (version 0)", () => {
      expect(getSchemaVersion({})).toBe(0);
      expect(getSchemaVersion({ schemaVersion: undefined })).toBe(0);
      expect(getSchemaVersion(null)).toBe(0);
      expect(getSchemaVersion(undefined)).toBe(0);
    });

    it("treats an invalid schemaVersion as legacy (version 0)", () => {
      expect(getSchemaVersion({ schemaVersion: "2" })).toBe(0);
      expect(getSchemaVersion({ schemaVersion: NaN })).toBe(0);
      expect(getSchemaVersion({ schemaVersion: Infinity })).toBe(0);
    });

    it("returns the container's schemaVersion when present", () => {
      expect(getSchemaVersion({ schemaVersion: 1 })).toBe(1);
      expect(getSchemaVersion({ schemaVersion: 3 })).toBe(3);
    });
  });

  describe("migrateElements", () => {
    it("lifts legacy elements through the whole migration chain", () => {
      const legacy = [{ id: "a", type: "rectangle", backgroundColor: "#fff" }];

      const migrated = migrateElements(legacy, 0);

      // v0 -> v1 migration keeps the element shape intact
      expect(migrated).toEqual(legacy);
    });

    it("returns the input array unchanged when already current", () => {
      const elements = [{ id: "a", type: "rectangle" }];

      expect(migrateElements(elements, CURRENT_SCHEMA_VERSION)).toBe(elements);
    });

    it("returns the input array unchanged when coming from a newer client", () => {
      const elements = [{ id: "a", type: "rectangle" }];

      expect(migrateElements(elements, CURRENT_SCHEMA_VERSION + 1)).toBe(
        elements,
      );
    });
  });

  describe("migrateElement", () => {
    it("does not mutate the input element", () => {
      const legacy = { id: "a", type: "rectangle" };

      const migrated = migrateElement(legacy, 0);

      expect(migrated).toEqual({ id: "a", type: "rectangle" });
      expect(legacy).toEqual({ id: "a", type: "rectangle" });
    });
  });

  describe("migrateElementPartial", () => {
    it("lifts a legacy delta partial to the current schema version", () => {
      const partial = { backgroundColor: "#fff", version: 2 };

      expect(migrateElementPartial(partial, 0)).toEqual(partial);
    });

    it("returns the partial unchanged when already current", () => {
      const partial = { backgroundColor: "#fff" };

      expect(migrateElementPartial(partial, CURRENT_SCHEMA_VERSION)).toBe(
        partial,
      );
    });
  });

  // Template for future migrations
  it("runs migrations in sequence up to the current version", () => {
    const migrated = migrateElement({ id: "a" }, 0);

    expect(migrated).toEqual({ id: "a" });
  });
});
