#!/usr/bin/env node
/**
 * Landing page performance benchmark (cold + warm).
 *
 * Usage:
 *   node scripts/benchmark-landing.mjs
 *   node scripts/benchmark-landing.mjs --url https://branch.project.pages.dev --runs 3
 *   node scripts/benchmark-landing.mjs --url http://localhost:5000 --label local
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RESULTS_PATH = path.join(REPO_ROOT, "scripts/benchmark-landing-results.json");

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};

const baseUrl = getArg("--url", "http://localhost:5000").replace(/\/$/, "");
const runs = Number(getArg("--runs", "3"));
const label = getArg("--label", new URL(baseUrl).hostname);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const collectVitals = () =>
  new Promise((resolve) => {
    const result = { fcp: null, lcp: null, tbt: 0 };
    const longTaskStarts = [];

    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "paint" && entry.name === "first-contentful-paint") {
          result.fcp = entry.startTime;
        }
        if (entry.entryType === "largest-contentful-paint") {
          result.lcp = entry.startTime;
        }
        if (entry.entryType === "longtask") {
          longTaskStarts.push(entry.startTime);
          result.tbt += Math.max(0, entry.duration - 50);
        }
      }
    });

    try {
      po.observe({ type: "paint", buffered: true });
      po.observe({ type: "largest-contentful-paint", buffered: true });
      po.observe({ type: "longtask", buffered: true });
    } catch {
      // buffered longtask not supported everywhere
    }

    setTimeout(() => {
      po.disconnect();
      resolve(result);
    }, 5000);
  });

const runNavigation = async (page, { cacheEnabled, runLabel }) => {
  const cacheBust = `bench=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const targetUrl = `${baseUrl}/?${cacheBust}`;

  const requests = [];
  const onRequest = (request) => {
    requests.push({
      url: request.url(),
      resourceType: request.resourceType(),
      time: Date.now(),
    });
  };
  page.on("request", onRequest);

  const heroChunkAt = { ms: null };
  const onResponse = (response) => {
    const url = response.url();
    if (url.includes("HeroTopologyScene") && heroChunkAt.ms === null) {
      heroChunkAt.ms = Date.now();
    }
  };
  page.on("response", onResponse);

  const startedAt = Date.now();
  const response = await page.goto(targetUrl, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  await page.waitForSelector(".landing-page", { timeout: 30_000 }).catch(() => null);
  await page
    .waitForSelector(".lp-hero-scene-wrap, .lp-hero-scene-wrap--fallback", {
      timeout: 30_000,
    })
    .catch(() => null);

  const vitals = await page.evaluate(collectVitals);
  const nav = await page.evaluate(() => {
    const [navEntry] = performance.getEntriesByType("navigation");
    return navEntry
      ? {
          domContentLoaded: navEntry.domContentLoadedEventEnd,
          load: navEntry.loadEventEnd,
          responseEnd: navEntry.responseEnd,
          transferSize: navEntry.transferSize,
        }
      : null;
  });

  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => ({
        name: entry.name,
        transferSize: entry.transferSize,
        duration: entry.duration,
        initiatorType: entry.initiatorType,
      }))
      .sort((a, b) => b.transferSize - a.transferSize),
  );

  const placeholderVisible = await page
    .locator("#terraform-canvas .lp-canvas-shell__placeholder")
    .isVisible()
    .catch(() => false);

  page.off("request", onRequest);
  page.off("response", onResponse);

  const totalTransfer = resources.reduce(
    (sum, resource) => sum + (resource.transferSize || 0),
    0,
  );

  return {
    runLabel,
    cacheEnabled,
    status: response?.status() ?? null,
    elapsedMs: Date.now() - startedAt,
    navigation: nav,
    vitals,
    requestCount: requests.length,
    totalTransferBytes: totalTransfer,
    heroChunkRequestedMs:
      heroChunkAt.ms === null ? null : heroChunkAt.ms - startedAt,
    canvasPlaceholderVisible: placeholderVisible,
    topResources: resources.slice(0, 10),
  };
};

const summarizeRuns = (items, getValue) =>
  median(
    items.map(getValue).filter((value) => typeof value === "number" && !Number.isNaN(value)),
  );

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const main = async () => {
  const { chromium } = await import("playwright");

  const coldRuns = [];
  const warmRuns = [];

  for (let i = 0; i < runs; i++) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      serviceWorkers: "block",
      ignoreHTTPSErrors: true,
    });
    await context.route("**/*", async (route) => {
      const headers = {
        ...route.request().headers(),
        "cache-control": "no-cache",
        pragma: "no-cache",
      };
      await route.continue({ headers });
    });
    const page = await context.newPage();
    coldRuns.push(
      await runNavigation(page, {
        cacheEnabled: false,
        runLabel: `cold-${i + 1}`,
      }),
    );
    await browser.close();
  }

  const warmBrowser = await chromium.launch({ headless: true });
  const warmContext = await warmBrowser.newContext({
    serviceWorkers: "block",
    ignoreHTTPSErrors: true,
  });
  const warmPage = await warmContext.newPage();

  await runNavigation(warmPage, { cacheEnabled: true, runLabel: "warm-prime" });

  for (let i = 0; i < runs; i++) {
    warmRuns.push(
      await runNavigation(warmPage, {
        cacheEnabled: true,
        runLabel: `warm-${i + 1}`,
      }),
    );
  }
  await warmBrowser.close();

  const summary = {
    label,
    url: baseUrl,
    runs,
    timestamp: new Date().toISOString(),
    cold: {
      fcpMs: summarizeRuns(coldRuns, (r) => r.vitals.fcp),
      lcpMs: summarizeRuns(coldRuns, (r) => r.vitals.lcp),
      tbtMs: summarizeRuns(coldRuns, (r) => r.vitals.tbt),
      domContentLoadedMs: summarizeRuns(coldRuns, (r) => r.navigation?.domContentLoaded),
      loadMs: summarizeRuns(coldRuns, (r) => r.navigation?.load),
      totalTransferBytes: summarizeRuns(coldRuns, (r) => r.totalTransferBytes),
      requestCount: summarizeRuns(coldRuns, (r) => r.requestCount),
      heroChunkRequestedMs: summarizeRuns(coldRuns, (r) => r.heroChunkRequestedMs),
    },
    warm: {
      fcpMs: summarizeRuns(warmRuns, (r) => r.vitals.fcp),
      lcpMs: summarizeRuns(warmRuns, (r) => r.vitals.lcp),
      tbtMs: summarizeRuns(warmRuns, (r) => r.vitals.tbt),
      domContentLoadedMs: summarizeRuns(warmRuns, (r) => r.navigation?.domContentLoaded),
      loadMs: summarizeRuns(warmRuns, (r) => r.navigation?.load),
      totalTransferBytes: summarizeRuns(warmRuns, (r) => r.totalTransferBytes),
      requestCount: summarizeRuns(warmRuns, (r) => r.requestCount),
    },
    coldRuns,
    warmRuns,
  };

  await writeFile(RESULTS_PATH, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`\nLanding benchmark (${label}) — ${baseUrl}`);
  console.log("Cold (median):");
  console.log(`  FCP: ${summary.cold.fcpMs?.toFixed?.(0) ?? "n/a"} ms`);
  console.log(`  LCP: ${summary.cold.lcpMs?.toFixed?.(0) ?? "n/a"} ms`);
  console.log(`  TBT: ${summary.cold.tbtMs?.toFixed?.(0) ?? "n/a"} ms`);
  console.log(`  DCL: ${summary.cold.domContentLoadedMs?.toFixed?.(0) ?? "n/a"} ms`);
  console.log(`  Transfer: ${formatKb(summary.cold.totalTransferBytes ?? 0)}`);
  console.log(`  Requests: ${summary.cold.requestCount ?? "n/a"}`);
  console.log("Warm (median):");
  console.log(`  FCP: ${summary.warm.fcpMs?.toFixed?.(0) ?? "n/a"} ms`);
  console.log(`  LCP: ${summary.warm.lcpMs?.toFixed?.(0) ?? "n/a"} ms`);
  console.log(`  Transfer: ${formatKb(summary.warm.totalTransferBytes ?? 0)}`);
  console.log(`\nWrote ${RESULTS_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
