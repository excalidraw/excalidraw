import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiError, get, post } from "../api/client";

import type { ReactNode } from "react";
import type { Features, User } from "../api/types";

interface AuthState {
  user: User | null;
  features: Features | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useAuth outside AuthProvider");
  }
  return v;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, cfg] = await Promise.allSettled([
        get("/auth/me"),
        get("/config"),
      ]);
      if (!alive) {
        return;
      }
      if (me.status === "fulfilled") {
        setUser(me.value.user);
      } else if (me.reason instanceof ApiError && me.reason.status !== 401) {
        console.warn("auth check failed", me.reason);
      }
      if (cfg.status === "fulfilled") {
        setFeatures(cfg.value.features);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser((await post("/auth/login", { email, password })).user);
  }, []);
  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setUser(
        (await post("/auth/register", { email, password, displayName })).user,
      );
    },
    [],
  );
  const logout = useCallback(async () => {
    await post("/auth/logout").catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, features, loading, login, register, logout, setUser }),
    [user, features, loading, login, register, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
