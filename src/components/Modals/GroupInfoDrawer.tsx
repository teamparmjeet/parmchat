import React, { useState } from 'react';
import {
  X,
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  Crown,
  Edit2,
  Check,
  LogOut,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

export const GroupInfoDrawer: React.FC = () => {
  const {
    activeChat,
    isGroupInfoOpen,
    setIsGroupInfoOpen,
    allUsers,
    updateGroup,
    setIsSecurityModalOpen,
  } = useChat();
  const { currentUser } = useAuth();

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descText, setDescText] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);

  if (!isGroupInfoOpen || !activeChat || activeChat.type !== 'group') return null;

  const isAdmin = activeChat.admins?.includes(currentUser?.id || '');
  const nonParticipants = allUsers.filter((u) => !activeChat.participants.includes(u.id));

  const handleSaveDescription = async () => {
    await updateGroup(activeChat.id, { description: descText });
    setIsEditingDescription(false);
  };

  const handleAddSelectedParticipants = async () => {
    if (selectedToAdd.length === 0) return;
    await updateGroup(activeChat.id, { addParticipants: selectedToAdd });
    setSelectedToAdd([]);
    setShowAddMember(false);
  };

  const handleRemoveParticipant = async (pid: string) => {
    if (confirm('Remove this participant from the encrypted group?')) {
      await updateGroup(activeChat.id, { removeParticipants: [pid] });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#111b21] border-l border-[#222e35] z-40 shadow-2xl flex flex-col text-[#e9edef] animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-16 px-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between">
        <h2 className="text-base font-semibold">Group Info</h2>
        <button
          onClick={() => setIsGroupInfoOpen(false)}
          className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Group Banner */}
        <div className="bg-[#202c33] rounded-xl p-5 flex flex-col items-center text-center shadow">
          <img
            src={
              activeChat.avatar ||
              'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80'
            }
            alt={activeChat.name}
            className="w-24 h-24 rounded-full object-cover mb-3 border-2 border-emerald-500/40"
          />
          <h3 className="text-lg font-bold text-white mb-1">{activeChat.name}</h3>
          <p className="text-xs text-[#8696a0]">
            Group · {activeChat.participants.length} participants
          </p>
        </div>

        {/* Group Description */}
        <div className="bg-[#202c33] rounded-xl p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-[#8696a0]">Description</span>
            {isAdmin && !isEditingDescription && (
              <button
                onClick={() => {
                  setDescText(activeChat.description || '');
                  setIsEditingDescription(true);
                }}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
          </div>

          {isEditingDescription ? (
            <div>
              <textarea
                value={descText}
                onChange={(e) => setDescText(e.target.value)}
                className="w-full bg-[#111b21] p-2 text-xs rounded border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsEditingDescription(false)}
                  className="px-2.5 py-1 text-xs text-[#8696a0]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDescription}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#d1d7db] leading-relaxed">
              {activeChat.description || 'No description provided'}
            </p>
          )}
        </div>

        {/* Encryption Safety Card */}
        <div
          onClick={() => setIsSecurityModalOpen(true)}
          className="bg-[#202c33] hover:bg-[#2a3942] transition cursor-pointer rounded-xl p-4 shadow flex items-center gap-3 border border-emerald-500/20"
        >
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white flex items-center gap-1">
              <span>Encryption Active</span>
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            </div>
            <p className="text-[11px] text-[#8696a0] line-clamp-1">
              Messages are end-to-end encrypted. Tap to verify.
            </p>
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-[#202c33] rounded-xl p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-[#8696a0]">
              {activeChat.participants.length} Participants
            </span>
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            )}
          </div>

          {/* Add member selector */}
          {showAddMember && (
            <div className="mb-4 p-3 bg-[#111b21] rounded-lg border border-[#2a3942]">
              <span className="text-xs font-semibold text-white block mb-2">
                Select contact to add:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto mb-2">
                {nonParticipants.length === 0 ? (
                  <p className="text-xs text-[#8696a0]">All available contacts are in this group</p>
                ) : (
                  nonParticipants.map((u) => {
                    const isChecked = selectedToAdd.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() =>
                          setSelectedToAdd((prev) =>
                            isChecked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          )
                        }
                        className="flex items-center justify-between p-1.5 hover:bg-[#202c33] rounded cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={u.avatar}
                            alt={u.displayName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span>{u.displayName}</span>
                        </div>
                        <input type="checkbox" checked={isChecked} readOnly />
                      </div>
                    );
                  })
                )}
              </div>
              {nonParticipants.length > 0 && (
                <button
                  onClick={handleAddSelectedParticipants}
                  disabled={selectedToAdd.length === 0}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium"
                >
                  Add Selected ({selectedToAdd.length})
                </button>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            {activeChat.participants.map((pid) => {
              const user = allUsers.find((u) => u.id === pid);
              const isGroupAdmin = activeChat.admins?.includes(pid);
              const isSelf = pid === currentUser?.id;

              return (
                <div key={pid} className="flex items-center justify-between py-1.5 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={user?.avatar}
                      alt={user?.displayName}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{user?.displayName || 'User'}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-[#111b21] px-1 py-0.2 rounded text-emerald-400">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8696a0] truncate">
                        {user?.about || user?.phone}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isGroupAdmin && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                        <Crown className="w-2.5 h-2.5" />
                        Admin
                      </span>
                    )}

                    {isAdmin && !isSelf && (
                      <button
                        onClick={() => handleRemoveParticipant(pid)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:bg-[#111b21] rounded transition"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Exit Group */}
        <div className="pt-2">
          <button
            onClick={() => {
              if (confirm('Leave this group?')) {
                updateGroup(activeChat.id, {
                  removeParticipants: [currentUser?.id || ''],
                });
                setIsGroupInfoOpen(false);
              }
            }}
            className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition border border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit Group</span>
          </button>
        </div>
      </div>
    </div>
  );
};
