import React, { useState } from 'react';
import { Lock, ShieldCheck, User, Key, Phone, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { login, register, demoLogin, demoUsers } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        if (!username || !displayName) {
          setError('Username and Display Name are required');
          setIsLoading(false);
          return;
        }

        const success = await register({
          username: username.toLowerCase().trim(),
          displayName: displayName.trim(),
          phone: phone.trim() || undefined,
          privacy,
        });

        if (success) {
          onClose();
        } else {
          setError('Username already taken or registration failed');
        }
      } else {
        if (!username) {
          setError('Username is required');
          setIsLoading(false);
          return;
        }

        const success = await login(username.toLowerCase().trim(), password);
        if (success) {
          onClose();
        } else {
          setError('User not found or invalid password');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#222e35] border border-[#2a3942] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-[#e9edef]">
        {/* Header */}
        <div className="p-6 bg-[#202c33] border-b border-[#2a3942] text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-3 border border-emerald-500/30">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            {isRegistering ? 'Create ParmChat Account' : 'ParmChat Authentication'}
          </h2>
          <p className="text-xs text-[#8696a0]">
            Automatic ECDH P-256 Keypair generation in browser memory
          </p>
        </div>

        {/* Demo Fast Logins */}
        <div className="p-4 bg-[#182229] border-b border-[#2a3942]">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-2 text-center">
            Or Instant 1-Click Demo Login:
          </span>
          <div className="grid grid-cols-2 gap-2">
            {demoUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={async () => {
                  await demoLogin(u.id);
                  onClose();
                }}
                className="flex items-center gap-2 p-2 bg-[#202c33] hover:bg-[#2a3942] border border-[#2a3942] rounded-xl text-left transition"
              >
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{u.name}</div>
                  <div className="text-[10px] text-[#8696a0] truncate">{u.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Auth Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#8696a0] uppercase mb-1">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
              <input
                type="text"
                placeholder="e.g. alex"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#111b21] rounded-lg text-sm text-white placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {isRegistering && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#8696a0] uppercase mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 bg-[#111b21] rounded-lg text-sm text-white placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8696a0] uppercase mb-1">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#111b21] rounded-lg text-sm text-white placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8696a0] uppercase mb-1">
                  Profile Privacy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrivacy('public')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                      privacy === 'public'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400 font-semibold'
                        : 'bg-[#111b21] border-[#2a3942] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    Public (All users)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivacy('private')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                      privacy === 'private'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-400 font-semibold'
                        : 'bg-[#111b21] border-[#2a3942] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    Private (Friends only)
                  </button>
                </div>
                <p className="text-[10px] text-[#8696a0] mt-1">
                  {privacy === 'public'
                    ? 'Anyone can discover you in ParmChat search.'
                    : 'Hidden from non-friends in global search.'}
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#8696a0] uppercase mb-1">
              Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-3 text-[#8696a0]" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#111b21] rounded-lg text-sm text-white placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#00a884] hover:bg-[#029070] disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shadow flex items-center justify-center gap-2"
          >
            {isRegistering ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'Generating Keys...' : 'Create Account & Keys'}</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Verifying...' : 'Sign In'}</span>
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
              className="text-xs text-emerald-400 hover:underline"
            >
              {isRegistering
                ? 'Already have an account? Sign In'
                : 'Need a new account? Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
