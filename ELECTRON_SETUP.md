# Electron Desktop Shell for ChatCanvas

This document describes the Electron desktop integration for the ChatCanvas UI Shell on Excalidraw.

## Overview

The Electron desktop shell enables users to run ChatCanvas as a standalone desktop application on Windows, macOS, and Linux. The application automatically launches in ChatCanvas mode (`?ui=chatcanvas`).

## Key Features

- **Automatic ChatCanvas Mode**: Launches directly into ChatCanvas UI without manual parameter entry
- **Cross-Platform**: Supports Windows, macOS, and Linux
- **Security**: Uses `contextIsolation` and `preload` scripts for safe API exposure
- **Development & Production**: Seamless switching between dev server and built files
- **Windows Installer**: NSIS-based installer with desktop shortcuts
- **Portable Executable**: Standalone `.exe` that requires no installation

## File Structure

```
excalidraw/
├── electron/
│   ├── main.ts              # Electron main process (TypeScript)
│   ├── preload.ts           # Preload script for secure API exposure
│   ├── tsconfig.json        # TypeScript configuration
│   ├── main.js              # Compiled main.ts (generated)
│   └── preload.js           # Compiled preload.ts (generated)
├── .github/workflows/
│   └── build-windows.yml    # GitHub Actions workflow for Windows builds
├── scripts/
│   └── build-electron.js    # Build script for Electron TypeScript files
├── package.json             # Updated with Electron dependencies and scripts
└── ELECTRON_SETUP.md        # This file
```

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- Yarn 1.22.22 or higher
- Git
- Windows 10+ (for Windows builds)

### Setup Steps

1. **Clone the repository**:
```bash
git clone https://github.com/SIJEYUSES/excalidraw.git
cd excalidraw
git checkout feature/electron-desktop
```

2. **Install dependencies**:
```bash
yarn install
```

This installs all dependencies including Electron, electron-builder, and other required packages.

## Development

### Running in Development Mode

Start the development environment with both Vite dev server and Electron:

```bash
yarn electron:dev
```

This command:
1. Starts the Vite dev server on `http://localhost:3001`
2. Waits for the server to be ready
3. Launches Electron, which loads `http://localhost:3001/?ui=chatcanvas`

**Hot Reload**: Changes to React components automatically reload in the Electron window.

**Developer Tools**: Press `Ctrl+Shift+I` (or `Cmd+Option+I` on macOS) to open DevTools.

## Building

### Build Steps

#### Step 1: Build React Application

```bash
yarn build
```

Generates the production build in `excalidraw-app/dist/`.

#### Step 2: Compile Electron TypeScript Files

```bash
yarn build:electron
```

Compiles `electron/main.ts` and `electron/preload.ts` to JavaScript.

#### Step 3: Package Electron Application

```bash
yarn electron:build
```

Runs electron-builder to create the installer and portable executable.

### Windows-Specific Builds

#### Create Windows Installer and Portable Executable

```bash
yarn dist:win
```

Generates:
- `ChatCanvas Setup 1.0.0.exe` - NSIS installer
- `ChatCanvas 1.0.0.exe` - Portable executable

#### Create Portable Executable Only

```bash
yarn dist:win:portable
```

Generates only the portable `.exe` file.

## Output Files

After building, the following files are generated in the `dist/` directory:

| File | Purpose |
|------|---------|
| `ChatCanvas Setup 1.0.0.exe` | Installer package (recommended for end users) |
| `ChatCanvas 1.0.0.exe` | Portable executable (no installation required) |
| `builder-effective-config.yaml` | Build configuration used |

### Installer Package

The installer includes:
- Desktop shortcut creation option
- Start menu shortcut creation
- Uninstaller
- Optional installation directory selection
- Automatic cleanup on uninstall

### Portable Executable

The portable executable:
- Requires no installation
- Can be run from any location
- Does not modify system registry
- Suitable for USB drives and portable deployments

## Configuration

### Electron Main Process (electron/main.ts)

**Key Features**:
- **ChatCanvas Mode**: Always loads with `?ui=chatcanvas` parameter
- **Development**: Loads from Vite dev server (`http://localhost:3001`)
- **Production**: Loads from built files using `file://` protocol with query string
- **Security**: Implements `contextIsolation` and uses `preload` script
- **Menu**: Provides File, Edit, and View menus with standard shortcuts

**URL Loading Strategy**:
```typescript
// Development: Load from dev server
mainWindow.loadURL("http://localhost:3001/?ui=chatcanvas");

// Production: Load from built files with query string
const fileUrl = pathToFileURL(indexPath).toString();
mainWindow.loadURL(`${fileUrl}?ui=chatcanvas`);
```

This approach solves the `loadFile` query string limitation by using `loadURL` with `file://` protocol.

### Preload Script (electron/preload.ts)

Exposes safe APIs to the renderer process:

```typescript
window.electronAPI = {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
  },
  app: {
    getName: () => "ChatCanvas",
    getVersion: () => "1.0.0",
  },
  ipc: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => ipcRenderer.on(channel, (event, data) => callback(data)),
  },
};
```

### electron-builder Configuration (package.json)

```json
{
  "build": {
    "appId": "com.chatcanvas.app",
    "productName": "ChatCanvas",
    "files": [
      "electron/main.js",
      "electron/preload.js",
      "excalidraw-app/dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "directories": {
      "buildResources": "assets",
      "output": "dist"
    },
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "ChatCanvas"
    }
  }
}
```

## GitHub Actions

### Automated Windows Build Workflow

The `.github/workflows/build-windows.yml` workflow:

1. **Triggers**: On push to `feature/electron-desktop` or `main` branches, or on pull requests
2. **Environment**: Runs on `windows-latest`
3. **Steps**:
   - Checkout code
   - Setup Node.js 18.x
   - Install dependencies
   - Build Electron files
   - Build React app
   - Create Windows installer
   - Upload artifacts to GitHub Actions

### Downloading Artifacts

1. Go to the GitHub Actions tab in your repository
2. Select the latest workflow run
3. Download the `windows-build` artifact
4. Extract the `.exe` files

### Creating GitHub Releases

To automatically create a release with the `.exe` files:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow will automatically create a GitHub Release and upload the `.exe` files.

## Troubleshooting

### Issue: "Cannot find module 'electron'"

**Solution**: Ensure dependencies are installed:
```bash
yarn install --force
```

### Issue: Dev server not connecting

**Solution**: Verify the Vite dev server is running on port 3001:
```bash
yarn start
```

### Issue: "electron-builder not found"

**Solution**: Rebuild dependencies:
```bash
yarn install --force
yarn build:electron
```

### Issue: Build fails with TypeScript errors

**Solution**: Rebuild Electron TypeScript files:
```bash
yarn build:electron
```

### Issue: Windows Defender flags the executable

**Solution**: This is normal for unsigned executables. To sign:
1. Obtain a code signing certificate
2. Update `build.win.certificateFile` in `package.json`
3. Rebuild with `yarn dist:win`

### Issue: Port 3001 already in use

**Solution**: Kill the process using the port:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3001
kill -9 <PID>
```

## Security Considerations

### Context Isolation

- `contextIsolation: true` - Isolates preload script from renderer process
- `nodeIntegration: false` - Disables Node.js in renderer process
- `sandbox: true` - Enables OS-level sandboxing

### Preload Script

- Only exposes necessary APIs through `contextBridge`
- No direct access to Node.js modules from renderer
- IPC communication for backend integration

### Best Practices

- Never expose `require` or `process` to the renderer
- Use IPC for communication between main and renderer processes
- Validate all data received from the renderer

## Performance

### Bundle Size

- Electron: ~150 MB (includes Chromium)
- ChatCanvas app: ~5 MB (production build)
- Total installer: ~200 MB (compressed)

### Memory Usage

- Typical: 300-500 MB
- With large canvases: 500-800 MB
- Multiple windows: +200-300 MB per window

## Future Enhancements

1. **Code Signing**: Sign executables to bypass Windows SmartScreen
2. **Auto-Updates**: Implement electron-updater for automatic updates
3. **Native Menus**: Add context menus for canvas operations
4. **File Operations**: Add file open/save dialogs
5. **System Tray**: Add system tray integration
6. **Crash Reporting**: Implement crash reporting service
7. **Multi-Window**: Support multiple document windows
8. **Preferences**: Add user preferences dialog

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review [Electron documentation](https://www.electronjs.org/docs)
3. Check [electron-builder documentation](https://www.electron.build/)
4. Open an issue on the GitHub repository

## License

This Electron integration follows the same MIT License as Excalidraw.

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Excalidraw Repository](https://github.com/excalidraw/excalidraw)
- [ChatCanvas Implementation](./CHATCANVAS_IMPLEMENTATION.md)
