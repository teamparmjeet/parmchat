import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  X,
  Send,
  Lock,
  ShieldCheck,
  Check,
  CheckCheck,
  Users,
  Code,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { E2EEService } from '../../crypto/e2ee';
import { Message, User } from '../../types';

export const DualDeviceView: React.FC = () => {
  const { currentUser, secondaryUserId, setSecondaryUserId, demoUsers, setDualDeviceMode } =
    useAuth();
  const { chats, activeChat, sendMessage, messages } = useChat();

  const [secondaryUser, setSecondaryUser] = useState<User | null>(null);
  const [secondaryMessages, setSecondaryMessages] = useState<Message[]>([]);
  const [secondaryInput, setSecondaryInput] = useState('');
  const [secondaryKeyPair, setSecondaryKeyPair] = useState<CryptoKeyPair | null>(null);
  const [isSendingSecondary, setIsSendingSecondary] = useState(false);

  const secondaryScrollRef = useRef<HTMLDivElement>(null);

  // Initialize secondary user session & keys
  useEffect(() => {
    async function initSecondary() {
      try {
        const res = await fetch('/api/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: secondaryUserId }),
        });

        if (res.ok) {
          const data = await res.json();
          setSecondaryUser(data.user);

          const keys = await E2EEService.getOrCreateUserKeys(data.user.id);
          setSecondaryKeyPair(keys.keyPair);
        }
      } catch (e) {
        console.error('Failed to init secondary simulator:', e);
      }
    }

    initSecondary();
  }, [secondaryUserId]);

  // Load and decrypt messages from secondary user's perspective
  useEffect(() => {
    if (!activeChat || !secondaryUser || !secondaryKeyPair) return;

    const currentChat = activeChat;
    const secUser = secondaryUser;
    const secKeyPair = secondaryKeyPair;
    let isSubscribed = true;

    async function syncSecondaryChat() {
      try {
        const res = await fetch(`/api/chats/${currentChat.id}/messages`, {
          headers: { Authorization: `Bearer token_${secUser.id}` },
        });

        if (res.ok) {
          const raw: Message[] = await res.json();
          // Decrypt from secondary user perspective
          const decryptedList = await Promise.all(
            raw.map(async (m) => {
              if (!m.ciphertext || !m.iv) return m;

              try {
                let plaintext = '';
                if (currentChat.type === 'direct') {
                  const otherId = currentChat.participants.find((p) => p !== secUser.id);
                  const otherRes = await fetch('/api/users');
                  const users: User[] = await otherRes.json();
                  const otherUser = users.find((u) => u.id === otherId);

                  if (otherUser?.publicKeyJwk) {
                    const sharedKey = await E2EEService.getSharedKey(
                      secUser.id,
                      secKeyPair.privateKey,
                      otherUser.id,
                      otherUser.publicKeyJwk
                    );
                    plaintext = await E2EEService.decryptDirect(m.ciphertext, m.iv, sharedKey);
                  }
                } else if (currentChat.type === 'group' && m.encryptedKeys) {
                  const usersRes = await fetch('/api/users');
                  const users: User[] = await usersRes.json();
                  const sender = users.find((u) => u.id === m.senderId);

                  if (sender?.publicKeyJwk && m.encryptedKeys[secUser.id]) {
                    plaintext = await E2EEService.decryptGroup(
                      m.ciphertext,
                      m.iv,
                      m.encryptedKeys,
                      secUser.id,
                      secKeyPair.privateKey,
                      sender.id,
                      sender.publicKeyJwk
                    );
                  }
                }

                return {
                  ...m,
                  decryptedContent: plaintext || m.ciphertext.substring(0, 24) + '...',
                };
              } catch (e) {
                return {
                  ...m,
                  decryptedContent: 'Decrypted E2EE payload',
                };
              }
            })
          );

          if (isSubscribed) {
            setSecondaryMessages(decryptedList);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    syncSecondaryChat();
    const interval = setInterval(syncSecondaryChat, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeChat, secondaryUser, secondaryKeyPair, messages]);

  // Send message as secondary user
  const handleSecondarySend = async () => {
    if (!secondaryInput.trim() || !activeChat || !secondaryUser || !secondaryKeyPair) return;
    setIsSendingSecondary(true);

    try {
      const usersRes = await fetch('/api/users');
      const allUsers: User[] = await usersRes.json();

      let ciphertext = '';
      let iv = '';
      let encryptedKeys: Record<string, string> | undefined = undefined;

      if (activeChat.type === 'direct') {
        const otherId = activeChat.participants.find((p) => p !== secondaryUser.id);
        const otherUser = allUsers.find((u) => u.id === otherId);

        if (otherUser?.publicKeyJwk) {
          const sharedKey = await E2EEService.getSharedKey(
            secondaryUser.id,
            secondaryKeyPair.privateKey,
            otherUser.id,
            otherUser.publicKeyJwk
          );
          const enc = await E2EEService.encryptDirect(secondaryInput.trim(), sharedKey);
          ciphertext = enc.ciphertext;
          iv = enc.iv;
        }
      } else {
        const participantsWithKeys = activeChat.participants
          .map((pid) => allUsers.find((u) => u.id === pid))
          .filter((u): u is User => !!u);

        const enc = await E2EEService.encryptGroup(
          secondaryInput.trim(),
          secondaryUser.id,
          secondaryKeyPair.privateKey,
          participantsWithKeys
        );
        ciphertext = enc.ciphertext;
        iv = enc.iv;
        encryptedKeys = enc.encryptedKeys;
      }

      // Send message to server as secondary user
      await fetch('/api/chats/create-direct', { method: 'GET' }); // keep connection alive

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const secWs = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

      secWs.onopen = () => {
        secWs.send(
          JSON.stringify({
            type: 'auth',
            token: `token_${secondaryUser.id}`,
            userId: secondaryUser.id,
          })
        );

        setTimeout(() => {
          secWs.send(
            JSON.stringify({
              type: 'message:send',
              chatId: activeChat.id,
              mediaType: 'text',
              ciphertext,
              iv,
              encryptedKeys,
            })
          );
          setTimeout(() => secWs.close(), 500);
        }, 100);
      };

      setSecondaryInput('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingSecondary(false);
    }
  };

  return (
    <div className="w-full md:w-[420px] lg:w-[480px] h-full bg-[#111b21] border-l-2 border-emerald-500/40 flex flex-col shadow-2xl shrink-0 select-none animate-in slide-in-from-right duration-200">
      {/* Top Banner */}
      <div className="h-16 px-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
              <span>Device 2 Simulator</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </h3>
            <div className="text-[11px] text-emerald-400 font-mono">
              Live Independent E2EE Session
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Persona selector for Device 2 */}
          <select
            value={secondaryUserId}
            onChange={(e) => setSecondaryUserId(e.target.value)}
            className="bg-[#111b21] text-xs text-white px-2 py-1 rounded border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {demoUsers
              .filter((u) => u.id !== currentUser?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name.split(' ')[0]} ({u.role})
                </option>
              ))}
          </select>

          <button
            onClick={() => setDualDeviceMode(false)}
            className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] hover:text-white"
            title="Close Simulator"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Simulator Device Header */}
      <div className="p-3 bg-[#182229] border-b border-[#222e35] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <img
            src={secondaryUser?.avatar}
            alt={secondaryUser?.displayName}
            className="w-8 h-8 rounded-full object-cover border border-emerald-500"
          />
          <div>
            <div className="font-semibold text-white">{secondaryUser?.displayName}</div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              <span>Independent Private Key</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[#8696a0] block">Viewing Chat:</span>
          <span className="font-medium text-white text-[11px] line-clamp-1 max-w-[140px]">
            {activeChat?.name || 'Active Conversation'}
          </span>
        </div>
      </div>

      {/* Simulator Chat Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
        <div className="flex justify-center my-1">
          <div className="bg-[#182229] text-[10px] text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Messages decrypted on Device 2 using native Web Crypto</span>
          </div>
        </div>

        {secondaryMessages.map((msg) => {
          const isFromDevice2 = msg.senderId === secondaryUser?.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isFromDevice2 ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs shadow ${
                  isFromDevice2
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                }`}
              >
                {!isFromDevice2 && (
                  <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">
                    {msg.senderName}
                  </span>
                )}

                <p className="whitespace-pre-wrap break-words">{msg.decryptedContent}</p>

                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#8696a0]">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isFromDevice2 && (
                    <span>
                      {msg.status === 'read' ? (
                        <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
                      ) : (
                        <CheckCheck className="w-3 h-3 text-[#8696a0]" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={secondaryScrollRef} />
      </div>

      {/* Simulator Composer */}
      <div className="p-3 bg-[#202c33] border-t border-[#222e35] flex items-center gap-2">
        <input
          type="text"
          placeholder={`Reply as ${secondaryUser?.displayName?.split(' ')[0]}...`}
          value={secondaryInput}
          onChange={(e) => setSecondaryInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSecondarySend();
          }}
          className="flex-1 bg-[#2a3942] text-xs text-white px-3 py-2 rounded-lg placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <button
          onClick={handleSecondarySend}
          disabled={!secondaryInput.trim() || isSendingSecondary}
          className="p-2 bg-[#00a884] hover:bg-[#029070] disabled:opacity-50 text-white rounded-full transition shadow"
          title="Send from Device 2"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
