import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { get } from "../api/client";

import type { ReactNode } from "react";
import type { Folder, Workspace } from "../api/types";

interface WorkspaceState {
  workspaces: Workspace[];
  current: Workspace | null;
  folders: Folder[];
  loading: boolean;
  reload: () => Promise<void>;
  reloadFolders: () => Promise<void>;
  select: (id: string) => void;
}

const Ctx = createContext<WorkspaceState | null>(null);
export const useWorkspace = () => {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useWorkspace outside provider");
  }
  return v;
};

const LAST_KEY = "ew:lastWorkspace";
const readLast = () => {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};

export const WorkspaceProvider = ({
  routeId,
  onSelect,
  children,
}: {
  routeId: string | undefined;
  onSelect: (id: string) => void;
  children: ReactNode;
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await get("/workspaces");
    setWorkspaces(res.workspaces);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [reload]);

  const current = useMemo(
    () =>
      workspaces.find((w) => w.id === routeId) ??
      workspaces.find((w) => w.id === readLast()) ??
      workspaces[0] ??
      null,
    [workspaces, routeId],
  );

  const reloadFolders = useCallback(async () => {
    if (!current) {
      return;
    }
    setFolders((await get(`/workspaces/${current.id}/folders`)).folders);
  }, [current]);

  useEffect(() => {
    reloadFolders().catch(() => {});
  }, [reloadFolders]);

  useEffect(() => {
    if (current) {
      try {
        localStorage.setItem(LAST_KEY, current.id);
      } catch {
        /* storage unavailable */
      }
    }
  }, [current]);

  const value = useMemo(
    () => ({
      workspaces,
      current,
      folders,
      loading,
      reload,
      reloadFolders,
      select: onSelect,
    }),
    [workspaces, current, folders, loading, reload, reloadFolders, onSelect],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
