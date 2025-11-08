/**
 * Collaborative Painting Platform Types
 *
 * Defines data structures for multi-user collaborative painting sessions
 * where users claim and paint specific regions of a canvas.
 */

export type UserId = string;
export type RegionId = string;
export type SessionId = string;

/**
 * Represents a geometric region on the canvas that can be claimed by a user.
 * Regions are defined as polygons with arbitrary shapes.
 */
export interface CanvasRegion {
  id: RegionId;
  /** Polygon points defining the region boundary (relative to canvas coordinates) */
  points: Array<{ x: number; y: number }>;
  /** User who claimed this region, null if unclaimed */
  claimedBy: UserId | null;
  /** Timestamp when region was claimed */
  claimedAt: number | null;
  /** Whether this region is locked (completed/frozen) */
  locked: boolean;
  /** Optional styling for region visualization */
  style?: {
    fillColor?: string;
    strokeColor?: string;
    opacity?: number;
  };
}

/**
 * User participant in a painting session
 */
export interface PaintingUser {
  id: UserId;
  username: string;
  color: string; // User's assigned color for UI elements
  avatarUrl?: string;
  /** Regions claimed by this user */
  claimedRegions: RegionId[];
  /** Whether user is actively painting */
  isActive: boolean;
  /** Timestamp of last activity */
  lastActivity: number;
  /** AI assistance enabled for this user */
  aiAssistEnabled: boolean;
}

/**
 * Collaborative painting session configuration
 */
export interface PaintingSession {
  id: SessionId;
  /** Session name/title */
  name: string;
  /** Session type: collaborative, contest, or freeform */
  type: "collaborative" | "contest" | "freeform";
  /** All regions in this session */
  regions: CanvasRegion[];
  /** Participating users */
  users: Record<UserId, PaintingUser>;
  /** Session creator/host */
  hostUserId: UserId;
  /** Session state */
  state: "setup" | "active" | "completed" | "judging" | "archived";
  /** Timestamp when session was created */
  createdAt: number;
  /** Timestamp when session started */
  startedAt: number | null;
  /** Timestamp when session completed */
  completedAt: number | null;
  /** Session settings */
  settings: PaintingSessionSettings;
  /** Initial canvas state (pre-filled portion) */
  initialElements?: string; // Serialized excalidraw elements
  /** Voting/judging results if applicable */
  results?: SessionResults;
}

/**
 * Session configuration settings
 */
export interface PaintingSessionSettings {
  /** Maximum number of participants */
  maxParticipants: number;
  /** Time limit per user (in seconds, null for unlimited) */
  timeLimitPerUser: number | null;
  /** Whether regions are pre-defined or users can draw their own */
  regionMode: "predefined" | "freeform";
  /** Percentage of canvas that should be pre-filled (0-100) */
  preFillPercentage: number;
  /** Allow AI assistance */
  allowAI: boolean;
  /** Enable voting/gallery after completion */
  enableVoting: boolean;
  /** Random matching vs invite-only */
  matchingMode: "random" | "invite";
}

/**
 * Results and voting for completed sessions
 */
export interface SessionResults {
  /** Votes by user */
  votes: Record<UserId, VoteData>;
  /** AI judge scores if enabled */
  aiScores?: AIJudgingScores;
  /** Final composite image/snapshot */
  finalSnapshot?: string; // Data URL
  /** NFT minting data if applicable */
  nftData?: {
    tokenId?: string;
    contractAddress?: string;
    mintedAt?: number;
  };
}

/**
 * User's vote on a completed painting
 */
export interface VoteData {
  voterId: UserId;
  /** Overall rating (1-5) */
  rating: number;
  /** Optional comment */
  comment?: string;
  /** Individual region scores */
  regionScores?: Record<RegionId, number>;
  timestamp: number;
}

/**
 * AI judging scores for different criteria
 */
export interface AIJudgingScores {
  /** Overall composition score (0-100) */
  composition: number;
  /** Color harmony score (0-100) */
  colorHarmony: number;
  /** Technical execution score (0-100) */
  technique: number;
  /** Creativity score (0-100) */
  creativity: number;
  /** How well regions blend together (0-100) */
  cohesion: number;
  /** AI-generated commentary */
  commentary: string;
  /** Timestamp of analysis */
  analyzedAt: number;
}

/**
 * State for region claiming UI
 */
export interface RegionClaimingState {
  /** Region being drawn/selected */
  activeRegion: CanvasRegion | null;
  /** Available regions to claim */
  availableRegions: CanvasRegion[];
  /** Whether user is in region selection mode */
  isSelectingRegion: boolean;
  /** Preview of region being drawn */
  regionPreview: Array<{ x: number; y: number }> | null;
}

/**
 * Canvas interaction permissions based on region ownership
 */
export interface CanvasPermissions {
  /** User ID these permissions apply to */
  userId: UserId;
  /** Regions this user can draw in */
  writableRegions: RegionId[];
  /** Whether user can view all regions */
  canViewAll: boolean;
  /** Whether user can claim new regions */
  canClaimRegions: boolean;
  /** Whether user can modify session settings */
  canModifySession: boolean;
}

/**
 * Event emitted when region is claimed
 */
export interface RegionClaimedEvent {
  regionId: RegionId;
  userId: UserId;
  timestamp: number;
  sessionId: SessionId;
}

/**
 * Event emitted when drawing occurs in a region
 */
export interface RegionDrawEvent {
  regionId: RegionId;
  userId: UserId;
  elementIds: string[]; // Excalidraw element IDs
  timestamp: number;
}

/**
 * AI painting assistance request
 */
export interface AIPaintRequest {
  userId: UserId;
  regionId: RegionId;
  /** Type of assistance */
  assistType: "complete" | "suggest" | "enhance";
  /** Style preferences */
  styleHints?: {
    style?: string; // e.g., "abstract", "realistic", "impressionist"
    colorPalette?: string[];
    subject?: string;
  };
  /** Context from surrounding regions */
  contextElements?: string; // Serialized elements from adjacent regions
}

/**
 * AI painting assistance response
 */
export interface AIPaintResponse {
  requestId: string;
  /** Generated elements to add to canvas */
  elements: string; // Serialized excalidraw elements
  /** Confidence score (0-100) */
  confidence: number;
  /** Explanation of what was generated */
  explanation?: string;
  timestamp: number;
}
