import { atom } from "../../app-jotai";

import type { DriveFile } from "./types";

export * from "./auth";
export * from "./driveApi";
export * from "./picker";
export type { DriveFile, PickedDriveFile } from "./types";

/** The Drive document the current scene is associated with, if any. */
export const driveFileAtom = atom<DriveFile | null>(null);
