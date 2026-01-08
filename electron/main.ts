import { app, BrowserWindow, Menu } from "electron";
import { pathToFileURL } from "url";
import path from "path";
import isDev from "electron-is-dev";

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the app with ChatCanvas mode enabled
  if (isDev) {
    // Development: Load from Vite dev server with ChatCanvas parameter
    mainWindow.loadURL("http://localhost:3001/?ui=chatcanvas");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files with ChatCanvas parameter
    const indexPath = path.join(__dirname, "../dist/index.html");
    const fileUrl = pathToFileURL(indexPath).toString();
    // Append the ChatCanvas parameter to the file URL
    mainWindow.loadURL(`${fileUrl}?ui=chatcanvas`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// Create window when app is ready
app.on("ready", createWindow);

// Quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Re-create window when app is activated (macOS)
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Create application menu
const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "CmdOrCtrl+Y", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow?.reload();
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.on("ready", createMenu);
