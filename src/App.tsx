import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatArea } from './components/Chat/ChatArea';
import { NewGroupModal } from './components/Modals/NewGroupModal';
import { GroupInfoDrawer } from './components/Modals/GroupInfoDrawer';
import { SecurityVerifyModal } from './components/Modals/SecurityVerifyModal';
import { NewChatModal } from './components/Modals/NewChatModal';
import { ProfileModal } from './components/Modals/ProfileModal';
import { StatusStoriesModal } from './components/Modals/StatusStoriesModal';
import { CallModal } from './components/Modals/CallModal';
import { DualDeviceView } from './components/DualDeviceView/DualDeviceView';
import { AuthModal } from './components/Auth/AuthModal';
import { ArrowLeft, Lock, ShieldCheck, Split, LogIn, Users } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentUser, isLoading, dualDeviceMode, setDualDeviceMode } = useAuth();
  const { activeChat, setActiveChatId, setIsGroupModalOpen } = useChat();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#111b21] flex flex-col items-center justify-center text-white select-none">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/30 animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-medium tracking-wide mb-2">ParmChat Web</h1>
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
          <ShieldCheck className="w-4 h-4 animate-spin" />
          <span>Initializing ParmChat Web Crypto Keys &amp; Database...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0c1317] flex flex-col font-sans select-none">
      {/* Top Subtle Status Bar */}
      <header className="h-8 bg-[#182229] border-b border-[#222e35] px-4 flex items-center justify-between text-[11px] text-[#8696a0] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-semibold text-[#d1d7db]">ParmChat E2EE</span>
          <span className="hidden sm:inline opacity-50">|</span>
          <span className="hidden sm:flex items-center gap-1 text-emerald-400 font-mono">
            <Lock className="w-2.5 h-2.5" />
            <span>ECDH P-256 + AES-GCM-256</span>
          </span>
          <span className="hidden md:inline opacity-50">|</span>
          <span className="hidden md:inline text-[10px] text-emerald-400/80 font-mono">
            MySQL &amp; AWS Ready
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Group creation button */}
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition"
            title="Create Group Chat"
          >
            <Users className="w-3 h-3" />
            <span className="hidden sm:inline">New Group</span>
          </button>

          {/* Dual Simulator Toggle */}
          <button
            onClick={() => setDualDeviceMode(!dualDeviceMode)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition ${
              dualDeviceMode
                ? 'bg-emerald-600 text-white'
                : 'bg-[#202c33] text-[#aebac1] hover:text-white'
            }`}
            title="Open side-by-side simulator for 2-user real-time testing"
          >
            <Split className="w-3 h-3" />
            <span>{dualDeviceMode ? 'Dual Mode ON' : 'Dual Mode'}</span>
          </button>

          {/* Account Modal Toggle */}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-1 text-[#8696a0] hover:text-white transition"
          >
            <LogIn className="w-3 h-3" />
            <span className="hidden sm:inline">Switch / Register</span>
          </button>
        </div>
      </header>

      {/* Main WhatsApp Window */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* On Mobile: Back button when in chat */}
        {activeChat && (
          <button
            onClick={() => setActiveChatId(null)}
            className="md:hidden absolute top-4 left-2 z-30 p-2 bg-[#202c33] text-white rounded-full shadow"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Sidebar */}
        <div
          className={`${
            activeChat ? 'hidden md:flex' : 'flex'
          } h-full w-full md:w-auto shrink-0`}
        >
          <Sidebar
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenStatus={() => setIsStatusOpen(true)}
          />
        </div>

        {/* Chat Area */}
        <div className={`${!activeChat ? 'hidden md:flex' : 'flex'} flex-1 h-full min-w-0`}>
          <ChatArea />
        </div>

        {/* Group Info Drawer (Right slideover) */}
        <GroupInfoDrawer />

        {/* Dual Device Live Simulator (Split Screen for testing) */}
        {dualDeviceMode && <DualDeviceView />}
      </div>

      {/* Modals */}
      <NewGroupModal />
      <NewChatModal />
      <SecurityVerifyModal />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <StatusStoriesModal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} />
      <CallModal />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <MainAppContent />
      </ChatProvider>
    </AuthProvider>
  );
}
