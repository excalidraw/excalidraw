import crypto from "node:crypto";

/** Normalized fingerprint of plan shape for reproducibility checks. */
export function planChangesFingerprint(planJson) {
  const plan =
    typeof planJson === "string" ? JSON.parse(planJson) : planJson;
  const rows = (plan.resource_changes || []).map((rc) => {
    const actions = [...(rc.change?.actions || [])].sort().join("+");
    return `${rc.address}\t${actions}`;
  });
  rows.sort();
  return crypto.createHash("sha256").update(rows.join("\n")).digest("hex");
}

export function countActions(planJson) {
  const plan =
    typeof planJson === "string" ? JSON.parse(planJson) : planJson;
  const counts = { create: 0, update: 0, delete: 0, "no-op": 0, read: 0 };
  for (const rc of plan.resource_changes || []) {
    for (const action of rc.change?.actions || []) {
      if (action in counts) {
        counts[action]++;
      }
    }
  }
  return counts;
}
