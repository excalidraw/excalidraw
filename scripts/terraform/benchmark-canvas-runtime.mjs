#!/usr/bin/env node
/* eslint-disable no-console */
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const baseUrl = getArg("--url", "http://localhost:3000").replace(/\/$/, "");
const runs = Number(getArg("--runs", "5"));
const out = getArg("--out", "/tmp/terraform-canvas-runtime-results.json");
const targetUrl = `${baseUrl}/demo?preset=staging-extended-localstack-v2&view=pipeline&pipelineVariant=compound&packedPullLeft=1&ancillary=1`;

const profiles = {
  baseline: [],
  icons: ["terraform-runtime-hide-icons"],
  hover: [
    "terraform-runtime-suppress-hover",
    "terraform-runtime-debounce-hover",
  ],
  clipping: ["terraform-runtime-suppress-clipping"],
  "skip-repair": ["terraform-runtime-skip-binding-repair"],
  all: ["terraform-runtime-enable-all"],
};

const percentile = (values, quantile) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] ??
    0
  );
};

const summarizeIntervals = (intervals) => ({
  p50: percentile(intervals, 0.5),
  p95: percentile(intervals, 0.95),
  average: intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
  worst: Math.max(...intervals, 0),
  over16_7: intervals.filter((value) => value > 16.7).length,
  over50: intervals.filter((value) => value > 50).length,
  over100: intervals.filter((value) => value > 100).length,
});

const openSubmenu = async (page, testId) => {
  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId(testId).click();
};

const configureProfile = async (page, controls) => {
  await openSubmenu(page, "terraform-runtime-performance-submenu");
  await page.getByTestId("terraform-runtime-reset").click();
  for (const control of controls) {
    await page.getByTestId(control).click();
  }
  await page.keyboard.press("Escape");
};

const restoreViewport = async (page, viewport) => {
  await page.evaluate((nextViewport) => {
    window.h.setState({
      zoom: { value: nextViewport.zoom },
      scrollX: nextViewport.scrollX,
      scrollY: nextViewport.scrollY,
      hoveredElementIds: {},
      selectedElementIds: {},
    });
  }, viewport);
  await page.waitForTimeout(250);
};

const startMeasurement = async (page) => {
  await page.evaluate(() => {
    window.__terraformRuntimeMeasurement = {
      frames: [],
      longTasks: [],
      startReplacements: window.__terraformReplaceAllElementsCount ?? 0,
      stopped: false,
    };
    const measurement = window.__terraformRuntimeMeasurement;
    let previous = performance.now();
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        measurement.longTasks.push(entry.duration);
      }
    });
    try {
      observer.observe({ type: "longtask", buffered: false });
    } catch {}
    measurement.observer = observer;
    const frame = (now) => {
      measurement.frames.push(now - previous);
      previous = now;
      if (!measurement.stopped) {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  });
};

const stopMeasurement = async (page) =>
  page.evaluate(() => {
    const measurement = window.__terraformRuntimeMeasurement;
    measurement.stopped = true;
    measurement.observer?.disconnect();
    return {
      intervals: measurement.frames.slice(1),
      longTasks: measurement.longTasks,
      replaceAllElements:
        (window.__terraformReplaceAllElementsCount ?? 0) -
        measurement.startReplacements,
    };
  });

const runWorkload = async (page, workload) => {
  const canvas = page.locator(".excalidraw__canvas.interactive");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("interactive canvas not found");
  }
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await startMeasurement(page);
  if (workload === "pan" || workload === "combined") {
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    for (let index = 0; index < 20; index++) {
      await page.mouse.move(center.x + index * 8, center.y + index * 3);
    }
    await page.mouse.up();
  }
  if (workload === "zoom" || workload === "combined") {
    for (let index = 0; index < 8; index++) {
      await page.mouse.move(center.x, center.y);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, index % 2 === 0 ? -80 : 80);
      await page.keyboard.up("Control");
    }
  }
  if (workload === "hover" || workload === "combined") {
    for (let index = 0; index < 30; index++) {
      await page.mouse.move(
        box.x + 40 + ((index * 73) % Math.max(80, box.width - 80)),
        box.y + 40 + ((index * 41) % Math.max(80, box.height - 80)),
      );
    }
  }
  await page.waitForTimeout(500);
  const raw = await stopMeasurement(page);
  return {
    frameIntervals: summarizeIntervals(raw.intervals),
    longTasks: {
      count: raw.longTasks.length,
      total: raw.longTasks.reduce((sum, value) => sum + value, 0),
      worst: Math.max(...raw.longTasks, 0),
    },
    replaceAllElements: raw.replaceAllElements,
  };
};

const main = async () => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.getByTestId("terraform-scene-panel").waitFor({ timeout: 120_000 });
  await page.getByTestId("terraform-debug-toggle-compact").click();
  await page.waitForFunction(
    () => window.h?.app?.scene?.getElementsIncludingDeleted().length >= 8000,
    null,
    { timeout: 180_000 },
  );

  await openSubmenu(page, "terraform-zoom-lod-submenu");
  const lodToggle = page.getByTestId("terraform-zoom-lod-enable");
  if ((await lodToggle.getAttribute("aria-checked")) === "true") {
    await lodToggle.click();
  }
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    const scene = window.h.app.scene;
    const original = scene.replaceAllElements.bind(scene);
    window.__terraformReplaceAllElementsCount = 0;
    scene.replaceAllElements = (...args) => {
      window.__terraformReplaceAllElementsCount++;
      return original(...args);
    };
  });

  const referenceViewport = await page.evaluate(() => {
    const elements = window.h.app.scene
      .getElementsIncludingDeleted()
      .filter((element) => !element.isDeleted);
    const minX = Math.min(...elements.map((element) => element.x));
    const minY = Math.min(...elements.map((element) => element.y));
    const maxX = Math.max(
      ...elements.map((element) => element.x + element.width),
    );
    const maxY = Math.max(
      ...elements.map((element) => element.y + element.height),
    );
    const zoom = 0.1;
    return {
      zoom,
      scrollX: window.h.state.width / (2 * zoom) - (minX + maxX) / 2,
      scrollY: window.h.state.height / (2 * zoom) - (minY + maxY) / 2,
    };
  });
  await restoreViewport(page, referenceViewport);

  const scene = await page.evaluate(() => {
    const elements = window.h.app.scene.getElementsIncludingDeleted();
    const composition = {};
    for (const element of elements) {
      const key = element.customData?.terraformAwsIconGlyph
        ? "terraformAwsIconGlyph"
        : element.customData?.terraform
        ? `terraform:${element.type}`
        : element.type;
      composition[key] = (composition[key] ?? 0) + 1;
    }
    return {
      elementCount: elements.length,
      visibleElementCount: window.h.app.visibleElements?.length ?? null,
      composition,
    };
  });

  const results = {};
  for (const [profile, controls] of Object.entries(profiles)) {
    await configureProfile(page, controls);
    results[profile] = [];
    await restoreViewport(page, referenceViewport);
    for (const workload of ["pan", "zoom", "hover", "combined"]) {
      await runWorkload(page, workload);
      for (let run = 0; run < runs; run++) {
        await restoreViewport(page, referenceViewport);
        results[profile].push({
          run: run + 1,
          workload,
          ...(await runWorkload(page, workload)),
        });
      }
    }
  }

  const { stdout: commitSha } = await execFileAsync("git", [
    "rev-parse",
    "HEAD",
  ]);
  const report = {
    timestamp: new Date().toISOString(),
    commitSha: commitSha.trim(),
    browserVersion: browser.version(),
    url: targetUrl,
    runs,
    scene,
    profiles: results,
  };
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);

  console.log("| Profile | Combined p95 (mean) | vs baseline |");
  console.log("| --- | ---: | ---: |");
  const combinedP95 = Object.fromEntries(
    Object.entries(results).map(([profile, entries]) => {
      const values = entries
        .filter((entry) => entry.workload === "combined")
        .map((entry) => entry.frameIntervals.p95);
      return [
        profile,
        values.reduce((sum, value) => sum + value, 0) / values.length,
      ];
    }),
  );
  for (const [profile, p95] of Object.entries(combinedP95)) {
    const improvement =
      ((combinedP95.baseline - p95) / combinedP95.baseline) * 100;
    console.log(
      `| ${profile} | ${p95.toFixed(2)} ms | ${improvement.toFixed(1)}% |`,
    );
  }
  console.log(`\nWrote ${out}`);
  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
