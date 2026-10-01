import React, { useState } from 'react';
import { X, Lock, ShieldCheck, Key, Copy, Check, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ProfileModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, publicJwk, updateProfile } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [about, setAbout] = useState(currentUser?.about || '');
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleSaveName = async () => {
    if (displayName.trim()) {
      await updateProfile({ displayName: displayName.trim() });
      setIsEditingName(false);
    }
  };

  const handleSaveAbout = async () => {
    if (about.trim()) {
      await updateProfile({ about: about.trim() });
      setIsEditingAbout(false);
    }
  };

  const copyPublicKey = () => {
    if (publicJwk) {
      navigator.clipboard.writeText(JSON.stringify(publicJwk, null, 2));
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#222e35] border border-[#2a3942] rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-[#e9edef]">
        {/* Header */}
        <div className="h-16 px-6 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <h2 className="text-base font-semibold">Profile &amp; Encryption Keys</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#374248] rounded-full text-[#8696a0] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Avatar & Phone */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500 shadow-lg"
              />
              <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-[#222e35] rounded-full" />
            </div>
            <span className="text-xs text-[#8696a0] font-mono">{currentUser.phone}</span>
          </div>

          {/* Display Name */}
          <div className="bg-[#111b21] p-3 rounded-lg border border-[#2a3942]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-[#8696a0] uppercase">Your Name</span>
              {!isEditingName && (
                <button
                  onClick={() => {
                    setDisplayName(currentUser.displayName);
                    setIsEditingName(true);
                  }}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-[#202c33] px-2 py-1 rounded text-sm text-white flex-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={handleSaveName}
                  className="px-2.5 py-1 bg-emerald-600 text-white text-xs rounded"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-white">{currentUser.displayName}</p>
            )}
          </div>

          {/* Profile Privacy Setting (Public vs Private) */}
          <div className="bg-[#111b21] p-3 rounded-lg border border-[#2a3942] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#8696a0] uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Profile Privacy</span>
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                  (currentUser.privacy || 'public') === 'public'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {currentUser.privacy || 'public'}
              </span>
            </div>

            <p className="text-[11px] text-[#8696a0] leading-relaxed">
              {(currentUser.privacy || 'public') === 'public'
                ? 'Your profile is Public. All registered users in the database can discover you.'
                : 'Your profile is Private. Only friends you already have chats with can see you. Non-friends cannot find you in global search.'}
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateProfile({ privacy: 'public' })}
                className={`flex-1 py-1.5 text-xs rounded font-medium transition ${
                  (currentUser.privacy || 'public') === 'public'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => updateProfile({ privacy: 'private' })}
                className={`flex-1 py-1.5 text-xs rounded font-medium transition ${
                  currentUser.privacy === 'private'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                }`}
              >
                Private (Friends Only)
              </button>
            </div>
          </div>

          {/* E2EE Public Key JWK Inspection */}
          <div className="bg-[#111b21] p-3 rounded-lg border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase">
                <Key className="w-3.5 h-3.5" />
                <span>Web Crypto ECDH Public Key</span>
              </div>
              <button
                onClick={copyPublicKey}
                className="text-xs text-[#8696a0] hover:text-white flex items-center gap-1"
                title="Copy JWK"
              >
                {copiedKey ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-[#8696a0]">
              This public key is published so other participants can establish pairwise ECDH shared
              secrets.
            </p>

            <pre className="text-[10px] font-mono text-emerald-300 bg-[#0b141a] p-2 rounded max-h-32 overflow-y-auto">
              {publicJwk ? JSON.stringify(publicJwk, null, 2) : 'Loading cryptographic keys...'}
            </pre>

            <div className="flex items-center gap-1.5 text-[11px] text-[#8696a0] pt-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Your private key is isolated in local browser memory and never uploaded.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
