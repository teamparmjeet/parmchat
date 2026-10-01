import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ShieldCheck, Lock } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { audioFx } from '../../utils/audio';

export const CallModal: React.FC = () => {
  const { activeCall, endCall, acceptCall } = useChat();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (activeCall?.status === 'ringing') {
      audioFx.startRinging();
    } else {
      audioFx.stopRinging();
    }

    return () => {
      audioFx.stopRinging();
    };
  }, [activeCall?.status]);

  useEffect(() => {
    let timer: any = null;
    if (activeCall?.status === 'connected') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall?.status]);

  if (!activeCall) return null;

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 bg-[#0b141a]/95 backdrop-blur-md flex flex-col items-center justify-between p-8 z-50 text-white animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col items-center gap-1.5 mt-8">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-[#182229] px-3 py-1 rounded-full border border-emerald-500/30">
          <Lock className="w-3.5 h-3.5" />
          <span>End-to-End Encrypted Call</span>
        </div>
        <h2 className="text-2xl font-bold mt-2">{activeCall.peerUser.displayName}</h2>
        <p className="text-sm text-[#8696a0]">
          {activeCall.status === 'connected'
            ? formatTimer(callDuration)
            : activeCall.direction === 'incoming'
            ? `Incoming WhatsApp ${activeCall.callType} call...`
            : `Ringing WhatsApp ${activeCall.callType} call...`}
        </p>
      </div>

      {/* Center Avatar with Pulse */}
      <div className="relative flex items-center justify-center my-auto">
        {activeCall.status === 'ringing' && (
          <div className="absolute w-44 h-44 rounded-full bg-emerald-500/20 animate-ping" />
        )}
        <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl relative z-10">
          <img
            src={activeCall.peerUser.avatar}
            alt={activeCall.peerUser.displayName}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-6 mb-12">
        {activeCall.status === 'ringing' && activeCall.direction === 'incoming' ? (
          <>
            {/* Decline */}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center shadow-lg transition transform hover:scale-105"
              title="Decline"
            >
              <PhoneOff className="w-7 h-7" />
            </button>

            {/* Accept */}
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-lg transition transform hover:scale-105"
              title="Accept"
            >
              <Phone className="w-7 h-7" />
            </button>
          </>
        ) : (
          <>
            {/* Mute */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition shadow ${
                isMuted ? 'bg-rose-600' : 'bg-[#202c33] hover:bg-[#2a3942]'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* Video Camera Toggle */}
            <button
              onClick={() => setIsVideoDisabled(!isVideoDisabled)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition shadow ${
                isVideoDisabled ? 'bg-rose-600' : 'bg-[#202c33] hover:bg-[#2a3942]'
              }`}
              title={isVideoDisabled ? 'Enable Video' : 'Disable Video'}
            >
              {isVideoDisabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            {/* End Call */}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center shadow-xl transition transform hover:scale-105"
              title="End Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
