export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  phone: string;
  about: string;
  publicKeyJwk?: JsonWebKey | null;
  privacy?: 'public' | 'private';
  online: boolean;
  lastSeen?: number;
}

export interface ChatParticipant {
  id: string;
  displayName: string;
  avatar: string;
  online: boolean;
  publicKeyJwk?: JsonWebKey | null;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatar?: string;
  description?: string;
  participants: string[];
  admins?: string[];
  createdAt: number;
  updatedAt: number;
  participantDetails?: ChatParticipant[];
  unreadCount?: number;
  lastMessage?: {
    id: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    mediaType?: 'text' | 'image' | 'voice' | 'file';
    isEncrypted: boolean;
    previewText?: string;
  };
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  mediaType: 'text' | 'image' | 'voice' | 'file';
  ciphertext?: string;
  iv?: string;
  encryptedKeys?: Record<string, string>; // userId -> encrypted message key for groups
  replyTo?: {
    id: string;
    senderName: string;
    snippet: string;
  };
  reactions?: Record<string, string>; // userId -> emoji
  status: 'sent' | 'delivered' | 'read';
  deliveredTo?: string[];
  readBy?: string[];
  mediaUrl?: string;
  duration?: number;
  // Local client decrypted fields
  decryptedContent?: string;
  decryptionError?: boolean;
}

export interface StatusItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'text' | 'image';
  content: string;
  caption?: string;
  bgColor?: string;
  timestamp: number;
  viewers: string[];
}

export interface CallSession {
  active: boolean;
  direction: 'incoming' | 'outgoing';
  callType: 'audio' | 'video';
  peerUser: {
    id: string;
    displayName: string;
    avatar: string;
  };
  status: 'ringing' | 'connected' | 'ended';
  startedAt?: number;
}
