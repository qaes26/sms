import { UserSession } from '@/lib/types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ISessionStore {
  create(phoneNumber: string, maskedPhoneNumber: string): Promise<UserSession>;
  get(id: string): Promise<UserSession | null>;
  update(id: string, updates: Partial<Pick<UserSession, 'status' | 'streamStatus'>>): Promise<UserSession | null>;
  heartbeat(id: string): Promise<boolean>;
  end(id: string): Promise<boolean>;
  getActiveSessions(): Promise<UserSession[]>;
}

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Upstash / Vercel KV REST helpers
function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/$/, ''), token };
  }
  return null;
}

async function redisCommand(command: string, ...args: (string | number)[]) {
  const config = getRedisConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`[Redis REST Error] ${command}: ${res.statusText}`);
      return null;
    }
    const json = await res.json();
    return json.result;
  } catch (err) {
    console.warn(`[Redis Network Exception] ${command}:`, err);
    return null;
  }
}

/**
 * Production-ready Redis Session Store for Vercel Serverless.
 */
class RedisSessionStore implements ISessionStore {
  async create(phoneNumber: string, maskedPhoneNumber: string): Promise<UserSession> {
    const id = crypto.randomBytes(16).toString('hex');
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

    // Store session object with 2 hour TTL
    await redisCommand('SET', `session:${id}`, JSON.stringify(session), 'EX', 7200);
    // Add to active set
    await redisCommand('SADD', 'active_sessions', id);

    return session;
  }

  async get(id: string): Promise<UserSession | null> {
    const raw = await redisCommand('GET', `session:${id}`);
    if (!raw) return null;

    try {
      const session: UserSession = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const now = Date.now();
      if (session.status === 'active' && now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        session.status = 'ended';
        session.streamStatus = 'stopped';
        session.endedAt = now;
        await redisCommand('SET', `session:${id}`, JSON.stringify(session), 'EX', 7200);
        await redisCommand('SREM', 'active_sessions', id);
      }
      return session;
    } catch {
      return null;
    }
  }

  async update(id: string, updates: Partial<Pick<UserSession, 'status' | 'streamStatus'>>): Promise<UserSession | null> {
    const session = await this.get(id);
    if (!session) return null;

    if (updates.status !== undefined) session.status = updates.status;
    if (updates.streamStatus !== undefined) session.streamStatus = updates.streamStatus;
    session.lastHeartbeat = Date.now();

    if (updates.status === 'ended') {
      session.endedAt = Date.now();
      await redisCommand('SREM', 'active_sessions', id);
    }

    await redisCommand('SET', `session:${id}`, JSON.stringify(session), 'EX', 7200);
    return session;
  }

  async heartbeat(id: string): Promise<boolean> {
    const session = await this.get(id);
    if (!session || session.status !== 'active') return false;

    session.lastHeartbeat = Date.now();
    await redisCommand('SET', `session:${id}`, JSON.stringify(session), 'EX', 7200);
    return true;
  }

  async end(id: string): Promise<boolean> {
    const session = await this.get(id);
    if (!session) return false;

    session.status = 'ended';
    session.streamStatus = 'stopped';
    session.endedAt = Date.now();

    await redisCommand('SET', `session:${id}`, JSON.stringify(session), 'EX', 7200);
    await redisCommand('SREM', 'active_sessions', id);
    return true;
  }

  async getActiveSessions(): Promise<UserSession[]> {
    const sessionIds = (await redisCommand('SMEMBERS', 'active_sessions')) as string[] | null;
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return [];
    }

    const sessions: UserSession[] = [];
    const now = Date.now();

    for (const id of sessionIds) {
      const session = await this.get(id);
      if (session && session.status === 'active') {
        if (now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          session.status = 'ended';
          session.streamStatus = 'stopped';
          session.endedAt = now;
          await redisCommand('SET', `session:${id}`, JSON.stringify(session), 'EX', 7200);
          await redisCommand('SREM', 'active_sessions', id);
        } else {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  }
}

/**
 * Local File-based persistent session store for development.
 * Uses atomic JSON read/write to disk to survive server restarts.
 */
class FileSessionStore implements ISessionStore {
  private getFilePath(): string {
    const dir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        return path.join('/tmp', 'sms_sessions.json');
      }
    }
    return path.join(dir, 'sessions.json');
  }

  private readAll(): Map<string, UserSession> {
    const file = this.getFilePath();
    if (!fs.existsSync(file)) return new Map();
    try {
      const content = fs.readFileSync(file, 'utf8');
      const obj = JSON.parse(content);
      return new Map(Object.entries(obj));
    } catch {
      return new Map();
    }
  }

  private writeAll(map: Map<string, UserSession>): void {
    const file = this.getFilePath();
    try {
      const obj = Object.fromEntries(map.entries());
      const tempFile = `${file}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(obj, null, 2), 'utf8');
      fs.renameSync(tempFile, file);
    } catch (err) {
      console.warn('[FileSessionStore write error]', err);
    }
  }

  async create(phoneNumber: string, maskedPhoneNumber: string): Promise<UserSession> {
    const id = crypto.randomBytes(16).toString('hex');
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

    const map = this.readAll();
    map.set(id, session);
    this.writeAll(map);
    return session;
  }

  async get(id: string): Promise<UserSession | null> {
    const map = this.readAll();
    const session = map.get(id);
    if (!session) return null;

    const now = Date.now();
    if (session.status === 'active' && now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      session.status = 'ended';
      session.streamStatus = 'stopped';
      session.endedAt = now;
      map.set(id, session);
      this.writeAll(map);
    }

    return session;
  }

  async update(id: string, updates: Partial<Pick<UserSession, 'status' | 'streamStatus'>>): Promise<UserSession | null> {
    const map = this.readAll();
    const session = map.get(id);
    if (!session) return null;

    if (updates.status !== undefined) session.status = updates.status;
    if (updates.streamStatus !== undefined) session.streamStatus = updates.streamStatus;
    session.lastHeartbeat = Date.now();

    if (updates.status === 'ended') {
      session.endedAt = Date.now();
    }

    map.set(id, session);
    this.writeAll(map);
    return session;
  }

  async heartbeat(id: string): Promise<boolean> {
    const map = this.readAll();
    const session = map.get(id);
    if (!session || session.status !== 'active') return false;

    session.lastHeartbeat = Date.now();
    map.set(id, session);
    this.writeAll(map);
    return true;
  }

  async end(id: string): Promise<boolean> {
    const map = this.readAll();
    const session = map.get(id);
    if (!session) return false;

    session.status = 'ended';
    session.streamStatus = 'stopped';
    session.endedAt = Date.now();

    map.set(id, session);
    this.writeAll(map);
    return true;
  }

  async getActiveSessions(): Promise<UserSession[]> {
    const map = this.readAll();
    const now = Date.now();
    const activeList: UserSession[] = [];
    let updated = false;

    for (const [id, session] of map.entries()) {
      if (session.status === 'active') {
        if (now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          session.status = 'ended';
          session.streamStatus = 'stopped';
          session.endedAt = now;
          map.set(id, session);
          updated = true;
        } else {
          activeList.push(session);
        }
      }
    }

    if (updated) {
      this.writeAll(map);
    }

    return activeList.sort((a, b) => b.createdAt - a.createdAt);
  }
}

// Export singleton dispatcher based on environment
const redisStore = new RedisSessionStore();
const fileStore = new FileSessionStore();

export class SessionStore {
  private static getStore(): ISessionStore {
    if (getRedisConfig()) {
      return redisStore;
    }
    return fileStore;
  }

  static async create(phoneNumber: string, maskedPhoneNumber: string): Promise<UserSession> {
    return this.getStore().create(phoneNumber, maskedPhoneNumber);
  }

  static async get(id: string): Promise<UserSession | null> {
    return this.getStore().get(id);
  }

  static async update(id: string, updates: Partial<Pick<UserSession, 'status' | 'streamStatus'>>): Promise<UserSession | null> {
    return this.getStore().update(id, updates);
  }

  static async heartbeat(id: string): Promise<boolean> {
    return this.getStore().heartbeat(id);
  }

  static async end(id: string): Promise<boolean> {
    return this.getStore().end(id);
  }

  static async getActiveSessions(): Promise<UserSession[]> {
    return this.getStore().getActiveSessions();
  }
}
