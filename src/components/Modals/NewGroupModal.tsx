import React, { useState } from 'react';
import { X, Users, Search, Check, ShieldCheck, ArrowRight } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

export const NewGroupModal: React.FC = () => {
  const { isGroupModalOpen, setIsGroupModalOpen, allUsers, createGroupChat } = useChat();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchContact, setSearchContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isGroupModalOpen) return null;

  // Filter out self from participant options
  const eligibleUsers = allUsers.filter((u) => u.id !== currentUser?.id);
  const filteredUsers = eligibleUsers.filter(
    (u) =>
      u.displayName.toLowerCase().includes(searchContact.toLowerCase()) ||
      u.username.toLowerCase().includes(searchContact.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleNextStep = () => {
    if (selectedUserIds.length === 0) {
      alert('Please select at least one contact for the group');
      return;
    }
    setStep(2);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please provide a group name');
      return;
    }

    setIsSubmitting(true);
    try {
      await createGroupChat({
        name: groupName.trim(),
        description: groupDescription.trim() || 'WhatsApp End-to-End Encrypted Group',
        participantIds: selectedUserIds,
      });

      // Reset and close
      setStep(1);
      setSelectedUserIds([]);
      setGroupName('');
      setGroupDescription('');
      setIsGroupModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#222e35] border border-[#2a3942] rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-[#e9edef]">
        {/* Header */}
        <div className="h-16 px-6 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold">
              {step === 1 ? 'Add Group Participants' : 'New Group Details'}
            </h2>
          </div>
          <button
            onClick={() => {
              setIsGroupModalOpen(false);
              setStep(1);
            }}
            className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* E2EE Info banner */}
        <div className="px-6 py-2 bg-[#182229] border-b border-[#2a3942] flex items-center gap-2 text-xs text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Group messages are secured with sender-key end-to-end encryption.</span>
        </div>

        {step === 1 ? (
          /* Step 1: Select Participants */
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#111b21] rounded-lg text-sm text-[#d1d7db] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Selected Pills */}
            {selectedUserIds.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-3 max-h-20 overflow-y-auto">
                {selectedUserIds.map((id) => {
                  const u = allUsers.find((x) => x.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1 bg-[#111b21] text-xs px-2.5 py-1 rounded-full border border-emerald-500/30 text-emerald-400"
                    >
                      <span>{u?.displayName}</span>
                      <button
                        onClick={() => toggleUserSelection(id)}
                        className="hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#2a3942] pr-1">
              {filteredUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-[#111b21] rounded-lg cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-sm font-medium text-white">{user.displayName}</div>
                        <div className="text-xs text-[#8696a0]">{user.about || user.phone}</div>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-[#8696a0]'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next Button */}
            <div className="mt-4 pt-3 border-t border-[#2a3942] flex justify-end">
              <button
                onClick={handleNextStep}
                disabled={selectedUserIds.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                <span>Next ({selectedUserIds.length})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Group Info */
          <div className="flex-1 p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8696a0] uppercase mb-1">
                  Group Subject / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Security & Cryptography Core"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#111b21] rounded-lg text-sm text-[#d1d7db] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8696a0] uppercase mb-1">
                  Group Description (Optional)
                </label>
                <textarea
                  placeholder="Add group guidelines or details..."
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-[#111b21] rounded-lg text-sm text-[#d1d7db] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                />
              </div>

              <div className="p-3 bg-[#111b21] rounded-lg text-xs text-[#8696a0]">
                <div className="font-semibold text-emerald-400 mb-1">Participants summary:</div>
                <div>You + {selectedUserIds.length} contacts selected</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#2a3942]">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-[#8696a0] hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isSubmitting || !groupName.trim()}
                className="px-6 py-2.5 bg-[#00a884] hover:bg-[#029070] disabled:opacity-50 text-white font-medium text-sm rounded-lg transition shadow flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Provisioning Keys...' : 'Create E2EE Group'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
