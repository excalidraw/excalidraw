import fs from "node:fs";
import path from "node:path";

const COMMENT_MARKER = "<!-- playwright-e2e-report -->";
const RESULTS_FILE =
  process.env.PLAYWRIGHT_RESULTS_FILE ?? "playwright-report/results.json";
const COMMENT_FILE =
  process.env.PLAYWRIGHT_COMMENT_FILE ?? "playwright-comment.md";
const MAX_ERROR_LENGTH = 2500;

const statusLabel = (status) => {
  switch (status) {
    case "passed":
      return "PASS";
    case "failed":
    case "timedOut":
    case "interrupted":
      return "FAIL";
    case "skipped":
      return "SKIP";
    default:
      return (status ?? "unknown").toUpperCase();
  }
};

const formatDuration = (duration = 0) => {
  if (duration < 1000) {
    return `${duration}ms`;
  }

  return `${(duration / 1000).toFixed(2)}s`;
};

const truncate = (value, max = MAX_ERROR_LENGTH) => {
  if (!value) {
    return "";
  }

  const text = String(value).trim();
  return text.length > max ? `${text.slice(0, max)}\n... (truncated)` : text;
};

const escapeTableValue = (value) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");

const collectSpecs = (suite, parentTitles = []) => {
  const specs = [];

  for (const spec of suite.specs ?? []) {
    specs.push({
      ...spec,
      titlePath: [...parentTitles, spec.title].filter(Boolean),
    });
  }

  for (const child of suite.suites ?? []) {
    specs.push(...collectSpecs(child, [...parentTitles, child.title]));
  }

  return specs;
};

const getSpecStatus = (spec) => {
  const statuses = (spec.tests ?? []).flatMap((test) =>
    (test.results ?? []).map((result) => result.status),
  );

  const hasPassed = statuses.includes("passed");
  const hasFailure =
    statuses.includes("failed") || statuses.includes("timedOut");

  if (hasPassed && hasFailure) {
    return "flaky";
  }

  if (hasFailure) {
    return "failed";
  }

  if (statuses.includes("interrupted")) {
    return "interrupted";
  }

  if (statuses.length > 0 && statuses.every((status) => status === "skipped")) {
    return "skipped";
  }

  if (hasPassed) {
    return "passed";
  }

  return "unknown";
};

const getSpecDuration = (spec) =>
  (spec.tests ?? []).reduce(
    (total, test) =>
      total +
      (test.results ?? []).reduce(
        (resultTotal, result) => resultTotal + (result.duration ?? 0),
        0,
      ),
    0,
  );

const getFailureDetails = (spec) => {
  const failures = [];

  for (const test of spec.tests ?? []) {
    for (const result of test.results ?? []) {
      if (!["failed", "timedOut", "interrupted"].includes(result.status)) {
        continue;
      }

      const attachments = (result.attachments ?? []).map((attachment) => {
        const name = attachment.name ?? "attachment";
        const file = attachment.path
          ? path.relative(process.cwd(), attachment.path)
          : "";
        return file ? `\`${name}\`: \`${file}\`` : `\`${name}\``;
      });

      failures.push({
        status: result.status,
        duration: result.duration ?? 0,
        retry: result.retry ?? 0,
        error: truncate(result.error?.message ?? result.error?.value ?? ""),
        stack: truncate(result.error?.stack ?? ""),
        attachments,
      });
    }
  }

  return failures;
};

const readResults = () => {
  const absolutePath = path.resolve(process.cwd(), RESULTS_FILE);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
};

const buildComment = () => {
  const results = readResults();
  const outcome = process.env.PLAYWRIGHT_OUTCOME ?? "unknown";
  const passed = outcome === "success";
  const runUrl = process.env.PLAYWRIGHT_RUN_URL ?? "";
  const reportUrl = process.env.PLAYWRIGHT_REPORT_URL ?? "";
  const artifactsUrl = process.env.PLAYWRIGHT_ARTIFACTS_URL ?? "";
  const branch =
    process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
  const commit = (process.env.GITHUB_SHA ?? "").slice(0, 7);
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";

  const lines = [
    COMMENT_MARKER,
    "## Playwright E2E report",
    "",
    `**Result:** ${passed ? "PASSED" : "FAILED"} (\`${outcome}\`)`,
    "",
    "| | |",
    "| --- | --- |",
    `| Branch | \`${branch || "unknown"}\` |`,
    `| Commit | \`${commit || "unknown"}\` |`,
    `| Attempt | ${attempt} |`,
  ];

  if (runUrl) {
    lines.push(`| Workflow run | [Open run](${runUrl}) |`);
  }

  if (reportUrl) {
    lines.push(
      `| Interactive report | [Open \`playwright show-report\` HTML artifact](${reportUrl}) |`,
    );
  }

  if (artifactsUrl) {
    lines.push(`| All artifacts | [Open artifacts](${artifactsUrl}) |`);
  }

  lines.push("");

  if (!results) {
    lines.push(
      "> Playwright did not produce `playwright-report/results.json`. The run probably failed before the tests started. Check the workflow logs above.",
    );
    return { body: `${lines.join("\n")}\n`, hasFailures: !passed };
  }

  if (results.parseError) {
    lines.push(
      `> Could not parse the Playwright results: \`${results.parseError}\``,
    );
    return { body: `${lines.join("\n")}\n`, hasFailures: !passed };
  }

  const specs = (results.suites ?? []).flatMap((suite) => collectSpecs(suite));
  const stats = results.stats ?? {};
  const specStatuses = specs.map(getSpecStatus);
  const failed = specStatuses.filter((status) => status === "failed").length;
  const flaky = specStatuses.filter((status) => status === "flaky").length;
  const skipped = specStatuses.filter((status) => status === "skipped").length;
  const total = specs.length;
  const passedCount = total - failed - flaky - skipped;

  lines.push(
    "| Total | Passed | Failed | Flaky | Skipped | Duration |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${total} | ${passedCount} | ${failed} | ${flaky} | ${skipped} | ${formatDuration(
      stats.duration,
    )} |`,
    "",
  );

  lines.push(
    "<details>",
    `<summary>All tests (${total})</summary>`,
    "",
    "| Status | Test | File | Duration |",
    "| --- | --- | --- | ---: |",
  );

  for (const spec of specs) {
    const status = getSpecStatus(spec);
    const file = spec.file ? path.relative(process.cwd(), spec.file) : "";
    const location = `${file}:${spec.line ?? 0}`;
    lines.push(
      `| ${statusLabel(status)} | ${escapeTableValue(
        spec.titlePath.join(" > "),
      )} | \`${location}\` | ${formatDuration(getSpecDuration(spec))} |`,
    );
  }

  lines.push("</details>", "");

  if (failed > 0 || flaky > 0) {
    lines.push("### Failures", "");

    for (const spec of specs) {
      const status = getSpecStatus(spec);
      if (status !== "failed" && status !== "flaky") {
        continue;
      }

      const file = spec.file ? path.relative(process.cwd(), spec.file) : "";
      lines.push(
        `#### ${statusLabel(status)}: ${spec.titlePath.join(" > ")}`,
        "",
        `- Location: \`${file}:${spec.line ?? 0}\``,
      );

      for (const failure of getFailureDetails(spec)) {
        lines.push(
          `- Attempt: ${failure.retry + 1}`,
          `- Duration: ${formatDuration(failure.duration)}`,
        );

        if (failure.attachments.length > 0) {
          lines.push(`- Attachments: ${failure.attachments.join(", ")}`);
        }

        if (failure.error) {
          lines.push("", "```text", truncate(failure.error), "```");
        } else if (failure.stack) {
          lines.push("", "```text", truncate(failure.stack), "```");
        }
      }

      lines.push("");
    }
  }

  lines.push(
    "---",
    "",
    `_Updated by the \`Playwright E2E\` workflow for run ${attempt}._`,
  );

  return { body: `${lines.join("\n")}\n`, hasFailures: failed > 0 || !passed };
};

const { body } = buildComment();
fs.writeFileSync(COMMENT_FILE, body);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${body}\n`);
}

process.stdout.write(`Wrote Playwright comment to ${COMMENT_FILE}\n`);
