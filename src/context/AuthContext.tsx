import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { E2EEService } from '../crypto/e2ee';
import { realtime } from '../services/websocket';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  keyPair: CryptoKeyPair | null;
  publicJwk: JsonWebKey | null;
  isLoading: boolean;
  demoUsers: { id: string; name: string; avatar: string; role: string }[];
  dualDeviceMode: boolean;
  setDualDeviceMode: (val: boolean) => void;
  secondaryUserId: string;
  setSecondaryUserId: (id: string) => void;
  login: (username: string, password?: string) => Promise<boolean>;
  register: (data: {
    username: string;
    displayName: string;
    phone?: string;
    avatar?: string;
    privacy?: 'public' | 'private';
  }) => Promise<boolean>;
  demoLogin: (userId: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS_LIST = [
  {
    id: 'user_alex',
    name: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Security Lead',
  },
  {
    id: 'user_sarah',
    name: 'Sarah Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'Cryptographer',
  },
  {
    id: 'user_marcus',
    name: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'Core Engineer',
  },
  {
    id: 'user_elena',
    name: 'Elena Rostova',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    role: 'Protocol Auditor',
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [publicJwk, setPublicJwk] = useState<JsonWebKey | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dualDeviceMode, setDualDeviceMode] = useState<boolean>(false);
  const [secondaryUserId, setSecondaryUserId] = useState<string>('user_sarah');

  // Initialize Auth on mount
  useEffect(() => {
    async function initAuth() {
      const savedToken = localStorage.getItem('wa_token');
      const savedUserId = localStorage.getItem('wa_user_id');

      if (savedToken && savedUserId) {
        try {
          // Verify with server demo-login or user fetch
          const res = await fetch('/api/auth/demo-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: savedUserId }),
          });

          if (res.ok) {
            const data = await res.json();
            await setupUserKeysAndSession(data.user, data.token);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to restore session:', e);
        }
      }

      // Default to Alex on initial launch for seamless instant demo
      await demoLogin('user_alex');
      setIsLoading(false);
    }

    initAuth();
  }, []);

  async function setupUserKeysAndSession(user: User, userToken: string) {
    // 1. Generate or load Web Crypto ECDH Keys for this user
    const keys = await E2EEService.getOrCreateUserKeys(user.id);
    setKeyPair(keys.keyPair);
    setPublicJwk(keys.publicJwk);

    // 2. Publish public key JWK to server if not present
    if (!user.publicKeyJwk || JSON.stringify(user.publicKeyJwk) !== JSON.stringify(keys.publicJwk)) {
      try {
        await fetch('/api/users/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            publicKeyJwk: keys.publicJwk,
          }),
        });
        user.publicKeyJwk = keys.publicJwk;
      } catch (err) {
        console.error('Failed to sync public key to server:', err);
      }
    }

    setCurrentUser(user);
    setToken(userToken);
    localStorage.setItem('wa_token', userToken);
    localStorage.setItem('wa_user_id', user.id);

    // 3. Connect WebSocket
    realtime.connect(userToken, user.id);
  }

  async function demoLogin(userId: string) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) throw new Error('Demo login failed');
      const data = await res.json();
      await setupUserKeysAndSession(data.user, data.token);

      // Auto update secondary user for split-view if same
      if (userId === secondaryUserId) {
        const nextSecondary = DEMO_USERS_LIST.find((u) => u.id !== userId);
        if (nextSecondary) setSecondaryUserId(nextSecondary.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(username: string, password = 'demo123'): Promise<boolean> {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      await setupUserKeysAndSession(data.user, data.token);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function register(data: {
    username: string;
    displayName: string;
    phone?: string;
    avatar?: string;
    privacy?: 'public' | 'private';
  }): Promise<boolean> {
    setIsLoading(true);
    try {
      // Pre-generate keys
      const dummyId = `user_${Date.now()}`;
      const keys = await E2EEService.getOrCreateUserKeys(dummyId);

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          publicKeyJwk: keys.publicJwk,
        }),
      });

      if (!res.ok) {
        return false;
      }

      const result = await res.json();
      // Re-save keys under real user ID
      E2EEService.saveKeysLocally(
        result.user.id,
        await E2EEService.exportJWK(keys.keyPair.privateKey),
        keys.publicJwk
      );

      await setupUserKeysAndSession(result.user, result.token);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    realtime.disconnect();
    setCurrentUser(null);
    setToken(null);
    setKeyPair(null);
    setPublicJwk(null);
    localStorage.removeItem('wa_token');
    localStorage.removeItem('wa_user_id');
  }

  async function updateProfile(data: Partial<User>) {
    if (!token || !currentUser) return;
    try {
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        setCurrentUser(result.user);
      }
    } catch (err) {
      console.error('Update profile failed:', err);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        keyPair,
        publicJwk,
        isLoading,
        demoUsers: DEMO_USERS_LIST,
        dualDeviceMode,
        setDualDeviceMode,
        secondaryUserId,
        setSecondaryUserId,
        login,
        register,
        demoLogin,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
