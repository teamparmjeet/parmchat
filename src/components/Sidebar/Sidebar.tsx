import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  CircleDot,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Split,
  MoreVertical,
  LogOut,
  UserCheck,
  Check,
  CheckCheck,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface SidebarProps {
  onOpenProfile: () => void;
  onOpenStatus: () => void;
  isCompact?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenProfile,
  onOpenStatus,
  isCompact = false,
}) => {
  const {
    currentUser,
    demoUsers,
    demoLogin,
    dualDeviceMode,
    setDualDeviceMode,
    logout,
  } = useAuth();

  const {
    chats,
    activeChatId,
    setActiveChatId,
    typingUsers,
    searchQuery,
    setSearchQuery,
    chatFilter,
    setChatFilter,
    setIsGroupModalOpen,
    setIsNewChatModalOpen,
    setIsSecurityModalOpen,
    setIsInspectingWire,
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);

  // Filtered chats
  const filteredChats = chats.filter((chat) => {
    // Filter by type
    if (chatFilter === 'groups' && chat.type !== 'group') return false;
    if (chatFilter === 'unread' && (!chat.unreadCount || chat.unreadCount === 0)) return false;

    // Filter by search query
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    if (chat.type === 'group') {
      return (
        chat.name?.toLowerCase().includes(query) ||
        chat.description?.toLowerCase().includes(query)
      );
    } else {
      const contact = chat.participantDetails?.find((p) => p.id !== currentUser?.id);
      return contact?.displayName.toLowerCase().includes(query);
    }
  });

  const formatChatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="h-full flex flex-col bg-[#111b21] border-r border-[#222e35] select-none text-[#e9edef] w-full max-w-[420px] min-w-[320px]">
      {/* Top Header */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222e35] shrink-0">
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-3 cursor-pointer group"
          title="Click to view profile & keys"
        >
          <div className="relative">
            <img
              src={currentUser?.avatar}
              alt={currentUser?.displayName}
              className="w-10 h-10 rounded-full object-cover border border-emerald-500/30 group-hover:opacity-80 transition"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#202c33] rounded-full" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition flex items-center gap-1.5">
              <span>{currentUser?.displayName}</span>
              <span title="E2EE Active">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
              <Lock className="w-2.5 h-2.5" />
              <span>Keys Protected</span>
            </div>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1 text-[#aebac1]">
          {/* New Group Button (Highlight feature requested) */}
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="p-2 hover:bg-[#374248] rounded-full transition text-emerald-400 hover:text-emerald-300 relative"
            title="Create New Group (E2EE)"
          >
            <Users className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
          </button>

          {/* New Direct Chat */}
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="p-2 hover:bg-[#374248] rounded-full transition hover:text-white"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Stories / Status */}
          <button
            onClick={onOpenStatus}
            className="p-2 hover:bg-[#374248] rounded-full transition hover:text-white relative"
            title="Status Updates"
          >
            <CircleDot className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
          </button>

          {/* Dual-Device Split Screen Simulator Toggle */}
          <button
            onClick={() => setDualDeviceMode(!dualDeviceMode)}
            className={`p-2 rounded-full transition ${
              dualDeviceMode
                ? 'bg-emerald-600 text-white'
                : 'hover:bg-[#374248] hover:text-white'
            }`}
            title="Toggle Split-Screen 2-User Testing Mode"
          >
            <Split className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 hover:bg-[#374248] rounded-full transition hover:text-white"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-12 w-56 bg-[#233138] rounded-lg shadow-2xl py-2 z-50 border border-[#2a3942] text-sm text-[#d1d7db]"
                onClick={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => setIsGroupModalOpen(true)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#182229] flex items-center gap-3 transition"
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>New Group</span>
                </button>
                <button
                  onClick={() => setIsSecurityModalOpen(true)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#182229] flex items-center gap-3 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Security &amp; Encryption</span>
                </button>
                <button
                  onClick={() => setIsInspectingWire(true)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#182229] flex items-center gap-3 transition"
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Inspect Encrypted Wire</span>
                </button>
                <button
                  onClick={onOpenProfile}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#182229] flex items-center gap-3 transition"
                >
                  <UserCheck className="w-4 h-4 text-blue-400" />
                  <span>Profile &amp; Keys</span>
                </button>
                <div className="my-1 border-t border-[#2a3942]" />
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#182229] text-rose-400 flex items-center gap-3 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Demo Account Switcher Bar (Instant testing of real-time multi-user) */}
      <div className="px-3 py-2 bg-[#182229] border-b border-[#222e35] flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Fast Switch:
        </span>
        {demoUsers.map((u) => {
          const isSelected = currentUser?.id === u.id;
          return (
            <button
              key={u.id}
              onClick={() => demoLogin(u.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-[#202c33] text-[#aebac1] hover:bg-[#2a3942] hover:text-white'
              }`}
              title={`Switch to ${u.name} (${u.role})`}
            >
              <img src={u.avatar} alt={u.name} className="w-3.5 h-3.5 rounded-full object-cover" />
              <span>{u.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="p-3 bg-[#111b21] flex flex-col gap-2 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-[#8696a0]" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#202c33] text-sm text-[#d1d7db] rounded-lg placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setChatFilter('all')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              chatFilter === 'all'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setChatFilter('unread')}
            className={`px-3 py-1 rounded-full font-medium transition ${
              chatFilter === 'unread'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setChatFilter('groups')}
            className={`px-3 py-1 rounded-full font-medium flex items-center gap-1 transition ${
              chatFilter === 'groups'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Groups</span>
            <span className="bg-[#111b21] text-[10px] px-1.5 py-0.2 rounded-full">
              {chats.filter((c) => c.type === 'group').length}
            </span>
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#222e35]/50">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-[#8696a0] flex flex-col items-center justify-center h-48">
            <MessageSquare className="w-10 h-10 text-[#374248] mb-2" />
            <p className="text-sm">No chats found</p>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="mt-3 text-xs text-emerald-400 hover:underline"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = chat.id === activeChatId;
            const isGroup = chat.type === 'group';

            // Find other participant for direct chat
            const otherParticipant = !isGroup
              ? chat.participantDetails?.find((p) => p.id !== currentUser?.id)
              : null;

            const chatTitle = isGroup ? chat.name : otherParticipant?.displayName || 'Chat';
            const chatAvatar = isGroup
              ? chat.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80'
              : otherParticipant?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

            const isOnline = isGroup
              ? chat.participantDetails?.some((p) => p.id !== currentUser?.id && p.online)
              : otherParticipant?.online;

            const isTyping = typingUsers[chat.id]?.length > 0;
            const typingText = isTyping
              ? isGroup
                ? `${typingUsers[chat.id][0]} is typing...`
                : 'typing...'
              : null;

            return (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={chatAvatar}
                    alt={chatTitle}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {isOnline && (
                    <span
                      className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#111b21] rounded-full"
                      title="Online"
                    />
                  )}
                  {isGroup && (
                    <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] p-0.5 rounded-full">
                      <Users className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-[#e9edef] truncate flex items-center gap-1.5">
                      <span>{chatTitle}</span>
                      {isGroup && (
                        <span className="text-[10px] bg-[#222e35] text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                          Group
                        </span>
                      )}
                    </h3>
                    <span className="text-[11px] text-[#8696a0] shrink-0 ml-2">
                      {formatChatTime(chat.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#8696a0]">
                    <div className="truncate flex items-center gap-1 pr-2">
                      {isTyping ? (
                        <span className="text-emerald-400 font-medium italic animate-pulse">
                          {typingText}
                        </span>
                      ) : (
                        <>
                          {chat.lastMessage?.senderId === currentUser?.id && (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                          <Lock className="w-2.5 h-2.5 text-emerald-500/70 shrink-0" />
                          <span className="truncate">
                            {chat.lastMessage?.previewText || 'Encrypted chat'}
                          </span>
                        </>
                      )}
                    </div>

                    {chat.unreadCount && chat.unreadCount > 0 ? (
                      <span className="bg-[#00a884] text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-4 text-center shrink-0">
                        {chat.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
