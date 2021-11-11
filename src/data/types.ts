import { ExcalidrawElement } from "../element/types";
import { AppState, BinaryFiles, LibraryItems, LibraryItems_v1 } from "../types";
import type { cleanAppStateForExport } from "../appState";

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
  version: number;
  source: string;
  libraryItems: LibraryItems;
  library?: LibraryItems | LibraryItems_v1;
}

export interface ImportedLibraryData extends Partial<ExportedLibraryData> {}
