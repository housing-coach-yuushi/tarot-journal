'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Mic, Send, Download, Share2, Loader2, Radio } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Message } from '@/hooks/useChat';

const TarotDrawButton = dynamic(() => import('@/components/TarotDrawButton'), { ssr: false });
const TarotDeckShuffle = dynamic(() => import('@/components/TarotDeckShuffle').then(m => m.TarotDeckShuffle), { ssr: false });

interface BottomControlsProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSending: boolean;
  isListening: boolean;
  messages: Message[];
  isSummarizing: boolean;
  isSharing: boolean;
  sttSupported: boolean;
  currentTranscript: string;
  heldTranscript: string;
  isShuffleOpen: boolean;
  onMicDown: (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => void;
  onMicUp: (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => void;
  onMicCancel: (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => void;
  onSave: () => void;
  onShare: () => void;
  onOpenRadio: () => void;
  onOpenShuffle: () => void;
  onCloseShuffle: () => void;
  onCardSelected: () => void;
  radioNotification: string | null;
}

export default function BottomControls({
  input,
  onInputChange,
  onSubmit,
  isSending,
  isListening,
  messages,
  isSummarizing,
  isSharing,
  sttSupported,
  currentTranscript,
  heldTranscript,
  isShuffleOpen,
  onMicDown,
  onMicUp,
  onMicCancel,
  onSave,
  onShare,
  onOpenRadio,
  onOpenShuffle,
  onCloseShuffle,
  onCardSelected,
  radioNotification,
}: BottomControlsProps) {
  const prefersReducedMotion = useReducedMotion();
  const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;

  return (
    <>
      {/* Listening indicator */}
      {isListening && (
        <div className="absolute bottom-40 left-0 right-0 flex justify-center z-30 px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 max-w-md"
          >
            <p className="text-white/80 text-sm text-center">
              {(heldTranscript ? `${heldTranscript} ${currentTranscript}`.trim() : currentTranscript) || '押したまま話してください...'}
            </p>
          </motion.div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="relative z-20 p-4 safe-area-bottom pb-6">
        <div className="max-w-2xl mx-auto px-2">
          {/* Input Form */}
          <form onSubmit={onSubmit} className="flex items-center gap-3 mb-4">
            <div className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="メッセージを入力..."
                className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-base"
                disabled={isSending || isListening}
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.9 }}
                disabled={!input.trim() || isSending}
                className="p-2 rounded-full bg-blue-600 text-white disabled:opacity-50"
              >
                <Send size={16} />
              </motion.button>
            </div>
          </form>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            {/* Left: Radio & Tarot */}
            <div className="flex-1 flex justify-end items-center gap-3 sm:gap-4">
              <motion.button
                onClick={onOpenRadio}
                whileTap={{ scale: 0.95 }}
                title="Weekly Radio"
                aria-label="ウィークリーラジオを開く"
                className="p-4 rounded-full bg-white/10 backdrop-blur-sm text-gold-400 hover:bg-white/20 border border-gold-500/30 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] relative"
              >
                <Radio size={24} />
                {radioNotification && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black"
                  />
                )}
              </motion.button>
              <TarotDrawButton
                disabled={isSending || isListening || isShuffleOpen}
                onCardDrawn={onOpenShuffle}
              />
            </div>

            <TarotDeckShuffle
              isOpen={isShuffleOpen}
              onCardSelected={onCardSelected}
              onClose={onCloseShuffle}
            />

            {/* Center: Mic Button */}
            <motion.div className="relative">
              <AnimatePresence>
                {isListening && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={prefersReducedMotion ? { opacity: 0.25, scale: 1 } : {
                        opacity: [0, 0.4, 0],
                        scale: [1, 1.5, 1.8],
                      }}
                      transition={prefersReducedMotion ? undefined : {
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "easeOut"
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 rounded-full bg-red-500 blur-xl"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={prefersReducedMotion ? { opacity: 0.2, scale: 1 } : {
                        opacity: [0, 0.6, 0],
                        scale: [1, 1.3, 1.5],
                      }}
                      transition={prefersReducedMotion ? undefined : {
                        repeat: Infinity,
                        duration: 1.5,
                        delay: 0.2,
                        ease: "easeOut"
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 rounded-full bg-red-400 blur-lg"
                    />
                  </>
                )}
              </AnimatePresence>
              <motion.button
                onPointerDown={onMicDown}
                onPointerUp={onMicUp}
                onPointerCancel={onMicCancel}
                onTouchStart={!supportsPointerEvents ? onMicDown : undefined}
                onTouchEnd={!supportsPointerEvents ? onMicUp : undefined}
                onMouseDown={!supportsPointerEvents ? onMicDown : undefined}
                onMouseUp={!supportsPointerEvents ? onMicUp : undefined}
                whileTap={{ scale: 0.95 }}
                disabled={!sttSupported}
                aria-label="マイクを押して話す"
                className={`p-5 sm:p-6 rounded-full transition-all select-none relative z-10 touch-none ${isListening
                  ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/40'
                  : 'bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10'
                  } ${!sttSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Mic size={28} className="sm:w-8 sm:h-8" />
              </motion.button>
            </motion.div>

            {/* Right: Save & Share */}
            <div className="flex-1 flex justify-start gap-3 sm:gap-4">
              <motion.button
                onClick={onSave}
                disabled={isSending || messages.length === 0 || isSummarizing}
                whileTap={{ scale: 0.95 }}
                title="要約して保存"
                aria-label="要約して保存"
                className={`p-3 sm:p-4 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10 transition-all ${isSending || messages.length === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                {isSummarizing ? (
                  <motion.div
                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                    transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 size={18} className="sm:w-6 sm:h-6" />
                  </motion.div>
                ) : (
                  <Download size={18} className="sm:w-6 sm:h-6" />
                )}
              </motion.button>
              <motion.button
                onClick={onShare}
                disabled={isSending || isSharing || messages.length === 0}
                whileTap={{ scale: 0.95 }}
                title="スマホに共有"
                aria-label="共有する"
                className={`p-3 sm:p-4 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10 transition-all ${isSending || messages.length === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                {isSharing ? (
                  <motion.div
                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                    transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 size={18} className="sm:w-6 sm:h-6" />
                  </motion.div>
                ) : (
                  <Share2 size={18} className="sm:w-6 sm:h-6" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
