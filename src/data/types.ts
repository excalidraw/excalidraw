import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

export interface DataState {
  type?: string;
  version?: string;
  source?: string;
  elements: readonly ExcalidrawElement[];
  appState: AppState | null;
}
