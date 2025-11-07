/**
 * SessionManager - Manages painting sessions and user participation
 */

import type {
  PaintingSession,
  PaintingUser,
  SessionId,
  UserId,
  PaintingSessionSettings,
  SessionResults,
} from "./types";
import { RegionManager } from "./RegionManager";

/**
 * Default session settings
 */
const DEFAULT_SETTINGS: PaintingSessionSettings = {
  maxParticipants: 6,
  timeLimitPerUser: null,
  regionMode: "freeform",
  preFillPercentage: 66, // 2/3 pre-filled as mentioned
  allowAI: true,
  enableVoting: true,
  matchingMode: "invite",
};

/**
 * Manages collaborative painting sessions
 */
export class SessionManager {
  private session: PaintingSession;
  private regionManager: RegionManager;
  private userTimeTracking: Map<UserId, number>; // Track time spent per user

  constructor(session: PaintingSession) {
    this.session = session;
    this.regionManager = new RegionManager(session);
    this.userTimeTracking = new Map();
  }

  /**
   * Create a new painting session
   */
  static createSession(
    hostUserId: UserId,
    name: string,
    type: PaintingSession["type"] = "collaborative",
    settings?: Partial<PaintingSessionSettings>,
  ): PaintingSession {
    const sessionId: SessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const hostUser: PaintingUser = {
      id: hostUserId,
      username: "Host",
      color: SessionManager.getRandomUserColor(),
      claimedRegions: [],
      isActive: true,
      lastActivity: Date.now(),
      aiAssistEnabled: false,
    };

    const session: PaintingSession = {
      id: sessionId,
      name,
      type,
      regions: [],
      users: {
        [hostUserId]: hostUser,
      },
      hostUserId,
      state: "setup",
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      settings: {
        ...DEFAULT_SETTINGS,
        ...settings,
      },
    };

    return session;
  }

  /**
   * Add a user to the session
   */
  addUser(
    userId: UserId,
    username: string,
    avatarUrl?: string,
  ): PaintingUser | null {
    // Check if session is full
    const currentUserCount = Object.keys(this.session.users).length;
    if (currentUserCount >= this.session.settings.maxParticipants) {
      return null;
    }

    // Check if user already exists
    if (this.session.users[userId]) {
      return this.session.users[userId];
    }

    const user: PaintingUser = {
      id: userId,
      username,
      color: SessionManager.getRandomUserColor(),
      avatarUrl,
      claimedRegions: [],
      isActive: true,
      lastActivity: Date.now(),
      aiAssistEnabled: false,
    };

    this.session.users[userId] = user;
    return user;
  }

  /**
   * Remove a user from the session
   */
  removeUser(userId: UserId): boolean {
    if (!this.session.users[userId]) {
      return false;
    }

    // Release all regions claimed by this user
    const user = this.session.users[userId];
    user.claimedRegions.forEach((regionId) => {
      this.regionManager.releaseRegion(regionId);
    });

    delete this.session.users[userId];
    return true;
  }

  /**
   * Start the session
   */
  startSession(): boolean {
    if (this.session.state !== "setup") {
      return false;
    }

    this.session.state = "active";
    this.session.startedAt = Date.now();

    return true;
  }

  /**
   * Complete the session
   */
  completeSession(): boolean {
    if (this.session.state !== "active") {
      return false;
    }

    this.session.state = "completed";
    this.session.completedAt = Date.now();

    // Lock all regions
    this.regionManager.getAllRegions().forEach((region) => {
      this.regionManager.lockRegion(region.id);
    });

    // If voting is enabled, move to judging state
    if (this.session.settings.enableVoting) {
      this.session.state = "judging";
      this.initializeResults();
    }

    return true;
  }

  /**
   * Initialize results structure for voting
   */
  private initializeResults(): void {
    this.session.results = {
      votes: {},
    };
  }

  /**
   * Submit a vote for the session
   */
  submitVote(
    voterId: UserId,
    rating: number,
    comment?: string,
    regionScores?: Record<string, number>,
  ): boolean {
    if (!this.session.results) {
      return false;
    }

    if (this.session.state !== "judging") {
      return false;
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return false;
    }

    this.session.results.votes[voterId] = {
      voterId,
      rating,
      comment,
      regionScores,
      timestamp: Date.now(),
    };

    return true;
  }

  /**
   * Calculate average rating from votes
   */
  getAverageRating(): number {
    if (!this.session.results || Object.keys(this.session.results.votes).length === 0) {
      return 0;
    }

    const ratings = Object.values(this.session.results.votes).map(
      (vote) => vote.rating,
    );
    const sum = ratings.reduce((acc, rating) => acc + rating, 0);

    return sum / ratings.length;
  }

  /**
   * Update user activity timestamp
   */
  updateUserActivity(userId: UserId): void {
    const user = this.session.users[userId];
    if (user) {
      user.lastActivity = Date.now();
      user.isActive = true;
    }
  }

  /**
   * Mark user as inactive
   */
  markUserInactive(userId: UserId): void {
    const user = this.session.users[userId];
    if (user) {
      user.isActive = false;
    }
  }

  /**
   * Toggle AI assistance for a user
   */
  toggleAIAssist(userId: UserId): boolean {
    const user = this.session.users[userId];
    if (!user) {
      return false;
    }

    if (!this.session.settings.allowAI) {
      return false;
    }

    user.aiAssistEnabled = !user.aiAssistEnabled;
    return user.aiAssistEnabled;
  }

  /**
   * Track time spent by user (in seconds)
   */
  trackUserTime(userId: UserId, seconds: number): void {
    const currentTime = this.userTimeTracking.get(userId) || 0;
    this.userTimeTracking.set(userId, currentTime + seconds);
  }

  /**
   * Get time spent by user
   */
  getUserTime(userId: UserId): number {
    return this.userTimeTracking.get(userId) || 0;
  }

  /**
   * Check if user has exceeded time limit
   */
  hasUserExceededTimeLimit(userId: UserId): boolean {
    const timeLimit = this.session.settings.timeLimitPerUser;
    if (timeLimit === null) {
      return false;
    }

    const timeSpent = this.getUserTime(userId);
    return timeSpent >= timeLimit;
  }

  /**
   * Get active users
   */
  getActiveUsers(): PaintingUser[] {
    return Object.values(this.session.users).filter((user) => user.isActive);
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      totalUsers: Object.keys(this.session.users).length,
      activeUsers: this.getActiveUsers().length,
      totalRegions: this.regionManager.getAllRegions().length,
      claimedRegions: this.regionManager
        .getAllRegions()
        .filter((r) => r.claimedBy !== null).length,
      completionPercentage: this.regionManager.getCompletionPercentage(),
      duration: this.session.startedAt
        ? Date.now() - this.session.startedAt
        : 0,
      averageRating: this.getAverageRating(),
    };
  }

  /**
   * Initialize canvas regions (called during setup)
   */
  initializeRegions(
    canvasWidth: number,
    canvasHeight: number,
    numRegions: number,
    style: "grid" | "organic" = "organic",
  ): void {
    if (style === "grid") {
      this.regionManager.generateRandomRegions(
        canvasWidth,
        canvasHeight,
        numRegions,
      );
    } else {
      this.regionManager.generateOrganicRegions(
        canvasWidth,
        canvasHeight,
        numRegions,
      );
    }
  }

  /**
   * Get the region manager
   */
  getRegionManager(): RegionManager {
    return this.regionManager;
  }

  /**
   * Get the session
   */
  getSession(): PaintingSession {
    return this.session;
  }

  /**
   * Update session settings
   */
  updateSettings(settings: Partial<PaintingSessionSettings>): boolean {
    // Only host can update settings
    if (this.session.state !== "setup") {
      return false;
    }

    this.session.settings = {
      ...this.session.settings,
      ...settings,
    };

    return true;
  }

  /**
   * Get a random color for user identification
   */
  private static getRandomUserColor(): string {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
      "#F8B739",
      "#52B788",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Archive the session
   */
  archiveSession(): boolean {
    if (
      this.session.state !== "completed" &&
      this.session.state !== "judging"
    ) {
      return false;
    }

    this.session.state = "archived";
    return true;
  }

  /**
   * Export session to JSON
   */
  exportSession(): string {
    return JSON.stringify(this.session, null, 2);
  }

  /**
   * Import session from JSON
   */
  static importSession(jsonData: string): PaintingSession {
    return JSON.parse(jsonData) as PaintingSession;
  }
}
