import { createContext, useContext, type ReactNode } from "react";

export interface AuthShellContextValue {
  signOut: () => Promise<void> | void;
  getToken?: () => Promise<string | null>;
  hasActiveSubscription: boolean;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  checkoutUrlBuilder?: (interval: "month" | "year") => void;
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
