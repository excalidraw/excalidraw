import { ExcalidrawElement } from "../element/types";
import { AppState, LibraryItems } from "../types";

export interface DataState {
  type?: string;
  version?: string;
  source?: string;
  elements: readonly ExcalidrawElement[];
  appState: MarkOptional<AppState, "offsetTop" | "offsetLeft">;
  useTex: boolean;
}

export interface ImportedDataState {
  type?: string;
  version?: string;
  source?: string;
  elements?: DataState["elements"] | null;
  appState?: Partial<DataState["appState"]> | null;
  useTex?: boolean;
}

export interface LibraryData {
  type?: string;
  version?: number;
  source?: string;
  library?: LibraryItems;
  useTex?: boolean;
}
