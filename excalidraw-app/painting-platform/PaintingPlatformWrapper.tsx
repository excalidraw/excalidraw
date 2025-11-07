/**
 * PaintingPlatformWrapper - Integration wrapper for painting platform
 *
 * Handles enabling/disabling the painting platform feature
 */

import React, { useState, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { PaintingPlatform } from "./PaintingPlatform";
import type { PaintingSession } from "./types";
import { SessionManager } from "./SessionManager";

interface PaintingPlatformWrapperProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

/**
 * Wrapper component that conditionally renders the painting platform
 */
export const PaintingPlatformWrapper: React.FC<
  PaintingPlatformWrapperProps
> = ({ excalidrawAPI }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUsername, setCurrentUsername] = useState<string>("User");

  // Check if painting mode is enabled via URL parameter or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paintingMode = params.get("paintingMode");
    const localStorageEnabled = localStorage.getItem("paintingPlatformEnabled");

    if (paintingMode === "true" || localStorageEnabled === "true") {
      setIsEnabled(true);
    }
  }, []);

  // Generate or retrieve user ID
  useEffect(() => {
    let userId = localStorage.getItem("paintingPlatformUserId");
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("paintingPlatformUserId", userId);
    }
    setCurrentUserId(userId);

    // Try to get username from localStorage or generate one
    let username = localStorage.getItem("paintingPlatformUsername");
    if (!username) {
      username = `Artist ${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem("paintingPlatformUsername", username);
    }
    setCurrentUsername(username);
  }, []);

  const handleSessionChange = (session: PaintingSession) => {
    // Save session to localStorage for persistence
    try {
      localStorage.setItem(
        "paintingPlatformSession",
        JSON.stringify(session),
      );
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  // Don't render if not enabled or if userId not yet initialized
  if (!isEnabled || !currentUserId) {
    return null;
  }

  return (
    <PaintingPlatform
      excalidrawAPI={excalidrawAPI}
      currentUserId={currentUserId}
      currentUsername={currentUsername}
      onSessionChange={handleSessionChange}
    />
  );
};

/**
 * Toggle painting platform mode
 */
export function togglePaintingPlatform(enabled: boolean): void {
  localStorage.setItem("paintingPlatformEnabled", enabled.toString());
  window.location.reload();
}

/**
 * Check if painting platform is enabled
 */
export function isPaintingPlatformEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const paintingMode = params.get("paintingMode");
  const localStorageEnabled = localStorage.getItem("paintingPlatformEnabled");

  return paintingMode === "true" || localStorageEnabled === "true";
}

export default PaintingPlatformWrapper;
