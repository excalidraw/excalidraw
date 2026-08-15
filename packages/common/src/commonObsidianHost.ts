import type { EditorInterface, StylesPanelMode } from "./editorInterface";

/**
 * Obsidian-only host contract shared by the fork's common and element layers.
 *
 * @remarks
 * This module is a deliberately ringfenced fork extension. It defines a
 * dependency-inversion boundary without importing Obsidian or the consuming
 * plugin. The host is registered once for an evaluated window-scoped runtime;
 * component instances must not install or dispose it.
 *
 * Author: zsviczian
 *
 * @see https://github.com/zsviczian/obsidian-excalidraw-plugin
 */

/** Runtime protocol understood by this version of the fork. */
export const OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION = 1 as const;

/** Device capabilities supplied by the Obsidian host. */
export type ObsidianDeviceType = Readonly<{
  isDesktop: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isMobile: boolean;
  isLinux: boolean;
  isMacOS: boolean;
  isWindows: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}>;

/** Canvas limits supplied by the host for the current platform. */
export type ObsidianCanvasLimits = Readonly<{
  areaLimit: number;
  widthHeightLimit: number;
}>;

/**
 * Narrow host capabilities required below the Excalidraw component layer.
 *
 * @remarks
 * Keep this contract semantic: do not expose the plugin instance, its settings
 * object, or an active view. Excalidraw-specific and editor-instance services
 * belong in higher-level adapters rather than this common-package boundary.
 */
export interface ObsidianCommonHostAdapter {
  readonly protocolVersion: typeof OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION;

  getDeviceInfo(): ObsidianDeviceType | null;

  getDesktopUIMode(): StylesPanelMode;

  getPreferredUIMode(
    formFactor: EditorInterface["formFactor"],
  ): StylesPanelMode;

  getCanvasLimits(): ObsidianCanvasLimits;

  getHighlightColor(sceneBackgroundColor: string, opacity: number): string;
}

/** Idempotent cleanup returned when a host adapter is configured. */
export type ObsidianCommonHostDisposer = () => void;

type HostRegistration = Readonly<{
  adapter: ObsidianCommonHostAdapter;
  token: symbol;
}>;

let activeRegistration: HostRegistration | null = null;

/**
 * Configures the common Obsidian host for this evaluated runtime.
 *
 * @returns An idempotent disposer. A disposer from an older registration will
 * not clear a newer host, which makes overlapping teardown safe.
 */
export const configureObsidianCommonHost = (
  adapter: ObsidianCommonHostAdapter,
): ObsidianCommonHostDisposer => {
  if (adapter.protocolVersion !== OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported Obsidian common host protocol: ${String(
        adapter.protocolVersion,
      )}`,
    );
  }

  const token = Symbol("obsidian-common-host");
  activeRegistration = { adapter, token };
  let disposed = false;

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;

    if (activeRegistration?.token === token) {
      activeRegistration = null;
    }
  };
};

/** Returns the configured common host, or `null` outside Obsidian. */
export const getObsidianCommonHost = (): ObsidianCommonHostAdapter | null =>
  activeRegistration?.adapter ?? null;

/** Returns whether this evaluated runtime currently has an Obsidian host. */
export const hasObsidianCommonHost = (): boolean => activeRegistration !== null;
