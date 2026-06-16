import { render, queryByLabelText } from "@testing-library/react";
import {
  render as renderApp,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getCollaborationLinkData } from "../../data";

import { SyncStatusButton } from "../../components/SyncStatusButton";

// ---------------------------------------------------------------------------
// Module mocks — mirror tests/collab.test.tsx so <ExcalidrawApp/> mounts
// without touching the network, plus a minimal @supabase/supabase-js mock so
// the real client.ts / auth.ts / sessionAtom construct cleanly under the flag.
// These are hoisted by vitest, so they apply to the full-app render below.
// ---------------------------------------------------------------------------

// jsdom lacks a usable WebCrypto for the editor; mirror collab.test.tsx.
Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
    },
  },
});

vi.mock("../../data/firebase.ts", () => {
  const loadFromFirebase = async () => null;
  const saveToFirebase = () => {};
  const isSavedToFirebase = () => true;
  const loadFilesFromFirebase = async () => ({
    loadedFiles: [],
    erroredFiles: [],
  });
  const saveFilesToFirebase = async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  });

  return {
    loadFromFirebase,
    saveToFirebase,
    isSavedToFirebase,
    loadFilesFromFirebase,
    saveFilesToFirebase,
  };
});

vi.mock("socket.io-client", () => {
  return {
    default: () => {
      return {
        close: () => {},
        on: () => {},
        once: () => {},
        off: () => {},
        emit: () => {},
      };
    },
  };
});

// Minimal @supabase/supabase-js mock (the §F skeleton, trimmed to what the
// disable path exercises): the client constructs without network, and its auth
// surface resolves a signed-out session so the SyncStatusButton renders the
// signed-out "Sign in to sync" affordance.
vi.mock("@supabase/supabase-js", () => {
  const createClient = () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (onF: any, onR: any) =>
        Promise.resolve({ data: null, error: null }).then(onF, onR),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() =>
          Promise.resolve({ data: { path: "x" }, error: null }),
        ),
        download: vi.fn(() =>
          Promise.resolve({ data: new Blob([""]), error: null }),
        ),
      })),
    },
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  });
  return { createClient };
});

// eslint-disable-next-line import/first
import ExcalidrawApp from "../../App";

// A `#room=<id>,<key>` link the ORIGINAL parser accepts: the encryption key
// (2nd capture group) must be exactly 22 chars or the parser alerts + returns
// null (data/index.ts RE_COLLAB_LINK + length guard). "abcdefghijklmnopqrstuv"
// is 22 chars, so flag-OFF yields a real { roomId, roomKey }.
const VALID_ROOM_LINK = "https://x.com/#room=abc123,abcdefghijklmnopqrstuv";

const stubSupabaseEnv = () => {
  vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true");
  vi.stubEnv("VITE_APP_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_APP_SUPABASE_ANON_KEY", "anon-test-key");
};

// ---------------------------------------------------------------------------
// A. Unit-level — getCollaborationLinkData gating (the collab entry point).
//
// This is the load-bearing disable assertion: getCollaborationLinkData is the
// sole producer of room data that drives <Collab>.startCollaboration. Proving
// it returns null under the flag (and a real object when off) proves the
// collab entry point is neutralized and flag-scoped (not a hard break of the
// non-sync build). It uses the REAL data/index.ts + REAL featureFlags.ts; the
// flag is read via import.meta.env, which vi.stubEnv controls.
// ---------------------------------------------------------------------------
describe("supabase-sync disable: getCollaborationLinkData gating", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null for a valid #room= link when the flag is ON", () => {
    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true");

    expect(getCollaborationLinkData(VALID_ROOM_LINK)).toBeNull();
  });

  it("CONTROL: returns the room object when the flag is OFF (guard is flag-scoped)", () => {
    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "false");

    // proves the guard does NOT hard-break the non-sync build: the original
    // parser still extracts roomId + roomKey from the very same link.
    expect(getCollaborationLinkData(VALID_ROOM_LINK)).toEqual({
      roomId: "abc123",
      roomKey: "abcdefghijklmnopqrstuv",
    });
  });

  it("CONTROL: null #room=-less link is null in BOTH flag states (parser, not the guard)", () => {
    const noRoom = "https://x.com/#json=abc,def";

    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "false");
    expect(getCollaborationLinkData(noRoom)).toBeNull();

    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true");
    expect(getCollaborationLinkData(noRoom)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B. Component-level — the replacement (sync) UI renders, and renders NO
// collaboration affordance. The SyncStatusButton is the exact UI that replaces
// the LiveCollaborationTrigger in the top-right slot (App.tsx renderTopRightUI).
// ---------------------------------------------------------------------------
describe("supabase-sync disable: SyncStatusButton replaces the collab trigger", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const noop = () => {};

  it("renders the signed-out 'Sign in to sync' affordance and NO collab trigger", () => {
    const { container } = render(
      <SyncStatusButton
        status="idle"
        lastSyncedAt={null}
        onSyncNow={noop}
        isSignedIn={false}
        onRequestSignIn={noop}
      />,
    );

    // PRESENCE: the sync pill is in the document with the signed-out label.
    // Stable selectors: the component root class + the aria-label/title that
    // getPresentation() emits for `!isSignedIn` (SyncStatusButton.tsx:29).
    expect(
      container.querySelector(".excalidraw-sync-status-button"),
    ).toBeInTheDocument();
    expect(queryByLabelText(container, "Sign in to sync")).toBeInTheDocument();

    // ABSENCE: no live-collaboration trigger is rendered by the sync UI.
    // Stable selectors for LiveCollaborationTrigger: the `.collab-button` class
    // (LiveCollaborationTrigger.tsx:31) and its title === t("labels.liveCollaboration")
    // ("Live collaboration...").
    expect(container.querySelector(".collab-button")).toBeNull();
    expect(queryByLabelText(container, "Live collaboration...")).toBeNull();
  });

  it("renders the signed-in 'Synced' state (proves the pill is the real status UI)", () => {
    const { container } = render(
      <SyncStatusButton
        status="synced"
        lastSyncedAt={Date.now()}
        onSyncNow={noop}
        isSignedIn
        onRequestSignIn={noop}
      />,
    );

    expect(queryByLabelText(container, "Synced")).toBeInTheDocument();
    // signed-in must NOT show the sign-in affordance as the pill label
    expect(queryByLabelText(container, "Sign in to sync")).toBeNull();
    // still no collab trigger
    expect(container.querySelector(".collab-button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C. Full-app integration — render <ExcalidrawApp/> under the flag.
//
// This is the preferred disable test: `renderApp` (the app test harness) does
// not resolve until the loading spinner clears (it internally waits for the
// canvas to mount AND `window.h.state.isLoading === false`). So reaching the
// assertions PROVES the flag-on boot hang is fixed (App.tsx:559-561 — the
// scene-init effect now proceeds when isSupabaseSyncEnabled(), even though
// <Collab> is unmounted and collabAPI stays null). Then we assert the collab
// trigger is gone and the SyncStatusButton took its place in the top-right.
// ---------------------------------------------------------------------------
describe("supabase-sync disable: full-app render hides collab, shows sync UI", () => {
  beforeEach(() => {
    stubSupabaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("boots without hanging; LiveCollaborationTrigger absent, SyncStatusButton present", async () => {
    // renderApp resolves only once the canvas is mounted and isLoading is false
    // — i.e. the spinner cleared. If the flag-on boot still hung, this awaited
    // render would time out with "still loading".
    const { container } = await renderApp(<ExcalidrawApp />);

    // sanity: the spinner is gone and the editor is up
    expect(container.querySelector(".LoadingMessage")).toBeNull();
    expect(window.h.state.isLoading).toBe(false);

    // PRESENCE: the SyncStatusButton occupies the top-right slot. Signed-out
    // (mocked session === null) ⇒ aria-label/title "Sign in to sync".
    await waitFor(() => {
      expect(
        queryByLabelText(document.body, "Sign in to sync"),
      ).toBeInTheDocument();
    });
    expect(
      document.body.querySelector(".excalidraw-sync-status-button"),
    ).toBeInTheDocument();

    // ABSENCE: the live-collaboration trigger is NOT in the document.
    expect(document.body.querySelector(".collab-button")).toBeNull();
    expect(queryByLabelText(document.body, "Live collaboration...")).toBeNull();
  });
});
