/**
 * Attachment rules for semantic topology satellite kinds (catalog JSON).
 */

import {
  TOPOLOGY_SATELLITE_KINDS,
  type TopologySatelliteKind,
} from "./terraformTopologyPrimaryLayoutTypes";

export type TopologyReverseRefMatch = "arn" | "planAddress" | "functionName";

export type TopologyAttachmentRulePlugin = {
  mode: "plugin";
  plugin: string;
};

export type TopologyAttachmentRuleReverseRef = {
  mode: "reverseRef";
  satelliteTypes: string[];
  primaryTypes: string[];
  linkField: string;
  match?: TopologyReverseRefMatch[];
  edgeType?: string;
  edgeLabel?: string;
};

export type TopologyAttachmentRuleCompanions = {
  mode: "companions";
  primaryTypes: string[];
  satelliteTypes: string[];
  linkFields: string[];
  edgeType?: string;
  edgeLabel?: string;
};

export type TopologyAttachmentRuleForwardRef = {
  mode: "forwardRef";
  primaryTypes: string[];
  satelliteTypes: string[];
  primaryField: string;
  edgeType?: string;
  edgeLabel?: string;
};

export type TopologyAttachmentRule =
  | TopologyAttachmentRulePlugin
  | TopologyAttachmentRuleReverseRef
  | TopologyAttachmentRuleCompanions
  | TopologyAttachmentRuleForwardRef;

export type TopologySatelliteKindCatalogEntry = {
  kind: TopologySatelliteKind;
  attachment: TopologyAttachmentRule;
};

export type TopologySatelliteKindCatalogJson = {
  kinds: TopologySatelliteKindCatalogEntry[];
};

const KIND_SET = new Set<string>(TOPOLOGY_SATELLITE_KINDS);

function isAttachmentRule(v: unknown): v is TopologyAttachmentRule {
  if (!v || typeof v !== "object") {
    return false;
  }
  const r = v as Record<string, unknown>;
  const mode = r.mode;
  if (mode === "plugin") {
    return typeof r.plugin === "string" && r.plugin.length > 0;
  }
  if (mode === "reverseRef") {
    return (
      Array.isArray(r.satelliteTypes) &&
      Array.isArray(r.primaryTypes) &&
      typeof r.linkField === "string"
    );
  }
  if (mode === "companions") {
    return (
      Array.isArray(r.primaryTypes) &&
      Array.isArray(r.satelliteTypes) &&
      Array.isArray(r.linkFields) &&
      r.linkFields.length > 0
    );
  }
  if (mode === "forwardRef") {
    return (
      Array.isArray(r.primaryTypes) &&
      Array.isArray(r.satelliteTypes) &&
      typeof r.primaryField === "string"
    );
  }
  return false;
}

export function validateTopologySatelliteKindCatalog(
  raw: unknown,
): TopologySatelliteKindCatalogJson {
  if (!raw || typeof raw !== "object") {
    throw new Error("satellite kind catalog: expected object");
  }
  const kinds = (raw as TopologySatelliteKindCatalogJson).kinds;
  if (!Array.isArray(kinds) || kinds.length === 0) {
    throw new Error("satellite kind catalog: kinds required");
  }
  const seen = new Set<string>();
  for (const entry of kinds) {
    if (!entry || typeof entry !== "object") {
      throw new Error("satellite kind catalog: invalid entry");
    }
    if (!KIND_SET.has(entry.kind)) {
      throw new Error(`satellite kind catalog: unknown kind ${entry.kind}`);
    }
    if (seen.has(entry.kind)) {
      throw new Error(`satellite kind catalog: duplicate kind ${entry.kind}`);
    }
    seen.add(entry.kind);
    if (!isAttachmentRule(entry.attachment)) {
      throw new Error(
        `satellite kind catalog: invalid attachment for ${entry.kind}`,
      );
    }
  }
  for (const k of TOPOLOGY_SATELLITE_KINDS) {
    if (!seen.has(k)) {
      throw new Error(`satellite kind catalog: missing kind ${k}`);
    }
  }
  return raw as TopologySatelliteKindCatalogJson;
}
