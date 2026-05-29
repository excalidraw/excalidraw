import { describe, expect, it } from "vitest";

import catalogJson from "../assets/terraform-topology-satellite-kinds.json";

import { assertAllCatalogPluginsRegistered } from "./terraformTopologySatelliteRegistry";
import { installSatellitePlugins } from "./terraformTopologySatellitePlugins";
import {
  getAllCatalogPluginIds,
  getSatelliteAttachmentRule,
  __satelliteKindCatalogForTest,
} from "./terraformTopologySatelliteEngine";
import { TOPOLOGY_SATELLITE_KINDS } from "./terraformTopologyPrimaryLayoutTypes";
import { validateTopologySatelliteKindCatalog } from "./terraformTopologySatelliteRulesTypes";

describe("terraformTopologySatelliteKindCatalog", () => {
  installSatellitePlugins();
  it("validates bundled catalog JSON", () => {
    expect(() =>
      validateTopologySatelliteKindCatalog(catalogJson),
    ).not.toThrow();
  });

  it("defines every TOPOLOGY_SATELLITE_KINDS entry", () => {
    const kinds = new Set(
      __satelliteKindCatalogForTest.kinds.map((e) => e.kind),
    );
    for (const k of TOPOLOGY_SATELLITE_KINDS) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  it("registers every plugin id from the catalog", () => {
    assertAllCatalogPluginsRegistered();
    for (const id of getAllCatalogPluginIds()) {
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("exposes attachment rules per kind", () => {
    expect(getSatelliteAttachmentRule("lambda_permission")?.mode).toBe(
      "reverseRef",
    );
    expect(getSatelliteAttachmentRule("kms_policies")?.mode).toBe("companions");
    expect(getSatelliteAttachmentRule("iam")?.mode).toBe("plugin");
  });
});
