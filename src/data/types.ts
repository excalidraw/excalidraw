import { ExcalidrawElement, Versioned } from "../element/types";
import { AppState } from "../types";

export interface DataState {
  type?: string;
  version?: string;
  source?: string;
  elements: readonly Versioned<ExcalidrawElement>[];
  appState: AppState | null;
}
