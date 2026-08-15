/**
 * Obsidian host contract for plugin-wide capabilities used by the Excalidraw
 * package layer.
 *
 * @remarks
 * This fork-only boundary intentionally exposes semantic capabilities, not the
 * plugin instance or its settings object. View-scoped state must not be added
 * here.
 *
 * Author: zsviczian
 *
 * @see https://github.com/zsviczian/obsidian-excalidraw-plugin
 */

import type { MermaidToExcalidrawLibProps } from "./components/TTDDialog/types";

/** Runtime protocol understood by this version of the Excalidraw package. */
export const OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION = 2 as const;

/** Keyboard-blocking lifecycle returned by the host's inline suggester. */
export interface ObsidianKeyBlocker {
  isBlockingKeys(): boolean;
  close(): void;
}

/** Plugin-wide capabilities consumed by the Excalidraw package. */
export interface ObsidianExcalidrawHostAdapter {
  readonly protocolVersion: typeof OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION;

  isDoubleTapEraserEnabled(): boolean;
  isRightClickPanEnabled(): boolean;
  getZoomToFitMaxLevel(): number;
  isPenModeCrosshairVisible(): boolean;
  isSingleFingerPanningEnabled(): boolean;
  isDoubleClickTextEditingDisabled(): boolean;
  getZoomStep(): number;
  getZoomMin(): number;
  getZoomMax(): number;
  isContextMenuDisabled(): boolean;
  shouldSyncElementLinkWithText(): boolean;

  loadFontFromFile(filename: string): Promise<ArrayBuffer | undefined>;
  getMermaid(): Promise<MermaidToExcalidrawLibProps>;
  runAction(action: "anyFile" | "LaTeX" | "card"): void;
  getLabel(key: string): string;
  attachInlineLinkSuggester(
    inputEl: HTMLInputElement | HTMLTextAreaElement,
    widthWrapper?: HTMLElement,
    container?: HTMLDivElement | null,
    suppressPlaceholder?: boolean,
  ): ObsidianKeyBlocker;
}

/** Idempotent cleanup returned when a package host is configured. */
export type ObsidianExcalidrawHostDisposer = () => void;

type HostRegistration = Readonly<{
  adapter: ObsidianExcalidrawHostAdapter;
  token: symbol;
}>;

let activeRegistration: HostRegistration | null = null;

/**
 * Configures the Obsidian host for this evaluated Excalidraw package runtime.
 *
 * @returns An idempotent, stale-registration-safe disposer.
 */
export const configureObsidianExcalidrawHost = (
  adapter: ObsidianExcalidrawHostAdapter,
): ObsidianExcalidrawHostDisposer => {
  if (adapter.protocolVersion !== OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported Obsidian Excalidraw host protocol: ${String(
        adapter.protocolVersion,
      )}`,
    );
  }

  const token = Symbol("obsidian-excalidraw-host");
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

/** Returns the configured package host, or `null` outside Obsidian. */
export const getObsidianExcalidrawHost =
  (): ObsidianExcalidrawHostAdapter | null =>
    activeRegistration?.adapter ?? null;

/** Returns whether this evaluated package runtime has an Obsidian host. */
export const hasObsidianExcalidrawHost = (): boolean =>
  activeRegistration !== null;
