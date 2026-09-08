import { SignalingMessage } from '@/lib/types';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line no-var
  var __appSignalingMessages: Map<string, SignalingMessage[]> | undefined;
}

const messageStore: Map<string, SignalingMessage[]> =
  globalThis.__appSignalingMessages || (globalThis.__appSignalingMessages = new Map());

export class SignalingBus {
  /**
   * Posts a signaling message to a session's queue.
   */
  static send(
    sessionId: string,
    sender: 'client' | 'admin',
    type: SignalingMessage['type'],
    payload: any
  ): SignalingMessage {
    const id = crypto.randomUUID();
    const message: SignalingMessage = {
      id,
      sessionId,
      sender,
      type,
      payload,
      timestamp: Date.now(),
    };

    let list = messageStore.get(sessionId);
    if (!list) {
      list = [];
      messageStore.set(sessionId, list);
    }

    list.push(message);

    // Keep message history bounded to last 100 messages per session
    if (list.length > 100) {
      list.splice(0, list.length - 100);
    }

    return message;
  }

  /**
   * Gets all messages intended for a recipient (messages sent by the opposite party)
   * since a given timestamp.
   */
  static getMessages(
    sessionId: string,
    recipientRole: 'client' | 'admin',
    since: number = 0
  ): SignalingMessage[] {
    const list = messageStore.get(sessionId);
    if (!list) return [];

    // Filter messages where sender is NOT the recipient, and timestamp > since
    return list.filter(
      (msg) => msg.sender !== recipientRole && msg.timestamp > since
    );
  }

  /**
   * Clears all signaling messages for a terminated session.
   */
  static clear(sessionId: string): void {
    messageStore.delete(sessionId);
  }
}
