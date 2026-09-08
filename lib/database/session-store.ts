import { UserSession, SessionStatus, StreamStatus } from '@/lib/types';
import crypto from 'crypto';

/**
 * In-memory thread-safe global session store.
 * Attached to globalThis in Next.js dev to preserve sessions across HMR reloads.
 */
declare global {
  // eslint-disable-next-line no-var
  var __appSessionStore: Map<string, UserSession> | undefined;
}

const sessions: Map<string, UserSession> =
  globalThis.__appSessionStore || (globalThis.__appSessionStore = new Map());

// Heartbeat timeout threshold in milliseconds (e.g. 25 seconds)
const HEARTBEAT_TIMEOUT_MS = 25 * 1000;

export class SessionStore {
  /**
   * Generates a cryptographically random, unpredictable session ID.
   */
  static generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Creates a new user session upon SMS initiation.
   */
  static create(phoneNumber: string, maskedPhoneNumber: string): UserSession {
    const id = this.generateId();
    const now = Date.now();
    const session: UserSession = {
      id,
      phoneNumber,
      maskedPhoneNumber,
      createdAt: now,
      status: 'active',
      streamStatus: 'idle',
      lastHeartbeat: now,
    };

    sessions.set(id, session);
    return session;
  }

  /**
   * Retrieves a session by ID.
   */
  static get(id: string): UserSession | null {
    const session = sessions.get(id);
    if (!session) return null;

    // Check if stale (no heartbeat for over timeout and stream was active)
    const now = Date.now();
    if (session.status === 'active' && now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      session.status = 'ended';
      session.streamStatus = 'stopped';
      session.endedAt = now;
    }

    return session;
  }

  /**
   * Updates session properties (status, streamStatus).
   */
  static update(id: string, updates: Partial<Pick<UserSession, 'status' | 'streamStatus'>>): UserSession | null {
    const session = sessions.get(id);
    if (!session) return null;

    if (updates.status !== undefined) session.status = updates.status;
    if (updates.streamStatus !== undefined) session.streamStatus = updates.streamStatus;
    session.lastHeartbeat = Date.now();

    if (updates.status === 'ended' && !session.endedAt) {
      session.endedAt = Date.now();
    }

    return session;
  }

  /**
   * Updates heartbeat timestamp from client or admin.
   */
  static heartbeat(id: string): boolean {
    const session = sessions.get(id);
    if (!session || session.status !== 'active') return false;
    session.lastHeartbeat = Date.now();
    return true;
  }

  /**
   * Explicitly marks a session as ended.
   */
  static end(id: string): boolean {
    const session = sessions.get(id);
    if (!session) return false;
    session.status = 'ended';
    session.streamStatus = 'stopped';
    session.endedAt = Date.now();
    return true;
  }

  /**
   * Returns all currently active sessions for the Admin dashboard.
   * Auto-prunes stale sessions that haven't sent a heartbeat within the threshold.
   */
  static getActiveSessions(): UserSession[] {
    const now = Date.now();
    const activeList: UserSession[] = [];

    for (const session of Array.from(sessions.values())) {
      if (session.status === 'active') {
        if (now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          // Client disconnected or closed tab
          session.status = 'ended';
          session.streamStatus = 'stopped';
          session.endedAt = now;
        } else {
          activeList.push(session);
        }
      }
    }

    // Sort by most recent creation first
    return activeList.sort((a, b) => b.createdAt - a.createdAt);
  }
}
