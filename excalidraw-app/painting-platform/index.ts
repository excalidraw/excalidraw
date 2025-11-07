/**
 * Painting Platform - Collaborative painting features for Excalidraw
 *
 * Entry point for the painting platform module
 */

// Types
export type {
  UserId,
  RegionId,
  SessionId,
  CanvasRegion,
  PaintingUser,
  PaintingSession,
  PaintingSessionSettings,
  SessionResults,
  VoteData,
  AIJudgingScores,
  RegionClaimingState,
  CanvasPermissions,
  RegionClaimedEvent,
  RegionDrawEvent,
  AIPaintRequest,
  AIPaintResponse,
} from "./types";

// Core classes
export { RegionManager } from "./RegionManager";
export { SessionManager } from "./SessionManager";
export {
  PaintingPermissionHandler,
  createPermissionHandler,
} from "./PaintingPermissionHandler";

// React components
export { PaintingPlatform } from "./PaintingPlatform";
export { SessionPanel } from "./SessionPanel";
export { RegionOverlay } from "./RegionOverlay";
export {
  PaintingPlatformWrapper,
  togglePaintingPlatform,
  isPaintingPlatformEnabled,
} from "./PaintingPlatformWrapper";

// AI utilities (to be implemented)
export { AIAssistant } from "./AIAssistant";
