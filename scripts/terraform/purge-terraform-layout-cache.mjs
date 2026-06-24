#!/usr/bin/env node
/**
 * Purge all keys in the production layout cache KV namespace.
 * Used on master deploy before re-seeding precomputed layouts.
 *
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 * Usage: node scripts/terraform/purge-terraform-layout-cache.mjs [--preview]
 */

const usePreview = process.argv.includes("--preview");
const namespaceId = usePreview
  ? "ffdd6e30dd904f1e899e1e3da72f27f4"
  : "f47a2e1592bd4edc8e9a132683dbb534";

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID } = process.env;
if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
  console.error("Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}`;
const headers = { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` };

let cursor;
let deleted = 0;

do {
  const url = new URL(`${base}/keys`);
  url.searchParams.set("limit", "1000");
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`KV list failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body = await res.json();
  if (!body.success) {
    console.error("KV list error:", JSON.stringify(body.errors));
    process.exit(1);
  }

  const keys = body.result.map((r) => r.name);
  if (keys.length > 0) {
    // Bulk delete via POST
    const del = await fetch(`${base}/bulk/delete`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(keys),
    });
    if (!del.ok) {
      console.error(`KV bulk delete failed: ${del.status} ${await del.text()}`);
      process.exit(1);
    }
    const delBody = await del.json();
    if (!delBody.success) {
      console.error("KV bulk delete error:", JSON.stringify(delBody.errors));
      process.exit(1);
    }
    deleted += keys.length;
  }

  cursor = body.result_info?.cursor;
  if (!cursor || body.result_info?.count < 1000) cursor = undefined;
} while (cursor);

console.log(
  `Purged ${deleted} key(s) from ${usePreview ? "preview" : "production"} layout cache KV.`,
);
