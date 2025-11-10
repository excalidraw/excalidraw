import { useState, useEffect } from "react";
import { SettingsSidebar } from "./SettingsSidebar";
import { ManageSubscriptionPage } from "./ManageSubscriptionPage";
import { ProfilePage } from "./ProfilePage";
import { trackEvent } from "../../../packages/excalidraw/analytics";

interface ClerkUser {
  primaryEmailAddress?: {
    emailAddress: string;
  } | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}

interface SettingsPageProps {
  onSignOut: () => void;
  onDeleteAccount: () => Promise<void>;
  apiBaseUrl?: string;
  getToken: () => Promise<string | null>;
  user: ClerkUser | null | undefined;
}

type SettingsView = "manage" | "profile";

/**
 * Extract settings page from pathname
 * Handles routes like /settings/billing, /workspace/settings/manage, etc.
 * Returns null if not a valid settings route
 */
function getSettingsPageFromPath(pathname: string): SettingsView | null {
  // Match /settings or /settings/* but not unrelated routes like /integrations/settings-guide
  const settingsMatch = pathname.match(/\/settings(?:\/([^/]+))?(?:\/|$)/);
  if (!settingsMatch) {
    return null;
  }

  const page = settingsMatch[1]; // undefined for /settings, or the page name
  if (page === "profile") return "profile";
  // Treat /settings, /settings/manage, and legacy /settings/billing as manage
  return "manage";
}

export function SettingsPage({
  onSignOut,
  onDeleteAccount,
  apiBaseUrl,
  getToken,
  user,
}: SettingsPageProps) {
  const [currentPage, setCurrentPage] = useState<SettingsView>("manage");

  // Read initial page from URL
  useEffect(() => {
    const pathname = window.location.pathname;
    const page = getSettingsPageFromPath(pathname);
    if (page) {
      setCurrentPage(page);
      trackEvent("settings", "page_viewed", page);
    }
  }, []);

  // Track settings page access
  useEffect(() => {
    trackEvent("settings", "accessed");
  }, []);

  const handleNavigate = (page: SettingsView) => {
    setCurrentPage(page);
    trackEvent("settings", "page_changed", page);

    // Update URL without page reload
    // Extract everything before /settings (workspace prefix, if any)
    const pathname = window.location.pathname;
    const settingsIndex = pathname.indexOf("/settings");
    const basePath = settingsIndex > 0 ? pathname.substring(0, settingsIndex) : "";
    const newPath =
      page === "manage"
        ? `${basePath}/settings/manage`
        : `${basePath}/settings/profile`;

    window.history.pushState({}, "", newPath);
  };

  // Listen to browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const page = getSettingsPageFromPath(pathname);
      if (page) {
        setCurrentPage(page);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div
      style={{
        backgroundColor: "#111827",
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <SettingsSidebar currentPage={currentPage} onNavigate={handleNavigate} />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: "#1a1a1a",
        }}
      >
        {currentPage === "manage" && <ManageSubscriptionPage apiBaseUrl={apiBaseUrl} getToken={getToken} />}
        {currentPage === "profile" && (
          <ProfilePage onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} user={user} />
        )}
      </div>
    </div>
  );
}
