import { describe, expect, it } from "vitest";

import {
  TOPOLOGY_SATELLITE_KINDS,
  allKindsInLayouts,
  validateTopologyPrimaryLayoutJson,
} from "./terraformTopologyPrimaryLayoutTypes";
import {
  __topologyPrimaryLayoutsForTest,
  getPrimaryLayoutConfig,
  getRegisteredTopologyPrimaryLayoutTypes,
  getTopologyPrimaryLayoutJson,
} from "./terraformTopologyPrimaryLayoutConfig";

import "./terraformTopologySatelliteRegistry";

describe("terraformTopologyPrimaryLayoutConfig", () => {
  it("registers default and per-type layouts", () => {
    const types = getRegisteredTopologyPrimaryLayoutTypes();
    expect(types).toContain("default");
    expect(types).toContain("aws_lambda_function");
    expect(types).toContain("aws_ecs_service");
    expect(types).toContain("aws_api_gateway_rest_api");
    expect(types).toContain("aws_s3_bucket");
    expect(types).toContain("aws_ec2_transit_gateway");
    expect(types).toContain("aws_lb");
  });

  it("falls back to default for unknown primary types", () => {
    const unknown = getPrimaryLayoutConfig("aws_fictional_unknown_type");
    const def = getPrimaryLayoutConfig("default");
    expect(unknown.slots).toEqual(def.slots);
  });

  it("loads aws_instance-specific slot kinds", () => {
    const ec2 = getTopologyPrimaryLayoutJson("aws_instance");
    expect(ec2.attachments).toContain("security_groups");
    expect(ec2.slots.some((s) => s.kinds.includes("cloudwatch_alarms"))).toBe(
      true,
    );
  });

  it("loads lambda-specific slot kinds", () => {
    const lambda = getTopologyPrimaryLayoutJson("aws_lambda_function");
    const bottomStart = lambda.slots.find(
      (s) => s.anchor === "bottom" && s.align === "start",
    );
    expect(bottomStart?.kinds).toContain("iam");
    expect(bottomStart?.kinds).toContain("lambda_permission");
    expect(bottomStart?.kinds).not.toContain("s3_companions");
  });

  it("validates slot kinds are listed in attachments", () => {
    const lambda = getTopologyPrimaryLayoutJson("aws_lambda_function");
    const attachmentSet = new Set(lambda.attachments);
    for (const slot of lambda.slots) {
      for (const k of slot.kinds) {
        expect(attachmentSet.has(k)).toBe(true);
      }
    }
    expect(attachmentSet.has("s3_companions")).toBe(false);
  });

  it("resolved config exposes enabledKinds", () => {
    const cfg = getPrimaryLayoutConfig("aws_lambda_function");
    expect(cfg.enabledKinds.has("lambda_permission")).toBe(true);
    expect(cfg.enabledKinds.has("alb_companions")).toBe(false);
  });

  it("validates every bundled JSON layout", () => {
    for (const raw of __topologyPrimaryLayoutsForTest) {
      expect(() => validateTopologyPrimaryLayoutJson(raw)).not.toThrow();
    }
  });

  it("covers all known satellite kinds across layouts", () => {
    const used = new Set(allKindsInLayouts(__topologyPrimaryLayoutsForTest));
    for (const kind of TOPOLOGY_SATELLITE_KINDS) {
      expect(used.has(kind)).toBe(true);
    }
  });
});
