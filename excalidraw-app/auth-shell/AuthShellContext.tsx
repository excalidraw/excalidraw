import { createContext, useContext, type ReactNode } from "react";

export interface AuthShellContextValue {
  signOut: () => Promise<void> | void;
}

const AuthShellContext = createContext<AuthShellContextValue | null>(null);

export function AuthShellProvider({
  value,
  children,
}: {
  value: AuthShellContextValue;
  children: ReactNode;
}) {
  return (
    <AuthShellContext.Provider value={value}>
      {children}
    </AuthShellContext.Provider>
  );
}

export function useAuthShell(): AuthShellContextValue | null {
  return useContext(AuthShellContext);
}
