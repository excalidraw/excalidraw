import {
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  useClerk,
} from "@clerk/clerk-react";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

import type { AuthShellConfig } from "./config";
import {
  fetchPremiumSession,
  hasPremiumCookie,
  setPremiumCookie,
} from "./premiumSession";
import { AuthShellProvider } from "./AuthShellContext";

type SessionStatus =
  | { type: "loading" }
  | { type: "ready"; premium: boolean }
  | { type: "error"; message: string };

interface AuthGateProps {
  config: AuthShellConfig;
  children: ReactElement;
}

const loaderStyles: CSSProperties = {
  alignItems: "center",
  display: "flex",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "1rem",
  height: "100vh",
  justifyContent: "center",
  padding: "2rem",
};

function Loader({ label }: { label: string }) {
  return <div style={loaderStyles}>{label}</div>;
}

const ClerkLoadedComponent =
  ClerkLoaded as unknown as ComponentType<{ children?: ReactNode }>;
const ClerkLoadingComponent =
  ClerkLoading as unknown as ComponentType<{ children?: ReactNode }>;
const SignedInComponent =
  SignedIn as unknown as ComponentType<{ children?: ReactNode }>;
const SignedOutComponent =
  SignedOut as unknown as ComponentType<{ children?: ReactNode }>;

function AuthScreen({ config }: { config: AuthShellConfig }) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: "100vh",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <SignIn
        routing="virtual"
        redirectUrl={config.redirectUrl}
        afterSignInUrl={config.redirectUrl}
        appearance={{
          elements: {
            rootBox: {
              boxShadow: "0 1rem 3rem rgba(16, 24, 40, 0.12)",
            },
          },
        }}
      />
    </div>
  );
}

function SessionGuard({
  config,
  children,
}: {
  config: AuthShellConfig;
  children: ReactElement;
}) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const shouldFetchSession = Boolean(config.apiBaseUrl);

  const [status, setStatus] = useState<SessionStatus>(() =>
    shouldFetchSession ? { type: "loading" } : { type: "ready", premium: true },
  );
  const [retryIndex, setRetryIndex] = useState(0);

  const ensurePremiumCookie = useCallback(
    (premium: boolean) => {
      setPremiumCookie(config, premium);
    },
    [config],
  );

  useEffect(() => {
    if (!shouldFetchSession) {
      if (!hasPremiumCookie(config)) {
        ensurePremiumCookie(true);
      }
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    async function hydrate() {
      setStatus({ type: "loading" });

      try {
        const session = await fetchPremiumSession(config, {
          getToken: () => getToken({ skipCache: true }),
          signal: controller.signal,
        });

        if (isCancelled) {
          return;
        }

        const premium = session?.premium ?? false;
        ensurePremiumCookie(premium);
        setStatus({ type: "ready", premium });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unknown session error occurred.";

        setStatus({ type: "error", message });
      }
    }

    hydrate();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [config, ensurePremiumCookie, getToken, retryIndex, shouldFetchSession]);

  const handleRetry = useCallback(() => {
    setRetryIndex((value) => value + 1);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      ensurePremiumCookie(false);
      await signOut();
    } catch (error) {
      console.error("[AuthShell] Failed to sign out", error);
    }
  }, [ensurePremiumCookie, signOut]);

  if (status.type === "loading") {
    return <Loader label="Restoring your session…" />;
  }

  if (status.type === "error") {
    return (
      <div
        style={{
          alignItems: "center",
          display: "flex",
          height: "100vh",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            boxShadow: "0 1.5rem 4rem rgba(15, 23, 42, 0.15)",
            maxWidth: "26rem",
            padding: "2rem",
            textAlign: "center",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Unable to load your workspace
          </h1>
          <p style={{ color: "#475467", marginBottom: "1.5rem" }}>
            {status.message}
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handleRetry}
              style={{
                backgroundColor: "#111827",
                border: "none",
                borderRadius: "0.75rem",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 600,
                padding: "0.65rem 1.5rem",
              }}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #d0d5dd",
                borderRadius: "0.75rem",
                color: "#111827",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 600,
                padding: "0.65rem 1.5rem",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthShellProvider value={{ signOut: handleSignOut, getToken }}>
      {children}
    </AuthShellProvider>
  );
}

export function AuthGate({ config, children }: AuthGateProps) {
  if (!config.publishableKey) {
    throw new Error("[AuthShell] Missing Clerk publishable key in config.");
  }

  return (
    <ClerkProvider publishableKey={config.publishableKey}>
      <ClerkLoadingComponent>
        <Loader label="Preparing authentication…" />
      </ClerkLoadingComponent>
      <ClerkLoadedComponent>
        <SignedInComponent>
          <SessionGuard config={config}>{children}</SessionGuard>
        </SignedInComponent>
        <SignedOutComponent>
          <AuthScreen config={config} />
        </SignedOutComponent>
      </ClerkLoadedComponent>
    </ClerkProvider>
  );
}
