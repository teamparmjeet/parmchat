import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Chat, Message, User, CallSession, StatusItem } from '../types';
import { useAuth } from './AuthContext';
import { E2EEService } from '../crypto/e2ee';
import { realtime } from '../services/websocket';

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  activeChatId: string | null;
  messages: Message[];
  allUsers: User[];
  typingUsers: Record<string, string[]>; // chatId -> list of userNames typing
  selectedMessageForInspection: Message | null;
  isInspectingWire: boolean;
  activeCall: CallSession | null;
  statuses: StatusItem[];
  isGroupModalOpen: boolean;
  isGroupInfoOpen: boolean;
  isSecurityModalOpen: boolean;
  isNewChatModalOpen: boolean;
  searchQuery: string;
  chatFilter: 'all' | 'unread' | 'groups';
  setSearchQuery: (q: string) => void;
  setChatFilter: (f: 'all' | 'unread' | 'groups') => void;
  setIsGroupModalOpen: (open: boolean) => void;
  setIsGroupInfoOpen: (open: boolean) => void;
  setIsSecurityModalOpen: (open: boolean) => void;
  setIsNewChatModalOpen: (open: boolean) => void;
  setActiveChatId: (id: string | null) => void;
  setSelectedMessageForInspection: (msg: Message | null) => void;
  setIsInspectingWire: (val: boolean) => void;
  sendMessage: (payload: {
    text: string;
    mediaType?: 'text' | 'image' | 'voice' | 'file';
    mediaUrl?: string;
    duration?: number;
    replyTo?: { id: string; senderName: string; snippet: string };
  }) => Promise<void>;
  sendReaction: (messageId: string, emoji: string) => void;
  sendTyping: (isTyping: boolean) => void;
  createDirectChat: (targetUserId: string) => Promise<Chat | null>;
  createGroupChat: (data: {
    name: string;
    description?: string;
    avatar?: string;
    participantIds: string[];
  }) => Promise<Chat | null>;
  updateGroup: (
    chatId: string,
    updates: {
      name?: string;
      description?: string;
      avatar?: string;
      addParticipants?: string[];
      removeParticipants?: string[];
    }
  ) => Promise<void>;
  startCall: (targetUser: { id: string; displayName: string; avatar: string }, callType: 'audio' | 'video') => void;
  endCall: () => void;
  acceptCall: () => void;
  rejectCall: () => void;
  refreshChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, token, keyPair } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [selectedMessageForInspection, setSelectedMessageForInspection] = useState<Message | null>(null);
  const [isInspectingWire, setIsInspectingWire] = useState(false);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'groups'>('all');

  // Decryption cache: msgId -> decrypted text
  const decryptedCache = useRef<Map<string, string>>(new Map());
  const typingTimeoutRef = useRef<any>(null);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  }, []);

  // Fetch chats for current user
  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/chats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Chat[] = await res.json();
        setChats(data);

        // Auto select first chat if none selected
        if (!activeChatId && data.length > 0) {
          setActiveChatId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch chats:', e);
    }
  }, [token, activeChatId]);

  // Fetch status items
  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (e) {
      console.error('Failed to fetch statuses:', e);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchChats();
      fetchStatuses();
    }
  }, [token, fetchUsers, fetchChats, fetchStatuses]);

  // Decrypt a single message
  const decryptMessage = useCallback(
    async (msg: Message, chat: Chat): Promise<Message> => {
      if (decryptedCache.current.has(msg.id)) {
        return {
          ...msg,
          decryptedContent: decryptedCache.current.get(msg.id)!,
        };
      }

      if (!msg.ciphertext || !msg.iv || !keyPair?.privateKey || !currentUser) {
        return msg;
      }

      try {
        let plaintext = '';

        if (chat.type === 'direct') {
          // Direct chat: sender or recipient
          const otherUserId = chat.participants.find((p) => p !== currentUser.id);
          const otherUser = allUsers.find((u) => u.id === otherUserId);

          if (!otherUser?.publicKeyJwk) {
            return {
              ...msg,
              decryptedContent: '[Encrypted: Contact public key unavailable]',
              decryptionError: true,
            };
          }

          const sharedKey = await E2EEService.getSharedKey(
            currentUser.id,
            keyPair.privateKey,
            otherUser.id,
            otherUser.publicKeyJwk
          );

          plaintext = await E2EEService.decryptDirect(msg.ciphertext, msg.iv, sharedKey);
        } else {
          // Group chat: decrypt sender-key
          const sender = allUsers.find((u) => u.id === msg.senderId);

          if (!msg.encryptedKeys || !msg.encryptedKeys[currentUser.id]) {
            return {
              ...msg,
              decryptedContent: '[Group message key not provisioned for this session]',
              decryptionError: true,
            };
          }

          if (!sender?.publicKeyJwk) {
            return {
              ...msg,
              decryptedContent: '[Encrypted: Sender key pending verification]',
              decryptionError: true,
            };
          }

          plaintext = await E2EEService.decryptGroup(
            msg.ciphertext,
            msg.iv,
            msg.encryptedKeys,
            currentUser.id,
            keyPair.privateKey,
            sender.id,
            sender.publicKeyJwk
          );
        }

        decryptedCache.current.set(msg.id, plaintext);
        return {
          ...msg,
          decryptedContent: plaintext,
        };
      } catch (err) {
        // Fallback for demo seed messages with mock ciphertext
        if (msg.ciphertext.includes('[E2EE-ENCRYPTED-PAYLOAD]')) {
          const fallbackText =
            msg.id === 'msg_g_1'
              ? 'Welcome to WhatsApp E2EE! All group messages are encrypted with pairwise sender-keys 🛡️'
              : msg.id === 'msg_g_2'
              ? 'Awesome! Tested sending an image attachment with AES-GCM 256. Zero data visible to server!'
              : 'Hey Alex! Our end-to-end encryption keys are verified. Let me know when you are free for the sync.';
          decryptedCache.current.set(msg.id, fallbackText);
          return {
            ...msg,
            decryptedContent: fallbackText,
          };
        }

        console.error('Decryption failed for message', msg.id, err);
        return {
          ...msg,
          decryptedContent: '[Message cannot be decrypted with current key]',
          decryptionError: true,
        };
      }
    },
    [allUsers, currentUser, keyPair]
  );

  // Fetch messages for active chat & decrypt them
  useEffect(() => {
    if (!activeChatId || !token) return;

    let isCancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/chats/${activeChatId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const rawMsgs: Message[] = await res.json();
          const currentChat = chats.find((c) => c.id === activeChatId);

          if (currentChat && !isCancelled) {
            const decrypted = await Promise.all(
              rawMsgs.map((m) => decryptMessage(m, currentChat))
            );

            if (!isCancelled) {
              setMessages(decrypted);

              // Mark unread messages as read
              const unreadIds = rawMsgs
                .filter((m) => m.senderId !== currentUser?.id && !m.readBy?.includes(currentUser?.id || ''))
                .map((m) => m.id);

              if (unreadIds.length > 0) {
                realtime.send({
                  type: 'message:read',
                  chatId: activeChatId,
                  messageIds: unreadIds,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    }

    loadMessages();

    return () => {
      isCancelled = true;
    };
  }, [activeChatId, token, chats, decryptMessage, currentUser?.id]);

  // WebSocket Event Handlers
  useEffect(() => {
    const unsubMsg = realtime.on('message:new', async (data: any) => {
      const { chatId, message } = data;

      // Update chat's lastMessage and timestamp
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            return {
              ...c,
              updatedAt: message.timestamp,
              lastMessage: {
                id: message.id,
                senderId: message.senderId,
                senderName: message.senderName,
                timestamp: message.timestamp,
                mediaType: message.mediaType,
                isEncrypted: true,
                previewText:
                  message.mediaType === 'image'
                    ? '📷 Photo'
                    : message.mediaType === 'voice'
                    ? '🎤 Voice message'
                    : '🔒 Encrypted message',
              },
              unreadCount:
                chatId === activeChatId
                  ? 0
                  : (c.unreadCount || 0) + (message.senderId !== currentUser?.id ? 1 : 0),
            };
          }
          return c;
        })
      );

      // If active chat, decrypt and append
      if (chatId === activeChatId) {
        const currentChat = chats.find((c) => c.id === chatId);
        if (currentChat) {
          const decrypted = await decryptMessage(message, currentChat);
          setMessages((prev) => {
            if (prev.some((m) => m.id === decrypted.id)) return prev;
            return [...prev, decrypted];
          });

          // Mark as read immediately if from someone else
          if (message.senderId !== currentUser?.id) {
            realtime.send({
              type: 'message:read',
              chatId,
              messageIds: [message.id],
            });
          }
        }
      }
    });

    const unsubStatus = realtime.on('message:status', (data: any) => {
      const { chatId, messageIds, status } = data;
      if (chatId === activeChatId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (messageIds.includes(m.id)) {
              return { ...m, status };
            }
            return m;
          })
        );
      }
    });

    const unsubReact = realtime.on('message:reaction', (data: any) => {
      const { chatId, messageId, reactions } = data;
      if (chatId === activeChatId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === messageId) {
              return { ...m, reactions };
            }
            return m;
          })
        );
      }
    });

    const unsubTypingStart = realtime.on('typing:start', (data: any) => {
      const { chatId, userName } = data;
      setTypingUsers((prev) => {
        const current = prev[chatId] || [];
        if (!current.includes(userName)) {
          return { ...prev, [chatId]: [...current, userName] };
        }
        return prev;
      });
    });

    const unsubTypingStop = realtime.on('typing:stop', (data: any) => {
      const { chatId } = data;
      setTypingUsers((prev) => ({
        ...prev,
        [chatId]: [],
      }));
    });

    const unsubPresence = realtime.on('presence:update', (data: any) => {
      const { userId, online, lastSeen } = data;
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, online, lastSeen } : u))
      );
      setChats((prev) =>
        prev.map((c) => ({
          ...c,
          participantDetails: c.participantDetails?.map((p) =>
            p.id === userId ? { ...p, online } : p
          ),
        }))
      );
    });

    const unsubChatCreated = realtime.on('chat:created', (data: any) => {
      fetchChats();
    });

    const unsubChatUpdated = realtime.on('chat:updated', (data: any) => {
      fetchChats();
    });

    const unsubCallIncoming = realtime.on('call:incoming', (data: any) => {
      setActiveCall({
        active: true,
        direction: 'incoming',
        callType: data.callType || 'audio',
        peerUser: {
          id: data.callerId,
          displayName: data.callerName,
          avatar: data.callerAvatar,
        },
        status: 'ringing',
      });
    });

    return () => {
      unsubMsg();
      unsubStatus();
      unsubReact();
      unsubTypingStart();
      unsubTypingStop();
      unsubPresence();
      unsubChatCreated();
      unsubChatUpdated();
      unsubCallIncoming();
    };
  }, [activeChatId, chats, currentUser?.id, decryptMessage, fetchChats]);

  // Send Encrypted Message
  const sendMessage = async ({
    text,
    mediaType = 'text',
    mediaUrl,
    duration,
    replyTo,
  }: {
    text: string;
    mediaType?: 'text' | 'image' | 'voice' | 'file';
    mediaUrl?: string;
    duration?: number;
    replyTo?: { id: string; senderName: string; snippet: string };
  }) => {
    if (!activeChatId || !currentUser || !keyPair) return;

    const chat = chats.find((c) => c.id === activeChatId);
    if (!chat) return;

    const contentToEncrypt = mediaType === 'text' ? text : JSON.stringify({ text, mediaUrl, duration });

    try {
      if (chat.type === 'direct') {
        const otherUserId = chat.participants.find((p) => p !== currentUser.id);
        const otherUser = allUsers.find((u) => u.id === otherUserId);

        if (!otherUser?.publicKeyJwk) {
          alert('Contact has not published their E2EE public key yet.');
          return;
        }

        const sharedKey = await E2EEService.getSharedKey(
          currentUser.id,
          keyPair.privateKey,
          otherUser.id,
          otherUser.publicKeyJwk
        );

        const { ciphertext, iv } = await E2EEService.encryptDirect(contentToEncrypt, sharedKey);

        realtime.send({
          type: 'message:send',
          chatId: activeChatId,
          mediaType,
          ciphertext,
          iv,
          replyTo,
          mediaUrl,
          duration,
        });
      } else {
        // Group Encryption
        const participantsWithKeys = chat.participants
          .map((pid) => allUsers.find((u) => u.id === pid))
          .filter((u): u is User => !!u);

        const { ciphertext, iv, encryptedKeys } = await E2EEService.encryptGroup(
          contentToEncrypt,
          currentUser.id,
          keyPair.privateKey,
          participantsWithKeys
        );

        realtime.send({
          type: 'message:send',
          chatId: activeChatId,
          mediaType,
          ciphertext,
          iv,
          encryptedKeys,
          replyTo,
          mediaUrl,
          duration,
        });
      }
    } catch (e) {
      console.error('Failed to send encrypted message:', e);
    }
  };

  // Typing event emission
  const sendTyping = (isTyping: boolean) => {
    if (!activeChatId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (isTyping) {
      realtime.send({ type: 'typing:start', chatId: activeChatId });
      typingTimeoutRef.current = setTimeout(() => {
        realtime.send({ type: 'typing:stop', chatId: activeChatId });
      }, 2500);
    } else {
      realtime.send({ type: 'typing:stop', chatId: activeChatId });
    }
  };

  // React to message
  const sendReaction = (messageId: string, emoji: string) => {
    if (!activeChatId) return;
    realtime.send({
      type: 'message:react',
      chatId: activeChatId,
      messageId,
      emoji,
    });
  };

  // Create Direct Chat
  const createDirectChat = async (targetUserId: string): Promise<Chat | null> => {
    if (!token) return null;
    try {
      const res = await fetch('/api/chats/create-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      });

      if (res.ok) {
        const newChat = await res.json();
        await fetchChats();
        setActiveChatId(newChat.id);
        return newChat;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Create Group Chat (Group Feature)
  const createGroupChat = async (data: {
    name: string;
    description?: string;
    avatar?: string;
    participantIds: string[];
  }): Promise<Chat | null> => {
    if (!token) return null;
    try {
      const res = await fetch('/api/chats/create-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const newChat = await res.json();
        await fetchChats();
        setActiveChatId(newChat.id);
        return newChat;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // Update Group Chat
  const updateGroup = async (
    chatId: string,
    updates: {
      name?: string;
      description?: string;
      avatar?: string;
      addParticipants?: string[];
      removeParticipants?: string[];
    }
  ) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/chats/${chatId}/group`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await fetchChats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Call handling
  const startCall = (
    targetUser: { id: string; displayName: string; avatar: string },
    callType: 'audio' | 'video'
  ) => {
    setActiveCall({
      active: true,
      direction: 'outgoing',
      callType,
      peerUser: targetUser,
      status: 'ringing',
    });

    realtime.send({
      type: 'call:signal',
      targetUserId: targetUser.id,
      callType,
      action: 'ring',
    });
  };

  const endCall = () => {
    if (activeCall) {
      realtime.send({
        type: 'call:signal',
        targetUserId: activeCall.peerUser.id,
        action: 'end',
      });
      setActiveCall(null);
    }
  };

  const acceptCall = () => {
    if (activeCall) {
      setActiveCall((prev) => (prev ? { ...prev, status: 'connected', startedAt: Date.now() } : null));
      realtime.send({
        type: 'call:signal',
        targetUserId: activeCall.peerUser.id,
        action: 'accept',
      });
    }
  };

  const rejectCall = () => {
    if (activeCall) {
      realtime.send({
        type: 'call:signal',
        targetUserId: activeCall.peerUser.id,
        action: 'reject',
      });
      setActiveCall(null);
    }
  };

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChat,
        activeChatId,
        messages,
        allUsers,
        typingUsers,
        selectedMessageForInspection,
        isInspectingWire,
        activeCall,
        statuses,
        isGroupModalOpen,
        isGroupInfoOpen,
        isSecurityModalOpen,
        isNewChatModalOpen,
        searchQuery,
        chatFilter,
        setSearchQuery,
        setChatFilter,
        setIsGroupModalOpen,
        setIsGroupInfoOpen,
        setIsSecurityModalOpen,
        setIsNewChatModalOpen,
        setActiveChatId,
        setSelectedMessageForInspection,
        setIsInspectingWire,
        sendMessage,
        sendReaction,
        sendTyping,
        createDirectChat,
        createGroupChat,
        updateGroup,
        startCall,
        endCall,
        acceptCall,
        rejectCall,
        refreshChats: fetchChats,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
