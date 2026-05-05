/**
 * Small shared helpers for Terraform plan nodes: plain-object checks, effective resource config,
 * and recursive AWS id extraction used by the pipeline, VPC facets, perimeter rules, and Excalidraw export.
 */

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Prefer `change.after`, then saved `values`, then `change.before` for attribute reads. */
function getCurrentResourceConfig(resource) {
  const change = resource.change || {};
  if (isPlainObject(change.after)) {
    return change.after;
  }
  if (isPlainObject(resource.values)) {
    return resource.values;
  }
  if (isPlainObject(change.before)) {
    return change.before;
  }
  return {};
}

/** First resource entry on a node that declares a `type`. */
function getPrimaryResourceFromNode(node = {}) {
  return Object.values(node.resources || {}).find((r) => r?.type) || {};
}

function normalizeVpcId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^vpc-[0-9a-f]+$/i.test(trimmed) ? trimmed : null;
}

function normalizeSubnetId(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^subnet-[0-9a-f]+$/i.test(trimmed) ? trimmed : null;
}

function collectAwsIdsFromValue(value, normalizer, out, depth = 0) {
  if (depth > 8 || value === null || typeof value === "undefined") {
    return;
  }

  const normalized = normalizer(value);
  if (normalized) {
    out.add(normalized);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectAwsIdsFromValue(entry, normalizer, out, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    for (const entry of Object.values(value)) {
      collectAwsIdsFromValue(entry, normalizer, out, depth + 1);
    }
  }
}

function extractVpcIdsFromConfig(config) {
  const ids = new Set();
  collectAwsIdsFromValue(config, normalizeVpcId, ids);
  return [...ids];
}

function extractSubnetIdsFromConfig(config) {
  const ids = new Set();
  collectAwsIdsFromValue(config, normalizeSubnetId, ids);
  return [...ids];
}

module.exports = {
  isPlainObject,
  getCurrentResourceConfig,
  getPrimaryResourceFromNode,
  normalizeVpcId,
  normalizeSubnetId,
  collectAwsIdsFromValue,
  extractVpcIdsFromConfig,
  extractSubnetIdsFromConfig,
};
