export type SessionStatus = 'active' | 'ended' | 'failed';
export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'stopped';

export interface UserSession {
  id: string;
  phoneNumber: string;
  maskedPhoneNumber: string;
  createdAt: number;
  endedAt?: number;
  status: SessionStatus;
  streamStatus: StreamStatus;
  lastHeartbeat: number;
}

export type SignalingMessageType = 
  | 'offer' 
  | 'answer' 
  | 'ice-candidate' 
  | 'client-ready' 
  | 'admin-connected' 
  | 'stream-status' 
  | 'session-ended';

export interface SignalingMessage {
  id: string;
  sessionId: string;
  sender: 'client' | 'admin';
  type: SignalingMessageType;
  payload: any;
  timestamp: number;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface AdminAuthPayload {
  role: 'admin';
  authenticatedAt: number;
}
