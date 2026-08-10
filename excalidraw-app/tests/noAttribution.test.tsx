import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";

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

describe("no authorship attribution in the app", () => {
  beforeEach(() => {
    socketMock.reset();
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username: "Test User" }),
    );
  });

  it("should not stamp authorship onto locally created elements", async () => {
    await render(<ExcalidrawApp />);

    UI.createElement("rectangle", { x: 10, y: 10 });

    expect(h.elements.length).toBe(1);
    expect(h.elements[0].createdBy).toBeNull();
    expect(h.elements[0].updatedBy).toBeNull();
  });

  // authorship is a host-app concern - excalidraw.com never identifies the
  // local user to the editor, so nothing it does may ever author an element
  it("should never pass a currentUser, not even while collaborating", async () => {
    await render(<ExcalidrawApp />);

    expect(h.app.props.currentUser).toBe(undefined);

    // returns a promise resolved on scene init, hence not awaited
    window.collab.startCollaboration(null);

    await waitFor(() => {
      expect(window.collab.portal.socket).toBeTruthy();
    });

    expect(h.app.props.currentUser).toBe(undefined);

    await act(async () => {
      socketMock.id = "socket_1";
      socketMock.trigger("connect");
    });

    expect(h.app.props.currentUser).toBe(undefined);

    await act(async () => {
      window.collab.setUsername("Renamed User");
    });

    expect(h.app.props.currentUser).toBe(undefined);

    await act(async () => {
      window.collab.stopCollaboration(false);
    });

    expect(h.app.props.currentUser).toBe(undefined);
  });
});
