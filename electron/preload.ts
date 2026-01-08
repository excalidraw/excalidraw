import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload script for Electron.
 * Exposes safe APIs to the renderer process.
 */

// Expose a minimal API to the renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // Version information
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
  },

  // App information
  app: {
    getName: () => "ChatCanvas",
    getVersion: () => "1.0.0",
  },

  // IPC communication (if needed in the future)
  ipc: {
    send: (channel: string, data: any) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel: string, callback: (data: any) => void) => {
      ipcRenderer.on(channel, (event, data) => callback(data));
    },
  },
});

// Declare the electronAPI for TypeScript
declare global {
  interface Window {
    electronAPI: {
      versions: {
        node: () => string;
        chrome: () => string;
        electron: () => string;
      };
      app: {
        getName: () => string;
        getVersion: () => string;
      };
      ipc: {
        send: (channel: string, data: any) => void;
        on: (channel: string, callback: (data: any) => void) => void;
      };
    };
  }
}
