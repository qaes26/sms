import { SignalingMessage } from '@/lib/types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ISignalingBus {
  send(
    sessionId: string,
    sender: 'client' | 'admin',
    type: SignalingMessage['type'],
    payload: any
  ): Promise<SignalingMessage>;
  getMessages(
    sessionId: string,
    recipientRole: 'client' | 'admin',
    since?: number
  ): Promise<SignalingMessage[]>;
  clear(sessionId: string): Promise<void>;
}

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
      console.warn(`[Redis Signaling Error] ${command}: ${res.statusText}`);
      return null;
    }
    const json = await res.json();
    return json.result;
  } catch (err) {
    console.warn(`[Redis Signaling Exception] ${command}:`, err);
    return null;
  }
}

/**
 * Production-ready Redis Signaling Bus for Vercel Serverless.
 * Allows WebRTC signaling exchange across isolated serverless lambda containers.
 */
class RedisSignalingBus implements ISignalingBus {
  async send(
    sessionId: string,
    sender: 'client' | 'admin',
    type: SignalingMessage['type'],
    payload: any
  ): Promise<SignalingMessage> {
    const id = crypto.randomUUID();
    const message: SignalingMessage = {
      id,
      sessionId,
      sender,
      type,
      payload,
      timestamp: Date.now(),
    };

    const key = `signaling:${sessionId}`;
    await redisCommand('RPUSH', key, JSON.stringify(message));
    // Expire signaling data after 1 hour
    await redisCommand('EXPIRE', key, 3600);

    return message;
  }

  async getMessages(
    sessionId: string,
    recipientRole: 'client' | 'admin',
    since: number = 0
  ): Promise<SignalingMessage[]> {
    const key = `signaling:${sessionId}`;
    const rawList = (await redisCommand('LRANGE', key, 0, -1)) as string[] | null;
    if (!rawList || !Array.isArray(rawList)) return [];

    const messages: SignalingMessage[] = [];
    for (const item of rawList) {
      try {
        const msg: SignalingMessage = typeof item === 'string' ? JSON.parse(item) : item;
        if (msg.sender !== recipientRole && msg.timestamp > since) {
          messages.push(msg);
        }
      } catch {
        // ignore unparseable item
      }
    }

    return messages;
  }

  async clear(sessionId: string): Promise<void> {
    const key = `signaling:${sessionId}`;
    await redisCommand('DEL', key);
  }
}

/**
 * Local File-based persistent signaling store for development.
 */
class FileSignalingBus implements ISignalingBus {
  private getFilePath(): string {
    const dir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        return path.join('/tmp', 'sms_signaling.json');
      }
    }
    return path.join(dir, 'signaling.json');
  }

  private readAll(): Record<string, SignalingMessage[]> {
    const file = this.getFilePath();
    if (!fs.existsSync(file)) return {};
    try {
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private writeAll(data: Record<string, SignalingMessage[]>): void {
    const file = this.getFilePath();
    try {
      const tempFile = `${file}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempFile, file);
    } catch (err) {
      console.warn('[FileSignalingBus write error]', err);
    }
  }

  async send(
    sessionId: string,
    sender: 'client' | 'admin',
    type: SignalingMessage['type'],
    payload: any
  ): Promise<SignalingMessage> {
    const id = crypto.randomUUID();
    const message: SignalingMessage = {
      id,
      sessionId,
      sender,
      type,
      payload,
      timestamp: Date.now(),
    };

    const data = this.readAll();
    if (!data[sessionId]) {
      data[sessionId] = [];
    }
    data[sessionId].push(message);

    // Keep bounded history
    if (data[sessionId].length > 100) {
      data[sessionId].splice(0, data[sessionId].length - 100);
    }

    this.writeAll(data);
    return message;
  }

  async getMessages(
    sessionId: string,
    recipientRole: 'client' | 'admin',
    since: number = 0
  ): Promise<SignalingMessage[]> {
    const data = this.readAll();
    const list = data[sessionId] || [];
    return list.filter((msg) => msg.sender !== recipientRole && msg.timestamp > since);
  }

  async clear(sessionId: string): Promise<void> {
    const data = this.readAll();
    delete data[sessionId];
    this.writeAll(data);
  }
}

const redisBus = new RedisSignalingBus();
const fileBus = new FileSignalingBus();

export class SignalingBus {
  private static getBus(): ISignalingBus {
    if (getRedisConfig()) {
      return redisBus;
    }
    return fileBus;
  }

  static async send(
    sessionId: string,
    sender: 'client' | 'admin',
    type: SignalingMessage['type'],
    payload: any
  ): Promise<SignalingMessage> {
    return this.getBus().send(sessionId, sender, type, payload);
  }

  static async getMessages(
    sessionId: string,
    recipientRole: 'client' | 'admin',
    since: number = 0
  ): Promise<SignalingMessage[]> {
    return this.getBus().getMessages(sessionId, recipientRole, since);
  }

  static async clear(sessionId: string): Promise<void> {
    return this.getBus().clear(sessionId);
  }
}
