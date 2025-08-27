import {
  CaptureUpdateAction,
  getSceneVersion,
  restoreElements,
  zoomToFitBounds,
  reconcileElements,
} from "@excalidraw/excalidraw";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { APP_NAME, EVENT } from "@excalidraw/common";
import {
  IDLE_THRESHOLD,
  ACTIVE_THRESHOLD,
  UserIdleState,
  assertNever,
  isDevEnv,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  throttleRAF,
} from "@excalidraw/common";
import { decryptData } from "@excalidraw/excalidraw/data/encryption";
import { getVisibleSceneBounds } from "@excalidraw/element";
import { newElementWith } from "@excalidraw/element";
import { isImageElement, isInitializedImageElement } from "@excalidraw/element";
import { AbortError } from "@excalidraw/excalidraw/errors";
import { t } from "@excalidraw/excalidraw/i18n";
import { withBatchedUpdates } from "@excalidraw/excalidraw/reactUtils";

import throttle from "lodash.throttle";
import { PureComponent } from "react";

import type {
  ReconciledExcalidrawElement,
  RemoteExcalidrawElement,
} from "@excalidraw/excalidraw/data/reconcile";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type {
  ExcalidrawElement,
  FileId,
  InitializedExcalidrawImageElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
  SocketId,
  Collaborator,
  Gesture,
} from "@excalidraw/excalidraw/types";
import type { Mutable, ValueOf } from "@excalidraw/common/utility-types";

import { appJotaiStore, atom } from "../app-jotai";
import {
  CURSOR_SYNC_TIMEOUT,
  FILE_UPLOAD_MAX_BYTES,
  INITIAL_SCENE_UPDATE_TIMEOUT,
  LOAD_IMAGES_TIMEOUT,
  WS_SUBTYPES,
  SYNC_FULL_SCENE_INTERVAL_MS,
  WS_EVENTS,
} from "../app_constants";
import {
  generateCollaborationLinkData,
  getCollaborationLink,
  getSyncableElements,
} from "../data";
import {
  encodeFilesForUpload,
  FileManager,
  updateStaleImageStatuses,
} from "../data/FileManager";
import { LocalData } from "../data/LocalData";
import {
  isSavedToSupabase,
  loadFilesFromSupabase,
  loadFromSupabase,
  saveFilesToSupabase,
  saveToSupabase,
  SupabaseSceneVersionCache,
} from "../data/supabase";
import {
  importUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
} from "../data/localStorage";
import { resetBrowserStateVersions } from "../data/tabSync";

import { collabErrorIndicatorAtom } from "./CollabError";
import Portal from "./Portal";

import type {
  SocketUpdateDataSource,
  SyncableExcalidrawElement,
} from "../data";

// Collaborative features disabled - using stub implementations
export const collabAPIAtom = atom<CollabAPI | null>({
  isCollaborating: () => false,
  onPointerUpdate: () => {},
  startCollaboration: async () => null,
  stopCollaboration: () => {},
  syncElements: () => {},
  fetchImageFilesFromFirebase: async () => ({ loadedFiles: [], erroredFiles: new Map() }),
  setUsername: () => {},
  getUsername: () => "",
  getActiveRoomLink: () => null,
  setCollabError: () => {},
});
export const isCollaboratingAtom = atom(false);
export const isOfflineAtom = atom(false);

interface CollabState {
  errorMessage: string | null;
  /** errors related to saving */
  dialogNotifiedErrors: Record<string, boolean>;
  username: string;
  activeRoomLink: string | null;
}

export const activeRoomLinkAtom = atom<string | null>(null);

type CollabInstance = InstanceType<typeof Collab>;

export interface CollabAPI {
  /** function so that we can access the latest value from stale callbacks */
  isCollaborating: () => boolean;
  onPointerUpdate: CollabInstance["onPointerUpdate"];
  startCollaboration: CollabInstance["startCollaboration"];
  stopCollaboration: CollabInstance["stopCollaboration"];
  syncElements: CollabInstance["syncElements"];
  fetchImageFilesFromFirebase: CollabInstance["fetchImageFilesFromFirebase"];
  setUsername: CollabInstance["setUsername"];
  getUsername: CollabInstance["getUsername"];
  getActiveRoomLink: CollabInstance["getActiveRoomLink"];
  setCollabError: CollabInstance["setErrorDialog"];
}

interface CollabProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

// Collaborative features disabled - stub implementation
class Collab extends PureComponent<CollabProps, CollabState> {
  excalidrawAPI: CollabProps["excalidrawAPI"];

  constructor(props: CollabProps) {
    super(props);
    this.state = {
      errorMessage: null,
      dialogNotifiedErrors: {},
      username: "",
      activeRoomLink: null,
    };
    this.excalidrawAPI = props.excalidrawAPI;
  }

  // Stub implementations for collaborative methods - all disabled
  isCollaborating(): boolean {
    return false;
  }

  onPointerUpdate(): void {
    // No-op - collaboration disabled
  }

  async startCollaboration(): Promise<any> {
    // No-op - collaboration disabled
    return null;
  }

  stopCollaboration(): void {
    // No-op - collaboration disabled
  }

  syncElements(): void {
    // No-op - collaboration disabled
  }

  async fetchImageFilesFromFirebase(): Promise<any> {
    // No-op - collaboration disabled
    return { loadedFiles: [], erroredFiles: new Map() };
  }

  setUsername(): void {
    // No-op - collaboration disabled
  }

  getUsername(): string {
    return "";
  }

  getActiveRoomLink(): string | null {
    return null;
  }

  setErrorDialog(): void {
    // No-op - collaboration disabled
  }

  render(): React.ReactNode {
    // Collaborative features disabled - render nothing
    return null;
  }
}

if (isTestEnv() || isDevEnv()) {
  window.collab = window.collab || ({} as Window["collab"]);
}

export default Collab;

export type TCollabClass = Collab;
