import { ExcalidrawElement, ExcalidrawGenericElement } from "../element/types";
import {
  AppState,
  BinaryFiles,
  LibraryItems,
  LibraryItems_anyVersion,
} from "../types";
import type { cleanAppStateForExport } from "../appState";
import { VERSIONS } from "../constants";
import { MarkOptional } from "../utility-types";
import { ElementConstructorOpts } from "../element/newElement";

export interface ExportedDataState {
  type: string;
  version: number;
  source: string;
  elements: readonly ExcalidrawElement[];
  appState: ReturnType<typeof cleanAppStateForExport>;
  files: BinaryFiles | undefined;
}

/**
 * Map of legacy AppState keys, with values of:
 *  [<legacy type>, <new AppState proeprty>]
 *
 * This is a helper type used in downstream abstractions.
 * Don't consume on its own.
 */
export type LegacyAppState = {
  /** @deprecated #6213 TODO remove 23-06-01 */
  isSidebarDocked: [boolean, "defaultSidebarDockedPreference"];
};

export interface ImportedDataState {
  type?: string;
  version?: number;
  source?: string;
  elements?:
    | readonly (
        | (ExcalidrawElement & {
            label?: [
              { text: string } & MarkOptional<
                ElementConstructorOpts,
                "x" | "y"
              >,
            ];
          })
        | {
            type: Exclude<ExcalidrawGenericElement["type"], "selection">;
            label?: [
              { text: string } & MarkOptional<
                ElementConstructorOpts,
                "x" | "y"
              >,
            ] &
              MarkOptional<ElementConstructorOpts, "x" | "y">;
          }
      )[]
    | null;
  appState?: Readonly<
    Partial<
      AppState & {
        [T in keyof LegacyAppState]: LegacyAppState[T][0];
      }
    >
  > | null;
  scrollToContent?: boolean;
  libraryItems?: LibraryItems_anyVersion;
  files?: BinaryFiles;
}

export interface ExportedLibraryData {
  type: string;
  version: typeof VERSIONS.excalidrawLibrary;
  source: string;
  libraryItems: LibraryItems;
}

export interface ImportedLibraryData extends Partial<ExportedLibraryData> {
  /** @deprecated v1 */
  library?: LibraryItems;
}
