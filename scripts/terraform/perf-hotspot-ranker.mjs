#!/usr/bin/env node

import { readFileSync } from "node:fs";

function fmtMs(v) {
  return `${Math.round(v * 100) / 100}ms`;
}

function fmtRatio(v) {
  return `${Math.round((v - 1) * 1000) / 10}%`;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("usage: node scripts/terraform/perf-hotspot-ranker.mjs <profile.json>");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(inputPath, "utf8"));
// `topSpans` (ranked by inclusive ms) is the current shape; fall back to the
// legacy `topSelfSpans` for older artifacts.
const topSpans = Array.isArray(raw.topSpans)
  ? raw.topSpans
  : Array.isArray(raw.topSelfSpans)
  ? raw.topSelfSpans
  : [];
const topRegressions = Array.isArray(raw.topRegressions)
  ? raw.topRegressions
  : [];
const noteworthy = topRegressions.filter((r) => typeof r.ratio === "number" && r.ratio > 1.05);

const lines = [];
lines.push("## Terraform Import Hotspot Ranker");
lines.push("");
lines.push(`Profile source: \`${inputPath}\``);
lines.push("");
if (raw.primaryView) {
  lines.push(`Primary view: \`${raw.primaryView}\``);
  lines.push("");
}
lines.push("### Top spans (inclusive ms)");
lines.push("");
if (topSpans.length === 0) {
  lines.push("- (none)");
} else {
  for (const s of topSpans.slice(0, 10)) {
    const v = typeof s.ms === "number" ? s.ms : s.selfMs;
    lines.push(`- \`${s.name}\`: ${fmtMs(v)} (calls: ${s.callCount})`);
  }
}
lines.push("");
lines.push("### Top baseline regressions");
lines.push("");
if (topRegressions.length === 0) {
  lines.push("- (none)");
} else {
  for (const s of topRegressions.slice(0, 10)) {
    lines.push(
      `- \`${s.name}\`: ${fmtRatio(s.ratio)} (${fmtMs(s.baselineSelfMs)} -> ${fmtMs(s.selfMs)}, delta ${fmtMs(s.deltaMs)})`,
    );
  }
}
lines.push("");
if (noteworthy.length > 0) {
  lines.push(
    `Hotspot candidates (>5% baseline regression): ${noteworthy
      .slice(0, 5)
      .map((r) => `\`${r.name}\``)
      .join(", ")}`,
  );
} else {
  lines.push("No >5% span regressions detected in this run.");
}

console.log(lines.join("\n"));
