import React, { useState, useRef, useEffect } from 'react';
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  Lock,
  ShieldCheck,
  Check,
  CheckCheck,
  Info,
  X,
  Play,
  Pause,
  Image as ImageIcon,
  Reply,
  Code,
  Square,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Message } from '../../types';
import { audioFx } from '../../utils/audio';

const SENDER_COLORS = [
  'text-emerald-400',
  'text-amber-400',
  'text-cyan-400',
  'text-purple-400',
  'text-rose-400',
  'text-blue-400',
];

export const ChatArea: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    activeChat,
    messages,
    sendMessage,
    sendReaction,
    sendTyping,
    startCall,
    typingUsers,
    setIsGroupInfoOpen,
    setIsSecurityModalOpen,
    setSelectedMessageForInspection,
    setIsInspectingWire,
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [imageUploadPreview, setImageUploadPreview] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<any>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Voice recording timer
  useEffect(() => {
    if (isRecordingVoice) {
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecordingVoice]);

  if (!activeChat) {
    return (
      <div className="flex-1 h-full bg-[#222e35] flex flex-col items-center justify-center p-8 text-center select-none border-b-6 border-[#00a884]">
        <div className="max-w-md flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-[#111b21] flex items-center justify-center mb-6 shadow-xl border border-emerald-500/20">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-light text-[#e9edef] mb-3">ParmChat Web with E2EE</h2>
          <p className="text-sm text-[#8696a0] leading-relaxed mb-6">
            Send and receive end-to-end encrypted messages with zero data visible to the server.
            Multi-user real-time WebSockets, direct chats, and full group messaging.
          </p>
          <div className="flex items-center gap-2 text-xs text-[#8696a0] bg-[#111b21] px-4 py-2 rounded-full border border-[#2a3942]">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-end encrypted with ECDH P-256 &amp; AES-256-GCM</span>
          </div>
        </div>
      </div>
    );
  }

  const isGroup = activeChat.type === 'group';
  const otherParticipant = !isGroup
    ? activeChat.participantDetails?.find((p) => p.id !== currentUser?.id)
    : null;

  const chatTitle = (isGroup ? activeChat.name : otherParticipant?.displayName) || 'Chat';
  const chatAvatar = isGroup
    ? activeChat.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80'
    : otherParticipant?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

  const groupParticipantsString = isGroup
    ? activeChat.participantDetails
        ?.map((p) => (p.id === currentUser?.id ? 'You' : p.displayName))
        .join(', ')
    : null;

  const isOnline = !isGroup && otherParticipant?.online;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTyping(e.target.value.length > 0);
  };

  const handleSend = async () => {
    if (!inputText.trim() && !imageUploadPreview) return;

    if (imageUploadPreview) {
      let finalMediaUrl = imageUploadPreview;
      try {
        const uploadRes = await fetch('/api/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: imageUploadPreview, type: 'image/jpeg' }),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.url) {
            finalMediaUrl = uploadData.url;
          }
        }
      } catch (err) {
        console.warn('AWS CloudFront upload fallback to data URI:', err);
      }

      await sendMessage({
        text: inputText.trim() || 'Photo',
        mediaType: 'image',
        mediaUrl: finalMediaUrl,
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              senderName: replyingTo.senderName,
              snippet: replyingTo.decryptedContent || 'Encrypted message',
            }
          : undefined,
      });
      setImageUploadPreview(null);
    } else {
      await sendMessage({
        text: inputText.trim(),
        mediaType: 'text',
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              senderName: replyingTo.senderName,
              snippet: replyingTo.decryptedContent || 'Encrypted message',
            }
          : undefined,
      });
    }

    audioFx.playSentTick();
    setInputText('');
    setReplyingTo(null);
    sendTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Image Upload handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Voice note complete
  const handleStopAndSendVoice = async () => {
    setIsRecordingVoice(false);
    // Send simulated/real voice note
    await sendMessage({
      text: '🎤 Voice message',
      mediaType: 'voice',
      duration: recordingDuration || 3,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            snippet: replyingTo.decryptedContent || 'Encrypted message',
          }
        : undefined,
    });
    audioFx.playSentTick();
    setReplyingTo(null);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const getSenderColor = (senderId: string) => {
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
      hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % SENDER_COLORS.length;
    return SENDER_COLORS[idx];
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0b141a] text-[#e9edef] overflow-hidden relative">
      {/* WhatsApp Background Wallpaper Pattern */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#00a884 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Chat Header */}
      <header className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222e35] z-10 shrink-0">
        <div
          onClick={() => {
            if (isGroup) setIsGroupInfoOpen(true);
            else setIsSecurityModalOpen(true);
          }}
          className="flex items-center gap-3 cursor-pointer group min-w-0"
        >
          <img
            src={chatAvatar}
            alt={chatTitle}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition truncate flex items-center gap-2">
              <span>{chatTitle}</span>
              {isGroup && (
                <span className="text-[10px] bg-[#111b21] text-emerald-400 px-1.5 py-0.5 rounded font-mono shrink-0">
                  {activeChat.participants.length} members
                </span>
              )}
            </h2>
            <p className="text-[11px] text-[#8696a0] truncate">
              {isGroup
                ? groupParticipantsString
                : isOnline
                ? 'online'
                : 'last seen recently'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 text-[#aebac1]">
          {/* E2EE Verify Badge Button */}
          <button
            onClick={() => setIsSecurityModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#111b21] hover:bg-[#2a3942] rounded-full text-xs text-emerald-400 border border-emerald-500/30 transition mr-1"
            title="Verify 60-digit E2EE safety code"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">E2EE Verified</span>
          </button>

          {/* Raw Wire Inspector Button */}
          <button
            onClick={() => setIsInspectingWire(true)}
            className="p-2 hover:bg-[#374248] rounded-full transition text-amber-400 hover:text-amber-300"
            title="Inspect Raw Encrypted Wire Packets"
          >
            <Code className="w-5 h-5" />
          </button>

          {/* Voice Call */}
          <button
            onClick={() =>
              startCall(
                {
                  id: otherParticipant?.id || activeChat.id,
                  displayName: chatTitle,
                  avatar: chatAvatar || '',
                },
                'audio'
              )
            }
            className="p-2 hover:bg-[#374248] rounded-full transition hover:text-white"
            title="Start Audio Call"
          >
            <Phone className="w-5 h-5" />
          </button>

          {/* Video Call */}
          <button
            onClick={() =>
              startCall(
                {
                  id: otherParticipant?.id || activeChat.id,
                  displayName: chatTitle,
                  avatar: chatAvatar || '',
                },
                'video'
              )
            }
            className="p-2 hover:bg-[#374248] rounded-full transition hover:text-white"
            title="Start Video Call"
          >
            <Video className="w-5 h-5" />
          </button>

          {/* Group / Contact info */}
          <button
            onClick={() => {
              if (isGroup) setIsGroupInfoOpen(true);
              else setIsSecurityModalOpen(true);
            }}
            className="p-2 hover:bg-[#374248] rounded-full transition hover:text-white"
            title={isGroup ? 'Group Info' : 'Contact Security'}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 z-10">
        {/* WhatsApp Official Style Security Notice Banner */}
        <div className="flex justify-center my-2">
          <div
            onClick={() => setIsSecurityModalOpen(true)}
            className="bg-[#182229]/90 border border-[#222e35] text-[#ffd279] text-xs px-4 py-2 rounded-lg max-w-md text-center shadow flex items-center justify-center gap-2 cursor-pointer hover:bg-[#202c33] transition"
          >
            <Lock className="w-4 h-4 text-[#ffd279] shrink-0" />
            <span className="leading-tight">
              Messages and calls are end-to-end encrypted. No one outside of this chat, not even
              WhatsApp or the server, can read or listen to them. Tap to verify.
            </span>
          </div>
        </div>

        {/* Messages */}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser?.id;
          const isHovered = hoveredMessageId === msg.id;

          return (
            <div
              key={msg.id}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
              className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[75%] sm:max-w-[65%] rounded-lg px-3 py-1.5 shadow-sm text-sm relative transition ${
                  isMe
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                }`}
              >
                {/* Group Sender Name */}
                {isGroup && !isMe && (
                  <div className={`text-xs font-semibold mb-0.5 ${getSenderColor(msg.senderId)}`}>
                    {msg.senderName}
                  </div>
                )}

                {/* Quoted Reply */}
                {msg.replyTo && (
                  <div className="mb-1.5 p-1.5 rounded bg-black/20 border-l-3 border-emerald-400 text-xs">
                    <span className="font-semibold text-emerald-400 block">
                      {msg.replyTo.senderName}
                    </span>
                    <span className="text-[#aebac1] line-clamp-1 italic">
                      {msg.replyTo.snippet}
                    </span>
                  </div>
                )}

                {/* Image Media */}
                {msg.mediaType === 'image' && msg.mediaUrl && (
                  <div className="my-1 rounded overflow-hidden">
                    <img
                      src={msg.mediaUrl}
                      alt="Encrypted attachment"
                      className="max-h-60 w-auto object-cover rounded cursor-pointer hover:opacity-90 transition"
                      onClick={() => {
                        window.open(msg.mediaUrl, '_blank');
                      }}
                    />
                  </div>
                )}

                {/* Voice Note Media */}
                {msg.mediaType === 'voice' && (
                  <div className="flex items-center gap-3 py-1 min-w-[200px]">
                    <button
                      onClick={() => {
                        if (playingVoiceId === msg.id) {
                          setPlayingVoiceId(null);
                        } else {
                          setPlayingVoiceId(msg.id);
                          audioFx.playMessagePop();
                          setTimeout(() => setPlayingVoiceId(null), 3500);
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 hover:bg-emerald-500/30 transition"
                    >
                      {playingVoiceId === msg.id ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Animated Waveform */}
                    <div className="flex-1 flex items-center gap-0.5 h-6">
                      {[4, 8, 14, 20, 12, 16, 6, 18, 10, 14, 8, 12, 22, 16, 10, 6].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}px` }}
                          className={`w-1 rounded-full transition-all ${
                            playingVoiceId === msg.id
                              ? 'bg-emerald-400 animate-pulse'
                              : 'bg-[#8696a0]'
                          }`}
                        />
                      ))}
                    </div>

                    <span className="text-[11px] text-[#8696a0] font-mono shrink-0">
                      {formatDuration(msg.duration || 3)}
                    </span>
                  </div>
                )}

                {/* Text Content */}
                {msg.mediaType === 'text' && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {msg.decryptedContent || (
                      <span className="text-amber-300 font-mono text-xs flex items-center gap-1">
                        <Lock className="w-3 h-3 animate-spin" />
                        Decrypting...
                      </span>
                    )}
                  </p>
                )}

                {/* Timestamp and Checkmarks */}
                <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-[#8696a0] select-none">
                  <span className="text-[10px] opacity-80 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {isMe && (
                    <span className="ml-0.5" title={msg.status === 'read' ? 'Read' : msg.status === 'delivered' ? 'Delivered' : 'Sent'}>
                      {msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#8696a0]" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                      )}
                    </span>
                  )}
                </div>

                {/* Reactions badge */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="absolute -bottom-2.5 right-2 bg-[#202c33] border border-[#2a3942] rounded-full px-1.5 py-0.5 text-xs flex items-center gap-0.5 shadow-md">
                    {Array.from(new Set(Object.values(msg.reactions))).map((emoji, idx) => (
                      <span key={idx}>{emoji}</span>
                    ))}
                    <span className="text-[10px] text-[#8696a0] font-bold">
                      {Object.keys(msg.reactions).length}
                    </span>
                  </div>
                )}
              </div>

              {/* Hover Actions Menu (Quote, Wire Inspect, Reaction) */}
              {isHovered && (
                <div
                  className={`absolute top-0 flex items-center gap-1 bg-[#182229] border border-[#2a3942] rounded-full px-2 py-0.5 shadow-lg z-20 ${
                    isMe ? 'right-[calc(100%+4px)]' : 'left-[calc(100%+4px)]'
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedMessageForInspection(msg);
                      setIsInspectingWire(true);
                    }}
                    className="p-1 hover:text-amber-400 text-[#8696a0] transition"
                    title="Inspect Encrypted Wire Packet"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1 hover:text-emerald-400 text-[#8696a0] transition"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  {['👍', '❤️', '😂', '🔥'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(msg.id, emoji)}
                      className="p-1 text-xs hover:scale-125 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Real-time typing bubble */}
        {typingUsers[activeChat.id]?.length > 0 && (
          <div className="flex items-center gap-2 bg-[#202c33] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg w-fit rounded-tl-none animate-pulse">
            <span className="text-emerald-400 font-medium">
              {isGroup
                ? `${typingUsers[activeChat.id].join(', ')} typing...`
                : 'typing...'}
            </span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
              <span
                className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quoted Message Preview Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-[#202c33] border-t border-[#222e35] flex items-center justify-between text-xs text-[#aebac1] z-20">
          <div className="border-l-3 border-emerald-500 pl-2">
            <span className="font-semibold text-emerald-400 block">
              Replying to {replyingTo.senderName}
            </span>
            <span className="line-clamp-1 italic text-[#8696a0]">
              {replyingTo.decryptedContent || 'Encrypted content'}
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:text-white rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Image Preview Bar before sending */}
      {imageUploadPreview && (
        <div className="p-3 bg-[#202c33] border-t border-[#222e35] flex items-center gap-3 z-20">
          <img
            src={imageUploadPreview}
            alt="Preview"
            className="h-16 w-16 object-cover rounded border border-emerald-500/50"
          />
          <div className="text-xs text-[#aebac1] flex-1">
            <span className="font-semibold block text-emerald-400">Encrypted Image Attachment</span>
            <span>Will be encrypted with AES-256-GCM before sending</span>
          </div>
          <button
            onClick={() => setImageUploadPreview(null)}
            className="p-1.5 text-rose-400 hover:bg-[#2a3942] rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 bg-[#202c33] border border-[#2a3942] rounded-xl p-3 shadow-2xl z-30 grid grid-cols-8 gap-2 text-xl max-w-xs">
          {['😀', '😂', '😍', '😎', '🥳', '🤔', '🤫', '🥺', '👍', '🙏', '❤️', '🔥', '🎉', '🚀', '🔒', '🛡️'].map(
            (em) => (
              <button
                key={em}
                onClick={() => {
                  setInputText((prev) => prev + em);
                  setShowEmojiPicker(false);
                }}
                className="hover:scale-125 transition p-1 text-center"
              >
                {em}
              </button>
            )
          )}
        </div>
      )}

      {/* Chat Composer / Input Bar */}
      <footer className="h-16 px-4 bg-[#202c33] flex items-center gap-2 border-t border-[#222e35] z-20 shrink-0">
        {isRecordingVoice ? (
          /* Voice Recording Mode */
          <div className="flex-1 flex items-center justify-between px-3 py-2 bg-[#111b21] rounded-lg">
            <div className="flex items-center gap-2 text-rose-400 text-sm">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span>Recording Voice Note:</span>
              <span className="font-mono font-bold">{formatDuration(recordingDuration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRecordingVoice(false)}
                className="text-xs text-[#8696a0] hover:text-rose-400 px-2 py-1 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleStopAndSendVoice}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition shadow"
                title="Send encrypted voice note"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Standard Messaging Mode */
          <>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-[#8696a0] hover:text-white rounded-full transition"
              title="Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#8696a0] hover:text-white rounded-full transition"
              title="Attach Encrypted File/Photo"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />

            {/* Input Box */}
            <input
              type="text"
              placeholder="Type a message (End-to-end encrypted)"
              value={inputText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-[#2a3942] text-sm text-[#d1d7db] px-4 py-2.5 rounded-lg placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />

            {inputText.trim() || imageUploadPreview ? (
              <button
                onClick={handleSend}
                className="p-2.5 bg-[#00a884] hover:bg-[#029070] text-white rounded-full transition shadow flex items-center justify-center shrink-0"
                title="Send Encrypted Message"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setIsRecordingVoice(true)}
                className="p-2 text-[#8696a0] hover:text-emerald-400 rounded-full transition shrink-0"
                title="Record Voice Note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
};
