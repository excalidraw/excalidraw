/**
 * SessionPanel - UI for managing painting sessions
 */

import React, { useState } from "react";
import type { PaintingSession, PaintingUser, CanvasRegion, UserId } from "./types";
import "./SessionPanel.scss";

interface SessionPanelProps {
  session: PaintingSession;
  currentUserId: UserId;
  onClaimRegion: (regionId: string) => void;
  onReleaseRegion: (regionId: string) => void;
  onStartSession: () => void;
  onCompleteSession: () => void;
  onToggleAI: () => void;
  onInitializeRegions: (numRegions: number, style: "grid" | "organic") => void;
}

export const SessionPanel: React.FC<SessionPanelProps> = ({
  session,
  currentUserId,
  onClaimRegion,
  onReleaseRegion,
  onStartSession,
  onCompleteSession,
  onToggleAI,
  onInitializeRegions,
}) => {
  const [numRegions, setNumRegions] = useState(6);
  const [regionStyle, setRegionStyle] = useState<"grid" | "organic">("organic");

  const currentUser = session.users[currentUserId];
  const isHost = currentUserId === session.hostUserId;

  const unclaimedRegions = session.regions.filter((r) => !r.claimedBy && !r.locked);
  const userRegions = session.regions.filter((r) => r.claimedBy === currentUserId);

  const getSessionStateLabel = (): string => {
    switch (session.state) {
      case "setup":
        return "Setting Up";
      case "active":
        return "In Progress";
      case "completed":
        return "Completed";
      case "judging":
        return "Judging";
      case "archived":
        return "Archived";
      default:
        return session.state;
    }
  };

  const getSessionStateColor = (): string => {
    switch (session.state) {
      case "setup":
        return "#94a3b8";
      case "active":
        return "#22c55e";
      case "completed":
        return "#3b82f6";
      case "judging":
        return "#a855f7";
      case "archived":
        return "#64748b";
      default:
        return "#94a3b8";
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="session-panel">
      {/* Session Header */}
      <div className="session-panel__header">
        <h2 className="session-panel__title">{session.name}</h2>
        <div
          className="session-panel__status"
          style={{ backgroundColor: getSessionStateColor() }}
        >
          {getSessionStateLabel()}
        </div>
      </div>

      {/* Session Info */}
      <div className="session-panel__info">
        <div className="session-panel__info-item">
          <span className="label">Type:</span>
          <span className="value">{session.type}</span>
        </div>
        <div className="session-panel__info-item">
          <span className="label">Participants:</span>
          <span className="value">
            {Object.keys(session.users).length} / {session.settings.maxParticipants}
          </span>
        </div>
        {session.startedAt && (
          <div className="session-panel__info-item">
            <span className="label">Started:</span>
            <span className="value">{formatTime(session.startedAt)}</span>
          </div>
        )}
      </div>

      {/* Setup Phase */}
      {session.state === "setup" && isHost && (
        <div className="session-panel__setup">
          <h3>Setup Session</h3>
          <div className="session-panel__setup-controls">
            <div className="form-group">
              <label>Number of Regions:</label>
              <input
                type="number"
                min="2"
                max="20"
                value={numRegions}
                onChange={(e) => setNumRegions(parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Region Style:</label>
              <select
                value={regionStyle}
                onChange={(e) =>
                  setRegionStyle(e.target.value as "grid" | "organic")
                }
              >
                <option value="organic">Organic</option>
                <option value="grid">Grid</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => onInitializeRegions(numRegions, regionStyle)}
            >
              Generate Regions
            </button>
          </div>

          {session.regions.length > 0 && (
            <button
              className="btn btn-success btn-large"
              onClick={onStartSession}
            >
              Start Session
            </button>
          )}
        </div>
      )}

      {/* Participants List */}
      <div className="session-panel__section">
        <h3>Participants</h3>
        <div className="session-panel__users">
          {Object.values(session.users).map((user) => (
            <div key={user.id} className="user-card">
              <div
                className="user-card__avatar"
                style={{ backgroundColor: user.color }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-card__info">
                <div className="user-card__name">
                  {user.username}
                  {user.id === session.hostUserId && (
                    <span className="badge">Host</span>
                  )}
                  {user.id === currentUserId && (
                    <span className="badge badge-primary">You</span>
                  )}
                </div>
                <div className="user-card__stats">
                  {user.claimedRegions.length} region(s)
                  {user.aiAssistEnabled && " • AI enabled"}
                </div>
              </div>
              <div
                className={`user-card__status ${user.isActive ? "active" : "inactive"}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Your Regions */}
      {session.state === "active" && (
        <div className="session-panel__section">
          <h3>Your Regions ({userRegions.length})</h3>
          <div className="session-panel__regions">
            {userRegions.map((region) => (
              <div key={region.id} className="region-card">
                <div className="region-card__info">
                  <span className="region-card__id">
                    {region.id.substring(0, 8)}...
                  </span>
                  {region.locked && <span className="badge">Locked</span>}
                </div>
                {!region.locked && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onReleaseRegion(region.id)}
                  >
                    Release
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Regions */}
      {session.state === "active" && unclaimedRegions.length > 0 && (
        <div className="session-panel__section">
          <h3>Available Regions ({unclaimedRegions.length})</h3>
          <div className="session-panel__regions">
            {unclaimedRegions.slice(0, 5).map((region) => (
              <div key={region.id} className="region-card">
                <span className="region-card__id">
                  {region.id.substring(0, 8)}...
                </span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onClaimRegion(region.id)}
                >
                  Claim
                </button>
              </div>
            ))}
            {unclaimedRegions.length > 5 && (
              <div className="region-card__more">
                +{unclaimedRegions.length - 5} more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Assistant */}
      {session.state === "active" && session.settings.allowAI && (
        <div className="session-panel__section">
          <h3>AI Assistant</h3>
          <button
            className={`btn btn-large ${currentUser?.aiAssistEnabled ? "btn-warning" : "btn-secondary"}`}
            onClick={onToggleAI}
          >
            {currentUser?.aiAssistEnabled ? "Disable AI" : "Enable AI"}
          </button>
          {currentUser?.aiAssistEnabled && (
            <p className="session-panel__hint">
              AI will help complete your regions. Click on a claimed region to get
              suggestions.
            </p>
          )}
        </div>
      )}

      {/* Session Controls */}
      {session.state === "active" && isHost && (
        <div className="session-panel__section">
          <h3>Session Controls</h3>
          <button
            className="btn btn-success btn-large"
            onClick={onCompleteSession}
          >
            Complete Session
          </button>
        </div>
      )}

      {/* Session Stats */}
      {(session.state === "completed" || session.state === "judging") && (
        <div className="session-panel__section">
          <h3>Session Stats</h3>
          <div className="session-panel__stats">
            <div className="stat-card">
              <div className="stat-card__value">
                {formatDuration(
                  session.completedAt! - session.startedAt!,
                )}
              </div>
              <div className="stat-card__label">Duration</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">
                {session.regions.filter((r) => r.claimedBy).length}
              </div>
              <div className="stat-card__label">Completed Regions</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">
                {Object.keys(session.users).length}
              </div>
              <div className="stat-card__label">Contributors</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionPanel;
