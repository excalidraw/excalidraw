#!/usr/bin/env node

/**
 * Measures excalidraw.com in a real browser (Playwright, Chromium) for the
 * Excalidraw+ admin's Performance page — page loads, and panning and zooming
 * a large scene: every scenario `--iterations` times, each in a fresh browser
 * context (cold HTTP cache) on a throttled fast-desktop connection — the
 * conditions of Excalidraw+'s own runs, so the apps' numbers compare.
 *
 * `--compare` (`yarn stats:compare`) measures two builds on this machine,
 * alternating them, and prints a table of their differences: this checkout's
 * production build — built and served locally — or `--url`, against `--base`,
 * a url (staging by default) or a commit, checked out and built the same way.
 * The machine's speed shows in every timing, so only builds measured side by
 * side compare. Master CI compares every commit with the one before it, and
 * `post.mjs` stores both builds' loads.
 *
 *   node scripts/stats/perf.mjs --url http://localhost:3000 --iterations 3
 *   node scripts/stats/perf.mjs --scenario oss-pan-zoom --iterations 1
 *   yarn stats:compare [--iterations 10] [--out diff.csv]
 *   yarn stats:compare --base master --out perf.json
 *   yarn stats:compare --url http://localhost:3000 --base https://excalidraw.com
 */

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

import { chromium } from "playwright";

const STAGING_URL = "https://staging.excalidraw.com";

const { values: args } = parseArgs({
  options: {
    // the app to measure — staging by default; with --compare, this checkout's build
    url: { type: "string" },
    iterations: { type: "string", default: "5" },
    // the JSON file to write the run to (printed when left out); with --compare, a
    // `.csv` gets the table of differences, a JSON file both builds' loads
    out: { type: "string" },
    // compare --url (this checkout's build by default) with --base, measured alternately
    compare: { type: "boolean", default: false },
    // a url, or a commit to build
    base: { type: "string", default: STAGING_URL },
    // only these scenarios (comma-separated ids)
    scenario: { type: "string" },
  },
});

const withoutSlash = (url) => url.replace(/\/$/, "");

const APP_URL = withoutSlash(args.url ?? STAGING_URL);
/**
 * Loads per scenario (per build with --compare). Consecutive loads differ a
 * little (one browser runs them all), so --compare alternates which build
 * loads first and needs an even count for both to get the same positions.
 */
const ITERATIONS = args.compare
  ? Math.ceil(Number(args.iterations) / 2) * 2
  : Number(args.iterations);

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** Same as Excalidraw+'s runs (`PERF_ENVIRONMENT` there), close to Lighthouse's desktop preset. */
const PERF_ENVIRONMENT = {
  viewport: { width: 1440, height: 900 },
  network: { latencyMs: 40, downloadKbps: 10_240, uploadKbps: 10_240 },
};

const LOAD_TIMEOUT_MS = 60_000;

/** Paints right after ready (the LCP is often one) are reported asynchronously. */
const PAINT_SETTLE_MS = 1_000;

/** Between loads, so the browser's work in the background after one (closing it, a renderer for the next) is done. */
const BETWEEN_LOADS_MS = 1_000;

/** Analytics and error reporting stay out of the measured loads (and out of the stats). */
const BLOCKED_URLS = [
  "https://*.simpleanalyticscdn.com/**",
  "https://*.sentry.io/**",
  "https://sentry.io/**",
];

/** The app marks when its entry module runs (`excalidraw-app/index.tsx`), ending the "HTML + JS" phase. */
const APP_START_MARK = "excalidraw:app-start";

/** The app's local storage keys (`STORAGE_KEYS` in `excalidraw-app/app_constants.ts`). */
const STORAGE_KEYS = { elements: "excalidraw", appState: "excalidraw-state" };

const LARGE_SCENE_GRID = {
  columns: 50,
  rows: 40,
  cellWidth: 140,
  cellHeight: 110,
};

/**
 * The same 2,000 elements every run (seeded): shapes, text, arrows, lines and
 * freedraw strokes on a grid, zoomed out so all of them are drawn.
 */
function createLargeScene() {
  // mulberry32
  let seed = 42;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (list) => list[Math.floor(random() * list.length)];
  const words = [
    "Idea",
    "Draft",
    "Review",
    "Ship it",
    "Backlog",
    "Q3 plan",
    "API",
    "Users",
  ];
  const { columns, rows, cellWidth, cellHeight } = LARGE_SCENE_GRID;
  const elements = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const base = {
        id: `perf-${elements.length}`,
        x: column * cellWidth,
        y: row * cellHeight,
        width: 100,
        height: 70,
        angle: 0,
        strokeColor: pick([
          "#1e1e1e",
          "#e03131",
          "#2f9e44",
          "#1971c2",
          "#f08c00",
        ]),
        backgroundColor: pick([
          "transparent",
          "#ffc9c9",
          "#b2f2bb",
          "#a5d8ff",
          "#ffec99",
        ]),
        fillStyle: pick(["solid", "hachure", "cross-hatch"]),
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(random() * 2 ** 31),
        version: 1,
        versionNonce: 0,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
      };
      const kind = random();

      if (kind < 0.35) {
        elements.push({ ...base, type: "rectangle", roundness: { type: 3 } });
      } else if (kind < 0.5) {
        elements.push({ ...base, type: "ellipse" });
      } else if (kind < 0.6) {
        elements.push({ ...base, type: "diamond" });
      } else if (kind < 0.75) {
        const text = pick(words);
        elements.push({
          ...base,
          type: "text",
          backgroundColor: "transparent",
          width: text.length * 11,
          height: 25,
          text,
          originalText: text,
          fontSize: 20,
          fontFamily: 5,
          textAlign: "left",
          verticalAlign: "top",
          containerId: null,
          autoResize: true,
          lineHeight: 1.25,
        });
      } else if (kind < 0.9) {
        const isArrow = kind < 0.85;
        elements.push({
          ...base,
          type: isArrow ? "arrow" : "line",
          backgroundColor: "transparent",
          points: [
            [0, 0],
            [50, random() * 70 - 35],
            [100, 70],
          ],
          lastCommittedPoint: null,
          startBinding: null,
          endBinding: null,
          startArrowhead: null,
          endArrowhead: isArrow ? "arrow" : null,
          elbowed: false,
        });
      } else {
        const points = Array.from({ length: 40 }, (_, index) => [
          index * 2.5,
          35 + Math.sin(index / 3) * 30 * random(),
        ]);
        elements.push({
          ...base,
          type: "freedraw",
          backgroundColor: "transparent",
          points,
          pressures: [],
          simulatePressure: true,
          lastCommittedPoint: null,
        });
      }
    }
  }

  // everything in view: the grid's size times the zoom fits the viewport, centered
  const zoom = 0.2;
  const { width, height } = PERF_ENVIRONMENT.viewport;
  const appState = {
    zoom: { value: zoom },
    scrollX: (width / zoom - columns * cellWidth) / 2,
    scrollY: (height / zoom - rows * cellHeight) / 2,
  };

  return { elements, appState };
}

/**
 * Collects what the Performance API only reports to observers, and counts the
 * static canvas's draw calls — the scene is drawn once it drew elements (runs
 * before the app's scripts).
 */
function installPageObservers() {
  const state = { lcp: 0, cls: 0, longTasks: [], staticDraws: 0 };
  window.__perf = state;

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.lcp = entry.startTime;
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        state.cls += entry.value;
      }
    }
  }).observe({ type: "layout-shift", buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.longTasks.push({
        start: entry.startTime,
        duration: entry.duration,
      });
    }
  }).observe({ type: "longtask", buffered: true });

  const context = CanvasRenderingContext2D.prototype;
  for (const method of ["drawImage", "fill", "stroke", "fillText"]) {
    const draw = context[method];
    context[method] = function (...drawArgs) {
      if (this.canvas.classList.contains("static")) {
        state.staticDraws += 1;
      }
      return draw.apply(this, drawArgs);
    };
  }
}

/** Bytes and requests that finished loading, with the connection throttled. */
async function trackNetwork(cdp) {
  const resourceTypes = new Map();
  const counters = { requests: 0, transferBytes: 0, jsBytes: 0 };

  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: PERF_ENVIRONMENT.network.latencyMs,
    downloadThroughput: (PERF_ENVIRONMENT.network.downloadKbps * 1024) / 8,
    uploadThroughput: (PERF_ENVIRONMENT.network.uploadKbps * 1024) / 8,
  });

  cdp.on("Network.responseReceived", ({ requestId, type }) => {
    resourceTypes.set(requestId, type);
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    counters.requests += 1;
    counters.transferBytes += encodedDataLength;
    if (resourceTypes.get(requestId) === "Script") {
      counters.jsBytes += encodedDataLength;
    }
  });

  return { snapshot: () => ({ ...counters }) };
}

/** The first frame's `performance.now()` the scenario's `readyAt` (run in the page, every frame) returned. */
async function waitForReady(page, readyAt) {
  const handle = await page.waitForFunction(readyAt, undefined, {
    timeout: LOAD_TIMEOUT_MS,
  });
  return handle.jsonValue();
}

/** Paint, layout shift and main-thread metrics of the page until `until` (`performance.now()`). */
function readPageMetrics(page, until) {
  return page.evaluate((untilTime) => {
    const { __perf: state } = window;
    const [navigation] = performance.getEntriesByType("navigation");
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]
      ?.startTime;
    // the main thread blocked between first paint and ready, like Lighthouse's TBT until TTI
    const tbt = state.longTasks
      .filter(({ start }) => start >= (fcp ?? 0) && start < untilTime)
      .reduce((sum, { duration }) => sum + Math.max(0, duration - 50), 0);

    return {
      ttfb: navigation?.responseStart,
      fcp,
      lcp: state.lcp || undefined,
      cls: state.cls,
      tbt,
    };
  }, until);
}

/** Frames slower than this are long animation frames: a visible stutter. */
const LONG_FRAME_MS = 50;

const repeat = (count, step) => Array.from({ length: count }, () => step);

/**
 * The wheel events of the pan-and-zoom scenario, one per frame (null: a
 * frame without one, so a zoom's sharp redraw after it stops is measured).
 * Shift+wheel pans horizontally, ctrl/cmd+shift+wheel vertically and
 * ctrl/cmd+wheel zooms around the pointer (`App.wheel.ts`) — whatever input
 * device the editor assumes. From the overview at 20 %: pan it, zoom to
 * 100 %, pan into elements not drawn at that zoom yet, zoom back out.
 */
const PAN_ZOOM_STEPS = [
  ...repeat(30, { shiftKey: true, deltaY: 15 }),
  ...repeat(30, { shiftKey: true, deltaY: -15 }),
  ...repeat(40, { ctrlKey: true, deltaY: -2 }),
  ...repeat(20, null),
  ...repeat(40, { ctrlKey: true, shiftKey: true, deltaY: 20 }),
  ...repeat(40, { shiftKey: true, deltaY: 20 }),
  ...repeat(40, { ctrlKey: true, deltaY: 2 }),
  ...repeat(20, null),
];

/**
 * Plays `PAN_ZOOM_STEPS` over the canvas: each frame's main-thread work, the
 * time between the frames, and the static canvas's draws. Headless Chromium
 * ticks frames at a fixed 60 Hz (the frame-rate flags don't change it), so the
 * time between frames only moves in whole frames; a frame's work — from its
 * start until a task posted in it runs, after its rendering: the editor
 * drawing the previous wheel event, handling the current one, style, layout
 * and paint — shows every millisecond.
 */
function panAndZoom(steps) {
  const canvas = document.querySelector(
    "canvas.excalidraw__canvas.interactive",
  );
  const { left, top, width, height } = canvas.getBoundingClientRect();
  const position = { clientX: left + width / 2, clientY: top + height / 2 };
  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(resolve));
  const afterRendering = () =>
    new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve(performance.now());
      channel.port2.postMessage(null);
    });

  // zooms anchor on the pointer's last position
  canvas.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerType: "mouse",
      isPrimary: true,
      ...position,
    }),
  );

  return (async () => {
    const drawsBefore = window.__perf.staticDraws;
    const work = [];
    const intervals = [];
    let frameStart = await nextFrame();
    for (const step of steps) {
      if (step) {
        canvas.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaMode: 0,
            ...position,
            ...step,
          }),
        );
      }
      work.push((await afterRendering()) - frameStart);
      const nextFrameStart = await nextFrame();
      intervals.push(nextFrameStart - frameStart);
      frameStart = nextFrameStart;
    }
    return { work, intervals, draws: window.__perf.staticDraws - drawsBefore };
  })();
}

/**
 * The mean frame work — the interaction's main-thread work spread over its
 * frames, so a slower part of it shows however short — its 95th percentile,
 * and the long frames.
 */
function getFrameMetrics({ work, intervals }) {
  const sorted = [...work].sort((a, b) => a - b);
  return {
    frameMean: work.reduce((sum, frame) => sum + frame, 0) / work.length,
    frameP95:
      sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))],
    longFrames: intervals.filter((interval) => interval > LONG_FRAME_MS).length,
  };
}

const LARGE_SCENE = createLargeScene();

/**
 * The scenarios, by their ids in the admin's catalogue (`PERF_SCENARIOS` in
 * Excalidraw+); `readyAt` returns `performance.now()` once the page is ready.
 * One with `interact` measures that once the page is ready and settled,
 * instead of the load.
 */
const SCENARIOS = [
  {
    id: "oss-editor",
    // the welcome screen shows once the app loaded an empty scene
    readyAt: () =>
      document.querySelector(".welcome-screen-center")?.checkVisibility()
        ? performance.now()
        : 0,
  },
  {
    id: "oss-large-scene",
    scene: LARGE_SCENE,
    readyAt: () => (window.__perf.staticDraws > 0 ? performance.now() : 0),
  },
  {
    id: "oss-pan-zoom",
    scene: LARGE_SCENE,
    readyAt: () => (window.__perf.staticDraws > 0 ? performance.now() : 0),
    interact: async (page) => {
      // fonts and lazy chunks loaded, so their redraws don't land in the frames
      await page.waitForLoadState("networkidle", { timeout: LOAD_TIMEOUT_MS });
      const frames = await page.evaluate(panAndZoom, PAN_ZOOM_STEPS);
      if (!frames.draws) {
        throw new Error("The scene didn't redraw while panning and zooming");
      }
      return getFrameMetrics(frames);
    },
  },
];

async function measureOnce(browser, scenario, appUrl) {
  const context = await browser.newContext({
    viewport: PERF_ENVIRONMENT.viewport,
    // the service worker's precaching would add to the measured downloads
    serviceWorkers: "block",
  });

  try {
    for (const url of BLOCKED_URLS) {
      await context.route(url, (route) => route.abort());
    }
    await context.addInitScript(installPageObservers);
    if (scenario.scene) {
      await context.addInitScript(
        ({ keys, elements, appState }) => {
          localStorage.setItem(keys.elements, elements);
          localStorage.setItem(keys.appState, appState);
        },
        {
          keys: STORAGE_KEYS,
          elements: JSON.stringify(scenario.scene.elements),
          appState: JSON.stringify(scenario.scene.appState),
        },
      );
    }

    const page = await context.newPage();
    const network = await trackNetwork(await context.newCDPSession(page));

    // without waiting for `load`, so the polling sees the editor as soon as it's ready
    await page.goto(appUrl, { timeout: LOAD_TIMEOUT_MS, waitUntil: "commit" });
    const ready = await waitForReady(page, scenario.readyAt);
    const transferred = network.snapshot();
    await page.waitForTimeout(PAINT_SETTLE_MS);
    const { appStart, buildSha } = await page.evaluate(
      (mark) => ({
        appStart: performance.getEntriesByName(mark, "mark")[0]?.startTime,
        buildSha: window.__EXCALIDRAW_SHA__ ?? null,
      }),
      APP_START_MARK,
    );
    const validBuildSha = /^[0-9a-f]{7,40}$/.test(buildSha ?? "")
      ? buildSha
      : null;

    if (scenario.interact) {
      return {
        metrics: await scenario.interact(page),
        phases: {},
        buildSha: validBuildSha,
      };
    }

    return {
      metrics: {
        ready,
        ...(await readPageMetrics(page, ready)),
        ...transferred,
      },
      // builds without the mark have no phases
      phases:
        appStart === undefined
          ? {}
          : { appCode: Math.min(appStart, ready), editor: ready },
      buildSha: validBuildSha,
    };
  } finally {
    await context.close();
  }
}

/** A free local port, from the OS. */
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const git = (...gitArgs) =>
  execFileSync("git", gitArgs, { cwd: REPO_ROOT, encoding: "utf8" }).trim();

/** Runs a command with its output kept back, but for the end of it when it fails. */
function runQuietly(command, commandArgs, options, failure) {
  try {
    execFileSync(command, commandArgs, {
      ...options,
      stdio: "pipe",
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    console.error(
      String(error.stderr ?? error)
        .trim()
        .split("\n")
        .slice(-20)
        .join("\n"),
    );
    throw new Error(failure);
  }
}

/** This checkout: its commit, and whether it has changes on top. */
function getThisCheckout() {
  const sha = git("rev-parse", "HEAD");
  return {
    dir: REPO_ROOT,
    sha,
    label: `this checkout (${sha.slice(0, 7)}${
      git("status", "--porcelain") ? " + uncommitted changes" : ""
    })`,
  };
}

/**
 * `revision` checked out into a temporary worktree with its own dependencies
 * (they may differ from this checkout's), removed when the script ends.
 */
function checkOut(revision) {
  const sha = git("rev-parse", "--verify", `${revision}^{commit}`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "excalidraw-perf-"));
  const dir = path.join(tmpDir, "excalidraw");
  const label = sha.startsWith(revision)
    ? sha.slice(0, 7)
    : `${revision} (${sha.slice(0, 7)})`;

  console.info(`⏱️ Checking out ${label} and installing its dependencies…`);
  process.on("exit", () => {
    try {
      execFileSync("git", ["worktree", "remove", "--force", dir], {
        cwd: REPO_ROOT,
        stdio: "ignore",
      });
    } catch {
      // the script ended before git created it
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  git("worktree", "add", "--quiet", "--detach", dir, sha);
  runQuietly(
    "yarn",
    ["install", "--frozen-lockfile", "--prefer-offline"],
    // no git hooks for the worktree
    { cwd: dir, env: { ...process.env, HUSKY: "0" } },
    `Installing the dependencies of ${label} failed`,
  );

  return { dir, sha, label };
}

/**
 * Builds a checkout's app for production — as Vercel does (`build:app`),
 * minus linting — and serves it with `vite preview`: its url, and how to stop
 * the server.
 */
async function serveLocalBuild({ dir, sha, label }) {
  const appDir = path.join(dir, "excalidraw-app");
  const vite = path.join(dir, "node_modules/vite/bin/vite.js");

  console.info(`⏱️ Building ${label}…`);
  runQuietly(
    process.execPath,
    [vite, "build"],
    {
      cwd: appDir,
      env: {
        ...process.env,
        VITE_APP_GIT_SHA: sha,
        VITE_APP_ENABLE_TRACKING: "true",
        VITE_APP_ENABLE_ESLINT: "false",
      },
    },
    `Building ${label} failed (\`yarn build:app\` shows why)`,
  );

  const port = await getFreePort();
  const server = spawn(
    process.execPath,
    [vite, "preview", "--port", String(port), "--strictPort"],
    { cwd: appDir, stdio: "ignore" },
  );
  // however the script ends
  process.on("exit", () => server.kill());
  const url = `http://localhost:${port}`;
  for (let attempt = 0; ; attempt++) {
    const isUp = await fetch(url)
      .then((response) => response.ok)
      .catch(() => false);
    if (isUp) {
      return { url, stop: () => server.kill() };
    }
    if (attempt > 60 || server.exitCode !== null) {
      server.kill();
      throw new Error("`vite preview` didn't start");
    }
    await sleep(500);
  }
}

// so a stopped run still removes its worktree and servers
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => process.exit(1));
}

/** The metrics the runner records, in the admin's order (`PERF_METRICS` in Excalidraw+), and their units. */
const METRIC_UNITS = {
  ready: "ms",
  ttfb: "ms",
  fcp: "ms",
  lcp: "ms",
  tbt: "ms",
  cls: "score",
  jsBytes: "bytes",
  transferBytes: "bytes",
  requests: "count",
  frameMean: "ms",
  frameP95: "ms",
  longFrames: "count",
};

/** Linear-interpolated quantile of ascending `sorted` (the admin's too). */
const quantile = (sorted, q) => {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
  };
};

/** Below it, a difference in timings is unlikely to be the loads' noise. */
const SIGNIFICANCE = 0.05;

/**
 * The two-sided p-value of the Mann–Whitney U test: how likely the two
 * samples' ranks are this far apart if the builds didn't differ — no
 * assumption on how timings spread, fit for a few loads per side. Exact (by
 * counting the rank arrangements); ties get mid-ranks.
 */
function mannWhitneyP(a, b) {
  const ranked = [
    ...a.map((value) => ({ value, inA: true })),
    ...b.map((value) => ({ value, inA: false })),
  ].sort((x, y) => x.value - y.value);
  let rankSumA = 0;
  for (let i = 0; i < ranked.length; ) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1].value === ranked[i].value) {
      j++;
    }
    // ranks i + 1 … j + 1, shared
    const rank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) {
      if (ranked[k].inA) {
        rankSumA += rank;
      }
    }
    i = j + 1;
  }
  const m = a.length;
  const n = b.length;
  const uA = rankSumA - (m * (m + 1)) / 2;
  const u = Math.floor(Math.min(uA, m * n - uA));

  // arrangements of m and n values with the statistic `value`
  const memo = new Map();
  const count = (value, m, n) => {
    if (value < 0) {
      return 0;
    }
    if (!m || !n) {
      return value === 0 ? 1 : 0;
    }
    const key = `${value},${m},${n}`;
    if (!memo.has(key)) {
      memo.set(key, count(value - n, m - 1, n) + count(value, m, n - 1));
    }
    return memo.get(key);
  };
  let atMost = 0;
  for (let value = 0; value <= u; value++) {
    atMost += count(value, m, n);
  }
  let arrangements = 1;
  for (let i = 1; i <= m; i++) {
    arrangements = (arrangements * (n + i)) / i;
  }
  return Math.min(1, (2 * atMost) / arrangements);
}

/**
 * Every metric is better lower. Timings differ when the Mann–Whitney test
 * says so (`SIGNIFICANCE`); bytes and requests don't vary from load to load,
 * so any difference in them counts.
 */
function getVerdict(baseValues, nextValues) {
  const isConstant = (values) => values.every((value) => value === values[0]);
  const direction = Math.sign(median(nextValues) - median(baseValues));
  const p =
    isConstant(baseValues) && isConstant(nextValues)
      ? direction
        ? 0
        : 1
      : mannWhitneyP(baseValues, nextValues);
  return {
    p,
    verdict:
      p < SIGNIFICANCE && direction
        ? direction > 0
          ? "worse"
          : "better"
        : "~",
  };
}

const median = (values) =>
  quantile(
    [...values].sort((a, b) => a - b),
    0.5,
  );

/** One row per scenario and metric both targets measured. */
function compareTargets(scenarios, base, next) {
  const rows = [];
  for (const scenario of scenarios) {
    const failed = (target) =>
      target.samples.filter((s) => s.scenario === scenario.id && s.error)
        .length;
    for (const [metric, unit] of Object.entries(METRIC_UNITS)) {
      const values = (target) =>
        target.samples.flatMap((sample) =>
          sample.scenario === scenario.id &&
          !sample.error &&
          sample.metrics[metric] !== undefined
            ? [sample.metrics[metric]]
            : [],
        );
      const baseValues = values(base);
      const nextValues = values(next);
      if (!baseValues.length || !nextValues.length) {
        continue;
      }
      const baseStats = summarize(baseValues);
      const nextStats = summarize(nextValues);
      const delta = nextStats.median - baseStats.median;
      rows.push({
        scenario: scenario.id,
        metric,
        unit,
        base: baseStats,
        next: nextStats,
        delta,
        deltaPercent: baseStats.median
          ? (delta / baseStats.median) * 100
          : null,
        ...getVerdict(baseValues, nextValues),
        baseFailed: failed(base),
        nextFailed: failed(next),
      });
    }
  }
  return rows;
}

const formatValue = (value, unit) =>
  unit === "ms"
    ? `${
        value < 100 ? value.toFixed(1) : Math.round(value).toLocaleString("en")
      } ms`
    : unit === "bytes"
    ? `${(value / 1024).toLocaleString("en", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} KiB`
    : unit === "score"
    ? value.toFixed(3)
    : String(Math.round(value * 10) / 10);

const formatSigned = (value, format) =>
  `${value > 0 ? "+" : value < 0 ? "−" : "±"}${format(Math.abs(value))}`;

const VERDICT_COLORS = { worse: 31, better: 32 };

/** The comparison as an aligned table, the verdicts colored on a terminal. */
function printComparison(rows) {
  const color = (text, verdict) =>
    process.stdout.isTTY && VERDICT_COLORS[verdict]
      ? `\x1b[${VERDICT_COLORS[verdict]}m${text}\x1b[0m`
      : text;
  const header = [
    "Scenario",
    "Metric",
    "Base",
    "New",
    "Change",
    "Change %",
    "Base p25–p75",
    "New p25–p75",
    "p",
    "",
  ];
  const lines = rows.map((row, index) => [
    index && rows[index - 1].scenario === row.scenario ? "" : row.scenario,
    row.metric,
    formatValue(row.base.median, row.unit),
    formatValue(row.next.median, row.unit),
    formatSigned(row.delta, (value) => formatValue(value, row.unit)),
    row.deltaPercent === null
      ? "—"
      : formatSigned(row.deltaPercent, (value) => `${value.toFixed(1)} %`),
    `${formatValue(row.base.p25, row.unit)} – ${formatValue(
      row.base.p75,
      row.unit,
    )}`,
    `${formatValue(row.next.p25, row.unit)} – ${formatValue(
      row.next.p75,
      row.unit,
    )}`,
    row.p < 0.001 ? "<0.001" : row.p.toFixed(3),
    row.verdict,
  ]);
  const widths = header.map((title, column) =>
    Math.max(title.length, ...lines.map((line) => line[column].length)),
  );
  // the names left-aligned, the numbers right-aligned
  const pad = (cell, column) =>
    column < 2 || column === header.length - 1
      ? cell.padEnd(widths[column])
      : cell.padStart(widths[column]);

  console.info(header.map(pad).join("  "));
  console.info(widths.map((width) => "─".repeat(width)).join("  "));
  rows.forEach((row, index) =>
    console.info(color(lines[index].map(pad).join("  "), row.verdict)),
  );
}

const CSV_COLUMNS = [
  "scenario",
  "metric",
  "unit",
  "base_median",
  "base_p25",
  "base_p75",
  "new_median",
  "new_p25",
  "new_p75",
  "change",
  "change_percent",
  "p_value",
  "verdict",
  "base_failed",
  "new_failed",
];

const toCsv = (rows) =>
  [
    CSV_COLUMNS.join(","),
    ...rows.map((row) =>
      [
        row.scenario,
        row.metric,
        row.unit,
        row.base.median,
        row.base.p25,
        row.base.p75,
        row.next.median,
        row.next.p25,
        row.next.p75,
        row.delta,
        row.deltaPercent ?? "",
        row.p,
        row.verdict,
        row.baseFailed,
        row.nextFailed,
      ].join(","),
    ),
  ].join("\n");

const scenarios = args.scenario
  ? SCENARIOS.filter(({ id }) => args.scenario.split(",").includes(id))
  : SCENARIOS;

/** A build to measure: its url, its commit when it's built here, and its loads. */
const target = (name, { url, label = url, commitSha = null }) => ({
  name,
  url,
  label,
  commitSha,
  samples: [],
  buildSha: null,
});

const stopServers = [];

/** A checkout's build, served here. */
async function localTarget(name, checkout) {
  const { url, stop } = await serveLocalBuild(checkout);
  stopServers.push(stop);
  return target(name, {
    url,
    label: `${checkout.label} at ${url}`,
    commitSha: checkout.sha,
  });
}

const isUrl = (value) => /^https?:\/\//.test(value);

// with --compare, the base and the new build alternate: whichever loads first
// switches every iteration, so the machine drifting (warming up, other work)
// weighs on both alike
const targets = args.compare
  ? [
      isUrl(args.base)
        ? target("base", { url: withoutSlash(args.base) })
        : await localTarget("base", checkOut(args.base)),
      args.url
        ? target("new", { url: APP_URL })
        : await localTarget("new", getThisCheckout()),
    ]
  : [target(null, { url: APP_URL })];

console.info(
  args.compare
    ? `⏱️ Comparing ${targets[1].label} with ${targets[0].label}, ${ITERATIONS} loads each per scenario, alternating…`
    : `⏱️ Measuring ${APP_URL}, ${ITERATIONS} loads per scenario…`,
);

const browser = await chromium.launch();
const browserVersion = browser.version();

try {
  // the browser's first load is slower than the next ones: one of each build, not recorded
  for (const target of targets) {
    await measureOnce(browser, scenarios[0], target.url).catch(() => {});
  }
  for (const scenario of scenarios) {
    for (let iteration = 1; iteration <= ITERATIONS; iteration++) {
      const order = iteration % 2 ? targets : [...targets].reverse();
      for (const target of order) {
        const label = `${scenario.id}${
          target.name ? ` ${target.name}` : ""
        } #${iteration}`;
        try {
          await sleep(BETWEEN_LOADS_MS);
          const load = await measureOnce(browser, scenario, target.url);
          target.buildSha ??= load.buildSha;
          target.samples.push({
            scenario: scenario.id,
            iteration,
            metrics: load.metrics,
            phases: load.phases,
            error: null,
          });
          console.info(
            `⏱️ ${label}: ${
              scenario.interact
                ? `mean frame ${Math.round(
                    load.metrics.frameMean,
                  )} ms, p95 ${Math.round(load.metrics.frameP95)} ms, ${
                    load.metrics.longFrames
                  } long`
                : `ready in ${Math.round(load.metrics.ready)} ms`
            }`,
          );
        } catch (error) {
          // a failed load is a sample with its error, so one flaky load doesn't lose the run
          const message = (
            error instanceof Error ? error.message : String(error)
          ).split("\n")[0];
          target.samples.push({
            scenario: scenario.id,
            iteration,
            metrics: {},
            phases: {},
            error: message,
          });
          console.warn(`⏱️ ${label} failed: ${message}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  stopServers.forEach((stop) => stop());
}

if (targets.some(({ samples }) => !samples.some(({ error }) => !error))) {
  console.error("⏱️ Every page load failed");
  process.exit(1);
}

const [base, next] = args.compare ? targets : [null, targets[0]];
// with --compare, the base build's loads too (`post.mjs` stores them with the run)
const run = {
  appUrl: next.url,
  buildSha: next.buildSha,
  environment: {
    ...PERF_ENVIRONMENT,
    runner: process.env.RUNNER_NAME ?? null,
    cpu: os.cpus()[0]?.model ?? null,
    browser: `chromium ${browserVersion}`,
    iterations: ITERATIONS,
  },
  samples: next.samples,
  ...(base && {
    base: {
      // a url's: the build it served
      commitSha: base.commitSha ?? base.buildSha,
      buildSha: base.buildSha,
      samples: base.samples,
    },
  }),
};

if (args.compare) {
  const rows = compareTargets(scenarios, base, next);
  const describe = ({ label, buildSha }) =>
    `${label}${buildSha ? ` (build ${buildSha.slice(0, 7)})` : ""}`;

  console.info(`\nBase: ${describe(base)}\nNew:  ${describe(next)}\n`);
  printComparison(rows);
  for (const row of rows.filter(
    (row, index) =>
      (row.baseFailed || row.nextFailed) &&
      rows.findIndex(({ scenario }) => scenario === row.scenario) === index,
  )) {
    console.warn(
      `⏱️ ${row.scenario}: ${row.baseFailed} base and ${row.nextFailed} new loads failed`,
    );
  }
  if (args.out) {
    fs.writeFileSync(
      args.out,
      args.out.endsWith(".csv")
        ? `${toCsv(rows)}\n`
        : JSON.stringify(run, null, 2),
    );
    console.info(`\nWrote ${args.out}`);
  }
} else if (args.out) {
  fs.writeFileSync(args.out, JSON.stringify(run, null, 2));
} else {
  console.info(JSON.stringify(run, null, 2));
}
