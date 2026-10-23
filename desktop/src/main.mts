/**
 * macOS app (Electron) for Excalidraw Notes.
 *
 * Runs the notes server (web app build + SQLite API) inside the main process,
 * bound to localhost only, and opens it in a native window. Notes and the
 * shape library are stored in `~/Library/Application Support/Excalidraw
 * Notes/notes.db` (override with `NOTES_DB_PATH`).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, shell } from "electron";

import { createNotesServer } from "../../excalidraw-app/notes-server/createServer.mts";

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const HOST = "127.0.0.1";
// fixed so the app origin (and with it localStorage: theme, language…) stays
// the same across launches
const PREFERRED_PORT = 43117;
// how long to wait for a pending autosave before retrying to close a window
const UNLOAD_SAVE_GRACE_MS = 800;

const mainDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.resolve(mainDir, "../../excalidraw-app/build");

let server: Server | null = null;
let appURL = "";
let isQuitting = false;

const listen = (server: Server, port: number) =>
  new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolve((server.address() as AddressInfo).port);
    });
  });

const startServer = async () => {
  const dbFile =
    process.env.NOTES_DB_PATH || path.join(app.getPath("userData"), "notes.db");
  server = createNotesServer({ buildDir, dbFile });
  let port: number;
  try {
    port = await listen(server, PREFERRED_PORT);
  } catch (error: any) {
    if (error.code !== "EADDRINUSE") {
      throw error;
    }
    console.warn(`port ${PREFERRED_PORT} in use, using a random one`);
    port = await listen(server, 0);
  }
  appURL = `http://${HOST}:${port}`;
  console.info(`Excalidraw Notes: ${appURL} (database: ${dbFile})`);
};

const isAppURL = (url: string) => url.startsWith(`${appURL}/`);

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 480,
    title: "Excalidraw Notes",
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  // links (e.g. on canvas elements, help dialog) open in the default browser
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppURL(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAppURL(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // The editor blocks unloading while a note has unsaved changes (and starts
  // saving them). Browsers would show a confirm dialog; here we give the save
  // a moment and close again, which goes through once nothing is pending.
  window.webContents.on("will-prevent-unload", () => {
    setTimeout(() => {
      if (window.isDestroyed()) {
        return;
      }
      if (isQuitting) {
        app.quit();
      } else {
        window.close();
      }
    }, UNLOAD_SAVE_GRACE_MS);
  });

  window.loadURL(appURL);
  return window;
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    } else {
      createWindow();
    }
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("will-quit", () => {
    server?.close();
  });

  // macOS convention: keep running without windows, reopen from the Dock
  // (without this listener Electron quits once the last window closes)
  app.on("window-all-closed", () => {});
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length && appURL) {
      createWindow();
    }
  });

  app.whenReady().then(async () => {
    await startServer();
    createWindow();
  });
}
