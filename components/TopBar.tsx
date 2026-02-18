'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { MessageSquare, ChevronDown, Settings, Volume2, VolumeX } from 'lucide-react';

interface TopBarProps {
  ttsEnabled: boolean;
  onToggleTts: () => void;
  showChat: boolean;
  onToggleChat: () => void;
  onOpenSettings: () => void;
  aiName?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
}

export default function TopBar({
  ttsEnabled,
  onToggleTts,
  showChat,
  onToggleChat,
  onOpenSettings,
  aiName = 'Live',
  isListening = false,
  isSpeaking = false,
}: TopBarProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative z-20 flex items-center justify-between px-4 py-3 safe-area-top min-h-[60px]">
      {/* Left: TTS Toggle */}
      <div className="flex-1 flex justify-start">
        <button
          onClick={onToggleTts}
          aria-label={ttsEnabled ? '音声をオフ' : '音声をオン'}
          className="p-2 text-white/50 hover:text-white transition-colors"
        >
          {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>

      {/* Center: Live Indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/90">
        <div className="flex items-center gap-1">
          <motion.div
            animate={prefersReducedMotion ? { opacity: 0.8 } : (isListening || isSpeaking ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.8 })}
            transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1.5 }}
            className="w-0.5 h-3 bg-white/80 rounded-full"
          />
          <motion.div
            animate={prefersReducedMotion ? { opacity: 0.6 } : (isListening || isSpeaking ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.6 })}
            transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1.5, delay: 0.2 }}
            className="w-0.5 h-2 bg-white/60 rounded-full"
          />
          <motion.div
            animate={prefersReducedMotion ? { opacity: 0.8 } : (isListening || isSpeaking ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.8 })}
            transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1.5, delay: 0.4 }}
            className="w-0.5 h-3 bg-white/80 rounded-full"
          />
        </div>
        <span className="text-sm font-medium tracking-widest uppercase">
          {aiName}
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex-1 flex justify-end items-center gap-1">
        <button
          onClick={onToggleChat}
          aria-label={showChat ? 'チャットを隠す' : 'チャットを表示'}
          className="p-2 text-white/50 hover:text-white transition-colors"
        >
          {showChat ? <ChevronDown size={22} /> : <MessageSquare size={22} />}
        </button>
        <button
          onClick={onOpenSettings}
          aria-label="設定を開く"
          className="p-2 text-white/50 hover:text-white transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
