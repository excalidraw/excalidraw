import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import ExcalidrawApp from "../App";
import { appJotaiStore } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { collabCurrentUserAtom } from "../collab/Collab";

const { h } = window;

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

vi.mock("../../excalidraw-app/data/firebase.ts", () => {
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

const socketMock = vi.hoisted(() => {
  const listeners = new Map<string, ((...args: any[]) => void)[]>();

  return {
    id: undefined as string | undefined,
    on(event: string, callback: (...args: any[]) => void) {
      listeners.set(event, [...(listeners.get(event) || []), callback]);
    },
    once(event: string, callback: (...args: any[]) => void) {
      this.on(event, callback);
    },
    off(event: string, callback?: (...args: any[]) => void) {
      listeners.set(
        event,
        (listeners.get(event) || []).filter((cb) => cb !== callback),
      );
    },
    emit: () => {},
    close: () => {},
    /** test helper simulating a server-sent event */
    trigger(event: string, ...args: any[]) {
      (listeners.get(event) || []).forEach((callback) => callback(...args));
    },
    reset() {
      this.id = undefined;
      listeners.clear();
    },
  };
});

vi.mock("socket.io-client", () => {
  return {
    default: () => socketMock,
  };
});

describe("collab currentUser", () => {
  beforeEach(() => {
    socketMock.reset();
    appJotaiStore.set(collabCurrentUserAtom, null);
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username: "Test User" }),
    );
  });

  it("should pass the socket id & username as currentUser while collaborating", async () => {
    await render(<ExcalidrawApp />);

    expect(appJotaiStore.get(collabCurrentUserAtom)).toBe(null);
    expect(h.app.props.currentUser).toBe(undefined);

    // returns a promise resolved on scene init, hence not awaited
    window.collab.startCollaboration(null);

    await waitFor(() => {
      expect(window.collab.portal.socket).toBeTruthy();
    });

    // no identity until the socket connects
    expect(appJotaiStore.get(collabCurrentUserAtom)).toBe(null);

    await act(async () => {
      socketMock.id = "socket_1";
      socketMock.trigger("connect");
    });

    await waitFor(() => {
      expect(appJotaiStore.get(collabCurrentUserAtom)).toEqual({
        id: "socket_1",
        name: "Test User",
      });
      expect(h.app.props.currentUser).toEqual({
        id: "socket_1",
        name: "Test User",
      });
    });

    // username changes are reflected
    await act(async () => {
      window.collab.setUsername("Renamed User");
    });

    await waitFor(() => {
      expect(h.app.props.currentUser).toEqual({
        id: "socket_1",
        name: "Renamed User",
      });
    });

    // reconnecting assigns a new socket id
    await act(async () => {
      socketMock.id = "socket_2";
      socketMock.trigger("connect");
    });

    await waitFor(() => {
      expect(h.app.props.currentUser).toEqual({
        id: "socket_2",
        name: "Renamed User",
      });
    });

    await act(async () => {
      window.collab.stopCollaboration(false);
    });

    await waitFor(() => {
      expect(appJotaiStore.get(collabCurrentUserAtom)).toBe(null);
      expect(h.app.props.currentUser).toBe(undefined);
    });
  });
});
