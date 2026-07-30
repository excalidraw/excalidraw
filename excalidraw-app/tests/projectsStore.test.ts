import { clear, createStore } from "idb-keyval";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";
import {
  activeProjectIdAtom,
  appJotaiStore,
  projectsListAtom,
} from "../app-jotai";
import {
  collectAllProjectFileIds,
  deleteProjectRecord,
  getActiveProjectId,
  getProject,
  listProjects,
  migrateLocalSceneToProject,
  saveActiveProject,
  saveProject,
  setActiveProjectId,
} from "../data/projectsStore";

import type { ProjectRecord } from "../data/projectsStore";

const idbStore = createStore(
  `${STORAGE_KEYS.IDB_PROJECTS}-db`,
  `${STORAGE_KEYS.IDB_PROJECTS}-store`,
);

const makeRecord = (overrides: Partial<ProjectRecord> = {}): ProjectRecord => ({
  id: `proj-test-${Math.random()}`,
  title: "Test board",
  createdAt: 1000,
  updatedAt: 1000,
  elements: [],
  appState: {},
  ...overrides,
});

const makeElement = (overrides: Record<string, unknown>) =>
  ({ id: "e1", type: "rectangle", isDeleted: false, ...overrides } as any);

describe("projectsStore", () => {
  beforeEach(async () => {
    await clear(idbStore);
    localStorage.clear();
    appJotaiStore.set(activeProjectIdAtom, null);
    appJotaiStore.set(projectsListAtom, []);
  });

  describe("CRUD", () => {
    it("saveProject + getProject roundtrip and index update", async () => {
      const record = makeRecord({ id: "p1", title: "Board A" });
      await saveProject(record);

      expect(await getProject("p1")).toEqual(record);
      expect(await listProjects()).toEqual([
        { id: "p1", title: "Board A", updatedAt: 1000 },
      ]);
      // index is mirrored into jotai for the sidebar
      expect(appJotaiStore.get(projectsListAtom)).toHaveLength(1);
    });

    it("saveProject updates existing index entry and sorts by updatedAt desc", async () => {
      await saveProject(makeRecord({ id: "p1", updatedAt: 1000 }));
      await saveProject(makeRecord({ id: "p2", updatedAt: 2000 }));
      await saveProject(
        makeRecord({ id: "p1", title: "Renamed", updatedAt: 3000 }),
      );

      const index = await listProjects();
      expect(index.map((p) => p.id)).toEqual(["p1", "p2"]);
      expect(index[0].title).toBe("Renamed");
      expect(index).toHaveLength(2);
    });

    it("deleteProjectRecord removes record and index entry", async () => {
      await saveProject(makeRecord({ id: "p1" }));
      await saveProject(makeRecord({ id: "p2" }));

      await deleteProjectRecord("p1");

      expect(await getProject("p1")).toBeNull();
      expect((await listProjects()).map((p) => p.id)).toEqual(["p2"]);
    });
  });

  describe("active project pointer", () => {
    it("get/setActiveProjectId roundtrip via localStorage", () => {
      expect(getActiveProjectId()).toBeNull();
      setActiveProjectId("p1");
      expect(getActiveProjectId()).toBe("p1");
      expect(appJotaiStore.get(activeProjectIdAtom)).toBe("p1");
    });
  });

  describe("migration", () => {
    it("creates the first project from an empty local scene", async () => {
      const record = await migrateLocalSceneToProject();

      expect(record.elements).toEqual([]);
      expect(record.title).toBeTruthy();
      expect(await listProjects()).toHaveLength(1);
      expect(getActiveProjectId()).toBe(record.id);
    });

    it("migrates the existing localStorage scene into the first project", async () => {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
        JSON.stringify([makeElement({ id: "legacy-1" })]),
      );
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
        JSON.stringify({ name: "My old drawing" }),
      );

      const record = await migrateLocalSceneToProject();

      expect(record.elements).toHaveLength(1);
      expect(record.elements[0].id).toBe("legacy-1");
      expect(record.title).toBe("My old drawing");
    });

    it("is idempotent: second call returns the existing active project", async () => {
      const first = await migrateLocalSceneToProject();
      const second = await migrateLocalSceneToProject();

      expect(second.id).toBe(first.id);
      expect(await listProjects()).toHaveLength(1);
    });

    it("repairs a stale active-project pointer", async () => {
      await saveProject(makeRecord({ id: "p1", updatedAt: 3000 }));
      await saveProject(makeRecord({ id: "p2", updatedAt: 1000 }));
      setActiveProjectId("deleted-project");

      const record = await migrateLocalSceneToProject();

      expect(record.id).toBe("p1"); // most recently updated
      expect(getActiveProjectId()).toBe("p1");
    });
  });

  describe("saveActiveProject", () => {
    it("persists snapshot into the active record", async () => {
      await saveProject(makeRecord({ id: "p1" }));
      setActiveProjectId("p1");

      await saveActiveProject([makeElement({ id: "e1" })], {
        name: "Canvas rename",
        openSidebar: { name: "projects" },
      } as any as AppState);

      const saved = await getProject("p1");
      expect(saved?.elements).toHaveLength(1);
      // ProjectName edit renames the project
      expect(saved?.title).toBe("Canvas rename");
      // sidebar state is not persisted into projects
      expect(saved?.appState.openSidebar).toBeNull();
    });

    it("filters out deleted elements", async () => {
      await saveProject(makeRecord({ id: "p1" }));
      setActiveProjectId("p1");

      await saveActiveProject(
        [
          makeElement({ id: "kept" }),
          makeElement({ id: "deleted", isDeleted: true }),
        ] as ExcalidrawElement[],
        {} as AppState,
      );

      const saved = await getProject("p1");
      expect(saved?.elements.map((e) => e.id)).toEqual(["kept"]);
    });

    it("keeps existing title when appState.name is not set", async () => {
      await saveProject(makeRecord({ id: "p1", title: "Stable title" }));
      setActiveProjectId("p1");

      await saveActiveProject([], {} as AppState);

      expect((await getProject("p1"))?.title).toBe("Stable title");
    });

    it("does nothing when the active record no longer exists", async () => {
      setActiveProjectId("ghost");
      await expect(
        saveActiveProject([], {} as AppState),
      ).resolves.toBeUndefined();
      expect(await listProjects()).toEqual([]);
    });
  });

  describe("collectAllProjectFileIds", () => {
    it("unions fileIds across every project", async () => {
      await saveProject(
        makeRecord({
          id: "p1",
          elements: [
            makeElement({ type: "image", fileId: "file-a" }),
            makeElement({ type: "rectangle" }),
          ],
        }),
      );
      await saveProject(
        makeRecord({
          id: "p2",
          elements: [makeElement({ type: "image", fileId: "file-b" })],
        }),
      );

      const fileIds = await collectAllProjectFileIds();
      expect([...fileIds].sort()).toEqual(["file-a", "file-b"]);
    });
  });
});
