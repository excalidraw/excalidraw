/**
 * Google Drive menu button component.
 * Shows sign in/sign out and save/open options.
 */

import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useCallback, useEffect, useState } from "react";

import {
  initGoogleDrive,
  isGoogleDriveEnabled,
  isSignedIn,
  signIn,
  signOut,
  setAuthStateCallback,
  getCurrentUserEmail,
} from "../../data/google-drive";

import { GoogleDriveIcon } from "./GoogleDriveIcon";

import "./GoogleDrive.scss";

interface GoogleDriveButtonProps {
  onOpenFromDrive: () => void;
  onSaveToDrive: () => void;
}

export const GoogleDriveButton: React.FC<GoogleDriveButtonProps> = ({
  onOpenFromDrive,
  onSaveToDrive,
}) => {
  const { t } = useI18n();
  const [isEnabled, setIsEnabled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (isGoogleDriveEnabled()) {
        setIsEnabled(true);
        await initGoogleDrive();
        setIsInitialized(true);
        setSignedIn(isSignedIn());
      }
    };

    init();

    // Set up auth state callback
    setAuthStateCallback(async (isSignedIn) => {
      setSignedIn(isSignedIn);
      if (isSignedIn) {
        const email = await getCurrentUserEmail();
        setUserEmail(email);
      } else {
        setUserEmail(null);
      }
    });
  }, []);

  const handleSignIn = useCallback(async () => {
    await signIn();
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
  }, []);

  if (!isEnabled) {
    return null;
  }

  if (!isInitialized) {
    return (
      <div className="google-drive-button google-drive-button--loading">
        <GoogleDriveIcon />
        <span>Loading...</span>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="google-drive-button">
        <FilledButton
          size="large"
          label="Sign in to Google Drive"
          icon={<GoogleDriveIcon />}
          onClick={handleSignIn}
        />
      </div>
    );
  }

  return (
    <div className="google-drive-menu">
      <div className="google-drive-menu__header">
        <GoogleDriveIcon />
        <div className="google-drive-menu__user">
          <span className="google-drive-menu__label">Google Drive</span>
          {userEmail && (
            <span className="google-drive-menu__email">{userEmail}</span>
          )}
        </div>
      </div>

      <div className="google-drive-menu__actions">
        <FilledButton
          size="large"
          variant="outlined"
          label="Open from Drive"
          onClick={onOpenFromDrive}
        />
        <FilledButton
          size="large"
          label="Save to Drive"
          onClick={onSaveToDrive}
        />
      </div>

      <button
        className="google-drive-menu__signout"
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </div>
  );
};
