import { useState } from "react";
import { trackEvent } from "../../../packages/excalidraw/analytics";

interface ClerkUser {
  primaryEmailAddress?: {
    emailAddress: string;
  } | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}

interface ProfilePageProps {
  onSignOut: () => void;
  onDeleteAccount: () => Promise<void>;
  user: ClerkUser | null | undefined;
}

export function ProfilePage({ onSignOut, onDeleteAccount, user }: ProfilePageProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = () => {
    trackEvent("settings", "signout_clicked");
    if (confirm("Are you sure you want to sign out?")) {
      trackEvent("settings", "signout_confirmed");
      onSignOut();
    } else {
      trackEvent("settings", "signout_canceled");
    }
  };

  const handleDeleteAccount = async () => {
    trackEvent("settings", "delete_account_clicked");
    const confirmed = confirm(
      "Deleting your account will permanently erase all your data, settings, and preferences from our system. This action is irreversible.\n\nAre you sure you want to delete your account?"
    );

    if (!confirmed) {
      trackEvent("settings", "delete_account_canceled");
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteAccount();
      trackEvent("settings", "delete_account_completed");
    } catch (error) {
      console.error("Failed to delete account:", error);
      trackEvent("settings", "delete_account_failed");
      const message =
        error instanceof Error ? error.message : "Failed to delete your account. Please try again.";
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const displayName = user?.fullName || user?.firstName || "User";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div style={{ padding: "2rem" }}>
      <h2
        style={{
          color: "#ffffff",
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
        }}
      >
        Profile
      </h2>

      {/* User Information Section */}
      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h3
          style={{
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          Account Information
        </h3>

        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              color: "#9ca3af",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.25rem",
            }}
          >
            Name
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: "0.9375rem",
            }}
          >
            {displayName}
          </div>
        </div>

        {email && (
          <div>
            <div
              style={{
                color: "#9ca3af",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.25rem",
              }}
            >
              Email
            </div>
            <div
              style={{
                color: "#ffffff",
                fontSize: "0.9375rem",
              }}
            >
              {email}
            </div>
          </div>
        )}

        <p
          style={{
            color: "#6b7280",
            fontSize: "0.8125rem",
            marginTop: "1rem",
            fontStyle: "italic",
          }}
        >
          To update your account information, please visit your Clerk user dashboard.
        </p>
      </div>

      {/* Sign Out Section */}
      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
        }}
      >
        <h3
          style={{
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
          }}
        >
          Sign Out
        </h3>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        >
          Sign out of your EmbraceBoard account. You will need to sign in again to access your subscription and boards.
        </p>
        <button
          onClick={handleSignOut}
          style={{
            backgroundColor: "#dc2626",
            border: "none",
            borderRadius: "0.375rem",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
            padding: "0.625rem 1.25rem",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#b91c1c";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#dc2626";
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Delete Account Section */}
      <div
        style={{
          backgroundColor: "#2c2c2c",
          border: "1px solid #3c3c3c",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
        <h3
          style={{
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
          }}
        >
          Delete account
        </h3>
        <p
          style={{
            color: "#fca5a5",
            fontSize: "0.875rem",
            marginBottom: "1rem",
            lineHeight: "1.6",
          }}
        >
          Deleting your account will permanently erase all your data, settings, and preferences from our system. This action is irreversible.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          style={{
            backgroundColor: "#7f1d1d",
            border: "1px solid #991b1b",
            borderRadius: "0.375rem",
            color: "#fef2f2",
            cursor: isDeleting ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
            padding: "0.625rem 1.25rem",
            transition: "background-color 0.2s, color 0.2s",
            opacity: isDeleting ? 0.65 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isDeleting) {
              e.currentTarget.style.backgroundColor = "#991b1b";
              e.currentTarget.style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            if (!isDeleting) {
              e.currentTarget.style.backgroundColor = "#7f1d1d";
              e.currentTarget.style.color = "#fef2f2";
            }
          }}
        >
          {isDeleting ? "Deleting..." : "Delete account"}
        </button>
      </div>
    </div>
  );
}
