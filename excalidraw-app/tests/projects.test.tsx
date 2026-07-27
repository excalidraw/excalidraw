import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { clear, createStore } from "idb-keyval";
import { vi } from "vitest";

import ExcalidrawApp from "../App";
import { STORAGE_KEYS } from "../app_constants";
import {
  activeProjectIdAtom,
  appJotaiStore,
  projectsListAtom,
} from "../app-jotai";
import {
  createProject,
  deleteProject,
  renameProject,
  switchProject,
} from "../data/projectSwitch";
import { getProject, listProjects } from "../data/projectsStore";
import { saveActiveProjectDebounced } from "../data/projectsStore";

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

const idbStore = createStore(
  `${STORAGE_KEYS.IDB_PROJECTS}-db`,
  `${STORAGE_KEYS.IDB_PROJECTS}-store`,
);

/** the imperative API of the currently rendered editor */
const excalidrawAPI = () => h.app.api;

const waitForMigration = () =>
  waitFor(() => {
    expect(appJotaiStore.get(activeProjectIdAtom)).toBeTruthy();
  });

describe("multiproject", () => {
  beforeEach(async () => {
    // cancel any pending debounced save from a previous test so it cannot
    // resurrect records after the IDB cleanup below
    saveActiveProjectDebounced.cancel();
    await clear(idbStore);
    localStorage.clear();
    appJotaiStore.set(activeProjectIdAtom, null);
    appJotaiStore.set(projectsListAtom, []);
  });

  it("switches between projects without cross-contamination", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;

    // draw on project A
    const rectA = API.createElement({
      type: "rectangle",
      id: "A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    h.app.updateScene({
      elements: [rectA],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    expect(h.elements.map((e) => e.id)).toEqual(["A"]);

    // create project B → canvas becomes empty, A is persisted
    const projectB = await createProject({ excalidrawAPI: excalidrawAPI() });
    expect(appJotaiStore.get(activeProjectIdAtom)).toBe(projectB.id);
    expect(h.elements).toHaveLength(0);
    expect((await getProject(projectAId))?.elements).toHaveLength(1);

    // draw on project B
    const ellipseB = API.createElement({
      type: "ellipse",
      id: "B",
      x: 50,
      y: 50,
      width: 200,
      height: 200,
    });
    h.app.updateScene({
      elements: [ellipseB],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    // back to A → only A's element on canvas
    await switchProject(projectAId, { excalidrawAPI: excalidrawAPI() });
    expect(h.elements.map((e) => e.id)).toEqual(["A"]);

    // forward to B → only B's element on canvas
    await switchProject(projectB.id, { excalidrawAPI: excalidrawAPI() });
    expect(h.elements.map((e) => e.id)).toEqual(["B"]);

    // records stayed isolated
    expect((await getProject(projectAId))?.elements.map((e) => e.id)).toEqual([
      "A",
    ]);
    expect((await getProject(projectB.id))?.elements.map((e) => e.id)).toEqual([
      "B",
    ]);
  });

  it("switchProject is a no-op when the target is already active", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;

    const result = await switchProject(projectAId, {
      excalidrawAPI: excalidrawAPI(),
    });
    expect(result).toBe(false);
  });

  it("stops collaboration before switching projects", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;
    const projectB = await createProject({ excalidrawAPI: excalidrawAPI() });

    const stopCollaboration = vi.fn();
    const collabAPI = {
      isCollaborating: () => true,
      stopCollaboration,
    };

    await switchProject(projectAId, {
      excalidrawAPI: excalidrawAPI(),
      collabAPI,
    });
    expect(stopCollaboration).toHaveBeenCalledWith(false);
    expect(appJotaiStore.get(activeProjectIdAtom)).toBe(projectAId);
    expect(await getProject(projectB.id)).not.toBeNull();
  });

  it("deleting the active project falls back to the most recent one", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;
    const projectB = await createProject({ excalidrawAPI: excalidrawAPI() });

    await deleteProject(projectB.id, { excalidrawAPI: excalidrawAPI() });

    expect(await getProject(projectB.id)).toBeNull();
    expect(appJotaiStore.get(activeProjectIdAtom)).toBe(projectAId);
    expect(await listProjects()).toHaveLength(1);
  });

  it("deleting the last remaining project creates a fresh empty one", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;

    const rectA = API.createElement({
      type: "rectangle",
      id: "A",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    h.app.updateScene({
      elements: [rectA],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await deleteProject(projectAId, { excalidrawAPI: excalidrawAPI() });

    const index = await listProjects();
    expect(index).toHaveLength(1);
    expect(index[0].id).not.toBe(projectAId);
    expect(appJotaiStore.get(activeProjectIdAtom)).toBe(index[0].id);
    // the deleted project's scene is gone for good: fresh canvas is empty
    expect(h.elements).toHaveLength(0);
    expect((await getProject(index[0].id))?.elements).toHaveLength(0);
  });

  it("renaming the active project syncs record, index and appState.name", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;

    await act(async () => {
      await renameProject(projectAId, "Renamed board", {
        excalidrawAPI: excalidrawAPI(),
      });
    });

    expect(h.state.name).toBe("Renamed board");
    const record = await getProject(projectAId);
    expect(record?.title).toBe("Renamed board");
    expect(record?.appState.name).toBe("Renamed board");
    expect((await listProjects())[0].title).toBe("Renamed board");
  });

  it("opens the projects sidebar and lists the projects", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;
    await renameProject(projectAId, "Sidebar board", {
      excalidrawAPI: excalidrawAPI(),
    });

    act(() => {
      excalidrawAPI().toggleSidebar({ name: "projects" });
    });

    await waitFor(() => {
      expect(document.querySelector(".projects-sidebar")).not.toBeNull();
    });
    expect(
      document.querySelector(".projects-sidebar__item-title")?.textContent,
    ).toBe("Sidebar board");
    // active project is highlighted and its switch button disabled
    expect(
      document.querySelector(
        ".projects-sidebar__item--active .projects-sidebar__item-main",
      ),
    ).toHaveProperty("disabled", true);
  });

  it("restoring a project never reopens an unexpected sidebar", async () => {
    await render(<ExcalidrawApp />);
    await waitForMigration();
    const projectAId = appJotaiStore.get(activeProjectIdAtom)!;

    // simulate a state where the projects sidebar was open while editing
    act(() => {
      h.app.setState({ openSidebar: { name: "projects" } });
    });
    const projectB = await createProject({ excalidrawAPI: excalidrawAPI() });

    // switching back to A must not restore openSidebar into the editor
    await act(async () => {
      await switchProject(projectAId, { excalidrawAPI: excalidrawAPI() });
    });
    expect(h.state.openSidebar).toBeNull();
    expect((await getProject(projectAId))?.appState.openSidebar).toBeNull();
    expect(await getProject(projectB.id)).not.toBeNull();
  });
});
