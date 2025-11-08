/**
 * PaintingPlatform - Main integration component for collaborative painting
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

import { SessionManager } from "./SessionManager";
import { SessionPanel } from "./SessionPanel";
import { RegionOverlay } from "./RegionOverlay";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { PaintingSession, UserId } from "./types";

import "./PaintingPlatform.scss";

interface PaintingPlatformProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  currentUserId: UserId;
  currentUsername: string;
  initialSession?: PaintingSession;
  onSessionChange?: (session: PaintingSession) => void;
}

export const PaintingPlatform: React.FC<PaintingPlatformProps> = ({
  excalidrawAPI,
  currentUserId,
  currentUsername,
  initialSession,
  onSessionChange,
}) => {
  const [sessionManager, setSessionManager] = useState<SessionManager | null>(
    null,
  );
  const [session, setSession] = useState<PaintingSession | null>(
    initialSession || null,
  );
  const [showPanel, setShowPanel] = useState(false); // Hide panel by default
  const [canvasSize, setCanvasSize] = useState({ width: 1920, height: 1080 });

  const updateInterval = useRef<NodeJS.Timeout>();

  // Initialize session with 3 equal regions automatically
  useEffect(() => {
    if (!session) {
      // Create a new session
      const newSession = SessionManager.createSession(
        currentUserId,
        "3-User Painting",
        "collaborative",
      );

      // Add current user
      const manager = new SessionManager(newSession);
      manager.addUser(currentUserId, currentUsername);

      // Auto-generate 3 equal regions
      const regionManager = manager.getRegionManager();
      regionManager.generateThreeEqualRegions(canvasSize.width, canvasSize.height);

      // Auto-start the session
      manager.startSession();

      setSession(manager.getSession());
      setSessionManager(manager);
    } else {
      const manager = new SessionManager(session);
      setSessionManager(manager);
    }
  }, [currentUserId, currentUsername]);

  // Notify parent of session changes
  useEffect(() => {
    if (session && onSessionChange) {
      onSessionChange(session);
    }
  }, [session, onSessionChange]);

  // Auto-update session state
  useEffect(() => {
    if (sessionManager && session?.state === "active") {
      updateInterval.current = setInterval(() => {
        sessionManager.updateUserActivity(currentUserId);
        setSession({ ...sessionManager.getSession() });
      }, 5000);

      return () => {
        if (updateInterval.current) {
          clearInterval(updateInterval.current);
        }
      };
    }
  }, [sessionManager, session?.state, currentUserId]);

  const handleInitializeRegions = useCallback(
    (numRegions: number, style: "grid" | "organic") => {
      if (!sessionManager) return;

      sessionManager.initializeRegions(
        canvasSize.width,
        canvasSize.height,
        numRegions,
        style,
      );

      setSession({ ...sessionManager.getSession() });
    },
    [sessionManager, canvasSize],
  );

  const handleStartSession = useCallback(() => {
    if (!sessionManager) return;

    sessionManager.startSession();
    setSession({ ...sessionManager.getSession() });
  }, [sessionManager]);

  const handleCompleteSession = useCallback(() => {
    if (!sessionManager) return;

    sessionManager.completeSession();
    setSession({ ...sessionManager.getSession() });
  }, [sessionManager]);

  const handleClaimRegion = useCallback(
    (regionId: string) => {
      if (!sessionManager) return;

      const regionManager = sessionManager.getRegionManager();
      const claimed = regionManager.claimRegion(regionId, currentUserId);

      if (claimed) {
        setSession({ ...sessionManager.getSession() });
      }
    },
    [sessionManager, currentUserId],
  );

  const handleReleaseRegion = useCallback(
    (regionId: string) => {
      if (!sessionManager) return;

      const regionManager = sessionManager.getRegionManager();
      regionManager.releaseRegion(regionId);

      setSession({ ...sessionManager.getSession() });
    },
    [sessionManager],
  );

  const handleToggleAI = useCallback(() => {
    if (!sessionManager) return;

    sessionManager.toggleAIAssist(currentUserId);
    setSession({ ...sessionManager.getSession() });
  }, [sessionManager, currentUserId]);

  const handleRegionClick = useCallback(
    (regionId: string) => {
      if (!sessionManager) return;

      const regionManager = sessionManager.getRegionManager();
      const region = regionManager.getRegion(regionId);

      if (!region) return;

      // If unclaimed and session is active, claim it
      if (!region.claimedBy && session?.state === "active") {
        handleClaimRegion(regionId);
      }
    },
    [sessionManager, session?.state, handleClaimRegion],
  );

  // Get canvas viewport info from Excalidraw
  const getCanvasViewport = useCallback(() => {
    if (!excalidrawAPI) {
      return { zoom: 1, scrollX: 0, scrollY: 0 };
    }

    const appState = excalidrawAPI.getAppState();
    return {
      zoom: appState.zoom.value,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
    };
  }, [excalidrawAPI]);

  const viewport = getCanvasViewport();

  if (!session || !sessionManager) {
    return (
      <div className="painting-platform">
        <div className="painting-platform__loading">
          <div className="spinner" />
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="painting-platform painting-platform--minimal">
      {/* Region Overlay - Only visible component */}
      <RegionOverlay
        regions={session.regions}
        users={session.users}
        currentUserId={currentUserId}
        zoom={viewport.zoom}
        scrollX={viewport.scrollX}
        scrollY={viewport.scrollY}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
        onRegionClick={handleRegionClick}
        showLabels={false}
      />
    </div>
  );
};

export default PaintingPlatform;
