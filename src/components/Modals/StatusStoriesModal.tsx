import React, { useState, useEffect } from 'react';
import { X, CircleDot, Plus, Eye, Send } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

export const StatusStoriesModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { statuses, refreshChats } = useChat();
  const { currentUser, token } = useAuth();

  const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [newStatusText, setNewStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState('#005c4b');

  const BG_COLORS = ['#005c4b', '#1f3c88', '#581845', '#1a365d', '#334155'];

  // Auto advance status story timer
  useEffect(() => {
    if (activeStatusIndex !== null && statuses.length > 0) {
      const timer = setTimeout(() => {
        if (activeStatusIndex < statuses.length - 1) {
          setActiveStatusIndex(activeStatusIndex + 1);
        } else {
          setActiveStatusIndex(null);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeStatusIndex, statuses.length]);

  if (!isOpen) return null;

  const handlePostStatus = async () => {
    if (!newStatusText.trim() || !token) return;
    try {
      const res = await fetch('/api/status/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'text',
          content: newStatusText.trim(),
          bgColor: selectedBg,
        }),
      });

      if (res.ok) {
        setNewStatusText('');
        setIsPosting(false);
        refreshChats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const currentViewed = activeStatusIndex !== null ? statuses[activeStatusIndex] : null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#222e35] border border-[#2a3942] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[650px] max-h-[90vh] text-[#e9edef] relative">
        {/* Fullscreen Story Viewer Overlay if one is active */}
        {currentViewed ? (
          <div
            className="absolute inset-0 z-30 flex flex-col justify-between p-6 text-white"
            style={{ backgroundColor: currentViewed.bgColor || '#005c4b' }}
          >
            {/* Story Top Progress Bars */}
            <div className="flex gap-1 mb-4">
              {statuses.map((_, idx) => (
                <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-white transition-all ${
                      idx < (activeStatusIndex || 0)
                        ? 'w-full'
                        : idx === activeStatusIndex
                        ? 'w-full duration-5000 ease-linear'
                        : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Story Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={currentViewed.userAvatar}
                  alt={currentViewed.userName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/50"
                />
                <div>
                  <h3 className="font-semibold text-sm">{currentViewed.userName}</h3>
                  <p className="text-[11px] opacity-80">
                    {new Date(currentViewed.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveStatusIndex(null)}
                className="p-1 hover:bg-black/20 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Story Content */}
            <div className="my-auto flex flex-col items-center justify-center text-center px-6">
              {currentViewed.type === 'image' ? (
                <div className="flex flex-col items-center">
                  <img
                    src={currentViewed.content}
                    alt="Status"
                    className="max-h-72 rounded-xl object-contain mb-3 shadow-lg"
                  />
                  {currentViewed.caption && (
                    <p className="text-sm font-medium">{currentViewed.caption}</p>
                  )}
                </div>
              ) : (
                <p className="text-2xl font-medium leading-relaxed max-w-sm">
                  {currentViewed.content}
                </p>
              )}
            </div>

            {/* Story Footer */}
            <div className="flex justify-between items-center text-xs opacity-75">
              <span>End-to-End Encrypted Status</span>
              <button
                onClick={() => setActiveStatusIndex(null)}
                className="px-3 py-1 bg-black/30 hover:bg-black/50 rounded-full"
              >
                Close Story
              </button>
            </div>
          </div>
        ) : null}

        {/* Normal Status Header */}
        <div className="h-16 px-6 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDot className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold">Status Updates</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* My Status Card */}
          <div className="bg-[#111b21] p-3 rounded-xl border border-[#2a3942] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={currentUser?.avatar}
                  alt={currentUser?.displayName}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <button
                  onClick={() => setIsPosting(true)}
                  className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs border border-[#111b21]"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">My Status</h3>
                <p className="text-xs text-[#8696a0]">Tap to add status update</p>
              </div>
            </div>

            <button
              onClick={() => setIsPosting(!isPosting)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
            >
              Add Update
            </button>
          </div>

          {/* Create Status Drawer/Form */}
          {isPosting && (
            <div className="p-4 bg-[#182229] rounded-xl border border-emerald-500/30 space-y-3">
              <span className="text-xs font-semibold uppercase text-emerald-400">
                Write Text Status
              </span>
              <textarea
                placeholder="What's on your mind? (End-to-end encrypted)"
                value={newStatusText}
                onChange={(e) => setNewStatusText(e.target.value)}
                rows={3}
                className="w-full bg-[#111b21] p-3 rounded-lg text-sm text-white placeholder-[#8696a0] border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
              />

              <div className="flex items-center justify-between">
                {/* Background color selection */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8696a0]">Color:</span>
                  {BG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedBg(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        selectedBg === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPosting(false)}
                    className="px-3 py-1 text-xs text-[#8696a0]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePostStatus}
                    disabled={!newStatusText.trim()}
                    className="px-4 py-1.5 bg-[#00a884] hover:bg-[#029070] disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    <span>Post</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent Updates from Contacts */}
          <div>
            <span className="text-xs font-semibold uppercase text-[#8696a0] block mb-2 px-1">
              Recent Updates ({statuses.length})
            </span>

            {statuses.length === 0 ? (
              <p className="text-xs text-[#8696a0] p-4 text-center">No recent status updates</p>
            ) : (
              <div className="space-y-2">
                {statuses.map((status, index) => (
                  <div
                    key={status.id}
                    onClick={() => setActiveStatusIndex(index)}
                    className="flex items-center justify-between p-2.5 bg-[#111b21] hover:bg-[#182229] rounded-xl cursor-pointer transition border border-[#2a3942]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative p-0.5 rounded-full border-2 border-emerald-500">
                        <img
                          src={status.userAvatar}
                          alt={status.userName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">{status.userName}</h4>
                        <p className="text-[11px] text-[#8696a0]">
                          {new Date(status.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
