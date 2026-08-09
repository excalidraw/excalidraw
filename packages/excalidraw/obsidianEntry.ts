/**
 * Obsidian-only entry point for the single-file Excalidraw runtime bundle.
 *
 * Author: zsviczian
 *
 * References:
 * - https://github.com/zsviczian/obsidian-excalidraw-plugin
 * - https://github.com/excalidraw/excalidraw/releases/tag/v0.18.0
 *
 * This file keeps the consumer-specific stylesheet outside the upstream ESM
 * entry point so future upstream merges do not need to understand Obsidian.
 */
export * from "./index";

import "./css/obsidianStylingOverrides.css";
