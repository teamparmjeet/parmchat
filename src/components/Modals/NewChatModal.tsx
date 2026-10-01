import React, { useState, useEffect } from 'react';
import { X, Search, ShieldCheck, Lock, UserCheck, Phone, AlertCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';

export const NewChatModal: React.FC = () => {
  const { isNewChatModalOpen, setIsNewChatModalOpen, createDirectChat } = useChat();
  const { currentUser, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Query server database search
  useEffect(() => {
    if (!isNewChatModalOpen) return;

    let isSubscribed = true;
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok && isSubscribed) {
          const data: User[] = await res.json();
          // Exclude current logged in user
          setSearchResults(data.filter((u) => u.id !== currentUser?.id));
        }
      } catch (err) {
        console.error('User search error:', err);
      } finally {
        if (isSubscribed) setIsSearching(false);
      }
    }, 200);

    return () => {
      isSubscribed = false;
      clearTimeout(delayDebounce);
    };
  }, [searchTerm, isNewChatModalOpen, token, currentUser?.id]);

  if (!isNewChatModalOpen) return null;

  const handleSelectUser = async (targetUserId: string) => {
    await createDirectChat(targetUserId);
    setIsNewChatModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#222e35] border border-[#2a3942] rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-[#e9edef]">
        {/* Header */}
        <div className="h-16 px-6 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold">New ParmChat Conversation</h2>
          </div>
          <button
            onClick={() => setIsNewChatModalOpen(false)}
            className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Verification Banner */}
        <div className="px-6 py-2 bg-[#182229] border-b border-[#2a3942] flex items-center justify-between text-xs text-emerald-400">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Search users registered in database (Phone / Name).</span>
          </div>
          <span className="text-[10px] bg-[#111b21] px-2 py-0.5 rounded text-[#8696a0] font-mono">
            DB Protected
          </span>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#2a3942]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
            <input
              type="text"
              placeholder="Search by registered phone number or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#111b21] rounded-lg text-sm text-[#d1d7db] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-[#8696a0] mt-2">
            💡 <em>Tip:</em> Private users are hidden from public discovery and only appear when
            searched by exact phone number or username.
          </p>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2a3942] p-2">
          {isSearching ? (
            <div className="text-center py-8 text-xs text-[#8696a0] flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Querying ParmChat registered database...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8696a0] px-4 space-y-1">
              <AlertCircle className="w-6 h-6 mx-auto text-[#8696a0] mb-1" />
              <p className="font-semibold text-white">No registered user found</p>
              <p>Only users existing in our database can be added. Check the phone number or username.</p>
            </div>
          ) : (
            searchResults.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className="flex items-center gap-3 p-3 hover:bg-[#111b21] rounded-lg cursor-pointer transition group"
              >
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                  {user.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#222e35] rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition truncate">
                      {user.displayName}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {user.privacy === 'private' && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                          Private
                        </span>
                      )}
                      <span title="E2EE Ready">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-[#8696a0] truncate flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-emerald-400/90">{user.phone}</span>
                    <span>·</span>
                    <span className="truncate">{user.about || `@${user.username}`}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
