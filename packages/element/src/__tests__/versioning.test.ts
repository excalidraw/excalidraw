import {
  CURRENT_ELEMENT_SCHEMA_VERSION,
  getElementSchemaVersion,
  upgradeElementSchema,
} from "../versioning";

describe("element schema versioning", () => {
  describe("getElementSchemaVersion", () => {
    it("treats an element without schemaVersion as legacy (version 0)", () => {
      expect(getElementSchemaVersion({})).toBe(0);
      expect(getElementSchemaVersion({ schemaVersion: undefined })).toBe(0);
    });

    it("returns the element's schemaVersion when present", () => {
      expect(getElementSchemaVersion({ schemaVersion: 1 })).toBe(1);
      expect(getElementSchemaVersion({ schemaVersion: 3 })).toBe(3);
    });
  });

  describe("upgradeElementSchema", () => {
    it("lifts a legacy element to the current schema version", () => {
      const legacy = { id: "a", type: "rectangle", backgroundColor: "#fff" };

      const upgraded = upgradeElementSchema(legacy);

      expect(upgraded.schemaVersion).toBe(CURRENT_ELEMENT_SCHEMA_VERSION);
    });

    it("preserves all other properties when upgrading", () => {
      const legacy = { id: "a", type: "rectangle", backgroundColor: "#fff" };

      const upgraded = upgradeElementSchema(legacy);

      expect(upgraded).toEqual({
        ...legacy,
        schemaVersion: CURRENT_ELEMENT_SCHEMA_VERSION,
      });
    });

    it("is idempotent on an already-current element", () => {
      const current = {
        id: "a",
        type: "rectangle",
        schemaVersion: CURRENT_ELEMENT_SCHEMA_VERSION,
      };

      const upgraded = upgradeElementSchema(current);

      expect(upgraded).toEqual(current);
    });

    it("does not mutate the input element", () => {
      const legacy = { id: "a", type: "rectangle" };

      upgradeElementSchema(legacy);

      expect(legacy).not.toHaveProperty("schemaVersion");
    });

    // Template for future N -> N+1 migrations. When a real migration is added
    // (e.g. repurposing an attribute at schema version 2), assert here that a
    // legacy element is transformed as expected end-to-end. Kept minimal on
    // purpose so it documents the pattern without asserting fake behavior.
    it("runs migrations in sequence up to the current version", () => {
      const upgraded = upgradeElementSchema({ id: "a", schemaVersion: 0 });

      expect(getElementSchemaVersion(upgraded)).toBe(
        CURRENT_ELEMENT_SCHEMA_VERSION,
      );
    });
  });
});
