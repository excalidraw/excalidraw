import { ExcalidrawElement } from "../element/types";
import { AppState, BinaryFiles, LibraryItems, LibraryItems_v1 } from "../types";
import type { cleanAppStateForExport } from "../appState";
import { VERSIONS } from "../constants";

export interface ExportedDataState {
  type: string;
  version: number;
  source: string;
  elements: readonly ExcalidrawElement[];
  appState: ReturnType<typeof cleanAppStateForExport>;
  files: BinaryFiles | undefined;
}

export interface ImportedDataState {
  type?: string;
  version?: number;
  source?: string;
  elements?: readonly ExcalidrawElement[] | null;
  appState?: Readonly<Partial<AppState>> | null;
  scrollToContent?: boolean;
  libraryItems?: LibraryItems | LibraryItems_v1;
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
