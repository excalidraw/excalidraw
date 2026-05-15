import fs from "node:fs";

/** Best-effort account id from a terraform state pull JSON file. */
export function accountIdFromStateFile(statePath) {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  for (const resource of state.resources || []) {
    for (const instance of resource.instances || []) {
      const attrs = instance.attributes || {};
      const candidates = [attrs.account_id, attrs.owner_id];
      for (const id of candidates) {
        if (typeof id === "string" && /^[0-9]{12}$/.test(id)) {
          return id;
        }
      }
    }
  }
  const fromEnv = process.env.AWS_ACCOUNT_ID || process.env.TF_VAR_aws_account_id;
  if (fromEnv && /^[0-9]{12}$/.test(String(fromEnv).trim())) {
    return String(fromEnv).trim();
  }
  return null;
}
