const http = require("http");
const path = require("path");
const fs = require("fs");

const { app, BrowserWindow, shell } = require("electron");

// GPU process segfaults on Wayland + NVIDIA (Electron 33.x).
// Disable the GPU process via command-line switches before app.whenReady().
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-gpu-sandbox");

const PORT = process.env.EXCALIDRAW_PORT || 7311;
const DEV_URL = `http://localhost:${PORT}`;

/**
 * PACKAGED MODE.
 *
 * A bundled `app/` beside this file means the production bundle is present, so
 * the window is served from LOCAL FILES by a loopback-only static server started
 * here — no Vite, no dev server, and nothing off the machine. Without it, the
 * window points at the dev server as before.
 *
 * A loopback server rather than `file://` on purpose: the build's asset URLs are
 * absolute (`/assets/…`, `/fonts/…`), which `file://` cannot resolve, and the
 * whole point is that the app opens untouched by how it is loaded.
 */
const BUNDLED_APP_DIR = path.join(__dirname, "app");
const isPackaged = fs.existsSync(path.join(BUNDLED_APP_DIR, "index.html"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/** Serves the bundle on 127.0.0.1 only. Returns the port. */
function serveBundle() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    let rel;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end("bad request");
      return;
    }
    let file = path.join(BUNDLED_APP_DIR, path.normalize(rel));
    // Never leave the bundle directory.
    if (!file.startsWith(BUNDLED_APP_DIR)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(BUNDLED_APP_DIR, "index.html"); // a single-page app
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
      "cache-control": file.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, "127.0.0.1");
  return new Promise((resolve) => {
    server.once("listening", () => resolve(server.address().port));
  });
}

let BUNDLE = null; // set when packaged, before the window opens
const LOG_FILE = path.join(app.getPath("userData"), "debug.log");

/**
 * Append a timestamped line to the debug log (kept in the user data dir).
 */
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    /* silently drop — logging must never break the app */
  }
  // eslint-disable-next-line no-console -- Electron writes this to the app log
  console.log(line.trim());
}

/**
 * Create the main window. The app stays alive independently of any single window.
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Excalidraw",
    icon: path.join(__dirname, "icon.png"),
  });

  const target = BUNDLE ? `http://127.0.0.1:${BUNDLE}` : DEV_URL;
  log(`Loading Excalidraw at ${target}`);

  win
    .loadURL(target)
    .then(() => log("Page loaded successfully"))
    .catch((err) => log(`Failed to load page: ${err.message}`));

  // Keep the app alive — closing the window does NOT quit Electron.
  // Reopen it from the desktop entry, or stop it with ./stop.sh.
  win.on("closed", () => {
    log("Window closed — app stays alive");
  });

  // Intercept all links — open them in the system browser instead of
  // navigating away from the Excalidraw canvas.
  win.webContents.setWindowOpenHandler(({ url }) => {
    log(`Link opened — launching system browser: ${url}`);
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const isLocal =
      url === target ||
      url.includes(`localhost:${PORT}`) ||
      (BUNDLE !== null && url.includes(`127.0.0.1:${BUNDLE}`));
    if (!isLocal) {
      log(`Navigation intercepted: ${url} → opening in system browser`);
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.on("ready-to-show", () => log("Window ready to show"));
}

// Keep the app alive even when no windows are open.
app.on("activate", () => {
  log("Activate event — creating new window");
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    createWindow();
  } else if (!win.isVisible()) {
    win.show();
  } else {
    win.focus();
  }
});

app.whenReady().then(async () => {
  if (isPackaged) {
    BUNDLE = await serveBundle();
    log(
      `packaged: serving the bundled app on 127.0.0.1:${BUNDLE} (no dev server)`,
    );
  }
  createWindow();
});

// Don't quit on Ctrl+Q or window-all-closed — let the user manage the app lifecycle.
app.on("window-all-closed", () => log("All windows closed — staying alive"));

app.on("quit", () => log("Quit requested"));

process.on("uncaughtException", (err) =>
  log(`UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`),
);

process.on("unhandledRejection", (reason, promise) =>
  log(`UNHANDLED REJECTION at ${promise}: ${reason}`),
);
